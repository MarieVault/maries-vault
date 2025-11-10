import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "../lib/queryClient";
import { ArrowLeft, BookOpen, Copy, User, Calendar } from "lucide-react";
import { Entry } from "@shared/schema";

export default function StoryViewer() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/story/:id");
  const { toast } = useToast();
  const [story, setStory] = useState<Entry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (match && params?.id) {
      fetchStory(parseInt(params.id));
    }
  }, [match, params?.id]);

  const fetchStory = async (id: number) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("GET", `/api/entries/${id}`);
      const data = await response.json();
      
      if (data.type !== 'story') {
        setError("This entry is not a story.");
        return;
      }
      
      setStory(data);
    } catch (error) {
      console.error('Error fetching story:', error);
      setError("Failed to load story.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!story?.content) return;
    
    try {
      await navigator.clipboard.writeText(story.content);
      toast({
        title: "Copied",
        description: "Story copied to clipboard!",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy to clipboard.",
      });
    }
  };

  if (!match) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Home
        </Button>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Story Not Found</h2>
          <p className="text-gray-600">{error || "The requested story could not be loaded."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Home
        </Button>
        
        <div className="flex items-center space-x-3 mb-4">
          <BookOpen className="text-purple-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-900">{story.title}</h1>
        </div>
      </div>

      {/* Story Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{story.title}</CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
              >
                <Copy size={14} className="mr-1" />
                Copy
              </Button>
            </div>
          </div>
          
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <User size={16} />
              <span>{story.artist}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar size={16} />
              <span>Story</span>
            </div>
          </div>

          {/* Tags */}
          {story.tags && story.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {story.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {story.content ? (
            <div className="prose prose-gray max-w-none">
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-800">
                  {story.content}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="mx-auto mb-4 text-gray-300" size={48} />
              <p>No story content available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}