export const videoContainers = {
  mp4: 'mp4',
  mov: 'mov',
  avi: 'avi',
  mkv: 'mkv',
  wmv: 'wmv',
  flv: 'flv',
  webm: 'webm',
  mpeg: 'mpeg',
  mpg: 'mpg',
  '3gp': '3gp',
  ogg: 'ogg',
  ts: 'ts',
  m4v: 'm4v',
  m2ts: 'm2ts',
  vob: 'vob',
  rm: 'rm',
  rmvb: 'rmvb',
  divx: 'divx',
  asf: 'asf',
  swf: 'swf',
  f4v: 'f4v',
} as const;

export type VideoContainer = (typeof videoContainers)[keyof typeof videoContainers];

export const encodingContainers = {
  mp4: 'mp4',
  mov: 'mov',
  avi: 'avi',
  mkv: 'mkv',
  wmv: 'wmv',
  flv: 'flv',
  webm: 'webm',
  mpeg: 'mpeg',
  mpg: 'mpg',
  '3gp': '3gp',
  ogg: 'ogg',
  ts: 'ts',
  m4v: 'm4v',
  m2ts: 'm2ts',
  vob: 'vob',
  rm: 'rm',
  rmvb: 'rmvb',
  divx: 'divx',
  asf: 'asf',
  swf: 'swf',
  f4v: 'f4v',
  jpeg: 'jpeg',
  jpg: 'jpg',
  png: 'png',
  gif: 'gif',
  m3u8: 'm3u8',
} as const;

export type EncodingContainer = (typeof encodingContainers)[keyof typeof encodingContainers];

export function isVideoContainer(container: string): container is VideoContainer {
  return Object.values(videoContainers).includes(container as VideoContainer);
}

export function isEncodingContainer(container: string | undefined): container is EncodingContainer {
  return Object.values(encodingContainers).includes(container as EncodingContainer);
}

export function mapVideoContainerToContentType(container: VideoContainer): string {
  const videoContainerToContentTypeMapping: Record<VideoContainer, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    webm: 'video/webm',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    '3gp': 'video/3gpp',
    ogg: 'video/ogg',
    ts: 'video/mp2t',
    m4v: 'video/x-m4v',
    m2ts: 'video/MP2T',
    vob: 'video/dvd',
    rm: 'application/vnd.rn-realmedia',
    rmvb: 'application/vnd.rn-realmedia-vbr',
    divx: 'video/divx',
    asf: 'video/x-ms-asf',
    swf: 'application/x-shockwave-flash',
    f4v: 'video/x-f4v',
  };

  return videoContainerToContentTypeMapping[container];
}

export function mapEncodingContainerToContentType(container: EncodingContainer): string {
  const encodingContainerToContentTypeMapping: Record<EncodingContainer, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    webm: 'video/webm',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    '3gp': 'video/3gpp',
    ogg: 'video/ogg',
    ts: 'video/mp2t',
    m4v: 'video/x-m4v',
    m2ts: 'video/MP2T',
    vob: 'video/dvd',
    rm: 'application/vnd.rn-realmedia',
    rmvb: 'application/vnd.rn-realmedia-vbr',
    divx: 'video/divx',
    asf: 'video/x-ms-asf',
    swf: 'application/x-shockwave-flash',
    f4v: 'video/x-f4v',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    m3u8: 'application/vnd.apple.mpegurl',
  };

  return encodingContainerToContentTypeMapping[container];
}
