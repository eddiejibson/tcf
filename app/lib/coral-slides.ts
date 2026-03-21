/** Maps coral image number (filename without extension) to the coral type name */
export const CORAL_IMAGE_NAMES: Record<number, string> = {
  1: "Goniopora",
  2: "Goniopora",
  3: "Tigers",
  4: "Chalice",
  5: "Acans",
  6: "Goniopora",
  7: "Goniopora",
  8: "Goniopora",
  10: "Chalice",
  11: "Tigers",
  12: "Chalice",
  13: "Goniopora",
  14: "Yumas",
  15: "Chalice",
  16: "Torches",
  17: "Goniopora",
  18: "Torches",
  19: "Chalice",
  20: "Chalice",
  21: "Inverts",
  22: "Goniopora",
  23: "Goniopora",
  24: "Goniopora",
  25: "Goniopora",
  26: "Goniopora",
  27: "Torches",
  28: "Symphyllia",
  29: "Torches",
  30: "Goniopora",
  31: "Goniopora",
  32: "Goniopora",
  33: "Goniopora",
  34: "Goniopora",
  35: "Yuma",
  36: "Goniopora",
  37: "Inverts",
};

/** Maps fish image number (filename without extension) to the fish type name */
export const FISH_IMAGE_NAMES: Record<number, string> = {
  1: "Wrasse",
  2: "Wrasse",
  3: "Angels",
  4: "Fish",
  5: "Firefish",
  6: "Pipefish",
  7: "Gobies",
  8: "Angel",
  9: "Wrasse",
  10: "Tangs",
  11: "Butterflies",
  12: "Wrasse",
  13: "Wrasse",
  14: "Angels",
  15: "Wrasse",
  16: "Firefish",
  17: "Wrasse",
  18: "Wrasse",
  19: "Goby",
  20: "Hawkfish",
  21: "Wrasse",
  22: "Tangs",
};

export const CORAL_IMAGE_IDS = Object.keys(CORAL_IMAGE_NAMES).map(Number);

export const FISH_IMAGE_IDS = Object.keys(FISH_IMAGE_NAMES).map(Number);

export interface SlideInfo {
  src: string;
  alt: string;
  name: string;
}

export function buildSlides(): SlideInfo[] {
  const corals: SlideInfo[] = CORAL_IMAGE_IDS.map((id) => ({
    src: `/coral-images/${id}.jpg`,
    alt: `Coral ${id}`,
    name: CORAL_IMAGE_NAMES[id],
  }));
  const fish: SlideInfo[] = FISH_IMAGE_IDS.map((id) => ({
    src: `/fish-images/${id}.jpg`,
    alt: `Fish ${id}`,
    name: FISH_IMAGE_NAMES[id],
  }));

  const result: SlideInfo[] = [];
  let ci = 0;
  let fi = 0;
  while (ci < corals.length || fi < fish.length) {
    if (ci < corals.length) result.push(corals[ci++]);
    if (ci < corals.length) result.push(corals[ci++]);
    if (fi < fish.length) result.push(fish[fi++]);
  }
  return result;
}
