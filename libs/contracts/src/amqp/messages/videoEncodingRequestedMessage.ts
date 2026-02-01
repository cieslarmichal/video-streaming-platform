import { type Static, Type } from 'typebox';

import {
  type EncodingContainer,
  type VideoContainer,
  encodingContainers,
  videoContainers,
} from './encodingContainer.js';
import { type EncodingId, encodingIds } from './encodingId.js';
import { pathPattern, uuidPattern } from './validationPatterns.js';

export const videoEncodingRequestedMessageSchema = Type.Object({
  videoId: Type.String({ pattern: uuidPattern }),
  videoContainer: Type.Union(
    Object.values(videoContainers).map((container) => Type.Literal(container as VideoContainer)),
  ),
  location: Type.String({ pattern: pathPattern }),
  encoding: Type.Object({
    id: Type.Union(Object.values(encodingIds).map((id) => Type.Literal(id as EncodingId))),
    container: Type.Union(
      Object.values(encodingContainers).map((container) => Type.Literal(container as EncodingContainer)),
    ),
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 }),
    bitrate: Type.Optional(Type.Integer({ minimum: 1 })),
    fps: Type.Optional(Type.Integer({ minimum: 1 })),
  }),
});

export type VideoEncodingRequestedMessage = Static<typeof videoEncodingRequestedMessageSchema>;

export type EncodingSpecification = VideoEncodingRequestedMessage['encoding'];
