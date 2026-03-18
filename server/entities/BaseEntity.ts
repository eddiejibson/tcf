import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export abstract class BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;
}

export abstract class BaseEntityWithUpdate extends BaseEntity {
  @UpdateDateColumn({ type: "timestamp" })
  updatedAt: Date;
}
