import { getDb } from "../db/data-source";
import { DoaClaim, DoaClaimStatus } from "../entities/DoaClaim";
import { DoaItem } from "../entities/DoaItem";
import { DoaReport } from "../entities/DoaReport";
import { Order } from "../entities/Order";
import { log } from "../logger";
import { Shipment } from "../entities/Shipment";
import { getObjectBuffer, uploadBuffer, getDownloadUrl } from "./storage.service";
import { addDoaCredit } from "./credit.service";
import JSZip from "jszip";

export async function createDoaClaim(
  orderId: string,
  items: { orderItemId: string; quantity: number; imageKeys: string[] }[]
) {
  const db = await getDb();
  const claimRepo = db.getRepository(DoaClaim);

  const existing = await claimRepo.findOne({ where: { orderId } });
  if (existing) throw new Error("A DOA claim already exists for this order");

  const claim = claimRepo.create({
    orderId,
    status: DoaClaimStatus.PENDING,
    items: items.map((item) => {
      const doaItem = new DoaItem();
      doaItem.orderItemId = item.orderItemId;
      doaItem.quantity = item.quantity;
      doaItem.imageKeys = item.imageKeys;
      return doaItem;
    }),
  });

  return claimRepo.save(claim);
}

export async function getDoaClaimByOrderId(orderId: string) {
  const db = await getDb();
  return db.getRepository(DoaClaim).findOne({
    where: { orderId },
    relations: ["items", "items.orderItem"],
  });
}

export async function getDoaClaimById(claimId: string) {
  const db = await getDb();
  return db.getRepository(DoaClaim).findOne({
    where: { id: claimId },
    relations: ["items", "items.orderItem", "order", "order.user", "order.shipment", "order.items"],
  });
}

export async function getAllDoaClaimsGrouped() {
  const db = await getDb();
  const claims = await db.getRepository(DoaClaim).find({
    relations: ["items", "items.orderItem", "order", "order.user", "order.shipment"],
    order: { createdAt: "DESC" },
  });

  const shipmentMap = new Map<string, {
    shipment: { id: string; name: string };
    claims: typeof claims;
    hasReport: boolean;
  }>();

  for (const claim of claims) {
    const shipmentId = claim.order.shipmentId || "catalog";
    if (!shipmentMap.has(shipmentId)) {
      shipmentMap.set(shipmentId, {
        shipment: { id: shipmentId, name: claim.order.shipment?.name || "Catalog Order" },
        claims: [],
        hasReport: false,
      });
    }
    shipmentMap.get(shipmentId)!.claims.push(claim);
  }

  const reportRepo = db.getRepository(DoaReport);
  for (const [shipmentId, group] of shipmentMap) {
    if (shipmentId === "catalog") continue;
    const report = await reportRepo.findOne({ where: { shipmentId } });
    group.hasReport = !!report;
  }

  return Array.from(shipmentMap.values());
}

export async function updateDoaItemApprovals(
  claimId: string,
  approvals: { itemId: string; approved: boolean }[]
) {
  const db = await getDb();
  const itemRepo = db.getRepository(DoaItem);
  const claimRepo = db.getRepository(DoaClaim);

  for (const approval of approvals) {
    await itemRepo.update(
      { id: approval.itemId, claimId },
      { approved: approval.approved }
    );
  }

  await claimRepo.update(claimId, { status: DoaClaimStatus.REVIEWED });

  return getDoaClaimById(claimId);
}

export async function approveAllItemsForClaim(claimId: string) {
  const db = await getDb();
  const itemRepo = db.getRepository(DoaItem);
  const claimRepo = db.getRepository(DoaClaim);

  await itemRepo.update({ claimId }, { approved: true });
  await claimRepo.update(claimId, { status: DoaClaimStatus.REVIEWED });

  return getDoaClaimById(claimId);
}

export async function generateDoaReport(shipmentId: string) {
  const db = await getDb();
  const claimRepo = db.getRepository(DoaClaim);
  const reportRepo = db.getRepository(DoaReport);

  const shipment = await db.getRepository(Shipment).findOneByOrFail({ id: shipmentId });

  const claims = await claimRepo.find({
    where: { order: { shipmentId } },
    relations: ["items", "items.orderItem", "order", "order.user", "order.items"],
  });

  const approvedItems: {
    itemName: string;
    quantity: number;
    imageKeys: string[];
  }[] = [];

  for (const claim of claims) {
    for (const item of claim.items) {
      if (item.approved) {
        approvedItems.push({
          itemName: item.orderItem.name,
          quantity: item.quantity,
          imageKeys: item.imageKeys || [],
        });
      }
    }
  }

  let reportText = `DOA Report - ${shipment.name}\n`;
  reportText += `Generated: ${new Date().toLocaleString("en-GB")}\n`;
  reportText += `${"=".repeat(50)}\n\n`;

  if (approvedItems.length === 0) {
    reportText += "No approved DOA items for this shipment.\n";
  } else {
    for (const item of approvedItems) {
      reportText += `Item: ${item.itemName}\n`;
      reportText += `Quantity DOA: ${item.quantity}\n`;
      reportText += `Images: ${(item.imageKeys || []).map((k) => k.split("/").pop()).join(", ")}\n`;
      reportText += `${"-".repeat(30)}\n`;
    }
    reportText += `\nTotal approved DOA items: ${approvedItems.length}\n`;
  }

  let zipKey: string | null = null;

  if (approvedItems.length > 0) {
    const zip = new JSZip();
    zip.file("report.txt", reportText);

    for (const item of approvedItems) {
      for (const key of item.imageKeys || []) {
        try {
          const buffer = await getObjectBuffer(key);
          const filename = `${item.itemName.replace(/[^a-zA-Z0-9]/g, "_")}_${key.split("/").pop()}`;
          zip.file(filename, buffer);
        } catch (e) {
          log.error(`Failed to fetch DOA image: ${key}`, e);
        }
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    zipKey = `doa-reports/${shipmentId}/${Date.now()}-report.zip`;
    await uploadBuffer(zipKey, zipBuffer, "application/zip");
  }

  const report = reportRepo.create({
    shipmentId,
    reportText,
    zipKey,
  });
  await reportRepo.save(report);

  for (const claim of claims) {
    await claimRepo.update(claim.id, { status: DoaClaimStatus.REPORTED });

    // Auto-credit user for approved DOA items (item value only, no freight/VAT)
    let creditAmount = 0;
    for (const item of claim.items) {
      if (item.approved) {
        creditAmount += item.quantity * Number(item.orderItem.unitPrice);
      }
    }
    if (creditAmount > 0) {
      try {
        await addDoaCredit(
          claim.order.userId,
          creditAmount,
          `DOA credit: ${shipment.name}`,
          claim.id
        );
      } catch (e) {
        log.error(`Failed to add DOA credit for claim ${claim.id}`, e);
      }
    }
  }

  return report;
}

export async function getDoaReport(reportId: string) {
  const db = await getDb();
  return db.getRepository(DoaReport).findOne({
    where: { id: reportId },
    relations: ["shipment"],
  });
}

export async function getDoaReportByShipmentId(shipmentId: string) {
  const db = await getDb();
  return db.getRepository(DoaReport).findOne({
    where: { shipmentId },
    relations: ["shipment"],
  });
}

export async function getDoaReportDownloadUrl(reportId: string): Promise<string | null> {
  const db = await getDb();
  const report = await db.getRepository(DoaReport).findOneBy({ id: reportId });
  if (!report || !report.zipKey) return null;
  return getDownloadUrl(report.zipKey);
}
