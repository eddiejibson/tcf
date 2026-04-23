import { DoaClaim } from "../entities/DoaClaim";
import { getDownloadUrl } from "./storage.service";

export async function claimWithGroupUrls(claim: DoaClaim) {
  const groups = await Promise.all(
    (claim.photoGroups || []).map(async (group) => ({
      ...group,
      imageUrls: await Promise.all((group.imageKeys || []).map((k) => getDownloadUrl(k))),
    }))
  );
  return { ...claim, groups };
}
