# API Routes

Source: `server/routes.ts`

## Auth
- `POST /api/auth/login`
  - Body: `{ passcode: string }`
  - Sets `auth_token` cookie.
  - Response: `{ success, message, deviceInfo }`
- `POST /api/auth/logout`
  - Response: `{ success, message }`
  - Clears `auth_token` cookie.
- `GET /api/auth/status`
  - Response: `{ authenticated: boolean, requiresAuth: true, deviceInfo? }`

## Entries
- `GET /api/entries`
  - Response: list of entries with merged customizations.
  - Fields: `id, title, imageUrl, externalLink, artist, tags, originalTags, userTags, type, sequenceImages, keywords, rating`.
- `GET /api/entries/:id`
  - Response: single entry.
- `POST /api/entries`
  - Body:
    ```json
    {
      "title": "string",
      "imageUrl": "string?",
      "externalLink": "string?",
      "artist": "string",
      "tags": ["string"]?,
      "userTags": ["string"]?,
      "keywords": ["string"]?,
      "type": "comic|image|sequence",
      "sequenceImages": ["string"]?
    }
    ```
  - Response: created entry.
- `DELETE /api/entries/:entryId`
  - Response: `{ message: "Entry deleted successfully" }`.
- `POST /api/entries/:entryId/sequence-images`
  - Body: `{ imageUrl: string }`
  - Response: `{ success: true, entry }`.
- `POST /api/entries/:entryId/sequence-images/twitter`
  - Body: `{ tweetUrls: string[] }`
  - Response: `{ success, entry, message, imageCount }`.

## Tags
- `GET /api/tags`
  - Response: list of `{ name, count, artists }`.
- `GET /api/tags/:tagName/entries`
  - Response: list of entries matching tag (case-insensitive match).

## Artists
- `GET /api/artists`
  - Response: list of `{ name, count, tags }`.
- `GET /api/artists/rankings`
  - Response: `{ rankings, metadata }`.
- `GET /api/artists/:artistName/entries`
  - Response: list of entries for artist.
- `GET /api/artists/:artistName/links`
  - Response: list of links.
- `POST /api/artists/:artistName/links`
  - Body: `{ platform: string, url: string }`
  - Response: created link.
- `DELETE /api/artist-links/:id`
  - Response: `{ success: true }`.

## Titles
- `GET /api/titles/:entryId`
  - Response: title record or 404.
- `POST /api/titles`
  - Body: `{ entryId: number, title: string }`
  - Response: created/updated title.

## Custom Entries
- `GET /api/custom-entries/:entryId`
  - Response: custom entry record or empty placeholders.
- `POST /api/custom-entries`
  - Body:
    ```json
    {
      "entryId": number,
      "customImageUrl": "string?",
      "customArtist": "string?",
      "customTags": ["string"]?,
      "userTags": ["string"]?,
      "keywords": ["string"]?,
      "rating": number?
    }
    ```
  - Response: updated custom entry or `{ message: "No updates needed" }`.

## Uploads & Share
- `POST /api/upload-image`
  - Form-data: `image` (file)
  - Response: `{ imageUrl: "/uploads/..." }`.
- `POST /api/share`
  - Form-data: `file` (optional), `title`, `text`, `url`
  - Response: `{ success, entry, message }`.
- `POST /share-handler`
  - Form-data: `file` (optional), `title`, `text`, `url`
  - Response: redirect to `/share-handler?status=...`.

## Tag Emojis
- `GET /api/tag-emojis/batch?tags=a,b,c`
  - Response: `{ [tagName]: emoji }`.
- `GET /api/tag-emojis/:tagName`
  - Response: emoji record or 404.
- `POST /api/tag-emojis`
  - Body: `{ tagName: string, emoji: string }`
  - Response: upserted emoji record.

## Twitter/X Import
- `POST /api/extract-twitter`
  - Body: `{ tweetUrl, title?, tags?, artist? }`
  - Response: `{ success, entry, message, imageCount }`.
- `POST /api/extract-twitter-multi`
  - Body: `{ tweetUrls: string[], title?, tags?, artist? }`
  - Response: `{ success, entry, message, imageCount, tweetCount }`.

## Notes
- All `/api/*` routes except `/api/auth/*` require a valid `auth_token` cookie.
- Uploads are served from `/uploads`.
