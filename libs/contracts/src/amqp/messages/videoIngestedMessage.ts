import { type Static, Type } from 'typebox';

import { type VideoContainer, videoContainers } from './encodingContainer.js';
import { urlPattern, uuidPattern } from './validationPatterns.js';

export const videoIngestedMessageSchema = Type.Object({
  videoId: Type.String({ pattern: uuidPattern }),
  videoUrl: Type.String({ pattern: urlPattern }),
  videoContainer: Type.Union(
    Object.values(videoContainers).map((container) => Type.Literal(container as VideoContainer)),
  ),
});

export type VideoIngestedMessage = Static<typeof videoIngestedMessageSchema>;
