import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { ArrowLeft, Plus, Upload, Camera, Twitter } from "lucide-react";
import type { Entry } from "@shared/schema";

export default function CreateEntry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingTwitter, setIsImportingTwitter] = useState(false);
  const [twitterUrl, setTwitterUrl] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    imageUrl: "",
    externalLink: "",
    artist: "",
    tags: "",
    type: "image" as "comic" | "image" | "sequence"
  });

  const [sequenceImages, setSequenceImages] = useState<string[]>([""]);
  const [uploadingStates, setUploadingStates] = useState<{[key: string]: boolean}>({});
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const sequenceImageInputRefs = useRef<{[key: number]: HTMLInputElement}>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSequenceImage = () => {
    setSequenceImages(prev => [...prev, ""]);
  };

  const removeSequenceImage = (index: number) => {
    setSequenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const updateSequenceImage = (index: number, value: string) => {
    setSequenceImages(prev => prev.map((img, i) => i === index ? value : img));
  };

  const handleImageUpload = async (file: File, uploadKey: string) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Image must be smaller than 5MB",
      });
      return null;
    }

    setUploadingStates(prev => ({ ...prev, [uploadKey]: true }));
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const { imageUrl } = await response.json();
      
      toast({
        title: "Success",
        description: "Image uploaded successfully!",
      });
      
      return imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload image. Please try again.",
      });
      return null;
    } finally {
      setUploadingStates(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = await handleImageUpload(file, 'cover');
    if (imageUrl) {
      handleInputChange('imageUrl', imageUrl);
    }
    
    if (coverImageInputRef.current) {
      coverImageInputRef.current.value = '';
    }
  };

  const handleSequenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = await handleImageUpload(file, `sequence-${index}`);
    if (imageUrl) {
      updateSequenceImage(index, imageUrl);
    }
    
    if (sequenceImageInputRefs.current[index]) {
      sequenceImageInputRefs.current[index].value = '';
    }
  };

  const handleTwitterImport = async () => {
    if (!twitterUrl.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a Twitter/X URL",
      });
      return;
    }

    // Validate Twitter URL format
    if (!twitterUrl.match(/twitter\.com\/\w+\/status\/\d+/) && !twitterUrl.match(/x\.com\/\w+\/status\/\d+/)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid Twitter/X tweet URL",
      });
      return;
    }

    setIsImportingTwitter(true);

    try {
      const response = await apiRequest("POST", "/api/extract-twitter", {
        tweetUrl: twitterUrl.trim(),
      });

      if (response.success && response.entry) {
        // Clear Twitter URL input immediately
        setTwitterUrl("");

        // Invalidate entries cache
        queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

        // Show success notification with longer duration
        toast({
          title: "✅ Import Successful!",
          description: `Successfully imported ${response.imageCount} image(s) from Twitter and created entry "${response.entry.title}". Redirecting...`,
          duration: 3000,
        });

        // Redirect to home after showing notification
        setTimeout(() => {
          setLocation("/");
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error importing from Twitter:', error);
      toast({
        variant: "destructive",
        title: "❌ Import Failed",
        description: error.message || "Failed to import tweet. Please check the URL and try again.",
        duration: 5000,
      });
    } finally {
      setIsImportingTwitter(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.artist.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Title and artist are required fields.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const entryData = {
        title: formData.title.trim(),
        imageUrl: formData.imageUrl.trim() || undefined,
        externalLink: formData.externalLink.trim() || undefined,
        artist: formData.artist.trim(),
        tags: formData.tags.trim()
          ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
          : [],
        type: formData.type,
        ...(formData.type === 'sequence' && {
          sequenceImages: sequenceImages.filter(img => img.trim().length > 0)
        })
      };

      await apiRequest("POST", "/api/entries", entryData);

      // Invalidate entries cache to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });

      toast({
        title: "Success",
        description: "New entry created successfully!",
      });

      // Redirect back to home
      setLocation("/");
    } catch (error) {
      console.error('Error creating entry:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Couldn't create entry. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
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
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Entry</h1>
          <p className="text-gray-600">Add a new entry to your vault collection.</p>
          <div className="mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
              ✓ Updated Version - Nov 1, 2025
            </span>
          </div>
        </div>

        {/* Twitter Import Section */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow-sm border border-blue-200 p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Twitter className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Import from Twitter/X</h2>
              <p className="text-sm text-gray-600">Paste a tweet URL to automatically extract and import images</p>
              {isImportingTwitter && (
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-blue-700">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-700 border-t-transparent"></div>
                  <span>Importing images and creating entry...</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                placeholder="https://x.com/username/status/1234567890..."
                className="flex-1 bg-white"
                disabled={isImportingTwitter}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTwitterImport();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleTwitterImport}
                disabled={isImportingTwitter || !twitterUrl.trim()}
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
            <p className="text-xs text-gray-500">
              ✨ Works with tweets containing images • No API key needed • Creates entry automatically
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-50 text-gray-500">Or create manually</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Enter the title..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="artist">Artist *</Label>
              <Input
                id="artist"
                value={formData.artist}
                onChange={(e) => handleInputChange("artist", e.target.value)}
                placeholder="Enter the artist name..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={formData.type} onValueChange={(value: "comic" | "image" | "sequence") => handleInputChange("type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="comic">Comic</SelectItem>
                  <SelectItem value="sequence">Sequence</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'sequence' ? (
              <div className="space-y-4">
                {/* Cover Image for Sequence */}
                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.imageUrl}
                      onChange={(e) => handleInputChange("imageUrl", e.target.value)}
                      placeholder="Cover image URL"
                      type="url"
                      className="flex-1"
                    />
                    <input
                      ref={coverImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => coverImageInputRef.current?.click()}
                      disabled={uploadingStates.cover}
                    >
                      {uploadingStates.cover ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent"></div>
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Cover image shown on the main card</p>
                </div>

                {/* Sequence Images */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Sequence Images</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addSequenceImage}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Image
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {sequenceImages.map((image, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={image}
                          onChange={(e) => updateSequenceImage(index, e.target.value)}
                          placeholder={`Image ${index + 1} URL`}
                          type="url"
                          className="flex-1"
                        />
                        <input
                          ref={el => el && (sequenceImageInputRefs.current[index] = el)}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSequenceImageUpload(e, index)}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => sequenceImageInputRefs.current[index]?.click()}
                          disabled={uploadingStates[`sequence-${index}`]}
                        >
                          {uploadingStates[`sequence-${index}`] ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent"></div>
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                        {sequenceImages.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSequenceImage(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Upload files or add URLs for your sequence images</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="imageUrl"
                    value={formData.imageUrl}
                    onChange={(e) => handleInputChange("imageUrl", e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    type="url"
                    className="flex-1"
                  />
                  <input
                    ref={coverImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => coverImageInputRef.current?.click()}
                    disabled={uploadingStates.cover}
                  >
                    {uploadingStates.cover ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent"></div>
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Upload a file or enter URL</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="externalLink">External Link</Label>
              <Input
                id="externalLink"
                value={formData.externalLink}
                onChange={(e) => handleInputChange("externalLink", e.target.value)}
                placeholder="https://example.com/source"
                type="url"
              />
              <p className="text-xs text-gray-500">Optional - link to original source</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => handleInputChange("tags", e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
              <p className="text-xs text-gray-500">Optional - separate multiple tags with commas</p>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus size={16} className="mr-2" />
                {isSubmitting ? "Creating..." : "Create Entry"}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}