import { type Static, Type } from 'typebox';

import { type EncodingId, encodingIds } from './encodingId.js';
import { pathPattern, uuidPattern } from './validationPatterns.js';

export const videoEncodedMessageSchema = Type.Object({
  videoId: Type.String({ pattern: uuidPattern }),
  artifactsDirectory: Type.String({ pattern: pathPattern }),
  encodingId: Type.Union(Object.values(encodingIds).map((id) => Type.Literal(id as EncodingId))),
});

export type VideoEncodedMessage = Static<typeof videoEncodedMessageSchema>;
