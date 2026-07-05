import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Palette, User, Edit } from "lucide-react";

interface ArtistEditorProps {
  isOwner: boolean;
  displayArtist: string;
  entryArtist: string;
  isEditingArtist: boolean;
  setIsEditingArtist: (v: boolean) => void;
  artistDraft: string;
  setArtistDraft: (v: string) => void;
  showArtistSuggestions: boolean;
  setShowArtistSuggestions: (v: boolean) => void;
  filteredArtistSuggestions: string[];
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ArtistEditor({
  isOwner, displayArtist, entryArtist, isEditingArtist, setIsEditingArtist,
  artistDraft, setArtistDraft, showArtistSuggestions, setShowArtistSuggestions,
  filteredArtistSuggestions, isSaving, onSubmit,
}: ArtistEditorProps) {
  return (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Palette className="text-indigo-600" size={14} />
            {!isEditingArtist ? (
              <div className="flex items-center space-x-2">
                {displayArtist && displayArtist !== "Unknown Artist" ? (
                  <Link href={`/artist/${encodeURIComponent(displayArtist)}`}>
                    <span className="hover:text-indigo-700 hover:underline transition-colors duration-200 cursor-pointer">
                      {displayArtist}
                    </span>
                  </Link>
                ) : (
                  <span>Unknown Artist</span>
                )}
                {isOwner && (!entryArtist || entryArtist === "Unknown Artist") && (
                  <button
                    onClick={() => setIsEditingArtist(true)}
                    className="text-indigo-600 hover:text-indigo-700 transition-colors duration-200 flex items-center space-x-1 focus-visible:focus"
                  >
                    <User size={12} />
                    <span className="text-xs">Add artist</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <form onSubmit={onSubmit} className="flex items-center space-x-2">
                  <div className="relative">
                    <Input
                      value={artistDraft}
                      onChange={(e) => {
                        setArtistDraft(e.target.value);
                        setShowArtistSuggestions(e.target.value.trim().length > 0);
                      }}
                      onFocus={() => setShowArtistSuggestions(artistDraft.trim().length > 0)}
                      onBlur={() => setTimeout(() => setShowArtistSuggestions(false), 150)}
                      placeholder="Enter artist name..."
                      className="text-xs h-7 w-32"
                      autoFocus
                      disabled={isSaving}
                    />
                    {showArtistSuggestions && filteredArtistSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-32 overflow-y-auto">
                        {filteredArtistSuggestions.map((artist, index) => (
                          <button
                            key={index}
                            type="button"
                            className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 transition-colors duration-150"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setArtistDraft(artist);
                              setShowArtistSuggestions(false);
                            }}
                          >
                            {artist}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
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
                      setIsEditingArtist(false);
                      setShowArtistSuggestions(false);
                    }}
                    disabled={isSaving}
                    className="h-7 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                </form>
              </div>
            )}
          </div>
          {isOwner && displayArtist && displayArtist !== "Unknown Artist" && !isEditingArtist && (
            <button
              onClick={() => {
                setArtistDraft(displayArtist);
                setIsEditingArtist(true);
              }}
              className="text-indigo-600 text-xs hover:text-indigo-700 transition-colors duration-200 flex items-center space-x-1 focus-visible:focus"
            >
              <Edit size={10} />
              <span>Edit</span>
            </button>
          )}
        </div>
  );
}
