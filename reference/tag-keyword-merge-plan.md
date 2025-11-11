# Tag & Keyword Merge Implementation Plan

**Date Created**: November 2, 2025
**Status**: In Progress - Phase 3
**Estimated Sessions**: 3-4
**Last Updated**: November 11, 2025

## Progress Tracker
- ✅ **Phase 1: Database Migration** - Completed (Nov 11, 2025)
  - Created migration file, added user_tags column
  - Migrated 61 keywords to user_tags
  - Merged 25 keyword emojis into tag_emojis
- ✅ **Phase 2: Backend API Updates** - Completed (Nov 11, 2025)
  - Updated schema.ts to add userTags field
  - Updated API routes to support userTags
  - Removed keyword emoji endpoints
  - Added backwards compatibility for keywords parameter
- ✅ **Phase 3: Frontend Components** - Completed (Nov 11, 2025)
  - Updated Entry interface with originalTags and userTags
  - Modified EntryCard to use userTags instead of keywords
  - Updated emoji fetching for unified tags
  - Display user tags with blue badges
  - Removed inline keywords editing UI
- 🔄 **Phase 4: Frontend Pages** - In Progress
- ⏳ **Phase 5: Search & Autocomplete** - Pending
- ⏳ **Phase 6: Cleanup & Deprecation** - Pending
- ⏳ **Phase 7: Testing & Rollback** - Pending

## Executive Summary

Merge the separate Tags and Keywords systems into a unified Tag system. This eliminates ~40% code duplication while improving performance and user experience.

---

## Current State Analysis

### Tags
- **Storage**: `entries.tags` (original) + `custom_entries.custom_tags` (override)
- **Logic**: `COALESCE(custom_tags, tags)` - complete replacement
- **API**: `/api/tags` with server-side aggregation & batch emoji fetching
- **Visual**: Gray badges
- **Purpose**: Content categorization

### Keywords
- **Storage**: `custom_entries.keywords` (user-added only)
- **Logic**: Always additive, no base values
- **API**: Client-side aggregation, individual emoji fetches (inefficient)
- **Visual**: Blue badges
- **Purpose**: Personal metadata

### Problems with Current System
1. **Nearly identical code** for two concepts that serve the same purpose
2. **Performance gap**: Keywords lack optimization
3. **User confusion**: Unclear when to use tags vs keywords
4. **Maintenance burden**: Duplicate emoji tables, API endpoints, UI components
5. **Feature parity issues**: Tags have optimizations that keywords lack

---

## Proposed Unified System

### Core Concept
**One unified "Tag" system with visual distinction between original and user-added tags**

- **Original Tags** (gray): From base `entries.tags`
- **User-Added Tags** (blue): From `custom_entries.user_tags`
- **Override Mode** (advanced): `custom_entries.custom_tags` replaces original completely

### Display Logic
```sql
-- Final tags shown to user:
COALESCE(custom_tags, tags) || COALESCE(user_tags, ARRAY[]::text[])

-- Translation:
-- If custom_tags exists: show custom_tags + user_tags
-- Otherwise: show original tags + user_tags
```

---

## Implementation Phases

## Phase 1: Database Schema Migration

**Estimated Time**: 1-2 hours
**Files**: `migrations/`, `shared/schema.ts`

### Tasks

#### 1.1: Create Migration File
```bash
# Create new migration
touch migrations/0002_merge_keywords_to_tags.sql
```

#### 1.2: Add user_tags Column
```sql
-- Add new column to custom_entries
ALTER TABLE custom_entries
ADD COLUMN user_tags text[] DEFAULT ARRAY[]::text[];
```

#### 1.3: Migrate Keyword Data
```sql
-- Copy all keywords to user_tags
UPDATE custom_entries
SET user_tags = keywords
WHERE keywords IS NOT NULL AND array_length(keywords, 1) > 0;
```

#### 1.4: Merge Emoji Tables
```sql
-- Copy keyword emojis to tag emojis (handle duplicates)
INSERT INTO tag_emojis (tag_name, emoji, created_at)
SELECT keyword_name, emoji, created_at
FROM keyword_emojis
ON CONFLICT (tag_name) DO NOTHING;

-- Drop keyword emoji table
DROP TABLE keyword_emojis;
```

