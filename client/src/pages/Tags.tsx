import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Tag, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface TagData {
  name: string;
  count: number;
  artists: string[];
}

export default function Tags() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("count");
  const [filterBy, setFilterBy] = useState<string>("all");

  const { data: allTags, isLoading } = useQuery<TagData[]>({
    queryKey: ["/api/tags"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch tag emojis for all unique tags in batch
  const tagNames = useMemo(() => allTags?.map(tag => tag.name) || [], [allTags]);
  const { data: tagEmojisData } = useQuery({
    queryKey: ["/api/tag-emojis/batch", tagNames.join(',')],
    enabled: tagNames.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    queryFn: async () => {
      const response = await fetch(`/api/tag-emojis/batch?tags=${tagNames.map(t => encodeURIComponent(t)).join(',')}`);
      if (response.ok) {
        return response.json();
      }
      return {};
    }
  });

  // Filter and sort tags
  const filteredTags = useMemo(() => {
    if (!allTags) return [];

    let filtered = [...allTags];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(tag =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Count filter
    if (filterBy !== "all") {
      if (filterBy === "popular") {
        filtered = filtered.filter(tag => tag.count >= 5);
      } else if (filterBy === "rare") {
        filtered = filtered.filter(tag => tag.count <= 2);
      }
    }

    // Sort
    if (sortBy === "count") {
      filtered.sort((a, b) => b.count - a.count);
    } else if (sortBy === "alphabetical") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "artists") {
      filtered.sort((a, b) => b.artists.length - a.artists.length);
    }

    return filtered;
  }, [allTags, searchTerm, sortBy, filterBy]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-background border-b shadow-sm">
          <div className="flex items-center justify-between h-12 px-4 max-w-md mx-auto">
            <Link href="/">
              <Button variant="ghost" size="sm" className="p-0">
                <ArrowLeft size={16} className="mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Loading...</h1>
            <div className="w-16"></div>
          </div>
        </header>
        <main className="p-4 max-w-md mx-auto">
          <div className="mt-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-card rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b shadow-sm">
        <div className="flex items-center justify-between h-12 px-4 max-w-md mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="p-0">
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Tags Gallery</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto">
        {/* Stats */}
        <div className="mb-6 p-4 bg-card rounded-xl shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <Tag className="text-primary" size={20} />
            <h2 className="text-lg font-semibold">Browse All Tags</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Tag size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">{allTags.length} unique tags</span>
            </div>
            <div className="flex items-center space-x-2">
              <Filter size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">{filteredTags.length} showing</span>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex space-x-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Most entries</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
                <SelectItem value="artists">Most artists</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                <SelectItem value="popular">Popular (5+)</SelectItem>
                <SelectItem value="rare">Rare (1-2)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredTags.length} of {allTags.length} tags
          </p>
        </div>

        {/* Tags Grid */}
        <div className="space-y-3">
          {filteredTags.length > 0 ? (
            filteredTags.map((tag) => (
              <Link key={tag.name} href={`/tags/${encodeURIComponent(tag.name.toLowerCase())}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="text-sm font-medium inline-flex items-center gap-1">
                            {tagEmojisData?.[tag.name] && <span>{tagEmojisData[tag.name]}</span>}
                            {tag.name}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>{tag.count} {tag.count === 1 ? 'entry' : 'entries'}</span>
                          <span>•</span>
                          <span>{tag.artists.length} {tag.artists.length === 1 ? 'artist' : 'artists'}</span>
                        </div>
                        {tag.artists.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">
                              Featured artists: {tag.artists.slice(0, 3).join(", ")}
                              {tag.artists.length > 3 && ` +${tag.artists.length - 3} more`}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-2xl font-bold text-primary">
                          {tag.count}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Search className="mx-auto text-muted-foreground mb-3" size={32} />
                <p className="text-muted-foreground mb-2">No tags found</p>
                <p className="text-sm text-muted-foreground">
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