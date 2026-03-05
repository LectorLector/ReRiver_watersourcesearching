export interface LocationHierarchy {
  [cityDistrict: string]: {
    [road: string]: any[];
  };
}

export interface WaterSource {
  groundwater: string;
  surface_water: string;
  reservoir: string;
  seawater: string;
}

export interface WaterSupplySystem {
  management: string;
  system: string;
  sources: WaterSource;
  area_text: string;
}

export type WaterSupplyMap = WaterSupplySystem[];
