import { Entity, Column, ManyToMany, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Company } from "./Company";

@Entity("tags")
export class Tag extends BaseEntityWithUpdate {
  @Column({ type: "varchar" })
  name: string;

  @ManyToMany(() => Company, (company) => company.tags)
  companies: Relation<Company[]>;
}

export type TagType = Omit<Tag, "companies">;
