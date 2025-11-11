# Tags and Keywords Merge Plan

## Executive Summary

Merge the separate tags and keywords systems into a unified tags system to eliminate redundancy and simplify the codebase.

## Current State Analysis

### Database Schema

#### Tags Storage
- **Location**: `entries` table and `custom_entries` table
- **entries.tags**: `text[]` - Array stored directly in the main entries table
- **custom_entries.custom_tags**: `text[]` - Optional override for custom tags
- **tag_emojis** table:
  - `id`: serial PRIMARY KEY
  - `tag_name`: text NOT NULL (unique)
  - `emoji`: text NOT NULL
  - `created_at`: timestamp

#### Keywords Storage
- **Location**: `custom_entries` table only
- **custom_entries.keywords**: `text[]` - Array field in custom_entries
- **keyword_emojis** table:
  - `id`: serial PRIMARY KEY
  - `keyword_name`: text NOT NULL (unique)
  - `emoji`: text NOT NULL
  - `created_at`: timestamp

### API Endpoints

#### Tags
- `GET /api/tags` - Aggregates all tags with counts and associated artists
- `GET /api/tag-emojis/batch?tags=tag1,tag2` - Batch fetch emojis
- `GET /api/tag-emojis/:tagName` - Get emoji for specific tag
- `POST /api/tag-emojis` - Create or update emoji

#### Keywords
- `GET /api/keyword-emojis/:keywordName` - Get emoji for specific keyword
- `POST /api/keyword-emojis` - Create or update emoji
- No dedicated `/api/keywords` endpoint (aggregated client-side)

### Frontend Components

#### Tags UI
- `/root/maries-vault-migration/maries-vault/client/src/pages/Tags.tsx` - Tags gallery
- `/root/maries-vault-migration/maries-vault/client/src/pages/TagPage.tsx` - Individual tag page
- Gray badges (bg-gray-100)
- Tag icon from lucide-react

#### Keywords UI
- `/root/maries-vault-migration/maries-vault/client/src/pages/Keywords.tsx` - Keywords gallery
- `/root/maries-vault-migration/maries-vault/client/src/pages/KeywordPage.tsx` - Individual keyword page
- Blue badges (bg-blue-100)
- BookOpen icon from lucide-react

#### Shared Entry Management
- `EntryCard.tsx` lines 776-903: Tags editing UI
- `EntryCard.tsx` lines 905-1082: Keywords editing UI
- `CreateEntry.tsx` lines 561-570: Tags input
- `CreateEntry.tsx` lines 572-613: Keywords input with autocomplete

### Key Differences

| Aspect | Tags | Keywords |
|--------|------|----------|
| **Storage** | Base entries + custom override | Only in custom_entries |
| **Purpose** | Content categorization/themes | Search context/title keywords |
| **API Endpoint** | Dedicated /api/tags | No server endpoint |
| **Default Source** | Entries always have base tags | Optional, no default |
| **Display Style** | Gray badge | Blue badge |
| **Icon** | Tag icon | BookOpen icon |
| **Navigation** | /tags and /tags/:tagName | /keywords and /keyword/:keyword |
| **Aggregation** | Server-side SQL | Client-side React |

## Why Merge Makes Sense

### Redundancy Issues
1. **Database**: Two separate text[] fields + two emoji tables
2. **API**: Duplicate endpoint logic for emojis
3. **Frontend**: Nearly identical pages (Tags.tsx vs Keywords.tsx)
4. **UI Components**: 130+ lines of duplicated editing code in EntryCard
5. **User Confusion**: Two very similar systems with subtle differences

### Benefits of Merging
1. **Simplified Mental Model**: One categorization system instead of two
2. **Reduced Code Duplication**: Eliminate ~500+ lines of redundant code
3. **Better Performance**: Single server-side aggregation instead of mixed approach
4. **Easier Maintenance**: One system to update, test, and debug
5. **Unified Search**: Tags work equally well for broad categories and specific keywords

## Migration Strategy

### Phase 1: Database Migration

