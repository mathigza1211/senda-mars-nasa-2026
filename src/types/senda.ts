export type ProvenanceKind = 'measured' | 'modeled' | 'assumed' | 'medido' | 'modelado' | 'supuesto';

export interface TargetRubric {
  novedad: number;
  habitabilidad: number;
  solo_humano: number;
  novelty?: number;
  habitability?: number;
  human_only?: number;
  total_15: number;
}

export interface TargetProperties {
  id: string;
  name: string;
  type_es: string;
  type_en?: string;
  sol: number;
  elev_geoid_m: number;
  desc_es: string;
  desc_en: string;
  rubric: TargetRubric;
  S: number;
  pov_image: string;
  camera?: string;
  coord_source: string;
  source_url: string;
  kind?: ProvenanceKind;
  is_base?: boolean;
  is_shelter?: boolean;
  shielding_reduction_pct?: number;
}

export interface TargetFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: TargetProperties;
}

export interface TargetsGeoJSON {
  type: 'FeatureCollection';
  metadata?: Record<string, unknown>;
  features: TargetFeature[];
}

export interface RouteStop {
  target: string;
  min: number;
}

export interface RouteMetrics {
  distance_oneway_m: number;
  climb_m: number;
  max_grade_pct: number | null;
  duration_min: number;
  energy_MJ: number;
  o2_L: [number, number, number]; // [central, min, max]
  dose_gcr_mSv: number;
  stops: RouteStop[];
  kind?: ProvenanceKind;
}

export interface RouteItem {
  id: string;
  name: string;
  color: string;
  visits: string[];
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat][]
  };
  elevation_m: number[];
  metrics: RouteMetrics;
  placeholder: boolean;
  kind?: ProvenanceKind;
  note: string;
  note_en?: string;
}

export interface RoutesResponse {
  meta: {
    note: string;
    base: string;
    destino: string;
    kind?: ProvenanceKind;
  };
  routes: RouteItem[];
}

export interface HourlyTempPoint {
  hour: string;
  hour_num: number;
  temp_C: number;
  pressure_Pa: number;
  in_eva_window: boolean;
}

export interface EnvData {
  site: {
    name: string;
    bbox_lon_lat: [number, number, number, number];
    center_lat_lon: [number, number];
    dimensions_km: [number, number];
    elevation_range_m: [number, number];
    dem_resolution_m: number;
    min_detectable_obstacle_m: number;
    kind: ProvenanceKind;
    source: string;
  };
  time: {
    earth_date: string;
    mars_year: number;
    ls_deg: number;
    season: string;
    sol: number;
    local_solar_time: string;
    sunrise: string;
    sunset: string;
    sol_duration_min: number;
    kind: ProvenanceKind;
    source: string;
  };
  atmosphere: {
    pressure_Pa: number;
    pressure_range_Pa: [number, number];
    unit: string;
    wind_speed_m_s: number;
    wind_gust_max_m_s: number;
    kind: ProvenanceKind;
    source: string;
  };
  temperature: {
    unit: string;
    min_C: number;
    max_C: number;
    eva_window_mean_C: number;
    eva_window_range_C: [number, number];
    kind: ProvenanceKind;
    source: string;
    hourly_curve: HourlyTempPoint[];
  };
  dust: {
    optical_depth_tau: number;
    tau_range: [number, number];
    status: string;
    dust_storm_tau: number;
    dust_storm_speed_factor: number;
    unit: string;
    kind: ProvenanceKind;
    source: string;
  };
  radiation: {
    gcr_dose_mSv_per_sol: number;
    gcr_dose_range_mSv_per_sol: [number, number];
    gcr_dose_uSv_per_hour: number;
    unit: string;
    kind: ProvenanceKind;
    source: string;
    solar_storm: {
      event_name: string;
      unshielded_dose_rate_mSv_per_hr: number;
      peak_event_dose_mSv: number;
      kind: ProvenanceKind;
      source: string;
    };
    limits: {
      career_limit_mSv: number;
      event_30day_limit_mSv: number;
      eva_nominal_budget_mSv: number;
      kind: ProvenanceKind;
      source: string;
    };
    shielding: {
      open_plain_reduction_pct: number;
      boxwork_hollow_reduction_pct: number;
      ridge_escarpment_shelter_reduction_pct: number;
      primary_shelter_target: string;
      primary_shelter_coords: [number, number];
      kind: ProvenanceKind;
      source: string;
    };
  };
  eva_window: {
    start: string;
    end: string;
    max_duration_min: number;
    temp_min_C: number;
    temp_max_C: number;
    solar_elevation_min_deg: number;
    kind: ProvenanceKind;
    rationale: string;
  };
  terrain_classes: {
    passable: { min_deg: number; max_deg: number; label: string; risk_score: number; color: string };
    caution: { min_deg: number; max_deg: number; label: string; risk_score: number; color: string };
    impassable: { min_deg: number; max_deg: number; label: string; risk_score: number; color: string };
    kind: ProvenanceKind;
    source: string;
  };
  physiology: {
    astronaut_mass_kg: number;
    suit_and_plss_mass_kg: number;
    total_mass_kg: number;
    gravity_mars_m_s2: number;
    gravity_ratio: number;
    suit_metabolic_multiplier: number;
    terrain_factor_eta: number;
    nominal_walking_speed_m_s: number;
    stop_science_metabolic_rate_W: number;
    energy_to_o2_kJ_per_L: number;
    o2_uncertainty_fraction: number;
    plss_o2_capacity_L: number;
    return_safety_factor: number;
    caution_margin_threshold: number;
    suit_leak_multiplier: number;
    injury_speed_multiplier: number;
    kind: ProvenanceKind;
    source: string;
  };
}

export type AlertLevel = 'info' | 'caution' | 'return now';

export type ScenarioType =
  | 'nominal'
  | 'solar_storm'
  | 'dust_storm'
  | 'suit_leak'
  | 'injury'
  | 'blocked_path';

export interface ReplanResponse {
  route: RouteItem;
  safe_return_zone?: {
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: [number, number][][];
    };
    properties: {
      radius_mean_m: number;
      o2_left_L: number;
      level: AlertLevel;
      kind: ProvenanceKind;
    };
  };
  alert: {
    level: AlertLevel;
    title: string;
    message: string;
    shelter_target: string | null;
    shielding_reduction_pct: number;
    reserve: {
      o2_left_L: number;
      o2_return_required_L: number;
      margin_L: number;
      margin_ratio: number;
      level: AlertLevel;
      action: string;
      scenario: string;
      speed_multiplier: number;
      consumption_multiplier: number;
      kind: ProvenanceKind;
    };
    kind: ProvenanceKind;
  };
}

export interface LayerConfig {
  id: string;
  name: string;
  enabled: boolean;
  opacity: number;
  kind: ProvenanceKind;
  mission: string;
  instrument: string;
  resolution: string;
  date_sol: string;
  coverage: string;
  limitations: string;
  legend: { label: string; color: string }[];
}
