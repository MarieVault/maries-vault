import { useState, useRef, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEntriesContext } from "../context/EntriesContext";
import { useAuth } from "../context/AuthContext";
import { setTitle } from "../lib/titleStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Edit, BookOpen, Image, Images, Film, Lock } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import SaveButton from "./SaveButton";
import { useBlur } from "../context/BlurContext";
import type { Entry } from "@shared/schema";
import EntryImage from "./entry-card/EntryImage";
import StarRating from "./entry-card/StarRating";
import EntryLinks from "./entry-card/EntryLinks";
import EntryActionsBar from "./entry-card/EntryActionsBar";
import ArtistEditor from "./entry-card/ArtistEditor";
import TagEditor from "./entry-card/TagEditor";

interface EntryCardProps {
  entry: Entry;
  showOrigin?: boolean;
}

export default function EntryCard({ entry, showOrigin = false }: EntryCardProps) {
  const { updateEntryTitle } = useEntriesContext();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  // Ownership & role checks
  const isOwner = isAuthenticated && user?.id === (entry as any).userId;
  const isAdmin = isAuthenticated && user?.role === 'admin';
  const { blurEnabled } = useBlur();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingArtist, setIsEditingArtist] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [draft, setDraft] = useState(entry.title || "");
  const [artistDraft, setArtistDraft] = useState(entry.artist || "");
  const [tagsDraft, setTagsDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [customArtist, setCustomArtist] = useState<string | null>(null);
  const [customTags, setCustomTags] = useState<string[] | null>(null);
  const [userTags, setUserTags] = useState<string[]>(entry.userTags || []);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rating, setRating] = useState<number | null>(entry.userRating ?? null);
  const [isImageRevealed, setIsImageRevealed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing custom data from entry
  useEffect(() => {
    if (entry.userTags && Array.isArray(entry.userTags)) {
      setUserTags(entry.userTags);
    }
  }, [entry]);

  // Fetch all entries to get available tags for autocomplete
  const { data: allEntries } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
  });

  // Fetch tag emojis for all tags in this entry (original + user tags)
  const allTags = [
    ...(customTags || entry.originalTags || entry.tags || []),
    ...(userTags || [])
  ];
  const uniqueTags = [...new Set(allTags)]; // Remove duplicates

  const { data: tagEmojisData } = useQuery({
    queryKey: ["/api/tag-emojis/batch", uniqueTags],
    enabled: uniqueTags.length > 0,
    queryFn: async () => {
      // One batched request per card instead of one fetch per tag.
      const res = await fetch(`/api/tag-emojis/batch?tags=${uniqueTags.map(encodeURIComponent).join(",")}`);
      if (!res.ok) return {} as Record<string, string>;
      return (await res.json()) as Record<string, string>;
    }
  });

  // Get all unique tags from all entries for autocomplete (includes both original and user tags)
  const allAvailableTags = useMemo(() => {
    if (!allEntries) return [];
    const tagSet = new Set<string>();
    allEntries.forEach(entry => {
      // Add all combined tags
      if (entry.tags) entry.tags.forEach(tag => tagSet.add(tag));
      // Also add user tags separately if they exist
      if (entry.userTags) entry.userTags.forEach(tag => tagSet.add(tag));
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

  // Filter tag suggestions based on current input
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
      // Save all tags as customTags and clear userTags (since we now edit them together)
      await apiRequest("POST", "/api/custom-entries", {
        entryId: entry.id,
        customTags: finalTags,
        userTags: [], // Clear userTags since all tags are now in customTags
      });

      setCustomTags(finalTags);
      setUserTags([]); // Clear local userTags state
      setIsEditingTags(false);
      setCurrentTags([]);
      setTagsDraft("");
      setShowSuggestions(false);

      // Invalidate caches to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });

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

  const [isArchiving, setIsArchiving] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    (entry.visibility === 'private' ? 'private' : 'public')
  );

  useEffect(() => {
    setVisibility(entry.visibility === 'private' ? 'private' : 'public');
  }, [entry.id, entry.visibility]);

  const handleVisibilityToggle = async () => {
    if (!isOwner) return;
    const next = visibility === 'private' ? 'public' : 'private';
    setIsTogglingVisibility(true);
    try {
      await apiRequest("PATCH", `/api/entries/${entry.id}/visibility`, { visibility: next });
      setVisibility(next);
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/myvault"] });
      toast({
        title: next === 'private' ? "Now private" : "Now public",
        description: next === 'private'
          ? "Only you can see this entry."
          : "Visible in the global feed.",
      });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Couldn't update visibility." });
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleArchive = async (archive: boolean) => {
    setIsArchiving(true);
    try {
      await apiRequest("PATCH", `/api/entries/${entry.id}/archive`, { archived: archive });
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: [`/api/artists/${encodeURIComponent(entry.artist)}/entries`] });
      toast({
        title: archive ? "Archived" : "Unarchived",
        description: archive ? "Entry moved to archive." : "Entry restored to vault.",
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Couldn't update archive status." });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRating = async (newRating: number) => {
    if (!isAuthenticated) return;
    try {
      if (newRating === rating) {
        // clicking same star = clear rating
        await fetch(`/api/ratings/${entry.id}`, { method: 'DELETE', credentials: 'include' });
        setRating(null);
        toast({ title: "Rating cleared" });
      } else {
        await fetch(`/api/ratings/${entry.id}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: newRating }),
        });
        setRating(newRating);
        toast({ title: `Rated ${newRating} star${newRating !== 1 ? 's' : ''}!` });
      }
    } catch {
      toast({ variant: "destructive", title: "Couldn't save rating" });
    }
  };

  // Reset optimistic overrides when the entry changes. All display data
  // (image/artist/tags/userRating) is already hydrated into the entry prop by
  // the feed query, so no per-card /api/custom-entries or /api/ratings fetch is
  // needed — display falls back to entry.* and rating seeds from userRating.
  useEffect(() => {
    setCustomImage(null);
    setCustomArtist(null);
    setCustomTags(null);
    setUserTags(entry.userTags || []);
    setRating(entry.userRating ?? null);
    setIsImageRevealed(false);
    setDraft(entry.title || "");
    setArtistDraft(entry.artist || "");
  }, [entry.id]);

  const displayTitle = entry.title || "Untitled";
  const nativeTitle = (entry as any).nativeTitle || "";
  const displayImage = customImage || entry.imageUrl || '/placeholder.jpg';
  const displayArtist = customArtist || entry.artist;

  const isComic = entry.type === 'comic';
  const isSequence = entry.type === 'sequence';
  const isStory = entry.type === 'story';
  const isVideo = entry.type === 'video';
  const TypeIcon = isComic ? BookOpen : (isSequence ? Images : (isStory ? BookOpen : (isVideo ? Film : Image)));
  const typeBorderColor = isComic ? 'border-l-orange-500' : (isSequence ? 'border-l-purple-500' : (isStory ? 'border-l-green-500' : (isVideo ? 'border-l-red-500' : 'border-l-indigo-500')));

  return (
    <article className={`bg-white rounded-xl shadow-lg overflow-hidden mb-6 animate-slide-up border-l-4 ${typeBorderColor}`}>
      {/* Card Image */}
      <EntryImage
        displayImage={displayImage}
        displayTitle={displayTitle}
        blurEnabled={blurEnabled}
        isImageRevealed={isImageRevealed}
        setIsImageRevealed={setIsImageRevealed}
        imageLoading={imageLoading}
        isUploadingImage={isUploadingImage}
        isOwner={isOwner}
        fileInputRef={fileInputRef}
        onImageUpload={handleImageUpload}
        onImageStart={handleImageStart}
        onImageLoad={handleImageLoad}
      />

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
                  {nativeTitle && (
                    <p className="text-sm text-gray-400 mt-0.5">{nativeTitle}</p>
                  )}
                  <div className="flex items-center gap-1">
                    {!isOwner && <SaveButton entryId={entry.id} showLabel />}
                    {isOwner && visibility === 'private' && (
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700"
                        title="Private — only visible to you"
                      >
                        <Lock size={12} />
                        <span>Private</span>
                      </div>
                    )}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      isComic
                        ? 'bg-orange-100 text-orange-700'
                        : isSequence
                          ? 'bg-purple-100 text-purple-700'
                          : isStory
                            ? 'bg-green-100 text-green-700'
                            : isVideo
                              ? 'bg-red-100 text-red-700'
                              : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      <TypeIcon size={12} />
                      <span>{isComic ? 'Comic' : isSequence ? 'Sequence' : isStory ? 'Story' : isVideo ? 'Video' : 'Image'}</span>
                      {showOrigin && (
                        isOwner
                          ? <span title="You added this" className="opacity-60">✏️</span>
                          : <span title="Saved from global feed" className="opacity-60">🔖</span>
                      )}
                    </div>
                  </div>
                </div>
                {isOwner && (
                  <button 
                    onClick={handleEditStart}
                    className="text-indigo-600 text-sm hover:text-indigo-700 transition-colors duration-200 flex items-center space-x-1 focus-visible:focus"
                  >
                    <Edit size={12} />
                    <span>Edit title</span>
                  </button>
                )}
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
        <ArtistEditor
          isOwner={isOwner}
          displayArtist={displayArtist}
          entryArtist={entry.artist}
          isEditingArtist={isEditingArtist}
          setIsEditingArtist={setIsEditingArtist}
          artistDraft={artistDraft}
          setArtistDraft={setArtistDraft}
          showArtistSuggestions={showArtistSuggestions}
          setShowArtistSuggestions={setShowArtistSuggestions}
          filteredArtistSuggestions={filteredArtistSuggestions}
          isSaving={isSaving}
          onSubmit={handleArtistSave}
        />

        {/* Tags */}
        <TagEditor
          entry={entry}
          isOwner={isOwner}
          customTags={customTags}
          userTags={userTags}
          tagEmojisData={tagEmojisData}
          isEditingTags={isEditingTags}
          setIsEditingTags={setIsEditingTags}
          tagsDraft={tagsDraft}
          setTagsDraft={setTagsDraft}
          currentTags={currentTags}
          setCurrentTags={setCurrentTags}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          filteredSuggestions={filteredSuggestions}
          isSaving={isSaving}
          onSave={handleTagsSave}
        />


        {/* Star Rating — logged-in users only */}
        {isAuthenticated && (
          <StarRating rating={rating} onRate={handleRating} />
        )}



        <EntryLinks entry={entry} displayImage={displayImage} />

        {/* Archive (any logged-in user) + Visibility (owner) + Delete (admin only) */}
        {isAuthenticated && (
          <EntryActionsBar
            entry={entry}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isArchiving={isArchiving}
            isTogglingVisibility={isTogglingVisibility}
            isDeleting={isDeleting}
            visibility={visibility}
            onArchive={handleArchive}
            onToggleVisibility={handleVisibilityToggle}
            onDelete={handleDelete}
          />
        )}

      </div>
    </article>
  );
}