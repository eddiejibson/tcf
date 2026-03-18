import { Repository, ObjectLiteral, FindOptionsWhere, DeepPartial } from "typeorm";
import { getDb } from "../db/data-source";

export abstract class BaseService<T extends ObjectLiteral> {
  protected abstract entity: new () => T;
  private _repo: Repository<T> | null = null;

  protected async repo(): Promise<Repository<T>> {
    if (!this._repo) {
      const db = await getDb();
      this._repo = db.getRepository(this.entity);
    }
    return this._repo;
  }

  async findById(id: string, relations?: string[]): Promise<T | null> {
    const r = await this.repo();
    return r.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
      relations,
    });
  }

  async findAll(relations?: string[]): Promise<T[]> {
    const r = await this.repo();
    return r.find({ relations });
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const r = await this.repo();
    const entity = r.create(data);
    return r.save(entity);
  }

  async update(id: string, data: DeepPartial<T>): Promise<T | null> {
    const r = await this.repo();
    const existing = await this.findById(id);
    if (!existing) return null;
    const merged = r.merge(existing, data);
    return r.save(merged);
  }

  async delete(id: string): Promise<boolean> {
    const r = await this.repo();
    const result = await r.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
