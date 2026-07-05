import { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "../lib/queryClient";
import { ArrowLeft, BookOpen, Copy, User, Calendar, List, ChevronRight } from "lucide-react";
import { Entry } from "@shared/schema";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''""]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractToc(markdown: string): TocItem[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    if (level === 1 && items.length === 0) continue; // skip title heading
    items.push({ id: slugify(text), text, level });
  }
  return items;
}

export default function StoryViewer() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/story/:id");
  const { toast } = useToast();
  const [story, setStory] = useState<Entry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToc, setShowToc] = useState(false);

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

  const tocItems = useMemo(() => {
    if (!story?.content) return [];
    return extractToc(story.content);
  }, [story?.content]);

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

  const hasToc = tocItems.length > 1;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
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

      {/* Cover Image */}
      {story.imageUrl && (
        <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
          <img
            src={story.imageUrl}
            alt={story.title}
            className="w-full max-h-96 object-cover"
          />
        </div>
      )}

      {/* Story Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl">{story.title}</CardTitle>
            <div className="flex space-x-2">
              {hasToc && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowToc(!showToc)}
                  className="lg:hidden"
                >
                  <List size={14} className="mr-1" />
                  {showToc ? 'Hide Contents' : 'Contents'}
                </Button>
              )}
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
            {story.content && (
              <div className="text-xs text-gray-400">
                {story.content.length.toLocaleString()} characters
              </div>
            )}
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
            <div className="flex gap-8">
              {/* Mobile TOC dropdown */}
              {hasToc && showToc && (
                <div className="lg:hidden w-full mb-4">
                  <nav className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                    <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Contents</h3>
                    {tocItems.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        onClick={() => setShowToc(false)}
                        className={`flex items-center text-sm py-1 hover:text-purple-600 transition-colors ${
                          item.level === 2 ? 'font-medium text-gray-800' : 
                          'text-gray-600 pl-3'
                        }`}
                      >
                        {item.level === 2 && <ChevronRight size={12} className="mr-1 flex-shrink-0 text-gray-400" />}
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </div>
              )}

              {/* Desktop TOC sidebar */}
              {hasToc && (
                <aside className="hidden lg:block w-52 flex-shrink-0">
                  <nav className="sticky top-24 space-y-0.5">
                    <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Contents</h3>
                    {tocItems.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={`block text-sm py-1 px-2 rounded hover:bg-purple-50 hover:text-purple-700 transition-colors ${
                          item.level === 2 ? 'font-medium text-gray-700' : 
                          'text-gray-500 pl-4 text-xs'
                        }`}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </aside>
              )}
              
              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="prose prose-gray max-w-none">
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children, ...props }) => {
                          const text = extractTextContent(children);
                          return <h1 id={slugify(text)} className="text-3xl font-bold mt-8 mb-4 text-gray-900" {...props}>{children}</h1>;
                        },
                        h2: ({ children, ...props }) => {
                          const text = extractTextContent(children);
                          return <h2 id={slugify(text)} className="text-2xl font-semibold mt-8 mb-3 pb-1 border-b border-gray-200 text-gray-800 scroll-mt-24" {...props}>{children}</h2>;
                        },
                        h3: ({ children, ...props }) => {
                          const text = extractTextContent(children);
                          return <h3 id={slugify(text)} className="text-xl font-medium mt-6 mb-2 text-gray-800 scroll-mt-24" {...props}>{children}</h3>;
                        },
                        p: ({ children, ...props }) => (
                          <p className="mb-4 leading-relaxed" {...props}>{children}</p>
                        ),
                        em: ({ children, ...props }) => (
                          <em className="italic text-gray-600" {...props}>{children}</em>
                        ),
                        strong: ({ children, ...props }) => (
                          <strong className="font-semibold text-gray-900" {...props}>{children}</strong>
                        ),
                        hr: (props) => (
                          <hr className="my-8 border-gray-300" {...props} />
                        ),
                        blockquote: ({ children, ...props }) => (
                          <blockquote className="border-l-4 border-purple-400 pl-4 my-4 italic text-gray-600" {...props}>{children}</blockquote>
                        ),
                      }}
                    >
                      {story.content}
                    </ReactMarkdown>
                  </div>
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

// Extract plain text from React children for heading IDs
function extractTextContent(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children.map(extractTextContent).join('');
  }
  if (children && typeof children === 'object' && 'props' in children) {
    return extractTextContent((children as any).props.children);
  }
  return '';
}
