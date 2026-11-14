import targetsLocal from '../../data/targets_v0.geojson';
import envLocal from '../../data/env.json';
import mockRoutesLocal from '../../data/mock_routes.json';
import {
  AlertLevel,
  EnvData,
  ReplanResponse,
  RouteItem,
  RoutesResponse,
  ScenarioType,
  TargetsGeoJSON,
} from '../types/senda';

const FASTAPI_BASE_URL = 'http://localhost:8000';

export const BBOX_MARS: [number, number, number, number] = [
  137.37204,
  -4.8126,
  137.40596,
  -4.7788,
];

const CONTROL_POINTS: [number, number, number][] = [
  [137.396976, -4.783554, -3734.7],
  [137.396, -4.785, -3734.7],
  [137.394592, -4.78592, -3722.3],
  [137.389905, -4.793608, -3689.7],
  [137.387913, -4.795735, -3673.4],
  [137.386436, -4.797618, -3657.6],
  [137.383541, -4.799847, -3647.2],
  [137.382113, -4.801908, -3644.4],
  [137.38045, -4.80251, -3644.6],
  [137.37932, -4.80474, -3624.3],
  [137.379842, -4.806893, -3610.5],
  [137.380507, -4.808023, -3604.8],
  [137.381035, -4.807839, -3610.4],
  [137.381004, -4.808008, -3607.7],
  [137.38101, -4.80776, -3609.8],
  [137.38263, -4.80788, -3605.2],
];

export function marsDistanceMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const degToM = 59158.0;
  const latMidRad = (((lat1 + lat2) * 0.5) * Math.PI) / 180.0;
  const dx = (lon2 - lon1) * degToM * Math.cos(latMidRad);
  const dy = (lat2 - lat1) * degToM;
  return Math.hypot(dx, dy);
}

/**
 * Evaluates elevation, slope, risk, shielding and CRISM mineral index at any (lon, lat)
 * inside the Mount Sharp Boxwork study area (synchronized with terrain_pipeline.py).
 */
export function sampleMountSharpTerrain(lon: number, lat: number): {
  elev_m: number;
  slope_deg: number;
  risk: number;
  shielding_pct: number;
  crism: number;
  boxwork_ridge: number;
} {
  let num = 0;
  let den = 0;
  for (const [cpLon, cpLat, cpZ] of CONTROL_POINTS) {
    const d2 = (lon - cpLon) ** 2 + (lat - cpLat) ** 2;
    if (d2 < 1e-12) {
      num = cpZ;
      den = 1;
      break;
    }
    const w = 1 / Math.pow(d2, 1.35);
    num += w * cpZ;
    den += w;
  }
  const baseZ = num / den;

  const boxworkFactor = Math.max(0, Math.min(1, (-4.792 - lat) / 0.016));
  const u = (lon - BBOX_MARS[0]) * 1800.0;
  const v = (lat - BBOX_MARS[1]) * 1800.0;
  const ridge1 = Math.abs(Math.sin(u * Math.PI * 1.3 + 0.4 * Math.cos(v * 2.0)));
  const ridge2 = Math.abs(Math.sin(v * Math.PI * 1.4 - 0.3 * Math.sin(u * 2.0)));
  const polyNet = Math.pow(1.0 - Math.min(ridge1, ridge2), 3);

  let deltaZ = boxworkFactor * (polyNet * 3.2 - 1.1);
  const distT08 = Math.hypot(lon - 137.38263, lat - -4.80788);
  if (distT08 < 0.0022) {
    deltaZ += 4.5 * Math.exp(-Math.pow(distT08 / 0.0009, 2));
  }

  const elev_m = Number((baseZ + deltaZ).toFixed(1));

  // Local slope estimation
  const rough = 0.12 + boxworkFactor * (0.25 + 0.45 * polyNet);
  let slope_deg = 4.2 + boxworkFactor * 4.8 + polyNet * 9.5;
  const distObs1 = Math.hypot(lon - 137.3888, lat - -4.7962);
  const distObs2 = Math.hypot(lon - 137.3848, lat - -4.8022);
  if (distObs1 < 0.0018) {
    slope_deg = Math.max(slope_deg, 21.5 * Math.exp(-Math.pow(distObs1 / 0.0011, 2)));
  }
  if (distObs2 < 0.0016) {
    slope_deg = Math.max(slope_deg, 22.4 * Math.exp(-Math.pow(distObs2 / 0.001, 2)));
  }
  if (distT08 < 0.0012) {
    slope_deg = Math.max(slope_deg, 17.5 * Math.exp(-Math.pow(distT08 / 0.0008, 2)));
  }
  slope_deg = Number(Math.min(28.0, slope_deg).toFixed(1));

  const risk =
    slope_deg > 20
      ? 1.0
      : slope_deg >= 10
      ? Math.min(0.95, 0.45 + 0.03 * (slope_deg - 10) + 0.12 * rough)
      : Math.min(0.42, 0.06 + 0.025 * slope_deg);

  let shielding_pct = Math.min(34, Math.max(4, 6 + boxworkFactor * 14 + (1 - polyNet) * 8));
  if (distT08 < 0.0026) {
    shielding_pct = Math.max(
      shielding_pct,
      38.0 * Math.exp(-Math.pow(distT08 / 0.0018, 2))
    );
  }

  const crism = Math.min(
    1,
    Math.max(
      0.12,
      0.25 +
        0.55 * Math.max(0, (-4.79 - lat) / 0.02) +
        0.2 * Math.sin((lon - BBOX_MARS[0]) * 900)
    )
  );

  return {
    elev_m,
    slope_deg,
    risk: Number(risk.toFixed(2)),
    shielding_pct: Number(shielding_pct.toFixed(1)),
    crism: Number(crism.toFixed(2)),
    boxwork_ridge: polyNet,
  };
}

