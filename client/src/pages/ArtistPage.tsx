import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Search, Palette, Image, BookOpen, Tag, Plus, ExternalLink, X, Archive } from "lucide-react";
import EntryCard from "@/components/EntryCard";
import { apiRequest } from "@/lib/queryClient";
import type { Entry, ArtistLink } from "@shared/schema";

export default function ArtistPage() {
  const { artistName } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("random");
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived">("active");
  const [isAddLinkDialogOpen, setIsAddLinkDialogOpen] = useState(false);
  const [newLinkPlatform, setNewLinkPlatform] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  
  const queryClient = useQueryClient();

  // Stable random order - shuffle once when entries change
  const shuffledOrderRef = useRef<number[]>([]);

  const { data: artistEntries, isLoading } = useQuery<Entry[]>({
    queryKey: [`/api/artists/${encodeURIComponent(artistName || '')}/entries`],
    enabled: !!artistName,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch artist links
  const { data: artistLinks } = useQuery<ArtistLink[]>({
    queryKey: [`/api/artists/${encodeURIComponent(artistName || '')}/links`],
    enabled: !!artistName,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Add link mutation
  const addLinkMutation = useMutation({
    mutationFn: async (linkData: { platform: string; url: string }) => {
      const response = await fetch(`/api/artists/${encodeURIComponent(artistName!)}/links`, {
        method: "POST",
        body: JSON.stringify(linkData),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error('Failed to add link');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/artists/${encodeURIComponent(artistName!)}/links`] });
      setIsAddLinkDialogOpen(false);
      setNewLinkPlatform("");
      setNewLinkUrl("");
    },
  });

  // Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: number) => {
      const response = await fetch(`/api/artist-links/${linkId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error('Failed to delete link');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/artists/${encodeURIComponent(artistName!)}/links`] });
    },
  });

  // Generate stable random order when entries change
  useEffect(() => {
    if (artistEntries && artistEntries.length > 0) {
      shuffledOrderRef.current = artistEntries.map((_, i) => i).sort(() => Math.random() - 0.5);
    }
  }, [artistEntries]);

  // Get all unique tags for this artist
  const artistTags = useMemo(() => {
    if (!artistEntries) return [];
    const tagSet = new Set<string>();
    artistEntries.forEach(entry => {
      entry.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [artistEntries]);

  // Count entry types
  const typeStats = useMemo(() => {
    if (!artistEntries) return { comics: 0, images: 0, sequences: 0, stories: 0 };
    return artistEntries.reduce((acc, entry) => {
      if (entry.type === 'comic') acc.comics++;
      else if (entry.type === 'sequence') acc.sequences++;
      else if (entry.type === 'story') acc.stories++;
      else acc.images++;
      return acc;
    }, { comics: 0, images: 0, sequences: 0, stories: 0 });
  }, [artistEntries]);

  // Apply filters and sorting
  const filteredEntries = useMemo(() => {
    if (!artistEntries) return [];

    let filtered = artistEntries;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(entry =>
        entry.type === typeFilter
      );
    }

    // Tag filter
    if (tagFilter !== "all") {
      filtered = filtered.filter(entry =>
        entry.tags.includes(tagFilter)
      );
    }

    // Archive filter
    if (archiveFilter === "active") {
      filtered = filtered.filter(entry => !entry.archived);
    } else if (archiveFilter === "archived") {
      filtered = filtered.filter(entry => entry.archived);
    }

    // Sort
    if (sortBy === "random") {
      // Use stable shuffled order
      const orderMap = new Map(shuffledOrderRef.current.map((origIdx, newIdx) => [origIdx, newIdx]));
      filtered = [...filtered].sort((a, b) => {
        const aOrigIdx = artistEntries?.indexOf(a) ?? 0;
        const bOrigIdx = artistEntries?.indexOf(b) ?? 0;
        return (orderMap.get(aOrigIdx) ?? 0) - (orderMap.get(bOrigIdx) ?? 0);
      });
    } else if (sortBy === "title") {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "type") {
      filtered = [...filtered].sort((a, b) => a.type.localeCompare(b.type));
    }

    return filtered;
  }, [artistEntries, searchTerm, typeFilter, tagFilter, sortBy, archiveFilter]);

  const displayArtistName = artistName ? decodeURIComponent(artistName) : "";

  // Helper function to get platform favicon URL
  const getPlatformFavicon = (platform: string, url: string) => {
    const platformLower = platform.toLowerCase();
    
    // Try to extract domain from URL first
    let domain = '';
    try {
      domain = new URL(url).hostname;
    } catch {
      // If URL parsing fails, fall back to platform detection
    }
    
    if (domain.includes('deviantart.com') || platformLower.includes('deviantart')) {
      return 'https://www.deviantart.com/favicon.ico';
    } else if (domain.includes('twitter.com') || domain.includes('x.com') || platformLower.includes('twitter') || platformLower.includes('x')) {
      return 'https://x.com/favicon.ico';
    } else if (domain.includes('instagram.com') || platformLower.includes('instagram')) {
      return 'https://www.instagram.com/favicon.ico';
    } else if (domain.includes('pixiv.net') || platformLower.includes('pixiv')) {
      return 'https://www.pixiv.net/favicon.ico';
    } else if (domain.includes('tumblr.com') || platformLower.includes('tumblr')) {
      return 'https://www.tumblr.com/favicon.ico';
    } else if (domain.includes('artstation.com') || platformLower.includes('artstation')) {
      return 'https://www.artstation.com/favicon.ico';
    } else if (domain.includes('newgrounds.com') || platformLower.includes('newgrounds')) {
      return 'https://www.newgrounds.com/favicon.ico';
    } else if (domain.includes('furaffinity.net') || platformLower.includes('furaffinity')) {
      return 'https://www.furaffinity.net/favicon.ico';
    } else if (domain.includes('reddit.com') || platformLower.includes('reddit')) {
      return 'https://www.reddit.com/favicon.ico';
    } else if (domain.includes('youtube.com') || platformLower.includes('youtube')) {
      return 'https://www.youtube.com/favicon.ico';
    } else if (domain.includes('twitch.tv') || platformLower.includes('twitch')) {
      return 'https://www.twitch.tv/favicon.ico';
    } else if (domain) {
      // Generic favicon from any domain
      return `https://${domain}/favicon.ico`;
    } else {
      // Fallback to a generic link icon
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    }
  };

  const handleAddLink = () => {
    if (newLinkPlatform.trim() && newLinkUrl.trim()) {
      addLinkMutation.mutate({
        platform: newLinkPlatform.trim(),
        url: newLinkUrl.trim()
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-12 px-4 max-w-md mx-auto">
            <Link href="/artists">
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

  if (!artistEntries.length) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-12 px-4 max-w-md mx-auto">
            <Link href="/artists">
              <Button variant="ghost" size="sm" className="p-0">
                <ArrowLeft size={16} className="mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-lg font-semibold text-slate-800">{displayArtistName}</h1>
            <div className="w-16"></div>
          </div>
        </header>
        <main className="p-4 max-w-md mx-auto">
          <Card className="mt-6">
            <CardContent className="p-6 text-center">
              <Palette className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-gray-600 mb-2">No entries found for this artist</p>
              <p className="text-sm text-gray-500">
                This artist doesn't exist or has no associated artwork.
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
          <Link href="/artists">
            <Button variant="ghost" size="sm" className="p-0">
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-slate-800 truncate">{displayArtistName}</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto">
        {/* Artist Stats */}
        <div className="mb-6 p-4 bg-white rounded-xl shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <Palette className="text-indigo-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 truncate">{displayArtistName}</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div className="text-center">
              <div className="font-semibold text-gray-900">{artistEntries.length}</div>
              <div className="text-gray-600 text-xs">{artistEntries.length === 1 ? 'Entry' : 'Entries'}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-orange-600">{typeStats.comics}</div>
              <div className="text-gray-600 text-xs">{typeStats.comics === 1 ? 'Comic' : 'Comics'}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-indigo-600">{typeStats.images}</div>
              <div className="text-gray-600 text-xs">{typeStats.images === 1 ? 'Image' : 'Images'}</div>
            </div>
          </div>

          {/* Artist Links Section */}
          <div className="space-y-2">
            {artistLinks && artistLinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {artistLinks.map((link) => (
                  <div key={link.id} className="flex items-center">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                    >
                      <img 
                        src={getPlatformFavicon(link.platform, link.url)}
                        alt={`${link.platform} favicon`}
                        className="w-4 h-4"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="text-gray-700">{link.platform}</span>
                      <ExternalLink size={12} className="text-gray-500" />
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteLinkMutation.mutate(link.id)}
                      className="ml-1 p-1 h-6 w-6 hover:bg-red-100"
                    >
                      <X size={12} className="text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Links Button */}
            <Dialog open={isAddLinkDialogOpen} onOpenChange={setIsAddLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full mt-2">
                  <Plus size={16} className="mr-2" />
                  Add Links
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Artist Link</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Platform</label>
                    <Input
                      placeholder="e.g. DeviantArt, Twitter, Instagram"
                      value={newLinkPlatform}
                      onChange={(e) => setNewLinkPlatform(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">URL</label>
                    <Input
                      placeholder="https://"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleAddLink}
                      disabled={!newLinkPlatform.trim() || !newLinkUrl.trim() || addLinkMutation.isPending}
                      className="flex-1"
                    >
                      {addLinkMutation.isPending ? "Adding..." : "Add Link"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddLinkDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Popular Tags */}
        {artistTags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <Tag size={16} className="text-indigo-600" />
              <span>Popular Tags</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {artistTags.slice(0, 6).map(tag => (
                <Link key={tag} href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}>
                  <Badge variant="secondary" className="hover:bg-indigo-100 hover:text-indigo-700 transition-colors cursor-pointer">
                    {tag}
                  </Badge>
                </Link>
              ))}
              {artistTags.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{artistTags.length - 6} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="space-y-3 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search artist's work..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex space-x-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="comic">Comics</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="sequence">Sequences</SelectItem>
                <SelectItem value="story">Stories</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {artistTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>

            {/* Archive filter toggle */}
            <div className="flex rounded-md border border-input overflow-hidden text-xs">
              {(["active", "archived"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setArchiveFilter(v)}
                  className={`px-2 py-1.5 capitalize transition-colors ${
                    archiveFilter === v
                      ? "bg-amber-500 text-white"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {v === "archived" ? "archived" : v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredEntries.length} of {artistEntries.length} entries
            {archiveFilter === "archived" && <span className="ml-2 text-amber-600 font-medium">(archived only)</span>}
            {archiveFilter === "active" && artistEntries.filter(e => e.archived).length > 0 && (
              <span className="ml-2 text-muted-foreground">
                · {artistEntries.filter(e => e.archived).length} archived hidden
              </span>
            )}
          </p>
        </div>

        {/* Artist's Work */}
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