#### Step 1: Create Migration to Merge Keywords into Tags
**File**: `migrations/XXXX_merge_keywords_into_tags.sql`

```sql
-- Merge keywords into custom_tags (or create custom_tags if null)
UPDATE custom_entries
SET custom_tags = COALESCE(custom_tags, ARRAY[]::text[]) ||
                  COALESCE(keywords, ARRAY[]::text[])
WHERE keywords IS NOT NULL AND array_length(keywords, 1) > 0;

-- Remove duplicates from merged tags
UPDATE custom_entries
SET custom_tags = ARRAY(SELECT DISTINCT unnest(custom_tags))
WHERE custom_tags IS NOT NULL;

-- For entries without custom_tags, merge keywords into base entry tags
UPDATE entries e
SET tags = COALESCE(e.tags, ARRAY[]::text[]) ||
           COALESCE(ce.keywords, ARRAY[]::text[])
FROM custom_entries ce
WHERE e.id = ce.entry_id
  AND ce.keywords IS NOT NULL
  AND array_length(ce.keywords, 1) > 0
  AND ce.custom_tags IS NULL;

-- Remove duplicates from base entry tags
UPDATE entries
SET tags = ARRAY(SELECT DISTINCT unnest(tags))
WHERE tags IS NOT NULL;
```

#### Step 2: Merge Emoji Tables
**File**: Same migration file

```sql
-- Merge keyword emojis into tag emojis (handle conflicts by keeping keyword emoji)
INSERT INTO tag_emojis (tag_name, emoji, created_at)
SELECT keyword_name, emoji, created_at
FROM keyword_emojis
ON CONFLICT (tag_name) DO UPDATE
SET emoji = EXCLUDED.emoji,
    created_at = EXCLUDED.created_at;

-- Drop keyword emojis table
DROP TABLE keyword_emojis;

-- Drop keywords column from custom_entries
ALTER TABLE custom_entries DROP COLUMN keywords;
```

### Phase 2: Backend Updates

#### Step 3: Update Schema
**File**: `shared/schema.ts`

- Remove `keywords` field from `customEntries` table definition (line 37)
- Remove `keywords` from `insertCustomEntrySchema` (around line 78-96)
- Remove `keywordEmojis` table definition (lines 49-54)
- Keep only `tagEmojis` table

#### Step 4: Update API Routes
**File**: `server/routes.ts`

- **Remove** keyword emoji endpoints (lines 637-705):
  - `GET /api/keyword-emojis/:keywordName`
  - `POST /api/keyword-emojis`
- Update `POST /api/custom-entries` to remove keywords parameter
- Update `POST /api/entries` to remove keywords parameter

**File**: `server/db-storage.ts`

- Remove keywords parameter from `updateCustomEntry` method (line 51)
- Remove keywords parameter from `createEntry` method

### Phase 3: Frontend Updates

#### Step 5: Merge EntryCard Editing UI
**File**: `client/src/components/EntryCard.tsx`

- Merge tags editing UI (lines 776-903) and keywords editing UI (lines 905-1082)
- Keep single tag editing interface
- Remove blue badge styling option
- Remove BookOpen icon references
- Update state management to handle single tags array

#### Step 6: Update CreateEntry Form
**File**: `client/src/pages/CreateEntry.tsx`

- Merge tags input (lines 561-570) and keywords input (lines 572-613)
- Keep single tag input with autocomplete
- Combine tag/keyword suggestions into unified list
- Update form submission to only include tags

#### Step 7: Remove Keywords Pages
**Files to delete**:
- `client/src/pages/Keywords.tsx`
- `client/src/pages/KeywordPage.tsx`

### Phase 4: Routing and Cleanup

#### Step 8: Add Route Redirects
**File**: `client/src/App.tsx`

```tsx
// Add redirects from old keyword routes to tag routes
<Route path="/keywords" element={<Navigate to="/tags" replace />} />
<Route path="/keyword/:keyword" element={<Navigate to="/tags/:keyword" replace />} />
```

Update existing routes (lines 31-35):
- Keep `/tags` and `/tags/:tagName` routes
- Remove `/keywords` and `/keyword/:keyword` routes

