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

/**
 * Toronto-wide landmarks for instant, offline-first search suggestions,
 * combined with Nominatim results for anything else.
 */
export const TORONTO_PLACES: Place[] = [
  ...TMU_PLACES,
  { id: "pl-union", label: "Union Station", description: "65 Front Street West", latitude: 43.6453, longitude: -79.3806, source: "tmu" },
  { id: "pl-cn", label: "CN Tower", description: "290 Bremner Boulevard", latitude: 43.6426, longitude: -79.3871, source: "tmu" },
  { id: "pl-eaton", label: "Eaton Centre", description: "220 Yonge Street", latitude: 43.6542, longitude: -79.3805, source: "tmu" },
  { id: "pl-nps", label: "Nathan Phillips Square", description: "100 Queen Street West", latitude: 43.6524, longitude: -79.3835, source: "tmu" },
  { id: "pl-stm", label: "St. Michael's Hospital", description: "30 Bond Street", latitude: 43.6539, longitude: -79.3785, source: "tmu" },
  { id: "pl-ugh", label: "Toronto General Hospital", description: "200 Elizabeth Street", latitude: 43.6597, longitude: -79.3891, source: "tmu" },
  { id: "pl-royal", label: "Royal Ontario Museum", description: "100 Queen's Park", latitude: 43.6677, longitude: -79.3948, source: "tmu" },
  { id: "pl-uoft", label: "University of Toronto (St. George)", description: "27 King's College Circle", latitude: 43.6613, longitude: -79.3964, source: "tmu" },
  { id: "pl-harbour", label: "Harbourfront Centre", description: "235 Queens Quay West", latitude: 43.6384, longitude: -79.3787, source: "tmu" },
  { id: "pl-rye", label: "Ryerson / TMU Athletics", description: "350 Victoria Street", latitude: 43.6566, longitude: -79.3786, source: "tmu" },
];

export const DEFAULT_PLACES: Place[] = TORONTO_PLACES;