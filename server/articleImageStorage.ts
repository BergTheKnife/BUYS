import fs from "fs/promises";
import { eq } from "drizzle-orm";
import type { Express, Response } from "express";
import { uploadedImages } from "@shared/schema";
import { db } from "./db";

const DB_IMAGE_PREFIX = "/article-images/";

export function registerArticleImageRoutes(app: Express) {
  app.get(`${DB_IMAGE_PREFIX}:id`, async (req, res) => {
    try {
      const image = await getStoredImageById(req.params.id);
      if (!image) {
        return res.status(404).end();
      }

      const buffer = Buffer.from(image.dataBase64, "base64");
      res.set({
        "Content-Type": image.mimeType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      res.end(buffer);
    } catch (error) {
      console.error("Article image download error:", error);
      res.status(500).json({ message: "Errore nel recupero dell'immagine" });
    }
  });
}

export async function storeArticleImage(params: {
  filePath: string;
  mimeType: string;
  originalName?: string;
  userId: string;
  activityId: string;
  scope: "inventory" | "production";
}) {
  const fileBuffer = await fs.readFile(params.filePath);
  const [image] = await db.insert(uploadedImages).values({
    userId: params.userId,
    activityId: params.activityId,
    scope: params.scope,
    originalName: params.originalName || null,
    mimeType: params.mimeType,
    dataBase64: fileBuffer.toString("base64"),
  }).returning();

  return `${DB_IMAGE_PREFIX}${image.id}`;
}

export async function getStoredImageById(id: string) {
  const [image] = await db.select().from(uploadedImages).where(eq(uploadedImages.id, id));
  return image || null;
}

export function isStoredArticleImageUrl(url?: string | null) {
  return Boolean(url && url.startsWith(DB_IMAGE_PREFIX));
}

export async function deleteStoredArticleImageByUrl(url?: string | null) {
  if (!isStoredArticleImageUrl(url)) {
    return false;
  }

  const imageId = url!.slice(DB_IMAGE_PREFIX.length);
  await db.delete(uploadedImages).where(eq(uploadedImages.id, imageId));
  return true;
}

export async function cleanupTempUpload(filePath?: string | null) {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch {
    // noop
  }
}
