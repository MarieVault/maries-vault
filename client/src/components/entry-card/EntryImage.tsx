import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

const isVideoFile = (url: string) => url.endsWith('.mp4');

interface EntryImageProps {
  displayImage: string;
  displayTitle: string;
  blurEnabled: boolean;
  isImageRevealed: boolean;
  setIsImageRevealed: (v: boolean) => void;
  imageLoading: boolean;
  isUploadingImage: boolean;
  isOwner: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageStart: () => void;
  onImageLoad: () => void;
}

export default function EntryImage({
  displayImage, displayTitle, blurEnabled, isImageRevealed, setIsImageRevealed,
  imageLoading, isUploadingImage, isOwner, fileInputRef, onImageUpload, onImageStart, onImageLoad,
}: EntryImageProps) {
  return (
      <div className="relative group">
        {isVideoFile(displayImage) ? (
          <video
            src={displayImage}
            className={`w-full h-56 object-cover transition-all duration-300 ${
              blurEnabled && !isImageRevealed ? 'blur-md grayscale' : ''
            }`}
            autoPlay
            loop
            muted
            playsInline
            onLoadStart={onImageStart}
            onLoadedData={onImageLoad}
          />
        ) : (
          <img
            src={displayImage}
            alt={displayTitle}
            className={`w-full h-56 object-cover transition-all duration-300 ${
              blurEnabled && !isImageRevealed ? 'blur-md grayscale' : ''
            }`}
            onLoadStart={onImageStart}
            onLoad={onImageLoad}
            onError={onImageLoad}
          />
        )}

        {/* Click-to-reveal overlay — only when blur is globally enabled */}
        {blurEnabled && !isImageRevealed && (
          <div
            onClick={() => setIsImageRevealed(true)}
            className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center cursor-pointer hover:bg-opacity-10 transition-all duration-200"
          >
            <div className="bg-white bg-opacity-90 rounded-lg px-4 py-2 shadow-lg">
              <p className="text-sm font-medium text-gray-800">Click to reveal</p>
            </div>
          </div>
        )}

        {/* Re-blur button — only when blur is globally enabled */}
        {blurEnabled && isImageRevealed && (
          <div
            onClick={() => setIsImageRevealed(false)}
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <button className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs hover:bg-opacity-70 transition-all">
              Hide
            </button>
          </div>
        )}

        {/* Loading overlay for image */}
        {(imageLoading || isUploadingImage) && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
            {isUploadingImage && (
              <span className="ml-2 text-sm text-gray-600">Uploading...</span>
            )}
          </div>
        )}

        {/* Image upload button — authenticated only */}
        {isOwner && (
          <div className="absolute top-2 right-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onImageUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              variant="secondary"
              className="bg-white/80 backdrop-blur hover:bg-white/90 text-gray-700"
              disabled={isUploadingImage}
            >
              <Camera size={14} />
            </Button>
          </div>
        )}
      </div>
  );
}
