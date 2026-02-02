import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function ImageViewer() {
  const { id } = useParams();
  const [customImage, setCustomImage] = useState<string | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["/api/entries"],
  });

  const entriesArray = Array.isArray(entries) ? entries : [];
  const entry = entriesArray.find((e: any) => e.id === parseInt(id!));

  // Load custom image if available
  useEffect(() => {
    const loadCustomData = async () => {
      if (!entry) return;
      try {
        const response = await fetch(`/api/custom-entries/${entry.id}`);
        if (response.ok) {
          const customData = await response.json();
          if (customData.customImageUrl) {
            setCustomImage(customData.customImageUrl);
          }
        }
      } catch (error) {
        console.error('Error loading custom data:', error);
      }
    };
    loadCustomData();
  }, [entry?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
        <div className="text-lg">Loading image...</div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Image not found</h2>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayImage = customImage || entry.imageUrl || '/placeholder.jpg';
  const displayTitle = entry.title || "Untitled";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="text-center flex-1 mx-4">
            <h1 className="text-2xl font-bold truncate">{displayTitle}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">by {entry.artist}</p>
          </div>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>

        {/* Main Image Display */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 min-h-[300px]">
            {displayImage && displayImage !== '/placeholder.jpg' ? (
              <img
                src={displayImage}
                alt={displayTitle}
                className="max-w-full max-h-[70vh] object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
                }}
              />
            ) : (
              <div className="text-gray-500 dark:text-gray-400">Image not available</div>
            )}
          </div>
        </div>

        {/* Entry Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Details</h3>
              <p><span className="text-gray-600 dark:text-gray-400">Type:</span> Image</p>
              {entry.externalLink && (
                <p className="mt-2">
                  <a
                    href={entry.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 underline"
                  >
                    <span>View Source</span>
                    <ExternalLink size={14} />
                  </a>
                </p>
              )}
              {displayImage && displayImage !== '/placeholder.jpg' && (
                <p className="mt-2">
                  <a
                    href={displayImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 underline"
                  >
                    <span>Open Full Size</span>
                    <ExternalLink size={14} />
                  </a>
                </p>
              )}
            </div>
            {entry.tags && entry.tags.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {entry.tags.map((tag: string) => (
                    <Link key={tag} href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}>
                      <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-1 rounded-full text-sm cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors">
                        {tag}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
