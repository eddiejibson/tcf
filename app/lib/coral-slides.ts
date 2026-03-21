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

/** Ordered list of coral image numbers that actually exist on disk */
export const CORAL_IMAGE_IDS = Object.keys(CORAL_IMAGE_NAMES).map(Number);

/** Ordered list of fish image numbers */
export const FISH_IMAGE_IDS = Object.keys(FISH_IMAGE_NAMES).map(Number);

export interface SlideInfo {
  src: string;
  alt: string;
  name: string;
}

/** Build all slides and shuffle so no two consecutive slides share the same name */
export function buildShuffledSlides(): SlideInfo[] {
  const all: SlideInfo[] = [];

  for (const id of CORAL_IMAGE_IDS) {
    all.push({ src: `/coral-images/${id}.jpg`, alt: `Coral ${id}`, name: CORAL_IMAGE_NAMES[id] });
  }
  for (const id of FISH_IMAGE_IDS) {
    all.push({ src: `/fish-images/${id}.jpg`, alt: `Fish ${id}`, name: FISH_IMAGE_NAMES[id] });
  }

  // Fisher-Yates shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  // Fix consecutive duplicates: swap with the next non-duplicate
  for (let i = 1; i < all.length; i++) {
    if (all[i].name === all[i - 1].name) {
      let swapped = false;
      for (let j = i + 1; j < all.length; j++) {
        if (all[j].name !== all[i - 1].name && (i + 1 >= all.length || all[j].name !== all[i + 1]?.name)) {
          [all[i], all[j]] = [all[j], all[i]];
          swapped = true;
          break;
        }
      }
      // If we couldn't find a swap forward, try backward
      if (!swapped) {
        for (let j = 0; j < i - 1; j++) {
          if (all[j].name !== all[i].name && all[j].name !== all[j + 1]?.name) {
            [all[i], all[j]] = [all[j], all[i]];
            break;
          }
        }
      }
    }
  }

  return all;
}