#### 1.5: Keep keywords Column (Temporary)
```sql
-- Don't drop yet - keep for rollback safety
-- Mark as deprecated in schema
-- COMMENT ON COLUMN custom_entries.keywords IS 'DEPRECATED: Use user_tags instead';
```

### Schema Updates

**File**: `shared/schema.ts`

#### Update customEntries Table Definition
```typescript
export const customEntries = pgTable("custom_entries", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().references(() => entries.id),
  customImageUrl: text("custom_image_url"),
  customArtist: text("custom_artist"),
  customTags: text("custom_tags").array(), // Override mode
  userTags: text("user_tags").array().default(sql`ARRAY[]::text[]`), // NEW: User-added tags
  keywords: text("keywords").array(), // DEPRECATED: Keep for rollback
  rating: integer("rating"),
});
```

#### Update Zod Schemas
```typescript
export const insertCustomEntrySchema = createInsertSchema(customEntries, {
  customTags: z.array(z.string()).optional(),
  userTags: z.array(z.string()).optional(), // NEW
  keywords: z.array(z.string()).optional(), // DEPRECATED
});

// Add new type
export type CustomEntryWithUserTags = Omit<CustomEntry, 'keywords'> & {
  userTags?: string[];
};
```

#### Remove Keyword Emoji Schema
```typescript
// DELETE these:
export const keywordEmojis = pgTable(...);
export const insertKeywordEmojiSchema = ...;
export type KeywordEmoji = ...;
```

### Testing Checklist
- [ ] Migration runs without errors
- [ ] All keyword data copied to user_tags
- [ ] All keyword emojis visible in tag_emojis
- [ ] No data loss (verify counts)
- [ ] Rollback script tested

---

## Phase 2: Backend API Changes

**Estimated Time**: 2-3 hours
**Files**: `server/routes.ts`, `server/db-storage.ts`

### Tasks

#### 2.1: Update Entry Queries

**File**: `server/routes.ts:61-77`

```typescript
// OLD query (Line 68):
COALESCE(ce.custom_tags, e.tags) as tags

// NEW query:
COALESCE(ce.custom_tags, e.tags) || COALESCE(ce.user_tags, ARRAY[]::text[]) as tags,
ce.user_tags as user_added_tags,
e.tags as original_tags
```

**Purpose**: Return all three tag types so UI can distinguish them

#### 2.2: Update Tags Aggregation Endpoint

**File**: `server/routes.ts:135-164`

```typescript
// Update /api/tags to include user_tags in aggregation
const tagsQuery = `
  SELECT
    unnested_tag as name,
    COUNT(*) as count,
    ARRAY_AGG(DISTINCT COALESCE(ce.custom_artist, e.artist)) as artists,
    -- NEW: Track tag source
    bool_or(unnested_tag = ANY(e.tags)) as is_original,
    bool_or(unnested_tag = ANY(ce.user_tags)) as is_user_added
  FROM entries e
  LEFT JOIN custom_entries ce ON e.id = ce.entry_id
  CROSS JOIN unnest(
    COALESCE(ce.custom_tags, e.tags) || COALESCE(ce.user_tags, ARRAY[]::text[])
  ) AS unnested_tag
  GROUP BY unnested_tag
  ORDER BY count DESC
`;
```

#### 2.3: Update Custom Entry Endpoint

**File**: `server/routes.ts:394-429`

```typescript
// Update POST /api/custom-entries request validation
const customEntrySchema = z.object({
  entryId: z.number(),
  customImageUrl: z.string().url().optional(),
  customArtist: z.string().optional(),
  customTags: z.array(z.string()).optional(), // Override mode
  userTags: z.array(z.string()).optional(), // NEW: Additive tags
  keywords: z.array(z.string()).optional(), // DEPRECATED: Ignore or sync to userTags
  rating: z.number().min(1).max(5).optional(),
});

// In handler, if keywords provided, add to userTags for backwards compat
if (keywords && keywords.length > 0) {
  userTags = [...(userTags || []), ...keywords];
}
```

#### 2.4: Update Storage Layer

**File**: `server/db-storage.ts:51-71`

