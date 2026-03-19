import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Relation } from "typeorm";
import { BaseEntity } from "./BaseEntity";

@Entity("categories")
export class Category extends BaseEntity {
  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "uuid", nullable: true })
  parentId: string | null;

  @ManyToOne(() => Category, (cat) => cat.children, { nullable: true })
  @JoinColumn({ name: "parentId" })
  parent: Relation<Category> | null;

  @OneToMany(() => Category, (cat) => cat.parent)
  children: Relation<Category[]>;

  @Column({ type: "int", default: 0 })
  sortOrder: number;
}

export type CategoryType = Omit<Category, "parent" | "children">;
