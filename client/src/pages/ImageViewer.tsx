import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Plus, Twitter, X } from "lucide-react";
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

export default function ImageViewer() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [customImage, setCustomImage] = useState<string | null>(null);
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

      const appendResponse = await fetch(`/api/entries/${id}/sequence-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });

      if (!appendResponse.ok) {
        throw new Error('Failed to add image');
      }

      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: "Image added! Redirecting to gallery...",
      });

      setLocation(`/sequence/${id}`);
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
      const response = await apiRequest("POST", `/api/entries/${id}/sequence-images/twitter`, {
        tweetUrls: validUrls,
      });

      if (response.success) {
        setTwitterUrls([""]);
        setIsTwitterDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

        toast({
          title: "Import Successful!",
          description: `Added ${response.imageCount} image(s). Redirecting to gallery...`,
        });

        setLocation(`/sequence/${id}`);
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
              displayImage.endsWith('.mp4') ? (
                <video
                  src={displayImage}
                  className="max-w-full max-h-[70vh] object-contain"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={displayImage}
                  alt={displayTitle}
                  className="max-w-full max-h-[70vh] object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
              )
            ) : (
              <div className="text-gray-500 dark:text-gray-400">Image not available</div>
            )}
          </div>
        </div>

        {/* Add Image */}
        <div className="flex justify-center gap-3 mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAddImage}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isUploading ? "Uploading..." : "Add Image"}
          </Button>

          {/* Twitter Import */}
          <Dialog open={isTwitterDialogOpen} onOpenChange={setIsTwitterDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Twitter className="h-4 w-4" />
                Import from Twitter
              </Button>
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
                  Add images from Twitter/X posts. This will convert the entry to a sequence.
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
