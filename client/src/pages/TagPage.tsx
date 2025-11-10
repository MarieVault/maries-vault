import { useState, useMemo, useEffect } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import EmojiPicker from "emoji-picker-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Tag, Users, Image, Palette, Smile, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import EntryCard from "@/components/EntryCard";
import type { Entry } from "@shared/schema";

interface ArtistData {
  name: string;
  count: number;
  entries: Entry[];
}

export default function TagPage() {
  const { tagName } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [artistFilter, setArtistFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("random");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [tagEmoji, setTagEmoji] = useState<string>("");
  const { toast } = useToast();

  const { data: allEntries, isLoading } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
  });

  // Fetch tag emoji (server handles case-insensitive lookup)
  const { data: tagEmojiData } = useQuery({
    queryKey: [`/api/tag-emojis/${tagName}`],
    enabled: !!tagName,
  });

  // Load emoji when data changes
  useEffect(() => {
    if (tagEmojiData?.emoji) {
      setTagEmoji(tagEmojiData.emoji);
    }
  }, [tagEmojiData]);

  // Handle emoji selection
  const handleEmojiSelect = async (emojiData: any) => {
    if (!tagName) return;
    
    try {
      const response = await fetch("/api/tag-emojis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tagName: displayTagName, // Use the actual case for consistency
          emoji: emojiData.emoji,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save emoji");
      }

      setTagEmoji(emojiData.emoji);
      setShowEmojiPicker(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/tag-emojis/${tagName}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      
      toast({
        title: "Success",
        description: `Emoji ${emojiData.emoji} added to ${tagName}!`,
      });
    } catch (error) {
      console.error("Error saving emoji:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save emoji. Please try again.",
      });
    }
  };

  // Filter entries by the current tag
  const tagEntries = useMemo(() => {
    if (!allEntries || !tagName) return [];
    return allEntries.filter(entry => 
      entry.tags.some(tag => tag.toLowerCase() === tagName.toLowerCase())
    );
  }, [allEntries, tagName]);

  // Get artists who have work with this tag
  const artistsInTag = useMemo(() => {
    if (!tagEntries) return [];

    const artistMap = new Map<string, ArtistData>();

    tagEntries.forEach(entry => {
      const artistName = entry.artist || "Unknown Artist";
      
      if (!artistMap.has(artistName)) {
        artistMap.set(artistName, {
          name: artistName,
          count: 0,
          entries: []
        });
      }

      const artist = artistMap.get(artistName)!;
      artist.count++;
      artist.entries.push(entry);
    });

    return Array.from(artistMap.values()).sort((a, b) => b.count - a.count);
  }, [tagEntries]);

  // Apply filters and sorting
  const filteredEntries = useMemo(() => {
    if (!tagEntries) return [];

    let filtered = tagEntries;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.artist && entry.artist.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Artist filter
    if (artistFilter !== "all") {
      filtered = filtered.filter(entry =>
        entry.artist === artistFilter
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(entry =>
        entry.type === typeFilter
      );
    }

    // Sort
    if (sortBy === "random") {
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    } else if (sortBy === "artist") {
      filtered = [...filtered].sort((a, b) => 
        (a.artist || "Unknown Artist").localeCompare(b.artist || "Unknown Artist")
      );
    } else if (sortBy === "title") {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }

    return filtered;
  }, [tagEntries, searchTerm, artistFilter, sortBy]);

  // Find the actual case of the tag from the entries for consistent display
  const displayTagName = useMemo(() => {
    if (!tagName) return "";
    
    // If we have entries, find the actual case from the first entry
    if (tagEntries.length > 0) {
      for (const entry of tagEntries) {
        const foundTag = entry.tags.find(tag => tag.toLowerCase() === tagName.toLowerCase());
        if (foundTag) return foundTag; // Return the actual case (e.g., "TG")
      }
    }
    
    // Fallback to URL case with proper capitalization
    return tagName.charAt(0).toUpperCase() + tagName.slice(1);
  }, [tagName, tagEntries]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-12 px-4 max-w-md mx-auto">
            <Link href="/">
              <Button variant="ghost" size="sm" className="p-0">
                <ArrowLeft size={16} className="mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-lg font-semibold text-slate-800">Loading...</h1>
            <div className="w-16"></div>
          </div>
        </header>
        <main className="p-4 max-w-md mx-auto">
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!tagEntries.length) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-12 px-4 max-w-md mx-auto">
            <Link href="/">
              <Button variant="ghost" size="sm" className="p-0">
                <ArrowLeft size={16} className="mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-lg font-semibold text-slate-800">{displayTagName}</h1>
            <div className="w-16"></div>
          </div>
        </header>
        <main className="p-4 max-w-md mx-auto">
          <Card className="mt-6">
            <CardContent className="p-6 text-center">
              <Tag className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-gray-600 mb-2">No entries found for this tag</p>
              <p className="text-sm text-gray-500">
                This tag doesn't exist or has no associated artwork.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between h-12 px-4 max-w-md mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="p-0">
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-slate-800">{displayTagName}</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto">
        {/* Tag Stats */}
        <div className="mb-6 p-4 bg-white rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="hover:scale-110 transition-transform duration-200 cursor-pointer"
                title={tagEmoji ? "Click to change emoji" : "Click to add emoji"}
              >
                {tagEmoji ? (
                  <span className="text-2xl">{tagEmoji}</span>
                ) : (
                  <Tag className="text-indigo-600 hover:text-indigo-700" size={20} />
                )}
              </button>
              <h2 className="text-lg font-semibold text-gray-900">{displayTagName}</h2>
              {!tagEmoji && (
                <span className="text-xs text-gray-500 ml-2">← Click to add emoji</span>
              )}
            </div>
            <div className="relative">
              {/* Keep the button as a secondary option */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 opacity-60 hover:opacity-100"
              >
                {tagEmoji ? <Edit size={14} /> : <Smile size={14} />}
              </Button>
              
              {showEmojiPicker && (
                <>
                  {/* Backdrop to close picker when clicking outside */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowEmojiPicker(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 z-50">
                    <div className="relative">
                      <EmojiPicker
                        onEmojiClick={handleEmojiSelect}
                        width={280}
                        height={400}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowEmojiPicker(false)}
                        className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0 bg-white border-2 shadow-md"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Image size={14} className="text-gray-600" />
              <span className="text-gray-600">{tagEntries.length} {tagEntries.length === 1 ? 'entry' : 'entries'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Palette size={14} className="text-gray-600" />
              <span className="text-gray-600">{artistsInTag.length} {artistsInTag.length === 1 ? 'artist' : 'artists'}</span>
            </div>
          </div>
        </div>

        {/* Featured Artists */}
        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
            <Users size={16} className="text-indigo-600" />
            <span>Featured Artists</span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {artistsInTag.slice(0, 4).map(artist => (
              <Link key={artist.name} href={`/artist/${encodeURIComponent(artist.name)}`}>
                <div className="bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <p className="font-medium text-sm text-gray-900 truncate">{artist.name}</p>
                  <p className="text-xs text-gray-600">{artist.count} {artist.count === 1 ? 'entry' : 'entries'}</p>
                </div>
              </Link>
            ))}
          </div>
          {artistsInTag.length > 4 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              +{artistsInTag.length - 4} more artists
            </p>
          )}
        </div>

        {/* Search and Filters */}
        <div className="space-y-3 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search in this tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex space-x-2">
            <Select value={artistFilter} onValueChange={setArtistFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All Artists" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Artists</SelectItem>
                {artistsInTag.map(artist => (
                  <SelectItem key={artist.name} value={artist.name}>{artist.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both</SelectItem>
                <SelectItem value="comic">Comics</SelectItem>
                <SelectItem value="image">Images</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredEntries.length} of {tagEntries.length} entries
          </p>
        </div>

        {/* Featured Art */}
        <div className="space-y-6">
          {filteredEntries.length > 0 ? (
            filteredEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Search className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="text-gray-600 mb-2">No entries found</p>
                <p className="text-sm text-gray-500">
                  Try adjusting your search or filter criteria
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}