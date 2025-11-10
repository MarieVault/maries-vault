import { useMemo, useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import EmojiPicker from "emoji-picker-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Smile, Edit } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import EntryCard from "../components/EntryCard";
import type { Entry } from "@shared/schema";

export default function KeywordPage() {
  const [match, params] = useRoute("/keyword/:keyword");
  const keyword = params?.keyword ? decodeURIComponent(params.keyword) : "";
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [keywordEmoji, setKeywordEmoji] = useState<string>("");
  const { toast } = useToast();

  const { data: allEntries, isLoading } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
    staleTime: 0,
  });

  const keywordEntries = useMemo(() => {
    if (!allEntries || !keyword) return [];

    return allEntries.filter(entry => {
      // Check if the keyword exists in the entry's keywords array
      const entryKeywords = (entry as any).keywords || [];
      return entryKeywords.some((entryKeyword: string) =>
        entryKeyword && entryKeyword.toLowerCase().trim() === keyword.toLowerCase().trim()
      );
    });
  }, [allEntries, keyword]);

  const keywordStats = useMemo(() => {
    if (!keywordEntries.length) return null;
    
    const artists = new Set(keywordEntries.map(entry => entry.artist));
    const tags = new Set(keywordEntries.flatMap(entry => entry.tags));
    
    return {
      totalEntries: keywordEntries.length,
      uniqueArtists: artists.size,
      uniqueTags: tags.size,
    };
  }, [keywordEntries]);

  // Find the actual case of the keyword from the entries for consistent display
  const displayKeywordName = useMemo(() => {
    if (!keyword) return "";
    
    // For keywords, we'll use the original case from the URL
    // (Keywords might not have the same case issues as tags)
    return keyword;
  }, [keyword]);

  // Fetch keyword emoji
  const { data: keywordEmojiData } = useQuery({
    queryKey: [`/api/keyword-emojis/${keyword}`],
    enabled: !!keyword,
  });

  // Load emoji when data changes
  useEffect(() => {
    if (keywordEmojiData?.emoji) {
      setKeywordEmoji(keywordEmojiData.emoji);
    }
  }, [keywordEmojiData]);

  // Handle emoji selection
  const handleEmojiSelect = async (emojiData: any) => {
    if (!keyword) return;
    
    try {
      const response = await fetch("/api/keyword-emojis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keywordName: displayKeywordName,
          emoji: emojiData.emoji,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save emoji");
      }

      setKeywordEmoji(emojiData.emoji);
      setShowEmojiPicker(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/keyword-emojis/${keyword}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      
      toast({
        title: "Success",
        description: `Emoji ${emojiData.emoji} added to keyword "${keyword}"!`,
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading entries...</p>
        </div>
      </div>
    );
  }

  if (!keyword) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-500">No keyword specified</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/keywords">
          <button className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 transition-colors duration-200 mb-4">
            <ArrowLeft size={20} />
            <span>Back to Keywords</span>
          </button>
        </Link>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="hover:scale-110 transition-transform duration-200 cursor-pointer"
              title={keywordEmoji ? "Click to change emoji" : "Click to add emoji"}
            >
              {keywordEmoji ? (
                <span className="text-3xl">{keywordEmoji}</span>
              ) : (
                <BookOpen className="text-indigo-600 hover:text-indigo-700" size={32} />
              )}
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Keyword: <span className="capitalize text-indigo-600">"{keyword}"</span>
              </h1>
              {!keywordEmoji && (
                <span className="text-xs text-gray-500 ml-2">← Click to add emoji</span>
              )}
            </div>
          </div>
          
          <div className="relative">
            {/* Secondary emoji button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 opacity-60 hover:opacity-100"
            >
              {keywordEmoji ? <Edit size={14} /> : <Smile size={14} />}
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
        
        {keywordStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-indigo-600">{keywordStats.totalEntries}</div>
                <div className="text-sm text-gray-600">
                  {keywordStats.totalEntries === 1 ? 'Entry' : 'Entries'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{keywordStats.uniqueArtists}</div>
                <div className="text-sm text-gray-600">
                  {keywordStats.uniqueArtists === 1 ? 'Artist' : 'Artists'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">{keywordStats.uniqueTags}</div>
                <div className="text-sm text-gray-600">
                  {keywordStats.uniqueTags === 1 ? 'Tag' : 'Tags'}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Entries Grid */}
      {keywordEntries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {keywordEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500 text-lg">No entries found with keyword "{keyword}"</p>
          <p className="text-gray-400">The keyword might not appear in any entry titles</p>
        </div>
      )}
    </div>
  );
}