```typescript
async updateCustomEntry(
  entryId: number,
  updates: Partial<{
    customImageUrl: string;
    customArtist: string;
    customTags: string[];
    userTags: string[]; // NEW
    rating: number;
  }>
): Promise<CustomEntry | undefined> {
  // Update onConflictDoUpdate to include userTags
  return await this.db
    .insert(customEntries)
    .values({ entryId, ...updates })
    .onConflictDoUpdate({
      target: customEntries.entryId,
      set: {
        ...updates,
        // Only update fields that are provided
      },
    })
    .returning()
    .then((rows) => rows[0]);
}
```

#### 2.5: Remove Keyword Emoji Endpoints

**File**: `server/routes.ts:638-705`

```typescript
// DELETE these endpoints:
// GET /api/keyword-emojis/:keywordName
// POST /api/keyword-emojis

// All emoji operations now use /api/tag-emojis/*
```

### Testing Checklist
- [ ] GET /api/entries returns tags with source info
- [ ] GET /api/tags includes all tags (original + user-added)
- [ ] POST /api/custom-entries accepts userTags
- [ ] Tag emojis work for all tags
- [ ] Backwards compat: keywords param still works
- [ ] No keyword-emoji endpoints exist

---

## Phase 3: Frontend Components (Core)

**Estimated Time**: 3-4 hours
**Files**: `client/src/components/EntryCard.tsx`

### Tasks

#### 3.1: Update EntryCard State

**File**: `client/src/components/EntryCard.tsx`

```typescript
// Add new state variables
const [originalTags, setOriginalTags] = useState<string[]>(entry.original_tags || []);
const [userTags, setUserTags] = useState<string[]>(entry.user_added_tags || []);
const [overrideTags, setOverrideTags] = useState<string[]>(entry.custom_tags || []);
const [isOverrideMode, setIsOverrideMode] = useState(false);

// Computed: final displayed tags
const displayedTags = overrideTags.length > 0
  ? [...overrideTags, ...userTags]
  : [...originalTags, ...userTags];
```

#### 3.2: Redesign Tags Display Section

**Replace Lines 776-903**

```typescript
{/* Tags Section - Unified */}
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <span className="text-sm font-semibold text-gray-700">Tags</span>
    {!editingTags && (
      <button onClick={() => setEditingTags(true)}>
        <PencilIcon className="h-4 w-4" />
      </button>
    )}
  </div>

  {!editingTags ? (
    <div className="flex flex-wrap gap-1">
      {/* Original tags (gray) */}
      {(overrideTags.length === 0 ? originalTags : []).map((tag) => (
        <Link to={`/tags/${encodeURIComponent(tag)}`} key={tag}>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-800">
            {tagEmojis[tag] && <span>{tagEmojis[tag]}</span>}
            {tag}
          </span>
        </Link>
      ))}

      {/* Override tags (gray with indicator) */}
      {overrideTags.map((tag) => (
        <Link to={`/tags/${encodeURIComponent(tag)}`} key={tag}>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300">
            {tagEmojis[tag] && <span>{tagEmojis[tag]}</span>}
            {tag}
          </span>
        </Link>
      ))}

      {/* User-added tags (blue) */}
      {userTags.map((tag) => (
        <Link to={`/tags/${encodeURIComponent(tag)}`} key={tag}>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 hover:bg-blue-200 text-blue-800">
            {tagEmojis[tag] && <span>{tagEmojis[tag]}</span>}
            {tag}
          </span>
        </Link>
      ))}
    </div>
  ) : (
    <div className="space-y-2">
      {/* Edit Mode UI - see below */}
    </div>
  )}
</div>
```

#### 3.3: Redesign Edit Mode

