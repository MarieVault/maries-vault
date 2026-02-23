/**
 * Twitter Image Extraction Service
 *
 * Uses fxTwitter API (https://github.com/FixTweet/FxTwitter) to extract
 * images from Twitter/X tweets without requiring authentication.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface TweetData {
  url: string;
  id: string;
  text: string;
  author: {
    name: string;
    screen_name: string;
    avatar_url?: string;
  };
  media?: {
    photos?: Array<{
      type: 'photo';
      url: string;
      width: number;
      height: number;
    }>;
    videos?: Array<{
      type: 'video' | 'gif';
      url: string;
      variants?: Array<{
        content_type: string;
        url: string;
        bitrate?: number;
      }>;
    }>;
  };
  created_at: string;
}

export interface ExtractedTweetImages {
  tweetData: TweetData;
  imageUrls: string[];
  downloadedImages: string[];
}

/**
 * Extract tweet ID from various Twitter/X URL formats
 */
export function extractTweetId(url: string): string | null {
  const patterns = [
    /twitter\.com\/\w+\/status\/(\d+)/,
    /x\.com\/\w+\/status\/(\d+)/,
    /\/status\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Fetch tweet data from fxTwitter API
 */
export async function fetchTweetData(tweetUrl: string): Promise<TweetData> {
  // Convert to fxTwitter API URL
  // Example: https://x.com/user/status/123 -> https://api.fxtwitter.com/user/status/123
  const apiUrl = tweetUrl
    .replace('twitter.com', 'api.fxtwitter.com')
    .replace('x.com', 'api.fxtwitter.com');

  try {
    const response = await axios.get(apiUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'MariesVault/1.0',
      },
    });

    if (response.data.code !== 200 || !response.data.tweet) {
      throw new Error(response.data.message || 'Failed to fetch tweet data');
    }

    return response.data.tweet;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch tweet: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Download an image from URL and save to uploads directory
 */
export async function downloadImage(
  imageUrl: string,
  uploadsDir: string,
  index: number = 0
): Promise<string> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'MariesVault/1.0',
      },
    });

    // Determine file extension
    const contentType = response.headers['content-type'] || '';
    let ext = 'jpg';
    if (contentType.includes('png')) {
      ext = 'png';
    } else if (contentType.includes('webp')) {
      ext = 'webp';
    } else if (contentType.includes('gif')) {
      ext = 'gif';
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `twitter-${timestamp}-${index}.${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save the file
    fs.writeFileSync(filepath, response.data);

    // Return the URL path (not filesystem path)
    return `/uploads/${filename}`;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Download a video from URL and save to uploads directory as MP4
 */
export async function downloadVideo(
  videoUrl: string,
  uploadsDir: string,
  index: number = 0
): Promise<string> {
  try {
    const response = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'MariesVault/1.0',
      },
    });

    const timestamp = Date.now();
    const filename = `twitter-${timestamp}-${index}.mp4`;
    const filepath = path.join(uploadsDir, filename);

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFileSync(filepath, response.data);
    return `/uploads/${filename}`;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to download video: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Extract and download all media (images + videos/GIFs) from a Twitter/X tweet
 *
 * @param tweetUrl - Full Twitter/X URL (e.g., https://twitter.com/user/status/123)
 * @param uploadsDir - Directory to save downloaded media (default: uploads/)
 * @returns Object containing tweet data and paths to downloaded media
 */
export async function extractTwitterImages(
  tweetUrl: string,
  uploadsDir: string = path.join(process.cwd(), 'uploads')
): Promise<ExtractedTweetImages> {
  // Validate URL
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) {
    throw new Error('Invalid Twitter/X URL format');
  }

  // Fetch tweet data
  const tweetData = await fetchTweetData(tweetUrl);

  const photos = tweetData.media?.photos || [];
  const videos = tweetData.media?.videos || [];

  if (photos.length === 0 && videos.length === 0) {
    throw new Error('No media found in tweet');
  }

  const downloadedMedia: string[] = [];
  let mediaIndex = 0;

  // Download photos
  for (const photo of photos) {
    try {
      const downloadedPath = await downloadImage(photo.url, uploadsDir, mediaIndex);
      downloadedMedia.push(downloadedPath);
      mediaIndex++;
    } catch (error) {
      console.error(`Failed to download photo ${mediaIndex + 1}:`, error);
      throw error;
    }
  }

  // Download videos/GIFs — pick highest-bitrate MP4 variant
  for (const video of videos) {
    try {
      const mp4Variants = (video.variants || []).filter(v => v.content_type === 'video/mp4');
      if (mp4Variants.length === 0) {
        console.warn(`No MP4 variant found for video in tweet ${tweetId}`);
        continue;
      }
      const best = mp4Variants.reduce((a, b) => (b.bitrate ?? 0) > (a.bitrate ?? 0) ? b : a);
      const downloadedPath = await downloadVideo(best.url, uploadsDir, mediaIndex);
      downloadedMedia.push(downloadedPath);
      mediaIndex++;
    } catch (error) {
      console.error(`Failed to download video ${mediaIndex + 1}:`, error);
      throw error;
    }
  }

  return {
    tweetData,
    imageUrls: photos.map(p => p.url),
    downloadedImages: downloadedMedia,
  };
}
