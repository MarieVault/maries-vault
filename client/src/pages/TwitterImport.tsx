import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { ArrowLeft, Plus, Twitter, X } from "lucide-react";

export default function TwitterImport() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isImportingTwitter, setIsImportingTwitter] = useState(false);
  const [twitterUrls, setTwitterUrls] = useState<string[]>([""]);

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
        description: `Invalid Twitter/X URL(s) detected. Please check all URLs.`,
      });
      return;
    }

    setIsImportingTwitter(true);

    try {
      const response = await apiRequest("POST", "/api/extract-twitter-multi", {
        tweetUrls: validUrls,
      });

      if (response.success && response.entry) {
        setTwitterUrls([""]);
        queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

        toast({
          title: "Import Successful!",
          description: `Successfully imported ${response.imageCount} media item(s) from ${validUrls.length} tweet(s) and created entry "${response.entry.title}". Redirecting...`,
          duration: 3000,
        });

        setTimeout(() => {
          setLocation("/");
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error importing from Twitter:', error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import tweets. Please check the URLs and try again.",
        duration: 5000,
      });
    } finally {
      setIsImportingTwitter(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Vault
          </Button>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Import from Twitter/X</h1>
          <p className="text-gray-600">Quickly import images and videos from tweets into your vault.</p>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow-sm border border-blue-200 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Twitter className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Paste Tweet URLs</h2>
              <p className="text-sm text-gray-600">Add one or more tweet URLs to extract and import their media into a single entry</p>
              {isImportingTwitter && (
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-blue-700">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-700 border-t-transparent"></div>
                  <span>Importing images and creating entry...</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {twitterUrls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex items-center justify-center w-6 h-9 text-xs text-gray-500 font-medium">
                  {index + 1}.
                </div>
                <Input
                  value={url}
                  onChange={(e) => updateTwitterUrl(index, e.target.value)}
                  placeholder={index === 0 ? "https://x.com/username/status/1234567890..." : "Add another tweet URL..."}
                  className="flex-1 bg-white"
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

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTwitterUrl}
                disabled={isImportingTwitter}
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Another Link
              </Button>
              <Button
                type="button"
                onClick={handleTwitterImport}
                disabled={isImportingTwitter || !twitterUrls.some(url => url.trim())}
                className="bg-blue-500 hover:bg-blue-600 ml-auto"
              >
                {isImportingTwitter ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Twitter className="h-4 w-4 mr-2" />
                    Import {twitterUrls.filter(u => u.trim()).length > 1 ? `${twitterUrls.filter(u => u.trim()).length} Tweets` : 'Tweet'}
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Add multiple tweet URLs to combine their images into a single entry. First tweet = first image(s), etc.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 mb-2">Need to create an entry manually?</p>
          <Button
            variant="outline"
            onClick={() => setLocation("/create")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Entry Manually
          </Button>
        </div>
      </div>
    </div>
  );
}
