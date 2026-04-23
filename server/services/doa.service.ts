import { getDb } from "../db/data-source";
import { DoaClaim, DoaClaimStatus } from "../entities/DoaClaim";
import { DoaItem } from "../entities/DoaItem";
import { DoaPhotoGroup } from "../entities/DoaPhotoGroup";
import { DoaReport } from "../entities/DoaReport";
import { Order } from "../entities/Order";
import { log } from "../logger";
import { Shipment } from "../entities/Shipment";
import { getObjectBuffer, uploadBuffer, getDownloadUrl } from "./storage.service";
import { addDoaCredit, getCompanyIdForUser } from "./credit.service";
import { generateDoaReportPdfBuffer, type DoaPdfGroup } from "./doa-pdf.service";
import JSZip from "jszip";

export type DoaGroupInput = {
  imageKeys: string[];
  items: { orderItemId: string; quantity: number }[];
};

export async function createDoaClaim(orderId: string, groups: DoaGroupInput[]) {
  const db = await getDb();
  const claimRepo = db.getRepository(DoaClaim);
  const groupRepo = db.getRepository(DoaPhotoGroup);
  const itemRepo = db.getRepository(DoaItem);

  const existing = await claimRepo.findOne({ where: { orderId } });
  if (existing) throw new Error("A DOA claim already exists for this order");

  const claim = await claimRepo.save(claimRepo.create({
    orderId,
    status: DoaClaimStatus.PENDING,
  }));

  for (const group of groups) {
    const saved = await groupRepo.save(groupRepo.create({
      claimId: claim.id,
      imageKeys: group.imageKeys,
    }));
    await itemRepo.save(group.items.map((item) => itemRepo.create({
      claimId: claim.id,
      photoGroupId: saved.id,
      orderItemId: item.orderItemId,
      quantity: item.quantity,
    })));
  }

  return claim;
}

const claimRelations = [
  "photoGroups",
  "photoGroups.items",
  "photoGroups.items.orderItem",
  "items",
  "items.orderItem",
];

export async function getDoaClaimByOrderId(orderId: string) {
  const db = await getDb();
  return db.getRepository(DoaClaim).findOne({
    where: { orderId },
    relations: claimRelations,
  });
}

export async function getDoaClaimById(claimId: string) {
  const db = await getDb();
  return db.getRepository(DoaClaim).findOne({
    where: { id: claimId },
    relations: [
      ...claimRelations,
      "order",
      "order.user",
      "order.shipment",
      "order.items",
    ],
  });
}

export async function getAllDoaClaimsGrouped() {
  const db = await getDb();
  const claims = await db.getRepository(DoaClaim).find({
    relations: [
      ...claimRelations,
      "order",
      "order.user",
      "order.shipment",
    ],
    order: { createdAt: "DESC" },
  });

  const shipmentMap = new Map<string, {
    shipment: { id: string; name: string };
    claims: typeof claims;
    latestReportId: string | null;
  }>();

  for (const claim of claims) {
    const shipmentId = claim.order.shipmentId || "catalog";
    if (!shipmentMap.has(shipmentId)) {
      shipmentMap.set(shipmentId, {
        shipment: { id: shipmentId, name: claim.order.shipment?.name || "Catalog Order" },
        claims: [],
        latestReportId: null,
      });
    }
    shipmentMap.get(shipmentId)!.claims.push(claim);
  }

  const reportRepo = db.getRepository(DoaReport);
  for (const [shipmentId, group] of shipmentMap) {
    if (shipmentId === "catalog") continue;
    const report = await reportRepo.findOne({
      where: { shipmentId },
      order: { createdAt: "DESC" },
    });
    group.latestReportId = report?.id ?? null;
  }

  return Array.from(shipmentMap.values());
}

export type DoaItemAction = "approve" | "deny" | "pending";

export async function updateDoaItemStates(
  claimId: string,
  updates: { itemId: string; action: DoaItemAction }[]
) {
  const db = await getDb();
  const itemRepo = db.getRepository(DoaItem);
  const claimRepo = db.getRepository(DoaClaim);

  for (const update of updates) {
    const patch =
      update.action === "approve"
        ? { approved: true, denied: false }
        : update.action === "deny"
          ? { approved: false, denied: true }
          : { approved: false, denied: false };
    await itemRepo.update({ id: update.itemId, claimId }, patch);
  }

  await claimRepo.update(claimId, { status: DoaClaimStatus.REVIEWED });

  return getDoaClaimById(claimId);
}

