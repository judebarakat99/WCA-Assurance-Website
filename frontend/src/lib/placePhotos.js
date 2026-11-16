// Photos for the map's hover cards (Wikimedia Commons, credited on the card).
import data from "./placePhotos.json" with { type: "json" };
import { publicAssetUrl } from "@/lib/assets.mjs";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const BY_ID = new Map(data.photos.map((p) => [p.id, p]));

function photo(id) {
  const p = BY_ID.get(id);
  return p && { ...p, src: publicAssetUrl(`/Assets/places/${p.file}`, BASE), credit: `${p.author} · ${p.license}` };
}

/** A host city's photo, or null when there is no free photo (NEOM). */
export const cityPhoto = (cityId) => photo(`city-${cityId}`);

/**
 * A stadium's own photo; otherwise its host city's photo, flagged `stand_in`
 * so the card can say so (most stadiums are not built yet).
 */
export function stadiumPhoto(stadiumId, cityId) {
  const own = photo(`stadium-${stadiumId}`);
  if (own) return own;
  const city = cityPhoto(cityId);
  return city ? { ...city, standIn: true } : null;
}
