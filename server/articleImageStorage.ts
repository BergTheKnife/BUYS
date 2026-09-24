import { and, eq, sql } from "drizzle-orm";
import type { Express, RequestHandler } from "express";
import { inventario, productionProducts, uploadedImages } from "@shared/schema";
import { db } from "./db";

const DB_IMAGE_PREFIX = "/article-images/";

export function registerArticleImageRoutes(app: Express, requireActivity: RequestHandler) {
  app.get(`${DB_IMAGE_PREFIX}:id`, requireActivity, async (req: any, res) => {
    try {
      const image = await getStoredImageById(req.params.id, req.session.activityId!);
      if (!image) {
        return res.status(404).end();
      }

      const buffer = Buffer.from(image.dataBase64, "base64");
      res.set({
        "Content-Type": image.mimeType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      });
      res.end(buffer);
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
    dataBase64: params.fileBuffer.toString("base64"),
  }).returning();

  return `${DB_IMAGE_PREFIX}${image.id}`;
}

export async function getStoredImageById(id: string, activityId: string) {
  const [image] = await db.select().from(uploadedImages)
    .where(and(eq(uploadedImages.id, id), eq(uploadedImages.activityId, activityId)));
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

export async function deleteStoredArticleImageIfUnreferenced(url?: string | null) {
  if (!isStoredArticleImageUrl(url)) {
    return false;
  }

  const imageId = url!.slice(DB_IMAGE_PREFIX.length);

  return await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      SELECT ${uploadedImages.id}
      FROM ${uploadedImages}
      WHERE ${uploadedImages.id} = ${imageId}
      FOR UPDATE
    `);

    if (!locked.rows[0]) {
      return false;
    }

    const references = await tx.execute(sql`
      SELECT (
        (SELECT COUNT(*)::int FROM ${inventario} WHERE ${inventario.immagineUrl} = ${url}) +
        (SELECT COUNT(*)::int FROM ${productionProducts} WHERE ${productionProducts.imageUrl} = ${url})
      ) AS total
    `);

    const total = Number(references.rows[0]?.total || 0);
    if (total > 0) {
      return false;
    }

    await tx.delete(uploadedImages).where(eq(uploadedImages.id, imageId));
    return true;
  });
}