export async function approveAllItemsForClaim(claimId: string) {
  const db = await getDb();
  const itemRepo = db.getRepository(DoaItem);
  const claimRepo = db.getRepository(DoaClaim);

  await itemRepo.update({ claimId }, { approved: true, denied: false });
  await claimRepo.update(claimId, { status: DoaClaimStatus.REVIEWED });

  return getDoaClaimById(claimId);
}

type ReportableGroup = {
  items: { name: string; quantity: number }[];
  imageKeys: string[];
};

function collectReportableGroups(claims: DoaClaim[]): ReportableGroup[] {
  const out: ReportableGroup[] = [];
  for (const claim of claims) {
    for (const group of claim.photoGroups || []) {
      const items = (group.items || [])
        .filter((item) => !item.denied)
        .map((item) => ({ name: item.orderItem.name, quantity: item.quantity }));
      if (items.length === 0) continue;
      out.push({ items, imageKeys: group.imageKeys || [] });
    }
  }
  return out;
}

export async function generateDoaReport(shipmentId: string) {
  const db = await getDb();
  const claimRepo = db.getRepository(DoaClaim);
  const reportRepo = db.getRepository(DoaReport);

  const shipment = await db.getRepository(Shipment).findOneByOrFail({ id: shipmentId });

  const claims = await claimRepo.find({
    where: { order: { shipmentId } },
    relations: [
      ...claimRelations,
      "order",
      "order.user",
      "order.items",
    ],
  });

  const reportable = collectReportableGroups(claims);

  let reportText = `DOA Report - ${shipment.name}\n`;
  reportText += `Generated: ${new Date().toLocaleString("en-GB")}\n`;
  reportText += `${"=".repeat(50)}\n\n`;

  if (reportable.length === 0) {
    reportText += "No DOA items for this shipment.\n";
  } else {
    for (const group of reportable) {
      for (const item of group.items) {
        reportText += `Item: ${item.name}\n`;
        reportText += `Quantity DOA: ${item.quantity}\n`;
      }
      reportText += `Images: ${(group.imageKeys || []).map((k) => k.split("/").pop()).join(", ")}\n`;
      reportText += `${"-".repeat(30)}\n`;
    }
    const totalItems = reportable.reduce((n, g) => n + g.items.length, 0);
    reportText += `\nTotal DOA items: ${totalItems}\n`;
  }

  let zipKey: string | null = null;

  if (reportable.length > 0) {
    const zip = new JSZip();
    zip.file("report.txt", reportText);

    for (let gi = 0; gi < reportable.length; gi++) {
      const group = reportable[gi];
      const label = group.items
        .map((i) => i.name.replace(/[^a-zA-Z0-9]/g, "_"))
        .join("_")
        .slice(0, 80) || `group_${gi + 1}`;
      for (const key of group.imageKeys || []) {
        try {
          const buffer = await getObjectBuffer(key);
          const filename = `${label}_${key.split("/").pop()}`;
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
    for (const item of claim.items || []) {
      if (item.approved) {
        creditAmount += item.quantity * Number(item.orderItem.unitPrice);
      }
    }
    if (creditAmount > 0 && claim.order.userId) {
      try {
        const companyId = await getCompanyIdForUser(claim.order.userId);
        if (!companyId) throw new Error("User has no company — cannot credit");
        await addDoaCredit(
          companyId,
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

export async function generateDoaReportPdfForShipment(shipmentId: string): Promise<{
  buffer: Buffer;
  shipmentName: string;
} | null> {
  const db = await getDb();
  const shipment = await db.getRepository(Shipment).findOneByOrFail({ id: shipmentId });

  const claims = await db.getRepository(DoaClaim).find({
    where: { order: { shipmentId } },
    relations: [
      ...claimRelations,
      "order",
    ],
  });

  const pdfGroups: DoaPdfGroup[] = [];
  for (const claim of claims) {
    for (const group of claim.photoGroups || []) {
      const items = (group.items || [])
        .filter((item) => !item.denied)
        .map((item) => ({ name: item.orderItem.name, quantity: item.quantity }));
      if (items.length === 0) continue;

      const images: { buffer: Buffer; key: string }[] = [];
      for (const key of group.imageKeys || []) {
        try {
          const buffer = await getObjectBuffer(key);
          images.push({ buffer, key });
        } catch (e) {
          log.error(`Failed to fetch DOA image for PDF: ${key}`, e);
        }
      }
      pdfGroups.push({ items, images });
    }
  }

  const buffer = await generateDoaReportPdfBuffer(pdfGroups);
  return { buffer, shipmentName: shipment.name };
}
