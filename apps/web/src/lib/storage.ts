import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * StorageProvider abstraction (spec §84). Local disk serves dev/staging;
 * the Cloudflare R2 implementation replaces it at launch (needs an R2 token —
 * the current Cloudflare token has no R2 permissions). Job media is private:
 * nothing here is ever served without an authorization check.
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

export const storage: StorageProvider = new LocalDiskStorageProvider();

/** Random, unguessable object keys — never derived from customer data. */
export function newObjectKey(ext: string): string {
  return `${Date.now().toString(36)}-${randomBytes(16).toString("hex")}.${ext}`;
}