```typescript
{/* Edit Mode */}
<div className="space-y-2">
  {/* Mode Toggle */}
  <div className="flex gap-2 text-xs">
    <button
      onClick={() => setIsOverrideMode(false)}
      className={`px-2 py-1 rounded ${!isOverrideMode ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
    >
      Add Tags
    </button>
    <button
      onClick={() => setIsOverrideMode(true)}
      className={`px-2 py-1 rounded ${isOverrideMode ? 'bg-gray-700 text-white' : 'bg-gray-200'}`}
    >
      Override All
    </button>
  </div>

  {/* Current Tags Display */}
  <div className="flex flex-wrap gap-1">
    {!isOverrideMode && (
      <>
        {/* Original tags (non-removable) */}
        {originalTags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
            {tagEmojis[tag]} {tag}
          </span>
        ))}

        {/* User tags (removable) */}
        {userTags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
            {tagEmojis[tag]} {tag}
            <button onClick={() => removeUserTag(tag)}>
              <XMarkIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </>
    )}

    {isOverrideMode && (
      <>
        {/* Override tags (all removable) */}
        {overrideTags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-800">
            {tagEmojis[tag]} {tag}
            <button onClick={() => removeOverrideTag(tag)}>
              <XMarkIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </>
    )}
  </div>

  {/* Autocomplete Input */}
  <TagAutocomplete
    allTags={allAvailableTags}
    onAdd={isOverrideMode ? addOverrideTag : addUserTag}
    excludeTags={isOverrideMode ? overrideTags : [...originalTags, ...userTags]}
  />

  {/* Help Text */}
  <p className="text-xs text-gray-500">
    {isOverrideMode
      ? "Override mode replaces all original tags. Use this to completely customize the tag list."
      : "Add your own tags. Original tags will remain visible."}
  </p>

  {/* Actions */}
  <div className="flex gap-2">
    <button onClick={handleSaveTags} className="px-3 py-1 bg-blue-500 text-white rounded">
      Save
    </button>
    <button onClick={handleCancelEdit} className="px-3 py-1 bg-gray-300 rounded">
      Cancel
    </button>
  </div>
</div>
```

#### 3.4: Update Save Handler

```typescript
const handleSaveTags = async () => {
  try {
    const response = await fetch(`/api/custom-entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: entry.id,
        customTags: isOverrideMode ? overrideTags : undefined,
        userTags: userTags,
      }),
    });

    if (response.ok) {
      setEditingTags(false);
      // Refresh entry data
    }
  } catch (error) {
    console.error("Failed to save tags:", error);
  }
};
```

#### 3.5: Remove Keywords Section

**DELETE Lines 905-1026** - entire keywords section

### Testing Checklist
- [ ] Original tags display in gray
- [ ] User-added tags display in blue
- [ ] Override mode shows different UI
- [ ] Add tags mode appends to user tags
- [ ] Override mode replaces all tags
- [ ] Tags save correctly
- [ ] No keywords section visible

---

## Phase 4: Frontend Pages (Gallery & Detail)

**Estimated Time**: 3-4 hours
**Files**: `client/src/pages/Tags.tsx`, `client/src/pages/TagPage.tsx`, routing

### Tasks

#### 4.1: Enhance Tags Gallery Page

**File**: `client/src/pages/Tags.tsx`

```typescript
// Add filter state
const [sourceFilter, setSourceFilter] = useState<'all' | 'original' | 'user'>('all');

// Update tag filtering
const filteredTags = useMemo(() => {
  return tags.filter((tag) => {
    // Apply source filter
    if (sourceFilter === 'original' && !tag.is_original) return false;
    if (sourceFilter === 'user' && !tag.is_user_added) return false;

    // Apply search, popularity filters...
    return true;
  });
}, [tags, sourceFilter, /* other filters */]);

// Add filter UI
<div className="flex gap-2 mb-4">
  <button
    onClick={() => setSourceFilter('all')}
    className={sourceFilter === 'all' ? 'active' : ''}
  >
    All Tags
  </button>
  <button
    onClick={() => setSourceFilter('original')}
    className={sourceFilter === 'original' ? 'active' : ''}
  >
    Original Tags
  </button>
  <button
    onClick={() => setSourceFilter('user')}
    className={sourceFilter === 'user' ? 'active' : ''}
  >
    My Tags
  </button>
</div>

// Update tag card display to show indicators
{tag.is_original && tag.is_user_added && (
  <span className="text-xs text-gray-500">(Original + Yours)</span>
)}
{tag.is_original && !tag.is_user_added && (
  <span className="text-xs text-gray-500">(Original)</span>
)}
{!tag.is_original && tag.is_user_added && (
  <span className="text-xs text-blue-500">(Your Tag)</span>
)}
```

#### 4.2: Update Tag Detail Page

**File**: `client/src/pages/TagPage.tsx`

```typescript
// Fetch tag source info
const [tagInfo, setTagInfo] = useState<{
  isOriginal: boolean;
  isUserAdded: boolean;
  entryCount: number;
  artistCount: number;
}>({});

// Display tag source badge
<div className="flex items-center gap-2">
  <h1 className="text-3xl font-bold">
    {emoji && <span className="text-5xl mr-2">{emoji}</span>}
    {tagName}
  </h1>

  {tagInfo.isOriginal && tagInfo.isUserAdded && (
    <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
      Original + User Tag
    </span>
  )}
  {tagInfo.isOriginal && !tagInfo.isUserAdded && (
    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
      Original Tag
    </span>
  )}
  {!tagInfo.isOriginal && tagInfo.isUserAdded && (
    <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
      Your Tag
    </span>
  )}
</div>
```

#### 4.3: Remove Keyword Pages

**DELETE Files**:
- `client/src/pages/Keywords.tsx`
- `client/src/pages/KeywordPage.tsx`

#### 4.4: Update Navigation

**File**: `client/src/App.tsx`

```typescript
// REMOVE keyword routes:
<Route path="/keywords" element={<Keywords />} />
<Route path="/keyword/:keyword" element={<KeywordPage />} />

// Keep only:
<Route path="/tags" element={<Tags />} />
<Route path="/tags/:tagName" element={<TagPage />} />
```

**File**: Navigation components (if any)

```typescript
// Remove "Keywords" nav link
// Keep only "Tags" nav link
```

#### 4.5: Update CreateEntry Form

**File**: `client/src/pages/CreateEntry.tsx`

```typescript
// REMOVE keywords input section (Lines 63-84 approximately)
// Keep only tags input
// Tags will be stored as base tags on entry creation
```

### Testing Checklist
- [ ] Tags gallery shows all tags
- [ ] Filter by source works (All/Original/My Tags)
- [ ] Tag page shows correct source badge
- [ ] No keyword pages accessible
- [ ] Navigation updated
- [ ] CreateEntry only has tags field

---

## Phase 5: Search & Autocomplete

**Estimated Time**: 1-2 hours
**Files**: `client/src/components/EntryCard.tsx`, search utilities

### Tasks

#### 5.1: Unified Autocomplete Component

**Create**: `client/src/components/TagAutocomplete.tsx`

```typescript
interface TagAutocompleteProps {
  allTags: Array<{ name: string; count: number; is_original?: boolean; is_user_added?: boolean }>;
  onAdd: (tag: string) => void;
  excludeTags: string[];
  placeholder?: string;
}

export function TagAutocomplete({ allTags, onAdd, excludeTags, placeholder }: TagAutocompleteProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<typeof allTags>([]);

  const updateSuggestions = (value: string) => {
    const filtered = allTags
      .filter((tag) =>
        tag.name.toLowerCase().includes(value.toLowerCase()) &&
        !excludeTags.includes(tag.name)
      )
      .sort((a, b) => {
        // Prioritize user's own tags, then popular tags
        if (a.is_user_added && !b.is_user_added) return -1;
        if (!a.is_user_added && b.is_user_added) return 1;
        return b.count - a.count;
      })
      .slice(0, 5);

    setSuggestions(filtered);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      onAdd(input.trim());
      setInput("");
      setSuggestions([]);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          updateSuggestions(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Add a tag..."}
        className="w-full px-3 py-2 border rounded"
      />

      {suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg">
          {suggestions.map((tag) => (
            <button
              key={tag.name}
              onClick={() => {
                onAdd(tag.name);
                setInput("");
                setSuggestions([]);
              }}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                {tag.name}
                {tag.is_user_added && (
                  <span className="text-xs text-blue-500">✓ Your tag</span>
                )}
              </span>
              <span className="text-xs text-gray-500">{tag.count} entries</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 5.2: Update EntryCard to Use New Component

**File**: `client/src/components/EntryCard.tsx`

```typescript
// Replace inline autocomplete with:
<TagAutocomplete
  allTags={allAvailableTags}
  onAdd={isOverrideMode ? addOverrideTag : addUserTag}
  excludeTags={isOverrideMode ? overrideTags : [...originalTags, ...userTags]}
  placeholder={isOverrideMode ? "Replace tags..." : "Add your tags..."}
/>
```

#### 5.3: Update Search/Filter Logic

**File**: Various search implementations

```typescript
// Update any search that filtered by keywords to search tags instead
// Update any keyword-specific filters to be tag filters

// Example in home page or search page:
const searchResults = entries.filter((entry) => {
  const allTags = [
    ...(entry.tags || []),
    ...(entry.user_added_tags || []),
  ];

  return allTags.some((tag) =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );
});
```

### Testing Checklist
- [ ] Autocomplete shows user's tags first
- [ ] Autocomplete shows popularity counts
- [ ] Search finds entries by all tag types
- [ ] No duplicate autocomplete code

---

## Phase 6: Cleanup & Deprecation

**Estimated Time**: 1 hour
**Files**: Multiple

### Tasks

#### 6.1: Remove Keyword-Related Code

**Search and remove references to:**
- `keywords` variable/state (replace with `userTags`)
- `keywordEmojis` (replace with `tagEmojis`)
- Keyword-specific API calls
- Keyword-specific utility functions

**Files to check:**
- All components in `client/src/components/`
- All pages in `client/src/pages/`
- `server/routes.ts`
- `server/db-storage.ts`

#### 6.2: Update Type Definitions

**File**: `shared/schema.ts`

```typescript
// Mark as deprecated (for now, eventual removal)
export type CustomEntry = {
  // ...
  /** @deprecated Use userTags instead */
  keywords?: string[];
  userTags?: string[];
};
```

#### 6.3: Add Migration Notice

**Create**: `client/src/components/MigrationNotice.tsx`

```typescript
export function MigrationNotice() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('keywords-migration-dismissed') === 'true'
  );

  if (dismissed) return null;

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-900">
            Keywords are now Tags! 🎉
          </h3>
          <p className="mt-1 text-sm text-blue-700">
            We've merged Keywords into Tags for a simpler experience. All your keywords
            have been preserved as user-added tags (shown in blue). You can now manage
            everything in one place!
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('keywords-migration-dismissed', 'true');
            setDismissed(true);
          }}
          className="ml-4 text-blue-500 hover:text-blue-700"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

**Add to main layout or home page**

#### 6.4: Update Documentation

**Update Files:**
- `README.md` - Update feature list
- `replit.md` - Update technical docs
- Any inline code comments

### Testing Checklist
- [ ] No references to "keywords" in UI
- [ ] No broken imports
- [ ] Migration notice displays once
- [ ] Documentation updated

---

## Phase 7: Testing & Rollback Plan

**Estimated Time**: 2-3 hours

### Pre-Deployment Testing

#### Database Tests
```sql
-- Verify migration
SELECT COUNT(*) FROM custom_entries WHERE keywords IS NOT NULL; -- Should equal user_tags count
SELECT COUNT(*) FROM tag_emojis; -- Should include old keyword emojis
SELECT COUNT(*) FROM keyword_emojis; -- Should error (table dropped)

-- Test query performance
EXPLAIN ANALYZE
SELECT unnested_tag as name, COUNT(*) as count
FROM entries e
LEFT JOIN custom_entries ce ON e.id = ce.entry_id
CROSS JOIN unnest(COALESCE(ce.custom_tags, e.tags) || COALESCE(ce.user_tags, ARRAY[]::text[])) AS unnested_tag
GROUP BY unnested_tag;
```

#### API Tests
- [ ] GET /api/entries returns correct tag data
- [ ] GET /api/tags returns all tags with source info
- [ ] POST /api/custom-entries saves userTags correctly
- [ ] POST /api/custom-entries saves customTags (override) correctly
- [ ] GET /api/tag-emojis/:tagName returns emoji for old keywords

#### UI Tests
- [ ] Entry cards display tags correctly (gray + blue)
- [ ] Edit mode works in both "Add" and "Override" modes
- [ ] Tags gallery filters by source
- [ ] Tag detail page shows correct info
- [ ] Autocomplete prioritizes user tags
- [ ] Emoji picker works for all tags
- [ ] Search finds entries by user tags

#### Edge Cases
- [ ] Entry with no tags
- [ ] Entry with only original tags
- [ ] Entry with only user tags
- [ ] Entry with override tags + user tags
- [ ] Entry with duplicate tags in different sources
- [ ] Very long tag names
- [ ] Special characters in tags
- [ ] Emoji-only tags

### Rollback Plan

**If issues arise, rollback in reverse order:**

#### Step 1: Revert Frontend (Quick)
```bash
git revert <commit-hash> # Revert UI changes
npm run build
pm2 restart marie-vault
```

#### Step 2: Revert API (Medium)
```bash
git revert <commit-hash> # Revert API changes
npm run build
pm2 restart marie-vault
```

#### Step 3: Revert Database (Slow - Last Resort)
```sql
-- Restore keyword_emojis table
CREATE TABLE keyword_emojis (
  id serial PRIMARY KEY,
  keyword_name text NOT NULL UNIQUE,
  emoji text NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Copy back from tag_emojis (if tracked separately)
-- This requires knowing which emojis were keywords originally

-- Restore keywords column
UPDATE custom_entries
SET keywords = user_tags
WHERE user_tags IS NOT NULL;

-- Remove user_tags column
ALTER TABLE custom_entries DROP COLUMN user_tags;
```

**Rollback Testing:**
- [ ] Test rollback on dev environment first
- [ ] Verify data integrity after rollback
- [ ] Document any data loss scenarios

---

## Success Metrics

### Code Metrics
- [ ] ~40% reduction in tag/keyword-related code
- [ ] Single emoji table instead of two
- [ ] Single gallery page instead of two
- [ ] Unified autocomplete component

### Performance Metrics
- [ ] Tag aggregation query time: < 100ms
- [ ] Page load time: No regression
- [ ] Emoji batch fetch: < 50ms for 100 tags

### User Experience Metrics
- [ ] No data loss for existing keywords
- [ ] All keyword emojis preserved
- [ ] Clear visual distinction between tag types
- [ ] Intuitive edit interface

---

## Post-Implementation Tasks

### Monitoring (Week 1)
- [ ] Monitor error logs for tag-related issues
- [ ] Check database query performance
- [ ] Watch for user feedback/confusion
- [ ] Verify data integrity (spot checks)

### Optimization (Week 2-4)
- [ ] Analyze tag usage patterns
- [ ] Add tag suggestions based on entry content
- [ ] Implement tag synonyms/aliases
- [ ] Add tag merging tool (for duplicates)

### Future Enhancements
- [ ] Tag hierarchies/categories
- [ ] Tag colors (user-customizable)
- [ ] Bulk tag operations
- [ ] Tag analytics dashboard
- [ ] AI-suggested tags based on image content

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | High | Test migration extensively, keep keywords column temporarily |
| User confusion about new system | Medium | Medium | Clear migration notice, intuitive UI, help text |
| Performance degradation | Low | Medium | Test queries, use indexes, batch operations |
| Rollback complexity | Medium | High | Document rollback steps, test rollback process |
| Breaking existing workflows | Medium | Medium | Backwards compatibility for keywords param |

---

## Timeline Estimate

| Phase | Time | Can Start After |
|-------|------|-----------------|
| Phase 1: Database | 1-2 hours | - |
| Phase 2: Backend | 2-3 hours | Phase 1 complete |
| Phase 3: EntryCard | 3-4 hours | Phase 2 complete |
| Phase 4: Pages | 3-4 hours | Phase 3 complete |
| Phase 5: Search | 1-2 hours | Phase 4 complete |
| Phase 6: Cleanup | 1 hour | Phase 5 complete |
| Phase 7: Testing | 2-3 hours | Phase 6 complete |
| **Total** | **13-19 hours** | **~3-4 sessions** |

---

## Next Steps

1. **Review this plan** - Make adjustments based on priorities
2. **Create database backup** - Before starting Phase 1
3. **Set up development branch** - `git checkout -b feature/merge-tags-keywords`
4. **Begin Phase 1** - Database migration
5. **Test after each phase** - Don't move forward with failures

---

## Notes & Considerations

### Design Decisions Made
- Keep `custom_tags` for override behavior (useful for corrections)
- Add `user_tags` for additive behavior (most common use case)
- Visual distinction via colors (gray = original, blue = user)
- Three-way merge logic: override || original + user

### Questions to Consider
- Should we auto-suggest tags based on title/artist?
- Should we allow tag renaming (affects all entries)?
- Should we track tag edit history?
- Should we add tag descriptions/wiki?

### Dependencies
- None external - all internal refactoring

### Breaking Changes
- Keyword API endpoints removed (backward compat via POST param)
- Keyword pages removed (redirect to tags?)
- `KeywordEmoji` type removed

---

**Last Updated**: November 2, 2025
**Author**: Claude Code
**Status**: Ready for Implementation
