import { getDb } from "../db/data-source";
import { Category } from "../entities/Category";
import { CatalogProduct } from "../entities/CatalogProduct";

export async function getAllCategories() {
  const db = await getDb();
  return db.getRepository(Category).find({
    order: { sortOrder: "ASC", name: "ASC" },
  });
}

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  children: CategoryNode[];
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  const all = await getAllCategories();
  const map = new Map<string, CategoryNode>();

  for (const cat of all) {
    map.set(cat.id, {
      id: cat.id,
      name: cat.name,
      parentId: cat.parentId,
      sortOrder: cat.sortOrder,
      children: [],
    });
  }

  const roots: CategoryNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function createCategory(data: {
  name: string;
  parentId?: string | null;
  sortOrder?: number;
}) {
  const db = await getDb();
  const repo = db.getRepository(Category);
  const cat = repo.create({
    name: data.name,
    parentId: data.parentId || null,
    sortOrder: data.sortOrder ?? 0,
  });
  return repo.save(cat);
}

export async function updateCategory(
  id: string,
  data: Partial<{ name: string; parentId: string | null; sortOrder: number }>
) {
  const db = await getDb();
  const repo = db.getRepository(Category);
  const existing = await repo.findOneBy({ id });
  if (!existing) return null;
  Object.assign(existing, data);
  return repo.save(existing);
}

export async function deleteCategory(id: string) {
  const db = await getDb();
  // Check no products reference this category
  const productCount = await db
    .getRepository(CatalogProduct)
    .count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw new Error("Cannot delete category with existing products");
  }
  // Check no child categories
  const childCount = await db
    .getRepository(Category)
    .count({ where: { parentId: id } });
  if (childCount > 0) {
    throw new Error("Cannot delete category with child categories");
  }
  await db.getRepository(Category).delete(id);
}
