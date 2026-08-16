import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * StorageProvider abstraction (spec §84). Cloudflare R2 (S3-compatible) when
 * R2_* env vars are present; local disk otherwise (dev without credentials).
 * Job media is private: nothing here is ever served without an authorization
 * check, and object keys are random (spec §55/§58).
 */
export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? ".uploads";

export class LocalDiskStorageProvider implements StorageProvider {
  async put(key: string, data: Buffer): Promise<void> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, key), data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(join(UPLOAD_DIR, key));
  }
}

export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor(
    endpoint: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucket: string,
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) throw new Error(`Object ${key} has no body`);
    return Buffer.from(await result.Body.transformToByteArray());
  }
}

function selectProvider(): StorageProvider {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (endpoint && accessKeyId && secretAccessKey && bucket) {
    return new R2StorageProvider(endpoint, accessKeyId, secretAccessKey, bucket);
  }
  return new LocalDiskStorageProvider();
}

export const storage: StorageProvider = selectProvider();

/** Random, unguessable object keys — never derived from customer data. */
export function newObjectKey(ext: string): string {
  return `${Date.now().toString(36)}-${randomBytes(16).toString("hex")}.${ext}`;
}
