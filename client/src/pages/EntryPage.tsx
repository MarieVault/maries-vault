import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, BookOpen, User, Tag } from "lucide-react";

export default function EntryPage() {
  const { id } = useParams();

  const { data: entries, isLoading } = useQuery({
    queryKey: ["/api/entries"],
  });

  const entriesArray = Array.isArray(entries) ? entries : [];
  const entry = entriesArray.find((e: any) => e.id === parseInt(id!));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center h-12 px-4 max-w-md mx-auto">
            <Link href="/">
              <Button variant="ghost" size="sm" className="p-0">
                <ArrowLeft size={16} className="mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-lg font-semibold text-slate-800 ml-2">Entry Not Found</h1>
          </div>
        </header>
        <main className="p-4 max-w-md mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <BookOpen className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-gray-600">This entry doesn't exist or has been removed.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Link to source (prefer externalLink, fall back to image viewer if it's an image)
  const sourceUrl = entry.externalLink || 
    (entry.type === "image" ? `/image/${entry.id}` : 
     entry.type === "sequence" ? `/sequence/${entry.id}` :
     entry.type === "story" ? `/story/${entry.id}` : null);

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
          <h1 className="text-lg font-semibold text-slate-800 truncate max-w-[200px]">
            {entry.title || "Untitled"}
          </h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto space-y-4">
        {/* Cover Image */}
        {entry.imageUrl && (
          <Card className="overflow-hidden">
            <img
              src={entry.imageUrl}
              alt={entry.title}
              className="w-full object-cover"
            />
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Title */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {entry.title || "Untitled"}
              </h2>
              {entry.nativeTitle && (
                <p className="text-sm text-gray-400 mt-0.5">{entry.nativeTitle}</p>
              )}
            </div>

            {/* Artist */}
            <div className="flex items-center space-x-2">
              <User size={16} className="text-indigo-500" />
              <span className="text-sm text-gray-600">Artist:</span>
              <Link href={`/artist/${encodeURIComponent(entry.artist || "Unknown Artist")}`}>
                <span className="text-sm text-indigo-600 hover:underline cursor-pointer">
                  {entry.artist || "Unknown Artist"}
                </span>
              </Link>
            </div>

            {/* Type */}
            <div className="flex items-center space-x-2">
              <BookOpen size={16} className="text-orange-500" />
              <span className="text-sm text-gray-600">Type:</span>
              <Badge variant="secondary" className="text-xs">
                {entry.type || "image"}
              </Badge>
            </div>

            {/* Tags */}
            {entry.tags && entry.tags.length > 0 && (
              <div className="flex items-start space-x-2">
                <Tag size={16} className="text-green-500 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {entry.tags.map((tag: string) => (
                    <Link key={tag} href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}>
                      <Badge variant="outline" className="text-xs cursor-pointer hover:bg-indigo-50">
                        {tag}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Link */}
        {sourceUrl && entry.type !== "story" && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button variant="outline" className="w-full">
              <ExternalLink size={16} className="mr-2" />
              View Original
            </Button>
          </a>
        )}

        {/* For stories, link to story viewer */}
        {entry.type === "story" && (
          <Link href={`/story/${entry.id}`}>
            <Button variant="outline" className="w-full">
              <BookOpen size={16} className="mr-2" />
              Read Story
            </Button>
          </Link>
        )}
      </main>
    </div>
  );
}
