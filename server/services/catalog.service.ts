import { getDb } from "../db/data-source";
import { CatalogProduct } from "../entities/CatalogProduct";
import { Category } from "../entities/Category";
import { ILike } from "typeorm";

export async function getAllCatalogProducts(filters?: {
  categoryId?: string;
  search?: string;
  activeOnly?: boolean;
}) {
  const db = await getDb();
  const repo = db.getRepository(CatalogProduct);

  const where: Record<string, unknown> = {};
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.activeOnly !== false) where.active = true;
  const qb = repo.createQueryBuilder("p")
    .leftJoinAndSelect("p.category", "category")
    .orderBy("category.name", "ASC")
    .addOrderBy("p.name", "ASC");

  if (filters?.categoryId) qb.andWhere("p.categoryId = :categoryId", { categoryId: filters.categoryId });
  if (filters?.activeOnly !== false) qb.andWhere("p.active = true");
  if (filters?.search) {
    qb.andWhere("(LOWER(p.name) LIKE LOWER(:search) OR LOWER(p.latinName) LIKE LOWER(:search))", { search: `%${filters.search}%` });
  }

  return qb.getMany();
}

export async function getCatalogProductById(id: string) {
  const db = await getDb();
  return db.getRepository(CatalogProduct).findOne({
    where: { id },
    relations: ["category"],
  });
}

export async function createCatalogProduct(data: {
  name: string;
  latinName?: string | null;
  price: number;
  type: CatalogProduct["type"];
  categoryId: string;
  imageKey?: string | null;
  stockMode: CatalogProduct["stockMode"];
  stockQty?: number | null;
  stockLevel?: CatalogProduct["stockLevel"] | null;
  active?: boolean;
  wysiwyg?: boolean;
}) {
  const db = await getDb();
  const catRepo = db.getRepository(Category);
  const category = await catRepo.findOneBy({ id: data.categoryId });
  if (!category) throw new Error("Category not found");

  const repo = db.getRepository(CatalogProduct);
  const product = repo.create({
    name: data.name,
    latinName: data.latinName || null,
    price: data.price,
    type: data.type,
    categoryId: data.categoryId,
    imageKey: data.imageKey || null,
    stockMode: data.stockMode,
    stockQty: data.stockQty ?? null,
    stockLevel: data.stockLevel ?? null,
    active: data.active ?? true,
    wysiwyg: data.wysiwyg ?? false,
  });

  return repo.save(product);
}

export async function updateCatalogProduct(
  id: string,
  data: Partial<{
    name: string;
    latinName: string | null;
    price: number;
    type: CatalogProduct["type"];
    categoryId: string;
    imageKey: string | null;
    stockMode: CatalogProduct["stockMode"];
    stockQty: number | null;
    stockLevel: CatalogProduct["stockLevel"] | null;
    active: boolean;
    wysiwyg: boolean;
  }>
) {
  const db = await getDb();
  const repo = db.getRepository(CatalogProduct);
  const existing = await repo.findOneBy({ id });
  if (!existing) return null;

  if (data.categoryId) {
    const catRepo = db.getRepository(Category);
    const category = await catRepo.findOneBy({ id: data.categoryId });
    if (!category) throw new Error("Category not found");
  }

  Object.assign(existing, data);
  return repo.save(existing);
}

export async function softDeleteCatalogProduct(id: string) {
  const db = await getDb();
  const repo = db.getRepository(CatalogProduct);
  const existing = await repo.findOneBy({ id });
  if (!existing) return null;
  existing.active = false;
  return repo.save(existing);
}

export async function deductCatalogStock(id: string, qty: number) {
  const db = await getDb();
  const result = await db
    .getRepository(CatalogProduct)
    .createQueryBuilder()
    .update(CatalogProduct)
    .set({ stockQty: () => `"stockQty" - ${qty}` })
    .where("id = :id AND \"stockMode\" = 'EXACT' AND \"stockQty\" >= :qty", { id, qty })
    .execute();
  return result.affected === 1;
}

export async function restoreCatalogStock(id: string, qty: number) {
  const db = await getDb();
  await db
    .getRepository(CatalogProduct)
    .createQueryBuilder()
    .update(CatalogProduct)
    .set({ stockQty: () => `"stockQty" + ${qty}` })
    .where("id = :id AND \"stockMode\" = 'EXACT'", { id })
    .execute();
}
