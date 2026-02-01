import { type Static, Type } from 'typebox';

import { type VideoContainer, videoContainers } from './encodingContainer.js';
import { pathPattern, uuidPattern } from './validationPatterns.js';

export const videoDownloadedMessageSchema = Type.Object({
  videoId: Type.String({ pattern: uuidPattern }),
  location: Type.String({ pattern: pathPattern }),
  videoContainer: Type.Union(
    Object.values(videoContainers).map((container) => Type.Literal(container as VideoContainer)),
  ),
});

export type VideoDownloadedMessage = Static<typeof videoDownloadedMessageSchema>;
