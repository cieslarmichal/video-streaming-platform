import { type Static, Type } from 'typebox';

import { encodingIds, type EncodingId } from './encodingId.js';
import { uuidPattern } from './validationPatterns.js';

export const videoArtifactsUploadedMessageSchema = Type.Object({
  videoId: Type.String({ pattern: uuidPattern }),
  encodingId: Type.Union(Object.values(encodingIds).map((id) => Type.Literal(id as EncodingId))),
});

export type VideoArtifactsUploadedMessage = Static<typeof videoArtifactsUploadedMessageSchema>;
