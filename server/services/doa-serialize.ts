import { DoaClaim } from "../entities/DoaClaim";
import { getDownloadUrl } from "./storage.service";

export async function claimWithGroupUrls(claim: DoaClaim) {
  const groups = await Promise.all(
    (claim.photoGroups || []).map(async (group) => {
      const imageUrls = await Promise.all((group.imageKeys || []).map((k) => getDownloadUrl(k)));
      return {
        ...group,
        imageUrls,
        items: (group.items || []).map((item) => ({ ...item, imageUrls })),
      };
    })
  );

  // Legacy shape: items[] flattened from all groups, each carrying its
  // group's imageUrls. Old frontends read claim.items[i].imageUrls directly.
  const items = groups.flatMap((g) => g.items);

  return { ...claim, items, groups };
}
