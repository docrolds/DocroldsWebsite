import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env';

/**
 * Cloudflare R2 client (S3-compatible API). Only constructed once R2 env
 * vars are present - callers should check isR2Configured() first, since
 * this module is only used by the stems-upload feature and shouldn't
 * crash server boot if R2 hasn't been set up yet.
 */
let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey) {
      throw new Error('R2 storage is not configured (missing R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY)');
    }
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return s3Client;
}

export function isR2Configured(): boolean {
  return Boolean(
    config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.bucketName
  );
}

/**
 * Uploads a buffer to the R2 bucket under the given key and returns the key
 * (not a URL - the bucket is private, so retrieval always goes through
 * getPresignedDownloadUrl() rather than a permanent public link).
 */
export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!config.r2.bucketName) {
    throw new Error('R2 storage is not configured (missing R2_BUCKET_NAME)');
  }
  await getClient().send(
    new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Generates a short-lived presigned GET URL for a private R2 object.
 * Defaults to 15 minutes - long enough for an admin to click through and
 * download, short enough that a leaked/logged URL doesn't stay valid.
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  if (!config.r2.bucketName) {
    throw new Error('R2 storage is not configured (missing R2_BUCKET_NAME)');
  }
  const command = new GetObjectCommand({ Bucket: config.r2.bucketName, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}
