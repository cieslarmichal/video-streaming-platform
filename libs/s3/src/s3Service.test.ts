import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { expect, describe, it, beforeEach, afterEach } from 'vitest';

import { S3TestUtils } from '../tests/s3TestUtils.ts';
import { S3ClientFactory } from './s3ClientFactory.ts';
import { S3Service } from './s3Service.ts';

describe('S3Service', () => {
  let s3Service: S3Service;

  let s3TestUtils: S3TestUtils;

  const resourcesDirectory = path.resolve(__dirname, '../../../resources');

  const sampleFileName = 'sample_image.jpg';

  const fileName = randomUUID();

  const bucketName = 'test-images';

  beforeEach(async () => {
    const s3Client = S3ClientFactory.create({
      accessKeyId: 'test',
      secretAccessKey: 'test',
      region: 'eu-central-1',
      endpoint: 'http://127.0.0.1:4566',
    });

    s3Service = new S3Service(s3Client);

    s3TestUtils = new S3TestUtils(s3Client);

    await s3TestUtils.createBucket(bucketName);
  });

  afterEach(async () => {
    await s3TestUtils.deleteBucket(bucketName);
  });

  describe('upload', () => {
    it('throws an error - when bucket does not exist', async () => {
      const filePath = path.join(resourcesDirectory, sampleFileName);

      const nonExistingBucketName = 'non-existing-bucket';

      try {
        await s3Service.uploadBlob({
          bucketName: nonExistingBucketName,
          blobName: fileName,
          data: createReadStream(filePath),
          contentType: 'image/jpg',
        });
      } catch (error) {
        expect(error).toBeDefined();

        return;
      }

      expect.fail();
    });

    it('uploads a resource', async () => {
      const filePath = path.join(resourcesDirectory, sampleFileName);

      await s3Service.uploadBlob({
        bucketName,
        blobName: fileName,
        data: createReadStream(filePath),
        contentType: 'image/jpg',
      });

      const exists = await s3TestUtils.objectExists(bucketName, fileName);

      expect(exists).toBe(true);
    });
  });

  it('returns URLs for resources', async () => {
    const filePath = path.join(resourcesDirectory, sampleFileName);

    await s3Service.uploadBlob({
      bucketName,
      blobName: `${fileName}/1`,
      data: createReadStream(filePath),
      contentType: 'image/jpg',
    });

    await s3Service.uploadBlob({
      bucketName,
      blobName: `${fileName}/2`,
      data: createReadStream(filePath),
      contentType: 'image/jpg',
    });

    const { blobs } = await s3Service.getBlobs({
      bucketName,
      prefix: fileName,
    });

    expect(blobs.length).toBe(2);

    blobs.forEach((blob) => {
      expect(blob.name.startsWith(fileName)).toBe(true);

      expect(blob.name.endsWith('1') || blob.name.endsWith('2')).toBe(true);

      expect(blob.contentType).toBe('image/jpg');
    });
  });
});
