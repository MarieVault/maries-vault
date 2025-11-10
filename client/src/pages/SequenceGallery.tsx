import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function SequenceGallery() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["/api/entries"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
        <div className="text-lg">Loading sequence...</div>
      </div>
    );
  }

  const entriesArray = Array.isArray(entries) ? entries : [];
  const entry = entriesArray.find((e: any) => e.id === parseInt(id!));

  if (!entry || entry.type !== 'sequence' || !entry.sequenceImages?.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Sequence not found</h2>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const images = entry.sequenceImages;
  const totalImages = images.length;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalImages - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < totalImages - 1 ? prev + 1 : 0));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{entry.title}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">by {entry.artist}</p>
          </div>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>

        {/* Image Counter */}
        <div className="text-center mb-4">
          <span className="bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
            {currentIndex + 1} of {totalImages}
          </span>
        </div>

        {/* Main Image Display */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="aspect-video flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            {images[currentIndex] ? (
              <img
                src={images[currentIndex]}
                alt={`${entry.title} - Image ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
                }}
              />
            ) : (
              <div className="text-gray-500 dark:text-gray-400">Image not available</div>
            )}
          </div>

          {/* Navigation Arrows */}
          {totalImages > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800"
                onClick={goToNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Thumbnail Navigation */}
        {totalImages > 1 && (
          <div className="flex gap-2 justify-center overflow-x-auto pb-4">
            {images.map((image: string, index: number) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? 'border-pink-500 shadow-lg'
                    : 'border-gray-200 dark:border-gray-600 hover:border-pink-300'
                }`}
              >
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTBweCIgZmlsbD0iIzljYTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPj88L3RleHQ+PC9zdmc+';
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Entry Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Details</h3>
              <p><span className="text-gray-600 dark:text-gray-400">Type:</span> Sequence</p>
              <p><span className="text-gray-600 dark:text-gray-400">Images:</span> {totalImages}</p>
              {entry.externalLink && (
                <p>
                  <span className="text-gray-600 dark:text-gray-400">Link:</span>{' '}
                  <a
                    href={entry.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-600 hover:text-pink-800 underline"
                  >
                    View Source
                  </a>
                </p>
              )}
            </div>
            {entry.tags && entry.tags.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {entry.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 px-2 py-1 rounded-full text-sm"
                    >
                      {tag}
                    </span>
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