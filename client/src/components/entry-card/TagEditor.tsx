import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Edit, X } from "lucide-react";
import type { Entry } from "@shared/schema";

interface TagEditorProps {
  entry: Entry;
  isOwner: boolean;
  customTags: string[] | null;
  userTags: string[];
  tagEmojisData: Record<string, string> | undefined;
  isEditingTags: boolean;
  setIsEditingTags: (v: boolean) => void;
  tagsDraft: string;
  setTagsDraft: (v: string) => void;
  currentTags: string[];
  setCurrentTags: React.Dispatch<React.SetStateAction<string[]>>;
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  filteredSuggestions: string[];
  isSaving: boolean;
  onSave: (tags: string[]) => void;
}

export default function TagEditor({
  entry, isOwner, customTags, userTags, tagEmojisData, isEditingTags, setIsEditingTags,
  tagsDraft, setTagsDraft, currentTags, setCurrentTags, showSuggestions, setShowSuggestions,
  filteredSuggestions, isSaving, onSave,
}: TagEditorProps) {
  return (
        <div className="flex flex-wrap gap-1 text-xs">
          {!isEditingTags ? (
            <div className="flex flex-wrap items-center gap-1">
              {/* Display combined tags: use local state if edited, otherwise use entry.tags from API (which already combines custom_tags + user_tags) */}
              {(customTags ? [...customTags, ...userTags] : entry.tags)?.map((tag, index) => (
                <Link key={index} href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}>
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs hover:bg-indigo-100 hover:text-indigo-700 transition-colors duration-200 cursor-pointer inline-flex items-center gap-1">
                    {tagEmojisData?.[tag] && <span>{tagEmojisData[tag]}</span>}
                    {tag}
                  </span>
                </Link>
              ))}
              {isOwner && (
                <button
                  onClick={() => {
                    // When editing, combine custom_tags (or original tags) with user_tags so all displayed tags are editable
                    const baseTags = customTags || entry.originalTags || [];
                    const allEditableTags = [...baseTags, ...(userTags || [])];
                    setCurrentTags(allEditableTags);
                    setTagsDraft("");
                    setIsEditingTags(true);
                  }}
                  className="text-indigo-600 hover:text-indigo-700 transition-colors duration-200 flex items-center space-x-1 text-xs focus-visible:focus"
                >
                  <Edit size={10} />
                  <span>Edit tags</span>
                </button>
              )}
            </div>
          ) : (
            <div className="w-full space-y-3">
              {/* Current Tags as Removable Badges */}
              {currentTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {currentTags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs flex items-center gap-1 px-2 py-1"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTags(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="hover:text-red-600 ml-1"
                        disabled={isSaving}
                      >
                        <X size={10} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add New Tag Input with Autocomplete */}
              <div className="relative">
                <Input
                  value={tagsDraft}
                  onChange={(e) => {
                    setTagsDraft(e.target.value);
                    setShowSuggestions(e.target.value.trim().length > 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (tagsDraft.trim() && !currentTags.includes(tagsDraft.trim())) {
                        setCurrentTags(prev => [...prev, tagsDraft.trim()]);
                        setTagsDraft("");
                        setShowSuggestions(false);
                      }
                    }
                  }}
                  placeholder="Type to add a tag..."
                  className="text-xs h-8"
                  autoFocus
                  disabled={isSaving}
                />

                {/* Autocomplete Suggestions */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 mt-1">
                    {filteredSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          if (!currentTags.includes(suggestion)) {
                            setCurrentTags(prev => [...prev, suggestion]);
                          }
                          setTagsDraft("");
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        disabled={isSaving}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    // Include any text in the input field that hasn't been added yet
                    let finalTags = [...currentTags];
                    if (tagsDraft.trim() && !currentTags.includes(tagsDraft.trim())) {
                      finalTags.push(tagsDraft.trim());
                    }
                    onSave(finalTags);
                  }}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 h-7 px-2 text-xs"
                >
                  {isSaving ? "..." : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingTags(false);
                    setCurrentTags([]);
                    setTagsDraft("");
                    setShowSuggestions(false);
                  }}
                  disabled={isSaving}
                  className="h-7 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
  );
}
