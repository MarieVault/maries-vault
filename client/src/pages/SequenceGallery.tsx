import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, Twitter, X, Play } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function SequenceGallery() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Twitter import state
  const [isTwitterDialogOpen, setIsTwitterDialogOpen] = useState(false);
  const [isImportingTwitter, setIsImportingTwitter] = useState(false);
  const [twitterUrls, setTwitterUrls] = useState<string[]>([""]);

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

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Image must be smaller than 5MB",
      });
      return;
    }

    setIsUploading(true);

    try {
      // First upload the image
      const formData = new FormData();
      formData.append('image', file);

      const uploadResponse = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const { imageUrl } = await uploadResponse.json();

      // Then append it to the sequence
      const appendResponse = await fetch(`/api/entries/${entry.id}/sequence-images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!appendResponse.ok) {
        throw new Error('Failed to add image to sequence');
      }

      // Refresh the entries data
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: "Image added to sequence!",
      });

      // Navigate to the new image
      setCurrentIndex(totalImages);
    } catch (error) {
      console.error('Error adding image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add image. Please try again.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Twitter URL management functions
  const addTwitterUrl = () => {
    setTwitterUrls(prev => [...prev, ""]);
  };

  const removeTwitterUrl = (index: number) => {
    setTwitterUrls(prev => prev.filter((_, i) => i !== index));
  };

  const updateTwitterUrl = (index: number, value: string) => {
    setTwitterUrls(prev => prev.map((url, i) => i === index ? value : url));
  };

  const handleTwitterImport = async () => {
    const validUrls = twitterUrls.filter(url => url.trim());

    if (validUrls.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter at least one Twitter/X URL",
      });
      return;
    }

    const invalidUrls = validUrls.filter(url =>
      !url.match(/twitter\.com\/\w+\/status\/\d+/) && !url.match(/x\.com\/\w+\/status\/\d+/)
    );

    if (invalidUrls.length > 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid Twitter/X URL(s) detected. Please check all URLs.",
      });
      return;
    }

    setIsImportingTwitter(true);

    try {
      const response = await apiRequest("POST", `/api/entries/${entry.id}/sequence-images/twitter`, {
        tweetUrls: validUrls,
      });

      if (response.success) {
        setTwitterUrls([""]);
        setIsTwitterDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

        toast({
          title: "Import Successful!",
          description: `Added ${response.imageCount} image(s) to the sequence.`,
        });

        // Navigate to the last new image
        setCurrentIndex(totalImages + response.imageCount - 1);
      }
    } catch (error: any) {
      console.error('Error importing from Twitter:', error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import tweets. Please check the URLs and try again.",
      });
    } finally {
      setIsImportingTwitter(false);
    }
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
              images[currentIndex].endsWith('.mp4') ? (
                <video
                  src={images[currentIndex]}
                  className="max-w-full max-h-full object-contain"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={images[currentIndex]}
                  alt={`${entry.title} - Image ${currentIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
              )
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
              {image.endsWith('.mp4') ? (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <Play className="h-5 w-5 text-white opacity-80" />
                </div>
              ) : (
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTBweCIgZmlsbD0iIzljYTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPj88L3RleHQ+PC9zdmc+';
                  }}
                />
              )}
            </button>
          ))}

          {/* Add Image Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAddImage}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-all flex items-center justify-center"
          >
            {isUploading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-pink-500 border-t-transparent"></div>
            ) : (
              <Plus className="h-6 w-6 text-gray-400 hover:text-pink-500" />
            )}
          </button>

          {/* Twitter Import Button */}
          <Dialog open={isTwitterDialogOpen} onOpenChange={setIsTwitterDialogOpen}>
            <DialogTrigger asChild>
              <button
                className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center"
              >
                <Twitter className="h-6 w-6 text-blue-400 hover:text-blue-500" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Twitter className="h-5 w-5 text-blue-500" />
                  Import from Twitter/X
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Add images from Twitter/X posts to this sequence.
                </p>

                <div className="space-y-2">
                  {twitterUrls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex items-center justify-center w-6 h-9 text-xs text-gray-500 font-medium">
                        {index + 1}.
                      </div>
                      <Input
                        value={url}
                        onChange={(e) => updateTwitterUrl(index, e.target.value)}
                        placeholder={index === 0 ? "https://x.com/username/status/..." : "Add another tweet URL..."}
                        className="flex-1"
                        disabled={isImportingTwitter}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (index === twitterUrls.length - 1 && url.trim()) {
                              addTwitterUrl();
                            }
                          }
                        }}
                      />
                      {twitterUrls.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTwitterUrl(index)}
                          disabled={isImportingTwitter}
                          className="px-2 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTwitterUrl}
                    disabled={isImportingTwitter}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Another
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTwitterUrls([""]);
                        setIsTwitterDialogOpen(false);
                      }}
                      disabled={isImportingTwitter}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleTwitterImport}
                      disabled={isImportingTwitter || !twitterUrls.some(url => url.trim())}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      {isImportingTwitter ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <Twitter className="h-4 w-4 mr-2" />
                          Import
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

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
