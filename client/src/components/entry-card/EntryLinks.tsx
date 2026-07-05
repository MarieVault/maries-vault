import { Link } from "wouter";
import { ExternalLink, ImageIcon, Images, Film } from "lucide-react";
import type { Entry } from "@shared/schema";

interface EntryLinksProps {
  entry: Entry;
  displayImage: string;
}

// View/gallery/external links shown beneath an entry's content.
export default function EntryLinks({ entry, displayImage }: EntryLinksProps) {
  const isComic = entry.type === 'comic';
  const isSequence = entry.type === 'sequence';
  const isStory = entry.type === 'story';
  const isVideo = entry.type === 'video';
  return (
    <>
        {/* View Image/Video Link (for single images and videos) */}
        {!isSequence && !isComic && !isStory && displayImage && displayImage !== '/placeholder.jpg' && (
          <div className="pt-2">
            <Link href={`/image/${entry.id}`}>
              <button className={`inline-flex items-center space-x-2 transition-colors duration-200 text-sm font-medium focus-visible:focus ${isVideo ? 'text-red-600 hover:text-red-700' : 'text-indigo-600 hover:text-indigo-700'}`}>
                <span>{isVideo ? 'View Video' : 'View Image'}</span>
                {isVideo ? <Film size={12} /> : <ImageIcon size={12} />}
              </button>
            </Link>
          </div>
        )}

        {/* Sequence Gallery Link */}
        {isSequence && entry.sequenceImages && entry.sequenceImages.length > 0 && (
          <div className="pt-2">
            <Link href={`/sequence/${entry.id}`}>
              <button className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-700 transition-colors duration-200 text-sm font-medium focus-visible:focus">
                <span>View Gallery ({entry.sequenceImages.length} images)</span>
                <Images size={12} />
              </button>
            </Link>
          </div>
        )}

        {/* External Link + Gallery Link */}
        {(entry.externalLink || entry.galleryUrl) && (
          <div className="pt-2 flex flex-wrap gap-3">
            {entry.externalLink && (
              <a
                href={entry.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 transition-colors duration-200 text-sm font-medium focus-visible:focus"
              >
                <span>View original</span>
                <ExternalLink size={12} />
              </a>
            )}
            {entry.galleryUrl && (
              <a
                href={entry.galleryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-pink-600 hover:text-pink-700 transition-colors duration-200 text-sm font-medium focus-visible:focus"
              >
                <span>View in Gallery</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
    </>
  );
}
