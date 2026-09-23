import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

export const r2Client = new S3Client({
  region: "auto",
  endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

export class ObjectStorageService {
  private requireConfig() {
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      throw new Error("Cloudflare R2 non configurato: servono R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL.");
    }
  }

  private publicObjectUrl(key: string) {
    this.requireConfig();
    return `${publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async getProfileImageUploadURL(): Promise<string> {
    return this.getUploadURL("profile-images");
  }

  async getInventoryImageUploadURL(): Promise<string> {
    return this.getUploadURL("inventory-images");
  }

  private async getUploadURL(folder: string): Promise<string> {
    this.requireConfig();
    const key = `${folder}/${randomUUID()}`;
    return getSignedUrl(r2Client, new PutObjectCommand({ Bucket: bucketName, Key: key }), { expiresIn: 900 });
  }

  async uploadImage(buffer: Buffer, contentType: string, folder: string, originalName?: string): Promise<string> {
    this.requireConfig();
    const extension = originalName?.split(".").pop()?.toLowerCase() || "jpg";
    const key = `${folder}/${randomUUID()}.${extension}`;
    await r2Client.send(new PutObjectCommand({ Bucket: bucketName, Key: key, Body: buffer, ContentType: contentType }));
    return this.publicObjectUrl(key);
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath) return rawPath;
    const cleanPath = rawPath.split("?")[0];
    if (publicUrl && cleanPath.startsWith(publicUrl)) return cleanPath;

    // Inventory uploads use a presigned R2 endpoint. Store the stable public URL,
    // not the expiring query string or the internal R2 endpoint.
    try {
      const url = new URL(cleanPath);
      if (url.hostname.endsWith(".r2.cloudflarestorage.com")) {
        return this.publicObjectUrl(decodeURIComponent(url.pathname.replace(/^\//, "")));
      }
    } catch {
      // Keep legacy/local paths unchanged.
    }

    return cleanPath;
  }

  async getObjectEntityFile(objectPath: string) {
    this.requireConfig();
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const key = objectPath.slice("/objects/".length);
    try {
      return await r2Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
    } catch {
      throw new ObjectNotFoundError();
    }
  }

  async downloadObject(object: any, res: any, cacheTtlSec = 3600) {
    if (!object.Body) return res.status(404).json({ error: "File not found" });
    res.set({
      "Content-Type": object.ContentType || "application/octet-stream",
      ...(object.ContentLength ? { "Content-Length": String(object.ContentLength) } : {}),
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
    });
    object.Body.pipe(res);
  }
}
