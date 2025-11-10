import { useState, useRef, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEntriesContext } from "../context/EntriesContext";
import { setTitle } from "../lib/titleStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Edit, ExternalLink, Palette, Camera, User, Users, BookOpen, Image, Trash2, Star, X, ImageIcon, Images } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import type { Entry } from "@shared/schema";

interface EntryCardProps {
  entry: Entry;
}

export default function EntryCard({ entry }: EntryCardProps) {
  const { updateEntryTitle } = useEntriesContext();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingArtist, setIsEditingArtist] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isEditingKeywords, setIsEditingKeywords] = useState(false);
  const [draft, setDraft] = useState(entry.title || "");
  const [artistDraft, setArtistDraft] = useState(entry.artist || "");
  const [tagsDraft, setTagsDraft] = useState("");
  const [keywordsDraft, setKeywordsDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [customArtist, setCustomArtist] = useState<string | null>(null);
  const [customTags, setCustomTags] = useState<string[] | null>(null);
  const [customKeywords, setCustomKeywords] = useState<string[] | null>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [currentKeywords, setCurrentKeywords] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rating, setRating] = useState<number | null>((entry as any).rating || null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isImageRevealed, setIsImageRevealed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing custom data from entry
  useEffect(() => {
    if ((entry as any).keywords && Array.isArray((entry as any).keywords)) {
      setCustomKeywords((entry as any).keywords);
    }
  }, [entry]);

  // Fetch all entries to get available tags for autocomplete
  const { data: allEntries } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
  });

  // Fetch tag emojis for all tags in this entry
  const tagNames = customTags || entry.tags || [];
  const { data: tagEmojisData } = useQuery({
    queryKey: ["/api/tag-emojis/bulk", tagNames],
    enabled: tagNames.length > 0,
    queryFn: async () => {
      const promises = tagNames.map(async (tagName) => {
        try {
          const response = await fetch(`/api/tag-emojis/${encodeURIComponent(tagName)}`);
          if (response.ok) {
            const data = await response.json();
            return { tagName, emoji: data.emoji };
          }
        } catch (error) {
          console.log(`No emoji found for tag: ${tagName}`);
        }
        return { tagName, emoji: null };
      });
      const results = await Promise.all(promises);
      return results.reduce((acc, { tagName, emoji }) => {
        if (emoji) acc[tagName] = emoji;
        return acc;
      }, {} as Record<string, string>);
    }
  });

  // Fetch keyword emojis for all keywords in this entry  
  const keywordNames = customKeywords || (entry as any).keywords || [];
  const { data: keywordEmojisData } = useQuery({
    queryKey: ["/api/keyword-emojis/bulk", keywordNames],
    enabled: keywordNames.length > 0,
    queryFn: async () => {
      const promises = keywordNames.map(async (keywordName: string) => {
        try {
          const response = await fetch(`/api/keyword-emojis/${encodeURIComponent(keywordName)}`);
          if (response.ok) {
            const data = await response.json();
            return { keywordName, emoji: data.emoji };
          }
        } catch (error) {
          console.log(`No emoji found for keyword: ${keywordName}`);
        }
        return { keywordName, emoji: null };
      });
      const results = await Promise.all(promises);
      return results.reduce((acc, { keywordName, emoji }) => {
        if (emoji) acc[keywordName] = emoji;
        return acc;
      }, {} as Record<string, string>);
    }
  });

  // Get all unique tags from all entries for autocomplete
  const allAvailableTags = useMemo(() => {
    if (!allEntries) return [];
    const tagSet = new Set<string>();
    allEntries.forEach(entry => {
      entry.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [allEntries]);

  // Get all unique artists from all entries for autocomplete
  const allAvailableArtists = useMemo(() => {
    if (!allEntries) return [];
    const artistSet = new Set<string>();
    allEntries.forEach(entry => {
      if (entry.artist && entry.artist.trim()) {
        artistSet.add(entry.artist);
      }
    });
    return Array.from(artistSet).sort();
  }, [allEntries]);

  // Get all unique keywords from all entries for autocomplete
  const allAvailableKeywords = useMemo(() => {
    if (!allEntries) return [];
    const keywordSet = new Set<string>();
    allEntries.forEach(entry => {
      if ((entry as any).keywords && Array.isArray((entry as any).keywords)) {
        (entry as any).keywords.forEach((keyword: string) => {
          if (keyword && keyword.trim()) {
            keywordSet.add(keyword.trim());
          }
        });
      }
    });
    return Array.from(keywordSet).sort();
  }, [allEntries]);

  // Filter suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    if (!tagsDraft.trim()) return [];
    return allAvailableTags.filter(tag => 
      tag.toLowerCase().includes(tagsDraft.toLowerCase()) &&
      !currentTags.includes(tag)
    ).slice(0, 5);
  }, [tagsDraft, allAvailableTags, currentTags]);

  // Filter artist suggestions based on current input
  const filteredArtistSuggestions = useMemo(() => {
    if (!artistDraft.trim()) return [];
    return allAvailableArtists.filter(artist => 
      artist.toLowerCase().includes(artistDraft.toLowerCase()) &&
      artist.toLowerCase() !== artistDraft.toLowerCase()
    ).slice(0, 5);
  }, [artistDraft, allAvailableArtists]);

  // Filter keyword suggestions based on current input
  const filteredKeywordSuggestions = useMemo(() => {
    if (!keywordsDraft.trim()) return [];
    return allAvailableKeywords.filter(keyword => 
      keyword.toLowerCase().includes(keywordsDraft.toLowerCase()) &&
      !currentKeywords.includes(keyword)
    ).slice(0, 5);
  }, [keywordsDraft, allAvailableKeywords, currentKeywords]);

  const handleEditStart = () => {
    if (isEditing) return;
    setIsEditing(true);
    setDraft(entry.title || "");
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setDraft(entry.title || "");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = draft.trim();
    if (!trimmedTitle) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Title cannot be empty",
      });
      return;
    }

    setIsSaving(true);

    try {
      await setTitle(entry.id, trimmedTitle);
      updateEntryTitle(entry.id, trimmedTitle);
      setIsEditing(false);

      // Invalidate entries cache to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: "Title saved successfully!",
      });
    } catch (error) {
      console.error('Error saving title:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Couldn't save title. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagsSave = async (tagsArray?: string[]) => {
    const finalTags = tagsArray || currentTags;

    setIsSaving(true);

    try {
      await apiRequest("POST", "/api/custom-entries", {
        entryId: entry.id,
        customTags: finalTags,
      });

      setCustomTags(finalTags);
      setIsEditingTags(false);
      setCurrentTags([]);
      setTagsDraft("");
      setShowSuggestions(false);

      // Invalidate entries cache to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: "Tags updated successfully!",
      });
    } catch (error) {
      console.error('Error saving tags:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update tags. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeywordsSave = async () => {
    setIsSaving(true);

    try {
      // Update the entry with new keywords
      const response = await fetch("/api/custom-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryId: entry.id,
          keywords: currentKeywords,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update keywords");
      }

      setCustomKeywords(currentKeywords);
      setIsEditingKeywords(false);
      setCurrentKeywords([]);
      setKeywordsDraft("");

      // Force refresh entries data
      await queryClient.refetchQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: "Keywords updated successfully!",
      });
    } catch (error) {
      console.error('Error saving keywords:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update keywords. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArtistSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedArtist = artistDraft.trim();
    if (!trimmedArtist) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Artist name cannot be empty",
      });
      return;
    }

    setIsSaving(true);

    try {
      await apiRequest("POST", "/api/custom-entries", {
        entryId: entry.id,
        customArtist: trimmedArtist,
      });

      setCustomArtist(trimmedArtist);
      setIsEditingArtist(false);
      setShowArtistSuggestions(false);

      // Invalidate entries cache to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: "Artist updated successfully!",
      });
    } catch (error) {
      console.error('Error saving artist:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Couldn't save artist. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Image must be smaller than 5MB",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { imageUrl } = await response.json();

      // Save the image URL to the database
      await apiRequest("POST", "/api/custom-entries", {
        entryId: entry.id,
        customImageUrl: imageUrl,
      });

      setCustomImage(imageUrl);

      // Invalidate entries cache to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: "Image uploaded successfully!",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Couldn't upload image. Please try again.",
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageStart = () => {
    setImageLoading(true);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);

    try {
      await apiRequest("DELETE", `/api/entries/${entry.id}`, {});

      // Invalidate entries cache to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: "Entry deleted successfully!",
      });
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Couldn't delete entry. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRating = async (newRating: number) => {
    try {
      await apiRequest("POST", "/api/custom-entries", {
        entryId: entry.id,
        rating: newRating,
      });

      setRating(newRating);

      // Invalidate entries cache to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: `Rated ${newRating} star${newRating !== 1 ? 's' : ''}!`,
      });
    } catch (error) {
      console.error('Error saving rating:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Couldn't save rating. Please try again.",
      });
    }
  };

  // Reset and load custom data when entry changes
  useEffect(() => {
    const loadCustomData = async () => {
      try {
        // Reset all custom state first to prevent previous entry data from persisting
        setCustomImage(null);
        setCustomArtist(null);
        setCustomTags(null);
        setCustomKeywords(null);
        setRating(null);
        setIsImageRevealed(false); // Reset blur overlay state
        setDraft(entry.title || "");
        setArtistDraft(entry.artist || "");
        
        // Load custom data for this entry
        const response = await fetch(`/api/custom-entries/${entry.id}`);
        if (response.ok) {
          const customData = await response.json();
          if (customData.customImageUrl) setCustomImage(customData.customImageUrl);
          if (customData.customArtist) setCustomArtist(customData.customArtist);
          if (customData.customTags) setCustomTags(customData.customTags);
          if (customData.keywords) setCustomKeywords(customData.keywords);
          if (customData.rating) setRating(customData.rating);
        }

        // Initialize keywords from entry data if not already set in custom data
        if ((entry as any).keywords && !customKeywords) {
          setCustomKeywords((entry as any).keywords);
        }
      } catch (error) {
        console.error('Error loading custom data:', error);
        // Reset state even on error to prevent stale data
        setCustomImage(null);
        setCustomArtist(null);
        setCustomTags(null);
        setCustomKeywords(null);
        setRating(null);
        setIsImageRevealed(false);
        setDraft(entry.title || "");
        setArtistDraft(entry.artist || "");
      }
    };

    loadCustomData();
  }, [entry.id]);

  const displayTitle = entry.title || "Untitled";
  const displayImage = customImage || entry.imageUrl || '/placeholder.jpg';
  const displayArtist = customArtist || entry.artist;

  const isComic = entry.type === 'comic';
  const isSequence = entry.type === 'sequence';
  const isStory = entry.type === 'story';
  const TypeIcon = isComic ? BookOpen : (isSequence ? Images : (isStory ? BookOpen : Image));
  const typeBorderColor = isComic ? 'border-l-orange-500' : (isSequence ? 'border-l-purple-500' : (isStory ? 'border-l-green-500' : 'border-l-indigo-500'));

  return (
    <article className={`bg-white rounded-xl shadow-lg overflow-hidden mb-6 animate-slide-up border-l-4 ${typeBorderColor}`}>
      {/* Card Image */}
      <div className="relative group">
        <img 
          src={displayImage} 
          alt={displayTitle}
          className={`w-full h-56 object-cover transition-all duration-300 ${
            !isImageRevealed ? 'blur-md grayscale' : ''
          }`}
          onLoadStart={handleImageStart}
          onLoad={handleImageLoad}
          onError={handleImageLoad}
        />

        {/* Click-to-reveal overlay */}
        {!isImageRevealed && (
          <div 
            onClick={() => setIsImageRevealed(true)}
            className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center cursor-pointer hover:bg-opacity-10 transition-all duration-200"
          >
            <div className="bg-white bg-opacity-90 rounded-lg px-4 py-2 shadow-lg">
              <p className="text-sm font-medium text-gray-800">Click to reveal</p>
            </div>
          </div>
        )}

        {/* Re-blur button (appears on hover when image is revealed) */}
        {isImageRevealed && (
          <div 
            onClick={() => setIsImageRevealed(false)}
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <button className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs hover:bg-opacity-70 transition-all">
              Hide
            </button>
          </div>
        )}

        {/* Loading overlay for image */}
        {(imageLoading || isUploadingImage) && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
            {isUploadingImage && (
              <span className="ml-2 text-sm text-gray-600">Uploading...</span>
            )}
          </div>
        )}

        {/* Image upload button */}
        <div className="absolute top-2 right-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="secondary"
            className="bg-white/80 backdrop-blur hover:bg-white/90 text-gray-700"
            disabled={isUploadingImage}
          >
            <Camera size={14} />
          </Button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-3">
        {/* Title Section with Edit */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {!isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  {isStory ? (
                    <Link href={`/story/${entry.id}`}>
                      <h2 className="text-lg font-semibold text-slate-800 leading-tight hover:text-green-600 cursor-pointer transition-colors">
                        {displayTitle}
                      </h2>
                    </Link>
                  ) : (
                    <h2 className="text-lg font-semibold text-slate-800 leading-tight">
                      {displayTitle}
                    </h2>
                  )}
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                    isComic 
                      ? 'bg-orange-100 text-orange-700' 
                      : isSequence
                        ? 'bg-purple-100 text-purple-700'
                        : isStory
                          ? 'bg-green-100 text-green-700'
                          : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    <TypeIcon size={12} />
                    <span>{isComic ? 'Comic' : isSequence ? 'Sequence' : isStory ? 'Story' : 'Image'}</span>
                  </div>
                </div>
                <button 
                  onClick={handleEditStart}
                  className="text-indigo-600 text-sm hover:text-indigo-700 transition-colors duration-200 flex items-center space-x-1 focus-visible:focus"
                >
                  <Edit size={12} />
                  <span>Edit title</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Enter a title..."
                  className="text-sm"
                  autoFocus
                  disabled={isSaving}
                />
                <div className="flex space-x-2">
                  <Button 
                    type="submit" 
                    size="sm"
                    disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleEditCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>



        {/* Artist Information */}
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
                {(!entry.artist || entry.artist === "Unknown Artist") && (
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
                <form onSubmit={handleArtistSave} className="flex items-center space-x-2">
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
          {displayArtist && displayArtist !== "Unknown Artist" && !isEditingArtist && (
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

        {/* Tags */}
        <div className="flex flex-wrap gap-1 text-xs">
          {!isEditingTags ? (
            <div className="flex flex-wrap items-center gap-1">
              {(customTags || entry.tags)?.map((tag, index) => (
                <Link key={index} href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}>
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs hover:bg-indigo-100 hover:text-indigo-700 transition-colors duration-200 cursor-pointer inline-flex items-center gap-1">
                    {tagEmojisData?.[tag] && <span>{tagEmojisData[tag]}</span>}
                    {tag}
                  </span>
                </Link>
              ))}
              <button 
                onClick={() => {
                  setCurrentTags(customTags || entry.tags || []);
                  setTagsDraft("");
                  setIsEditingTags(true);
                }}
                className="text-indigo-600 hover:text-indigo-700 transition-colors duration-200 flex items-center space-x-1 text-xs focus-visible:focus"
              >
                <Edit size={10} />
                <span>Edit tags</span>
              </button>
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
                  onClick={() => handleTagsSave()}
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

        {/* Keywords */}
        <div className="flex flex-wrap gap-1 text-xs">
          {!isEditingKeywords ? (
            <div className="flex flex-wrap items-center gap-1">
              {(customKeywords || (entry as any).keywords)?.length > 0 && (
                (customKeywords || (entry as any).keywords).map((keyword: string, index: number) => (
                  <Link key={index} href={`/keyword/${encodeURIComponent(keyword.toLowerCase())}`}>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs hover:bg-blue-200 hover:text-blue-800 transition-colors duration-200 cursor-pointer inline-flex items-center gap-1">
                      {keywordEmojisData?.[keyword] && <span>{keywordEmojisData[keyword]}</span>}
                      {keyword}
                    </span>
                  </Link>
                ))
              )}
              <button 
                onClick={() => {
                  setCurrentKeywords(customKeywords || (entry as any).keywords || []);
                  setKeywordsDraft("");
                  setIsEditingKeywords(true);
                }}
                className="text-indigo-600 hover:text-indigo-700 transition-colors duration-200 flex items-center space-x-1 text-xs focus-visible:focus"
              >
                <Edit size={10} />
                <span>
                  {(customKeywords || (entry as any).keywords)?.length > 0 
                    ? "Edit keywords" 
                    : "Add keywords"
                  }
                </span>
              </button>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {/* Current Keywords as Removable Badges */}
              {currentKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {currentKeywords.map((keyword, index) => (
                    <Badge 
                      key={index}
                      variant="secondary" 
                      className="text-xs flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700"
                    >
                      <span>{keyword}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentKeywords(prev => prev.filter((_, i) => i !== index));
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

              {/* Add New Keyword Input with Autocomplete */}
              <div className="relative">
                <Input
                  value={keywordsDraft}
                  onChange={(e) => {
                    setKeywordsDraft(e.target.value);
                    setShowKeywordSuggestions(e.target.value.trim().length > 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (keywordsDraft.trim() && !currentKeywords.includes(keywordsDraft.trim())) {
                        setCurrentKeywords(prev => [...prev, keywordsDraft.trim()]);
                        setKeywordsDraft("");
                        setShowKeywordSuggestions(false);
                      }
                    }
                  }}
                  placeholder="Type to add a keyword..."
                  className="text-xs h-8"
                  autoFocus
                  disabled={isSaving}
                />

                {/* Autocomplete Suggestions */}
                {showKeywordSuggestions && filteredKeywordSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 mt-1">
                    {filteredKeywordSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          if (!currentKeywords.includes(suggestion)) {
                            setCurrentKeywords(prev => [...prev, suggestion]);
                          }
                          setKeywordsDraft("");
                          setShowKeywordSuggestions(false);
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

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button 
                onClick={async () => {
                  try {
                    setIsSaving(true);

                    // Add new keyword if there's text in the input
                    let updatedKeywords = [...currentKeywords];
                    if (keywordsDraft.trim()) {
                      const newKeywords = keywordsDraft.split(',').map(k => k.trim()).filter(k => k);
                      updatedKeywords = [...updatedKeywords, ...newKeywords];
                    }

                    // Update the entry with new keywords
                    const response = await fetch("/api/custom-entries", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        entryId: entry.id,
                        keywords: updatedKeywords,
                      }),
                    });

                    if (!response.ok) {
                      throw new Error("Failed to update keywords");
                    }

                    setCustomKeywords(updatedKeywords);
                    setIsEditingKeywords(false);
                    setKeywordsDraft("");

                    toast({
                      title: "Keywords updated",
                      description: "Keywords have been saved successfully."
                    });
                  } catch (error) {
                    console.error("Error saving keywords:", error);
                    toast({
                      title: "Error",
                      description: "Failed to save keywords",
                      variant: "destructive"
                    });
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
              >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setIsEditingKeywords(false);
                    setCurrentKeywords([]);
                    setKeywordsDraft("");
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

        {/* Star Rating */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                className="p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
              >
                <Star
                  size={16}
                  className={`transition-colors duration-200 ${
                    star <= (hoverRating || rating || 0)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300 hover:text-yellow-300'
                  }`}
                />
              </button>
            ))}
            {rating && (
              <span className="text-xs text-gray-500 ml-2">
{rating}/5
              </span>
            )}
          </div>
        </div>



        {/* Sequence Gallery Link */}
        {isSequence && entry.sequenceImages && entry.sequenceImages.length > 0 && (
          <div className="pt-2">
            <Link href={`/sequence/${entry.id}`}>
              <button className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-700 transition-colors duration-200 text-sm font-medium focus-visible:focus">
                <span>View Gallery ({entry.sequenceImages.length} images)</span>
                <Images size={12} />
              </button>
            </Link>
          </div>
        )}

        {/* External Link */}
        {entry.externalLink && (
          <div className="pt-2">
            <a 
              href={entry.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 transition-colors duration-200 text-sm font-medium focus-visible:focus"
            >
              <span>View original</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        {/* Delete Button */}
        <div className="pt-2 border-t border-gray-200">
          <Button 
            onClick={handleDelete}
            variant="outline"
            size="sm"
            disabled={isDeleting}
            className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 transition-colors duration-200"
          >
            <Trash2 size={14} className="mr-1" />
            {isDeleting ? "Deleting..." : "Delete Entry"}
          </Button>
        </div>

      </div>
    </article>
  );
}