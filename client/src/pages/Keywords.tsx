import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Entry } from "@shared/schema";

interface KeywordData {
  name: string;
  count: number;
  entries: Entry[];
  artists: string[];
}

export default function Keywords() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("count");
  const [filterBy, setFilterBy] = useState<string>("all");

  const { data: allEntries, isLoading } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
    staleTime: 0, // Always consider data stale to force fresh fetches
  });

  // Process all keywords from entries
  const allKeywords = useMemo(() => {
    if (!allEntries) return [];

    const keywordMap = new Map<string, KeywordData>();

    allEntries.forEach(entry => {
      const entryKeywords = (entry as any).keywords || [];
      entryKeywords.forEach((keyword: string) => {
        if (!keyword || !keyword.trim()) return;

        const normalizedKeyword = keyword.toLowerCase().trim();

        if (!keywordMap.has(normalizedKeyword)) {
          keywordMap.set(normalizedKeyword, {
            name: keyword, // Keep original casing from first occurrence
            count: 0,
            entries: [],
            artists: []
          });
        }

        const keywordData = keywordMap.get(normalizedKeyword)!;
        keywordData.count++;
        keywordData.entries.push(entry);
        
        // Add unique artists
        if (entry.artist && !keywordData.artists.includes(entry.artist)) {
          keywordData.artists.push(entry.artist);
        }
      });
    });

    return Array.from(keywordMap.values());
  }, [allEntries]);

  // Fetch keyword emojis for all unique keywords
  const keywordNames = useMemo(() => allKeywords.map(keyword => keyword.name), [allKeywords]);
  const { data: keywordEmojisData } = useQuery({
    queryKey: ["/api/keyword-emojis/bulk", keywordNames],
    enabled: keywordNames.length > 0,
    queryFn: async () => {
      const promises = keywordNames.map(async (keywordName) => {
        try {
          const response = await fetch(`/api/keyword-emojis/${encodeURIComponent(keywordName)}`);
          if (response.ok) {
            const data = await response.json();
            return { keywordName, emoji: data.emoji };
          }
        } catch (error) {
          // Silently fail for keywords without emojis
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

  // Filter and sort keywords
  const filteredKeywords = useMemo(() => {
    if (!allKeywords) return [];

    let filtered = allKeywords;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(keyword =>
        keyword.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Count filter
    if (filterBy !== "all") {
      if (filterBy === "popular") {
        filtered = filtered.filter(keyword => keyword.count >= 5);
      } else if (filterBy === "rare") {
        filtered = filtered.filter(keyword => keyword.count <= 2);
      }
    }

    // Sort
    if (sortBy === "count") {
      filtered = [...filtered].sort((a, b) => b.count - a.count);
    } else if (sortBy === "alphabetical") {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "artists") {
      filtered = [...filtered].sort((a, b) => b.artists.length - a.artists.length);
    }

    return filtered;
  }, [allKeywords, searchTerm, sortBy, filterBy]);

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
          <h1 className="text-lg font-semibold">Keywords Gallery</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto">
        {/* Stats */}
        <div className="mb-6 p-4 bg-card rounded-xl shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <BookOpen className="text-primary" size={20} />
            <h2 className="text-lg font-semibold">Browse All Keywords</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <BookOpen size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">{allKeywords.length} unique keywords</span>
            </div>
            <div className="flex items-center space-x-2">
              <Filter size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">{filteredKeywords.length} showing</span>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search keywords..."
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
                <SelectItem value="all">All keywords</SelectItem>
                <SelectItem value="popular">Popular (5+)</SelectItem>
                <SelectItem value="rare">Rare (1-2)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredKeywords.length} of {allKeywords.length} keywords
          </p>
        </div>

        {/* Keywords Grid */}
        <div className="space-y-3">
          {filteredKeywords.length > 0 ? (
            filteredKeywords.map((keyword) => (
              <Link key={keyword.name} href={`/keyword/${encodeURIComponent(keyword.name.toLowerCase())}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-sm font-medium inline-flex items-center gap-1">
                            {keywordEmojisData?.[keyword.name] && <span>{keywordEmojisData[keyword.name]}</span>}
                            {keyword.name}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>{keyword.count} {keyword.count === 1 ? 'entry' : 'entries'}</span>
                          <span>•</span>
                          <span>{keyword.artists.length} {keyword.artists.length === 1 ? 'artist' : 'artists'}</span>
                        </div>
                        {keyword.artists.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">
                              Featured artists: {keyword.artists.slice(0, 3).join(", ")}
                              {keyword.artists.length > 3 && ` +${keyword.artists.length - 3} more`}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-2xl font-bold text-primary">
                          {keyword.count}
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
                <p className="text-muted-foreground mb-2">No keywords found</p>
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