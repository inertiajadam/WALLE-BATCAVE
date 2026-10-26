/** Species metadata used by the model and the UI. Codes follow NABat four-letter conventions. */
export type Ecology = "hibernator" | "migrant" | "resident";

export interface Species {
  code: string;
  sci: string;
  common: string;
  ecology: Ecology;
  /** USFWS Endangered Species Act status, where listed. */
  status?: "Endangered" | "Threatened" | "Proposed endangered" | "Under review";
  /** Relative weight in the community activity index (listed species count more). */
  weight: number;
  /** Where the spatial layer comes from. */
  layer: "nabat" | "gbif";
  color: [number, number, number];
  note: string;
}

export const SPECIES: Species[] = [
  { code: "TABR", sci: "Tadarida brasiliensis", common: "Mexican free-tailed bat", ecology: "migrant", weight: 1, layer: "gbif", color: [255, 170, 60], note: "Forms the largest colonies on Earth in Texas; long-distance migrant to Mexico. Fast, high-flying, forages over highways and lit areas." },
  { code: "LACI", sci: "Lasiurus cinereus", common: "Hoary bat", ecology: "migrant", weight: 1.2, layer: "nabat", color: [220, 120, 255], note: "Continent-wide tree bat and long-distance migrant; the species most often killed at wind turbines, and under review for listing." , status: "Under review"},
  { code: "LANO", sci: "Lasionycteris noctivagans", common: "Silver-haired bat", ecology: "migrant", weight: 1, layer: "nabat", color: [160, 160, 255], note: "Migratory tree bat; spring and fall movement peaks." },
  { code: "LABO", sci: "Lasiurus borealis", common: "Eastern red bat", ecology: "migrant", weight: 1, layer: "gbif", color: [255, 90, 90], note: "Migratory tree bat of the eastern US; attracted to insects around lights." },
  { code: "EPFU", sci: "Eptesicus fuscus", common: "Big brown bat", ecology: "resident", weight: 0.8, layer: "nabat", color: [200, 160, 110], note: "Widespread, light-tolerant; least displaced by lighting in experiments." },
  { code: "MYLU", sci: "Myotis lucifugus", common: "Little brown bat", ecology: "hibernator", weight: 1.5, layer: "nabat", color: [120, 200, 255], note: "Devastated by white-nose syndrome; displaced at least 75 m (250 ft) by LED lighting (Connecticut experiment)." , status: "Under review"},
  { code: "MYSO", sci: "Myotis sodalis", common: "Indiana bat", ecology: "hibernator", weight: 2, layer: "gbif", color: [90, 255, 200], note: "Federally endangered; avoids crossing roads when traffic is present." , status: "Endangered"},
  { code: "MYSE", sci: "Myotis septentrionalis", common: "Northern long-eared bat", ecology: "hibernator", weight: 2, layer: "nabat", color: [60, 220, 160], note: "Federally endangered since 2023; light-averse forest bat." , status: "Endangered"},
  { code: "PESU", sci: "Perimyotis subflavus", common: "Tricolored bat", ecology: "hibernator", weight: 2, layer: "nabat", color: [255, 220, 120], note: "Proposed endangered; one of the species hit hardest by white-nose syndrome." , status: "Proposed endangered"},
  { code: "MYGR", sci: "Myotis grisescens", common: "Gray bat", ecology: "hibernator", weight: 2, layer: "nabat", color: [180, 180, 180], note: "Federally endangered cave bat of the Kentucky and Tennessee karst; commutes along rivers and roads." , status: "Endangered"},
  { code: "MYLE", sci: "Myotis leibii", common: "Eastern small-footed bat", ecology: "hibernator", weight: 1.3, layer: "nabat", color: [150, 210, 190], note: "Rock-roosting bat of the Appalachians." },
  { code: "MYEV", sci: "Myotis evotis", common: "Long-eared myotis", ecology: "hibernator", weight: 1, layer: "nabat", color: [140, 255, 140], note: "Western forest bat; gleans insects from foliage." },
  { code: "MYTH", sci: "Myotis thysanodes", common: "Fringed myotis", ecology: "hibernator", weight: 1, layer: "nabat", color: [100, 230, 100], note: "Western bat of oak and pine woodlands." },
  { code: "MYVO", sci: "Myotis volans", common: "Long-legged myotis", ecology: "hibernator", weight: 1, layer: "nabat", color: [80, 200, 120], note: "Western montane bat." },
  { code: "MYYU", sci: "Myotis yumanensis", common: "Yuma myotis", ecology: "hibernator", weight: 1, layer: "nabat", color: [120, 220, 220], note: "Forages low over western rivers and reservoirs." },
];

export const SPECIES_BY_CODE: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.code, s]));
export const FLAGSHIPS = ["TABR", "LACI", "MYSO", "MYLU"];
