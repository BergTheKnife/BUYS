import { db } from "./db";
import { eq } from "drizzle-orm";
import { storeProfiles, productAttributeDefs } from "@shared/schema";

type FeatureFlags = Record<string, boolean>;

const DEFAULT_FLAGS_BY_TYPE: Record<string, FeatureFlags> = {
  "abbigliamento": { production: false, vetrina: false, variants: true, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "calzature": { production: false, vetrina: false, variants: true, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "gioielli": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "elettronica": { production: false, vetrina: false, variants: false, serials: true, lots_expiry: false, shipping: true, services: false, digital: false },
  "informatica": { production: false, vetrina: false, variants: false, serials: true, lots_expiry: false, shipping: true, services: false, digital: false },
  "casa": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "sport": { production: false, vetrina: false, variants: true, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "cosmetici": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: true, shipping: true, services: false, digital: false },
  "alimentari": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: true, shipping: true, services: false, digital: false },
  "libri": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "ricambi": { production: false, vetrina: false, variants: false, serials: true, lots_expiry: false, shipping: true, services: false, digital: false },
  "artigianato": { production: true, vetrina: true, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "stampa": { production: true, vetrina: true, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "digitale": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: false, services: false, digital: true },
  "servizi": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: false, services: true, digital: false }
};

const DEFAULT_ATTRS_BY_TYPE: Record<string, Array<{key:string,label:string,type:string,unit?:string,required?:boolean,options?:any}>> = {
  "abbigliamento": [
    { key: "taglia", label: "Taglia", type: "select", options: ["XS","S","M","L","XL"] },
    { key: "colore", label: "Colore", type: "text" }
  ],
  "calzature": [
    { key: "numeroEU", label: "Numero EU", type: "select", options: ["36","37","38","39","40","41","42","43","44","45"] },
    { key: "colore", label: "Colore", type: "text" }
  ],
  "elettronica": [
    { key: "seriale", label: "Seriale/IMEI", type: "text", required: true },
    { key: "garanziaMesi", label: "Garanzia (mesi)", type: "number" }
  ],
  "cosmetici": [
    { key: "lotto", label: "Lotto", type: "text" },
    { key: "scadenza", label: "Scadenza", type: "date" },
    { key: "pao", label: "PAO", type: "number", unit: "mesi" }
  ],
  "alimentari": [
    { key: "lotto", label: "Lotto", type: "text" },
    { key: "scadenza", label: "Scadenza", type: "date" },
    { key: "allergeni", label: "Allergeni", type: "text" }
  ],
  "artigianato": [
    { key: "schedaVetrina", label: "Scheda Vetrina", type: "text" }
  ],
  "stampa": [
    { key: "schedaVetrina", label: "Scheda Vetrina", type: "text" }
  ]
};

export async function getStoreProfile(activityId: string) {
  const rows = await db.select().from(storeProfiles).where(eq(storeProfiles.activityId, activityId));
  return rows[0] || null;
}

export async function upsertStoreProfile(p: {
  userId: string; activityId: string;
  storeType: string; currency?: string|null; country?: string|null; defaultVat?: number|null;
  featureFlags?: Record<string, boolean>|null;
}) {
  const existing = await getStoreProfile(p.activityId);
  const flags = p.featureFlags || DEFAULT_FLAGS_BY_TYPE[p.storeType] || {};
  if (!existing) {
    const [ins] = await db.insert(storeProfiles).values({
      userId: p.userId, activityId: p.activityId,
      storeType: p.storeType, featureFlags: flags,
      currency: p.currency || "EUR", country: p.country || "IT",
      defaultVat: String(p.defaultVat ?? 22.0)
    }).returning();
    const attrs = DEFAULT_ATTRS_BY_TYPE[p.storeType] || [];
    for (const a of attrs) {
      await db.insert(productAttributeDefs).values({
        activityId: p.activityId,
        key: a.key, label: a.label, type: a.type, unit: a.unit || null,
        required: a.required ? "1" : "0", options: a.options ? (a.options as any) : null
      });
    }
    return ins;
  } else {
    const [upd] = await db.update(storeProfiles).set({
      storeType: p.storeType,
      featureFlags: flags,
      currency: p.currency || existing.currency,
      country: p.country || existing.country,
      defaultVat: String(p.defaultVat ?? Number(existing.defaultVat || 22.0)),
      updatedAt: new Date()
    }).where(eq(storeProfiles.id, existing.id)).returning();
    return upd;
  }
}
