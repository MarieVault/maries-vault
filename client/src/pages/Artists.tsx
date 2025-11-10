import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Users, Filter, Image } from "lucide-react";

interface ArtistData {
  name: string;
  count: number;
  tags: string[];
}

export default function Artists() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  const { data: artistsData, isLoading } = useQuery<ArtistData[]>({
    queryKey: ["/api/artists"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const allTags = useMemo(() => {
    if (!artistsData) return [];
    const tagSet = new Set<string>();
    artistsData.forEach(artist => {
      artist.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [artistsData]);

  const filteredArtists = useMemo(() => {
    if (!artistsData) return [];

    let filtered = artistsData;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(artist =>
        artist.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Tag filter
    if (tagFilter !== "all") {
      filtered = filtered.filter(artist =>
        artist.tags.includes(tagFilter)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "count":
          return b.count - a.count;
        default:
          return 0;
      }
    });

    return filtered;
  }, [artistsData, searchTerm, tagFilter, sortBy]);

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
            <h1 className="text-lg font-semibold text-slate-800">Artists</h1>
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
          <h1 className="text-lg font-semibold text-slate-800">Artists</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto">
        {/* Search and Filters */}
        <div className="space-y-3 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search artists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex space-x-2">
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="flex-1">
                <div className="flex items-center space-x-2">
                  <Filter size={14} />
                  <SelectValue placeholder="Filter by tag" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="count">Entry Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Found {filteredArtists.length} artist{filteredArtists.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Artists List */}
        <div className="space-y-3">
          {filteredArtists.map((artist) => (
            <Link key={artist.name} href={`/artist/${encodeURIComponent(artist.name)}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {artist.name}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Image size={14} />
                        <span>{artist.count} {artist.count === 1 ? 'entry' : 'entries'}</span>
                      </div>
                    </div>
                    <Users className="text-indigo-600" size={20} />
                  </div>

                {/* Tags */}
                {artist.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {artist.tags.slice(0, 5).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {artist.tags.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{artist.tags.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {filteredArtists.length === 0 && (
          <Card className="mt-6">
            <CardContent className="p-6 text-center">
              <Users className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-gray-600 mb-2">No artists found</p>
              <p className="text-sm text-gray-500">
                Try adjusting your search or filter criteria
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
