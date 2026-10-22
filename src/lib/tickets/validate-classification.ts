import { db } from "@/lib/db";
import { categories, subcategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { categoryTicketType } from "./taxonomy";
export async function validateClassification(type: string, categoryId?: string | null, subcategoryId?: string | null): Promise<string | null> {
  if (!categoryId) return subcategoryId ? "Pilih kategori sebelum subkategori." : null;
  const category = await db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  if (!category?.isActive) return "Kategori tidak tersedia.";
  const expected = categoryTicketType(category);
  if (expected && expected !== type) return "Kategori tidak sesuai jenis tiket.";
  if (subcategoryId) {
    const child = await db.query.subcategories.findFirst({ where: eq(subcategories.id, subcategoryId) });
    if (!child?.isActive || child.categoryId !== categoryId) return "Subkategori tidak sesuai kategori tiket.";
  }
  return null;
}
