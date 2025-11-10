import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, Filter } from "lucide-react";
import type { Entry } from "@shared/schema";

interface KeywordData {
  keyword: string;
  count: number;
  entries: Entry[];
}

export default function Titles() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("count");
  const [filterBy, setFilterBy] = useState<string>("all");

  const { data: allEntries, isLoading } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
    staleTime: 0, // Always consider data stale to force fresh fetches
  });

  // Process keywords from titles and user-added keywords (simplified)
  const allKeywords = useMemo(() => {
    if (!allEntries) return [];
    
    const keywordMap = new Map<string, Set<number>>();
    
    allEntries.forEach(entry => {
      // Extract keywords from user-added keywords field (highest priority)
      if ((entry as any).keywords && Array.isArray((entry as any).keywords)) {
        (entry as any).keywords.forEach((keyword: string) => {
          if (keyword && keyword.trim()) {
            const cleanKeyword = keyword.trim().toLowerCase();
            if (!keywordMap.has(cleanKeyword)) {
              keywordMap.set(cleanKeyword, new Set());
            }
            keywordMap.get(cleanKeyword)!.add(entry.id);
          }
        });
      }
      
      // Extract simple keywords from titles
      if (entry.title && entry.title !== "Untitled") {
        const cleanTitle = entry.title
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        const words = cleanTitle.split(/\s+/);
        const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'his', 'her', 'its', 'our', 'your', 'their', 'this', 'that', 'these', 'those'];
        
        // Extract single meaningful words (3+ characters, not stop words)
        words.forEach(word => {
          if (word.length > 2 && !stopWords.includes(word)) {
            if (!keywordMap.has(word)) {
              keywordMap.set(word, new Set());
            }
            keywordMap.get(word)!.add(entry.id);
          }
        });
        
        // Extract common 2-word phrases only
        for (let i = 0; i < words.length - 1; i++) {
          const word1 = words[i];
          const word2 = words[i + 1];
          
          if (word1.length > 2 && word2.length > 2 && 
              !stopWords.includes(word1) && !stopWords.includes(word2)) {
            const phrase = `${word1} ${word2}`;
            if (!keywordMap.has(phrase)) {
              keywordMap.set(phrase, new Set());
            }
            keywordMap.get(phrase)!.add(entry.id);
          }
        }
      }
    });

    // Convert to array and add counts
    const keywordsArray: KeywordData[] = Array.from(keywordMap.entries()).map(([keyword, entryIds]) => {
      const entries = allEntries.filter(entry => entryIds.has(entry.id));
      return {
        keyword,
        count: entryIds.size,
        entries,
      };
    });

    return keywordsArray;
  }, [allEntries]);

  // Simplified emoji system based on categories
  const getKeywordEmoji = (keyword: string): string => {
    const word = keyword.toLowerCase();
    
    // Category-based emoji assignment
    const categories = {
      people: ['girl', 'boy', 'woman', 'man', 'princess', 'prince', 'mother', 'father', 'sister', 'brother', 'friend', 'baby', 'child', 'teen', 'alien', 'nurse', 'doctor', 'chef'],
      emotions: ['love', 'heart', 'kiss', 'hug', 'smile', 'happy', 'sad', 'cry', 'angry', 'mad', 'cute', 'dream', 'sleep'],
      fantasy: ['magic', 'fairy', 'angel', 'witch', 'dragon', 'unicorn', 'crystal', 'star', 'moon', 'sun'],
      school: ['school', 'student', 'teacher', 'book', 'study', 'learn', 'class', 'homework', 'test', 'grade', 'science', 'math'],
      home: ['home', 'house', 'family', 'room', 'bed', 'kitchen', 'garden', 'pet', 'cat', 'dog', 'bird', 'fish'],
      food: ['cake', 'cookie', 'candy', 'chocolate', 'ice', 'cream', 'fruit', 'berry', 'sweet', 'tea', 'milk', 'juice'],
      activities: ['art', 'draw', 'paint', 'music', 'piano', 'guitar', 'sport', 'game', 'toy', 'doll', 'dance', 'sing', 'play'],
      nature: ['nature', 'tree', 'forest', 'beach', 'ocean', 'mountain', 'rain', 'snow', 'wind', 'storm', 'cloud', 'sunny', 'flower'],
      colors: ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'white', 'black', 'orange', 'gold', 'silver', 'rainbow'],
      adventure: ['adventure', 'journey', 'travel', 'explore', 'discover', 'mystery', 'secret', 'treasure', 'quest', 'rescue']
    };
    
    const categoryEmojis = {
      people: '👥',
      emotions: '💖',
      fantasy: '✨',
      school: '🏫',
      home: '🏠',
      food: '🍰',
      activities: '🎨',
      nature: '🌿',
      colors: '🎨',
      adventure: '🗺️'
    };
    
    // Check if keyword belongs to any category
    for (const [category, words] of Object.entries(categories)) {
      if (words.some(w => word.includes(w))) {
        return categoryEmojis[category as keyof typeof categoryEmojis];
      }
    }
    
    // Default emoji based on first letter
    const firstLetter = word.charAt(0);
    const letterEmojis = '🌟🎈🎪💎🌸🌺🌻🏠🍦💎🔑💝🌙🌃🌊🎀👑🌹⭐🎭☂️💐🌍✨🌈⚡';
    const index = firstLetter.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
    
    return letterEmojis[index] || '🔮';
  };

  // Filter and sort keywords
  const filteredKeywords = useMemo(() => {
    let filtered = allKeywords;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(item =>
        item.keyword.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      // If no search term, only show keywords with 2+ entries
      filtered = filtered.filter(item => item.count >= 2);
    }

    // Apply count filter
    if (filterBy === "common") {
      filtered = filtered.filter(item => item.count >= 3);
    } else if (filterBy === "rare") {
      filtered = filtered.filter(item => item.count === 1);
    }

    // Sort results
    if (sortBy === "count") {
      filtered.sort((a, b) => b.count - a.count);
    } else if (sortBy === "alphabetical") {
      filtered.sort((a, b) => a.keyword.localeCompare(b.keyword));
    }

    return filtered;
  }, [allKeywords, searchTerm, sortBy, filterBy]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading keywords...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <BookOpen className="text-indigo-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">Title Keywords</h1>
          </div>
          <Link href="/">
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Back to Gallery
            </button>
          </Link>
        </div>
        <p className="text-gray-600">
          Explore common words and phrases from entry titles in your collection
        </p>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Search keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex space-x-4">
          <Select value={filterBy} onValueChange={setFilterBy}>
            <SelectTrigger className="w-[140px]">
              <Filter size={16} />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Keywords</SelectItem>
              <SelectItem value="common">Common (3+)</SelectItem>
              <SelectItem value="rare">Unique (1)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">By Count</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{allKeywords.length}</div>
            <div className="text-sm text-gray-600">Total Keywords</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {allKeywords.filter(k => k.count >= 3).length}
            </div>
            <div className="text-sm text-gray-600">Common Words</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {filteredKeywords.length}
            </div>
            <div className="text-sm text-gray-600">Filtered Results</div>
          </CardContent>
        </Card>
      </div>

      {/* Keywords Grid - Compact Layout */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {filteredKeywords.map((keywordData) => (
          <Link key={keywordData.keyword} href={`/keyword/${encodeURIComponent(keywordData.keyword)}`}>
            <div className="bg-white hover:bg-gray-50 border border-gray-200 hover:border-indigo-300 rounded-lg p-3 transition-all duration-200 cursor-pointer group">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg group-hover:scale-110 transition-transform duration-200">
                  {getKeywordEmoji(keywordData.keyword)}
                </span>
                <span className="text-sm font-medium text-gray-900 truncate capitalize">
                  {keywordData.keyword}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs px-2 py-1">
                  {keywordData.count}
                </Badge>
                
                {/* Show top artist if available */}
                {keywordData.entries.length > 0 && keywordData.entries[0].artist && (
                  <span className="text-xs text-gray-500 truncate max-w-20">
                    {keywordData.entries[0].artist}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredKeywords.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500 text-lg">No keywords found</p>
          <p className="text-gray-400">Try adjusting your search or filter settings</p>
        </div>
      )}
    </div>
  );
}