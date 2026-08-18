import type { Place } from "../types/index.js";

/**
 * TMU landmarks used for instant, offline-first search suggestions.
 * Combined with Nominatim results when the user searches beyond the campus.
 */
export const TMU_PLACES: Place[] = [
  {
    id: "pl-slc",
    label: "Student Learning Centre (SLC)",
    description: "341 Yonge Street",
    latitude: 43.6577,
    longitude: -79.3802,
    buildingId: "slc",
    source: "tmu",
  },
  {
    id: "pl-eng",
    label: "George Vari Engineering and Computing Centre (ENG)",
    description: "245 Church Street",
    latitude: 43.658112,
    longitude: -79.377632,
    buildingId: "eng",
    source: "tmu",
  },
  {
    id: "pl-jorg",
    label: "Jorgenson Hall (JOR)",
    description: "380 Victoria Street",
    latitude: 43.65733,
    longitude: -79.37792,
    buildingId: "jorg",
    source: "tmu",
  },
  {
    id: "pl-lib",
    label: "University Library",
    description: "350 Victoria Street",
    latitude: 43.6575,
    longitude: -79.3782,
    buildingId: "lib",
    source: "tmu",
  },
  {
    id: "pl-pod",
    label: "Podium Building",
    description: "350 Victoria Street",
    latitude: 43.65731,
    longitude: -79.37814,
    buildingId: "pod",
    source: "tmu",
  },
  {
    id: "pl-trsm",
    label: "Ted Rogers School of Management (TRSM)",
    description: "55 Dundas Street West",
    latitude: 43.65703,
    longitude: -79.3815,
    buildingId: "trsm",
    source: "tmu",
  },
  {
    id: "pl-rcc",
    label: "Roger's Communications Centre (RCC)",
    description: "80 Gould Street",
    latitude: 43.65822,
    longitude: -79.3794,
    buildingId: "rcc",
    source: "tmu",
  },
  {
    id: "pl-khs",
    label: "Kerr Hall South (KHS)",
    description: "379 Victoria Street",
    latitude: 43.6579,
    longitude: -79.3787,
    buildingId: "khs",
    source: "tmu",
  },
];

export const DEFAULT_PLACES: Place[] = TMU_PLACES;