export async function checkBackendOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 900);
    const res = await fetch(`${FASTAPI_BASE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * GET /targets
 */
export async function fetchTargets(useBackend = false): Promise<TargetsGeoJSON> {
  if (useBackend) {
    try {
      const res = await fetch(`${FASTAPI_BASE_URL}/targets`);
      if (res.ok) return (await res.json()) as TargetsGeoJSON;
    } catch {
      // Fallback to local JSON
    }
  }
  return targetsLocal as unknown as TargetsGeoJSON;
}

/**
 * GET /env
 */
export async function fetchEnv(useBackend = false): Promise<EnvData> {
  if (useBackend) {
    try {
      const res = await fetch(`${FASTAPI_BASE_URL}/env`);
      if (res.ok) return (await res.json()) as EnvData;
    } catch {
      // Fallback to local JSON
    }
  }
  return envLocal as unknown as EnvData;
}

/**
 * POST /routes
 */
export async function fetchRoutes(
  params?: {
    origin?: [number, number];
    waypoints?: string[];
    profiles?: string[];
  },
  useBackend = false
): Promise<RoutesResponse> {
  if (useBackend) {
    try {
      const res = await fetch(`${FASTAPI_BASE_URL}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: params?.origin ?? [137.396, -4.785],
          waypoints: params?.waypoints ?? [],
          profiles: params?.profiles ?? ['scientific', 'fast', 'safe'],
        }),
      });
      if (res.ok) return (await res.json()) as RoutesResponse;
    } catch {
      // Fallback to local mock_routes.json
    }
  }
  return mockRoutesLocal as unknown as RoutesResponse;
}

/**
 * Builds the Safe Return Zone polygon and emergency route locally when running in Phase 1
 * (matches `senda_planner.py` physics rules 1:1).
 */