#### Step 9: Update Navigation
**File**: `client/src/pages/Home.tsx`

- Remove Keywords navigation link
- Keep only Tags navigation link

#### Step 10: Testing
- Verify all existing entries show merged tags
- Test tag editing in EntryCard
- Test tag input in CreateEntry form
- Verify tag emojis work correctly
- Test tag gallery page (/tags)
- Test individual tag pages (/tags/:tagName)
- Verify redirects from old keyword URLs work

## Files to be Modified

### Backend
1. `migrations/XXXX_merge_keywords_into_tags.sql` (NEW)
2. `shared/schema.ts` - Remove keywords field and table
3. `server/routes.ts` - Remove keyword emoji endpoints
4. `server/db-storage.ts` - Remove keywords parameters

### Frontend
5. `client/src/components/EntryCard.tsx` - Merge editing UI
6. `client/src/pages/CreateEntry.tsx` - Combine inputs
7. `client/src/pages/Keywords.tsx` - DELETE
8. `client/src/pages/KeywordPage.tsx` - DELETE
9. `client/src/App.tsx` - Update routes, add redirects
10. `client/src/pages/Home.tsx` - Remove Keywords link

## Potential Challenges

### 1. Data Migration Complexity
- **Challenge**: Merging keywords into tags without losing data or creating duplicates
- **Mitigation**: Use SQL DISTINCT and array operations to deduplicate automatically
- **Testing**: Verify migration on backup database first

### 2. Semantic Differences
- **Challenge**: Users may have used tags and keywords differently (broad vs specific)
- **Impact**: Merged system loses this distinction
- **Mitigation**: Tags work well for both purposes; unified system is simpler

### 3. Display Styling
- **Challenge**: Current blue/gray distinction helps visual organization
- **Impact**: All tags will look the same
- **Mitigation**: Could add optional tag categories/colors in future if needed

### 4. API Breaking Changes
- **Challenge**: External bookmarks or integrations using `/keywords` endpoints
- **Impact**: These links would break
- **Mitigation**: Add redirects from old routes to new routes

### 5. Autocomplete List Size
- **Challenge**: Combined tag list will be longer
- **Impact**: May be harder to find specific tags
- **Mitigation**: Existing autocomplete with filtering should handle this well

### 6. Backward Compatibility
- **Challenge**: Migration is one-way, can't easily rollback
- **Impact**: Need to be confident in migration before deploying
- **Mitigation**: Test thoroughly, keep database backup

## Key Decisions

### Before Starting Implementation

1. **Badge Styling**:
   - Option A: All tags use gray badges
   - Option B: Add optional color coding for former keywords
   - **Recommendation**: Option A (simplicity)

2. **Icon Choice**:
   - Option A: Keep Tag icon
   - Option B: Use new unified icon
   - **Recommendation**: Option A (Tag icon is standard)

3. **Migration Timing**:
   - Option A: Run automatically on deploy
   - Option B: Provide manual migration button for user review
   - **Recommendation**: Option A (with backup reminder)

4. **Emoji Conflicts**:
   - When same name exists in both emoji tables, which to keep?
   - **Recommendation**: Keep keyword emoji (in SQL ON CONFLICT clause)

## Implementation Order

1. Create and test database migration locally
2. Update backend schema and routes
3. Update frontend components (EntryCard, CreateEntry)
4. Remove Keywords pages
5. Add route redirects
6. Update navigation
7. Full end-to-end testing
8. Deploy with database backup

## Rollback Plan

If issues are discovered after deployment:

1. **Immediate**: Add route redirects back to restore old URLs
2. **Short-term**: Keep migration file in case we need to reference old logic
3. **Database**: Restore from backup taken before migration
4. **Code**: Git revert to commit before merge changes

## Success Criteria

- All existing tags and keywords are preserved (no data loss)
- Tag emojis work correctly for all merged tags
- All tag-related pages and functionality work as before
- No console errors or broken links
- Redirects from old keyword URLs work correctly
- Code is simpler with reduced duplication
