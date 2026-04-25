import { Entity, Column, Index, Unique } from "typeorm";
import { BaseEntity } from "./BaseEntity";

@Entity("webhook_events")
@Unique("UQ_webhook_events_provider_eventId", ["provider", "eventId"])
@Index("IDX_webhook_events_provider_event", ["provider", "eventId"])
export class WebhookEvent extends BaseEntity {
  @Column({ type: "varchar" })
  provider: string;

  @Column({ type: "varchar" })
  eventId: string;

  @Column({ type: "varchar", nullable: true })
  eventType: string | null;
}
