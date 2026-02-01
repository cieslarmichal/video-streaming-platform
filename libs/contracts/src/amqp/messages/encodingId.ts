export const encodingIds = {
  '360p': '360p',
  '480p': '480p',
  '720p': '720p',
  '1080p': '1080p',
  preview_360p: 'preview_360p',
  preview_480p: 'preview_480p',
  thumbnails: 'thumbnails',
} as const;

export type EncodingId = (typeof encodingIds)[keyof typeof encodingIds];

export function isVideoFormat(encodingId: EncodingId): boolean {
  return encodingId === '360p' || encodingId === '480p' || encodingId === '720p' || encodingId === '1080p';
}

export function isPreviewFormat(encodingId: EncodingId): boolean {
  return encodingId === 'preview_360p' || encodingId === 'preview_480p';
}

export function isThumbnailsFormat(encodingId: EncodingId): boolean {
  return encodingId === encodingIds.thumbnails;
}