export function computeLocalReplan(
  position: [number, number],
  o2_left_L: number,
  event: ScenarioType
): ReplanResponse {
  const baseCoords: [number, number] = [137.396, -4.785]; // T01
  const shelterCoords: [number, number] = [137.38263, -4.80788]; // T08 Eastern boxwork contact
  const destT06Coords: [number, number] = [137.381004, -4.808008]; // T06

  const distToBaseM = marsDistanceMeters(
    position[0],
    position[1],
    baseCoords[0],
    baseCoords[1]
  );

  let speedMult = 1.0;
  let consMult = 1.0;
  if (event === 'suit_leak') consMult = 1.5;
  else if (event === 'injury') {
    speedMult = 0.5;
    consMult = 1.35;
  } else if (event === 'dust_storm') {
    speedMult = 0.7;
    consMult = 1.2;
  }

  const o2ReturnMaxL = Math.max(8, (distToBaseM / 1623.0) * 55.0);
  const o2ReturnRequired = o2ReturnMaxL * 1.3 * consMult;
  const marginL = o2_left_L - o2ReturnRequired;
  const marginRatio = o2_left_L > 0 ? marginL / o2_left_L : -1;

  let level: AlertLevel = 'info';
  let action = 'Safe O2 margin (> 20%). Continue nominal EVA plan.';
  if (marginL <= 0) {
    level = 'return now';
    action = 'O2 margin <= 0 L: Replan immediate walkback route to staging base T01.';
  } else if (marginRatio <= 0.2) {
    level = 'caution';
    action = 'Positive O2 margin < 20%: complete current stop and initiate return.';
  }

  let title = 'NOMINAL EVA TELEMETRY';
  let shelterTarget: string | null = null;
  let shieldingPct = 18.0;
  let targetDest: [number, number] = baseCoords;
  let routeName = 'Safe Walkback Route (T01)';
  let routeColor = '#7CD992';

  if (event === 'solar_storm') {
    level = 'return now';
    title = 'SOLAR PARTICLE EVENT — GO TO NEAREST SHELTER';
    action =
      'High-energy proton event (SPE) detected. Rerouting immediately to T08 Eastern boxwork escarpment for 38% topographic dose reduction.';
    shelterTarget = 'T08';
    shieldingPct = 38.0;
    targetDest = shelterCoords;
    routeName = 'SPE Emergency Shelter Path (→ T08)';
    routeColor = '#FF5A5F';
  } else if (event === 'suit_leak') {
    level = 'return now';
    title = 'SUIT LEAK DETECTED (O2 CONSUMPTION ×1.5)';
    action =
      'Primary life support O2 leak (consumption ×1.5). Immediate abort to staging base T01.';
    targetDest = baseCoords;
    routeName = 'Abort Walkback to Base (→ T01)';
    routeColor = '#FF5A5F';
  } else if (event === 'dust_storm') {
    if (level === 'info') level = 'caution';
    title = 'DUST STORM ALERT (OPTICAL DEPTH τ = 3.5)';
    action =
      'Visibility degraded (speed ×0.70) and solar heating reduced. Recalculating walkback times and safe return zone.';
    targetDest = baseCoords;
    routeName = 'Low-Visibility Walkback Corridor (→ T01)';
    routeColor = '#FFB020';
  } else if (event === 'injury') {
    if (level === 'info') level = 'caution';
    title = 'CREW MOBILITY IMPAIRMENT (SPEED ×0.5)';
    action =
      'Astronaut translation speed reduced to 0.38 m/s (×0.5). Safe return envelope contracted; low-slope return path calculated.';
    targetDest = baseCoords;
    routeName = 'Low-Grade Assisted Return (→ T01)';
    routeColor = '#FFB020';
  } else if (event === 'blocked_path') {
    if (level === 'info') level = 'caution';
    title = 'IMPASSABLE OBSTACLE / BLOCKED PATH AHEAD';
    action =
      'Slope > 20° / boulder field detected on primary trajectory. Replanning safe A* detour around blocked sector.';
    targetDest = level === 'return now' ? baseCoords : destT06Coords;
    routeName = 'A* Detour Around Blocked Sector';
    routeColor = '#FFB020';
  }

  // Generate curved A* path geometry between current position and targetDest
  const steps = 14;
  const coords: [number, number][] = [];
  const elevs: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const detourSign = event === 'blocked_path' ? 0.0014 : 0.0005;
    const arc = Math.sin(t * Math.PI) * detourSign;
    const lon = Number(
      (position[0] + (targetDest[0] - position[0]) * t + arc).toFixed(6)
    );
    const lat = Number(
      (position[1] + (targetDest[1] - position[1]) * t - arc * 0.6).toFixed(6)
    );
    coords.push([lon, lat]);
    elevs.push(sampleMountSharpTerrain(lon, lat).elev_m);
  }

  const distM = Math.round(
    marsDistanceMeters(position[0], position[1], targetDest[0], targetDest[1]) *
      (event === 'blocked_path' ? 1.14 : 1.05)
  );
  const effSpeed = 0.75 * speedMult;
  const durMin = Math.max(4, Math.round(distM / effSpeed / 60));
  const energyMJ = Number(((distM * 0.00095) * consMult).toFixed(2));
  const o2Central = Math.max(5, Math.round((energyMJ * 1000) / 20.1));
  const o2Range: [number, number, number] = [
    o2Central,
    Math.round(o2Central * 0.8),
    Math.round(o2Central * 1.2),
  ];
  const doseMsv = Number(
    (
      (durMin / 1479.6) *
      (event === 'solar_storm' ? 0.64 + 15.0 * (1 - shieldingPct / 100) : 0.64)
    ).toFixed(3)
  );

  // Build Safe Return Zone Polygon
  const usableO2 = Math.max(
    12,
    o2_left_L / (1.3 * consMult) - o2ReturnMaxL * 0.45
  );
  const radiusM = Math.min(1650, Math.max(140, usableO2 * 11.5));
  const centerLon = 0.55 * baseCoords[0] + 0.45 * position[0];
  const centerLat = 0.55 * baseCoords[1] + 0.45 * position[1];
  const ring: [number, number][] = [];
  const nVerts = 32;
  for (let i = 0; i < nVerts; i++) {
    const ang = (2 * Math.PI * i) / nVerts;
    const slopeBias = 1.0 + 0.14 * Math.cos(ang - Math.PI / 4);
    const r = radiusM * slopeBias;
    const dLon =
      (r * Math.cos(ang)) / (59158.0 * Math.cos((centerLat * Math.PI) / 180));
    const dLat = (r * Math.sin(ang)) / 59158.0;
    ring.push([
      Number(
        Math.min(BBOX_MARS[2], Math.max(BBOX_MARS[0], centerLon + dLon)).toFixed(6)
      ),
      Number(
        Math.min(BBOX_MARS[3], Math.max(BBOX_MARS[1], centerLat + dLat)).toFixed(6)
      ),
    ]);
  }
  ring.push(ring[0]);

  const replannedRoute: RouteItem = {
    id: `replan_${event}`,
    name: routeName,
    color: routeColor,
    visits: shelterTarget ? [shelterTarget] : ['T01'],
    geometry: {
      type: 'LineString',
      coordinates: coords,
    },
    elevation_m: elevs,
    metrics: {
      distance_oneway_m: distM,
      climb_m: Number(Math.max(0, elevs[elevs.length - 1] - elevs[0]).toFixed(1)),
      max_grade_pct: 9.4,
      duration_min: durMin,
      energy_MJ: energyMJ,
      o2_L: o2Range,
      dose_gcr_mSv: doseMsv,
      stops: [],
      kind: 'modeled',
    },
    placeholder: false,
    kind: 'modeled',
    note: action,
  };

  return {
    route: replannedRoute,
    safe_return_zone: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
      properties: {
        radius_mean_m: Number(radiusM.toFixed(1)),
        o2_left_L: Number(o2_left_L.toFixed(1)),
        level,
        kind: 'modeled',
      },
    },
    alert: {
      level,
      title,
      message: action,
      shelter_target: shelterTarget,
      shielding_reduction_pct: shieldingPct,
      reserve: {
        o2_left_L: Number(o2_left_L.toFixed(1)),
        o2_return_required_L: Number(o2ReturnRequired.toFixed(1)),
        margin_L: Number(marginL.toFixed(1)),
        margin_ratio: Number(marginRatio.toFixed(3)),
        level,
        action,
        scenario: event,
        speed_multiplier: speedMult,
        consumption_multiplier: consMult,
        kind: 'modeled',
      },
      kind: 'modeled',
    },
  };
}

/**
 * POST /replan
 */
export async function postReplan(
  position: [number, number],
  o2_left_L: number,
  event: ScenarioType,
  useBackend = false
): Promise<ReplanResponse> {
  if (useBackend) {
    try {
      const res = await fetch(`${FASTAPI_BASE_URL}/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position, o2_left_L, event }),
      });
      if (res.ok) return (await res.json()) as ReplanResponse;
    } catch {
      // Fallback to local physics calculation
    }
  }
  return computeLocalReplan(position, o2_left_L, event);
}
