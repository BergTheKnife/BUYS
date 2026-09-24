import { and, eq } from "drizzle-orm";
import type { Express, RequestHandler } from "express";
import { uploadedImages } from "@shared/schema";
import { db } from "./db";

const DB_IMAGE_PREFIX = "/article-images/";

export function registerArticleImageRoutes(app: Express, requireActivity: RequestHandler) {
  app.get(`${DB_IMAGE_PREFIX}:id`, requireActivity, async (req: any, res) => {
    try {
      const image = await getStoredImageById(req.params.id, req.session.activityId!);
      if (!image) {
        return res.status(404).end();
      }

      res.set({
        "Content-Type": image.mimeType,
        "Content-Length": image.data.length.toString(),
        "Cache-Control": "private, max-age=3600",
      });
      res.end(image.data);
    } catch (error) {
      console.error("Article image download error:", error);
      res.status(500).json({ message: "Errore nel recupero dell'immagine" });
    }
  });
}

export async function storeArticleImage(params: {
  fileBuffer: Buffer;
  mimeType: string;
  originalName?: string;
  userId: string;
  activityId: string;
  scope: "inventory" | "production";
}) {
  const [image] = await db.insert(uploadedImages).values({
    userId: params.userId,
    activityId: params.activityId,
    scope: params.scope,
    originalName: params.originalName || null,
    mimeType: params.mimeType,
    data: params.fileBuffer,
  }).returning();

  return `${DB_IMAGE_PREFIX}${image.id}`;
}

export async function getStoredImageById(id: string, activityId: string) {
  const [image] = await db.select().from(uploadedImages)
    .where(and(eq(uploadedImages.id, id), eq(uploadedImages.activityId, activityId)));
  return image || null;
}
