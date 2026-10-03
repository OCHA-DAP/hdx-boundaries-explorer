import { ADMIN_SOURCES } from "$lib/sources";

export interface ViewState {
  country: string;
  source?: string;
  level?: number;
  kiosk: boolean;
}

function parseView(params: URLSearchParams): ViewState {
  const source = params.get("source") ?? "";
  const level = Number(params.get("level"));
  return {
    country: (params.get("country") ?? "").toUpperCase(),
    source: ADMIN_SOURCES.some((s) => s.id === source) ? source : undefined,
    level: Number.isInteger(level) && level > 0 ? level : undefined,
    kiosk: params.has("kiosk"),
  };
}

// A hash view wins over the query string, so an embedding page can drive the map by changing
// only the hash, which fires hashchange instead of reloading the iframe.
export function viewFromUrl(url: URL | Location): ViewState {
  const hash = new URLSearchParams(url.hash.slice(1));
  return parseView(hash.size > 0 ? hash : new URLSearchParams(url.search));
}
