import React, { useEffect, useMemo, useState } from 'react';
import {
  EnvData,
  LayerConfig,
  ReplanResponse,
  RouteItem,
  ScenarioType,
  TargetFeature,
} from './types/senda';
import {
  checkBackendOnline,
  fetchEnv,
  fetchRoutes,
  fetchTargets,
  marsDistanceMeters,
  postReplan,
} from './services/api';
import { TopBar } from './components/TopBar';
import { LayerPanel } from './components/LayerPanel';
import { MapView } from './components/MapView';
import { TargetCard } from './components/TargetCard';
import { RouteComparator } from './components/RouteComparator';
import { EnvironmentStrip } from './components/EnvironmentStrip';
import { FieldHUD } from './components/FieldHUD';
import { AlertModal } from './components/AlertModal';
import { Terrain3DView } from './components/Terrain3DView';

const INITIAL_LAYERS: LayerConfig[] = [
  {
    id: 'ortho',
    name: 'Ortho HiRISE',
    enabled: true,
    opacity: 1.0,
    kind: 'measured',
    mission: 'Mars Reconnaissance Orbiter (MRO)',
    instrument: 'HiRISE LRGB Mosaic COG',
    resolution: '0.25 m/px',
    date_sol: 'MSL Gale Mosaic v3 (2025)',
    coverage: '100% of 2×2 km Boxwork Bbox',
    limitations: 'Optical texture only; does not provide elevation without DEM.',
    legend: [
      { label: 'Boxwork Ridges', color: '#C8845E' },
      { label: 'Hollows / Regolith', color: '#704936' },
    ],
  },
  {
    id: 'relief',
    name: 'Shaded Relief',
    enabled: true,
    opacity: 0.45,
    kind: 'measured',
    mission: 'USGS Astrogeology / MRO HiRISE Stereo',
    instrument: 'MSL Gale Merged DEM 1m v3 Hillshade',
    resolution: '1.0 m/cell',
    date_sol: 'USGS v3 Release',
    coverage: '100% of study bbox (−3735 m to −3605 m)',
    limitations: 'Obstacles < 2 m not visible in 1 m DEM.',
    legend: [
      { label: 'Sunlit NW Slope', color: '#D0D7DE' },
      { label: 'Shadowed SE Wall', color: '#30363D' },
    ],
  },
  {
    id: 'slope',
    name: 'Slope (gdaldem)',
    enabled: false,
    opacity: 0.65,
    kind: 'modeled',
    mission: 'Derived from HiRISE 1m DEM',
    instrument: 'Horn / GDAL Slope Operator',
    resolution: '1.0 m/cell',
    date_sol: 'Computed Sol 5074',
    coverage: '100% of study bbox',
    limitations: 'Sub-meter boulders (< 2 m) require POV visual check.',
    legend: [
      { label: '< 10° Passable', color: '#7CD992' },
      { label: '10°–20° Caution', color: '#FFB020' },
      { label: '> 20° Impassable', color: '#FF5A5F' },
    ],
  },
  {
    id: 'risk',
    name: 'Risk Index',
    enabled: false,
    opacity: 0.6,
    kind: 'modeled',
    mission: 'SENDA Traversability Engine',
    instrument: 'Slope + TRI Roughness Composite',
    resolution: '2.0 m/cell cost grid',
    date_sol: 'Sol 5074 Model',
    coverage: '100% of study bbox',
    limitations: 'Weights calibrated for 0.38 g xEMU pressurized suit.',
    legend: [
      { label: 'Low Risk (<0.3)', color: '#7CD992' },
      { label: 'Moderate (0.3–0.7)', color: '#FFB020' },
      { label: 'High / No-Go (>0.7)', color: '#FF5A5F' },
    ],
  },
  {
    id: 'crism',
    name: 'CRISM Minerals',
    enabled: false,
    opacity: 0.55,
    kind: 'measured',
    mission: 'Mars Reconnaissance Orbiter (MRO)',
    instrument: 'CRISM Spectral Index (Polyhydrated Sulfates)',
    resolution: '18.0 m/px',
    date_sol: 'MRO Orbital Pass FRT',
    coverage: 'Regional boxwork unit',
    limitations: 'Coarse orbital footprint (18 m/px); cannot pinpoint cm-scale veins.',
    legend: [
      { label: 'Mg/Fe Sulfate Rich', color: '#E066FF' },
      { label: 'CaSO4 Vein Halo', color: '#4FC3F7' },
    ],
  },
  {
    id: 'shielding',
    name: 'Natural Shielding',
    enabled: false,
    opacity: 0.65,
    kind: 'modeled',
    mission: 'MSL RAD + HiRISE Horizon Sky-View',
    instrument: 'Zenith-Angle Sky-Blocking Model (Guo et al. 2026)',
    resolution: '2.0 m/cell',
    date_sol: 'Sol 5074',
    coverage: '100% of study bbox (Max at T08 Escarpment)',
    limitations: 'Relative dose attenuation estimate; depends on SPE anisotropy.',
    legend: [
      { label: 'Open Plain (0–10%)', color: '#1F6FEB' },
      { label: 'Hollow (15–22%)', color: '#39D353' },
      { label: 'T08 Shelter (38%)', color: '#7CD992' },
    ],
  },
  {
    id: 'targets',
    name: 'Science Targets (8)',
    enabled: true,
    opacity: 1.0,
    kind: 'measured',
    mission: 'MSL Curiosity Rover Campaigns (2025)',
    instrument: 'Mastcam / Navcam / ChemCam / Drill',
    resolution: 'Point (< 0.5 m relocated on HiRISE)',
    date_sol: 'Sols 4414–4711',
    coverage: '8 curated ROIs (T01–T08)',
    limitations: 'Rubric weights reflect human field geology priority.',
    legend: [
      { label: 'T01 Staging Base', color: '#4FC3F7' },
      { label: 'Science ROI (T02–T07)', color: '#E8B04B' },
      { label: 'T08 Shelter / Contact', color: '#7CD992' },
    ],
  },
  {
    id: 'routes',
    name: 'EVA Routes (3)',
    enabled: true,
    opacity: 1.0,
    kind: 'modeled',
    mission: 'SENDA A* Metabolic Pathfinder',
    instrument: 'Pandolf 0.38g + Risk-Weighted Graph',
    resolution: 'Waypoint-chained LineStrings',
    date_sol: 'Sol 5074',
    coverage: 'T01 Base to T06 Nevado Sajama',
    limitations: 'O2 consumption carries ±20% physiological uncertainty.',
    legend: [
      { label: 'Scientific', color: '#E8B04B' },
      { label: 'Fast', color: '#4FC3F7' },
      { label: 'Safe', color: '#7CD992' },
    ],
  },
];

export const App: React.FC = () => {
  const [backendOnline, setBackendOnline] = useState(false);
  const [targets, setTargets] = useState<TargetFeature[]>([]);
  const [env, setEnv] = useState<EnvData | null>(null);
  const [routes, setRoutes] = useState<RouteItem[]>([]);

  const [mode, setMode] = useState<'PLAN' | 'FIELD' | '3D'>('PLAN');
  const [layers, setLayers] = useState<LayerConfig[]>(INITIAL_LAYERS);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('T06');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('cientifica');

  // FIELD simulation state
  const [progress, setProgress] = useState<number>(0.18);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 10 | 60>(10);
  const [scenario, setScenario] = useState<ScenarioType>('nominal');
  const [replanData, setReplanData] = useState<ReplanResponse | null>(null);
  const [speModalOpen, setSpeModalOpen] = useState<boolean>(false);

  // Initial load from /data (and probe FastAPI backend)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const online = await checkBackendOnline();
      if (!mounted) return;
      setBackendOnline(online);

      const [tData, eData, rData] = await Promise.all([
        fetchTargets(online),
        fetchEnv(online),
        fetchRoutes(undefined, online),
      ]);
      if (!mounted) return;
      setTargets(tData.features);
      setEnv(eData);
      setRoutes(rData.routes);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const activeRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) || routes[0],
    [routes, selectedRouteId]
  );

  const selectedTarget = useMemo(
    () =>
      targets.find((t) => t.properties.id === selectedTargetId) || targets[0],
    [targets, selectedTargetId]
  );

  // Interpolate current astronaut position along activeRoute
  const astronautPos: [number, number] = useMemo(() => {
    if (!activeRoute || activeRoute.geometry.coordinates.length === 0) {
      return [137.396, -4.785];
    }
    const coords = activeRoute.geometry.coordinates;
    if (coords.length === 1) return coords[0];
    const scaled = Math.max(0, Math.min(1, progress)) * (coords.length - 1);
    const idx = Math.floor(scaled);
    const frac = scaled - idx;
    if (idx >= coords.length - 1) return coords[coords.length - 1];
    const [lon1, lat1] = coords[idx];
    const [lon2, lat2] = coords[idx + 1];
    return [
      Number((lon1 + (lon2 - lon1) * frac).toFixed(6)),
      Number((lat1 + (lat2 - lat1) * frac).toFixed(6)),
    ];
  }, [activeRoute, progress]);

  // Compute dynamic FIELD metrics based on progress & scenario
  const fieldTelemetry = useMemo(() => {
    const tankCap = env?.physiology.plss_o2_capacity_L ?? 300;
    if (!activeRoute) {
      return {
        o2LeftL: tankCap,
        elapsedMin: 0,
        accumulatedDoseMsv: 0,
        nextWaypointId: 'T06',
        distToNextWaypointM: 0,
      };
    }

    const consMult =
      scenario === 'suit_leak'
        ? 1.5
        : scenario === 'injury'
        ? 1.35
        : scenario === 'dust_storm'
        ? 1.2
        : 1.0;

    const routeO2Central = activeRoute.metrics.o2_L[0];
    const usedO2 = routeO2Central * progress * consMult;
    const o2LeftL = Math.max(8, tankCap - usedO2);

    const elapsedMin = Math.round(activeRoute.metrics.duration_min * progress);
    const baseDose = activeRoute.metrics.dose_gcr_mSv * progress;
    const speExtra = scenario === 'solar_storm' ? 0.145 : 0.0;
    const accumulatedDoseMsv = Number((baseDose + speExtra).toFixed(3));

    const visits = activeRoute.visits;
    const visitIdx = Math.min(
      visits.length - 1,
      Math.max(1, Math.ceil(progress * (visits.length - 1)))
    );
    const nextWaypointId = visits[visitIdx] || 'T06';
    const nextTarget = targets.find((t) => t.properties.id === nextWaypointId);
    const distToNextWaypointM = nextTarget
      ? Math.round(
          marsDistanceMeters(
            astronautPos[0],
            astronautPos[1],
            nextTarget.geometry.coordinates[0],
            nextTarget.geometry.coordinates[1]
          )
        )
      : Math.round(activeRoute.metrics.distance_oneway_m * (1 - progress));

    return {
      o2LeftL,
      elapsedMin,
      accumulatedDoseMsv,
      nextWaypointId,
      distToNextWaypointM,
    };
  }, [activeRoute, env, progress, scenario, astronautPos, targets]);

  // Advance astronaut position when playing in FIELD mode
  useEffect(() => {
    if (mode !== 'FIELD' || !isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const step = 0.0022 * (speedMultiplier / 10);
        if (prev + step >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return Number((prev + step).toFixed(4));
      });
    }, 180);
    return () => clearInterval(interval);
  }, [mode, isPlaying, speedMultiplier]);

  // Update Replan & Safe Return Zone whenever astronaut moves or scenario changes
  useEffect(() => {
    let active = true;
    (async () => {
      const rep = await postReplan(
        astronautPos,
        fieldTelemetry.o2LeftL,
        scenario,
        backendOnline
      );
      if (active) setReplanData(rep);
    })();
    return () => {
      active = false;
    };
  }, [astronautPos, fieldTelemetry.o2LeftL, scenario, backendOnline]);

  const handleToggleLayer = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l))
    );
  };

  const handleChangeOpacity = (id: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l))
    );
  };

  const handleScenarioChange = (sc: ScenarioType) => {
    setScenario(sc);
    if (sc === 'solar_storm') {
      setSpeModalOpen(true);
      // Automatically turn on Natural Shielding layer so the crew sees T08 shelter
      setLayers((prev) =>
        prev.map((l) => (l.id === 'shielding' ? { ...l, enabled: true } : l))
      );
    } else {
      setSpeModalOpen(false);
    }
  };

  if (!env || targets.length === 0 || routes.length === 0) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0B0F14',
          color: '#E6EDF3',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        INITIALIZING SENDA MISSION CONTROL TELEMETRY...
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0B0F14',
        color: '#E6EDF3',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Top Mission Control Bar */}
      <TopBar
        env={env}
        mode={mode}
        onModeChange={setMode}
        elapsedMin={fieldTelemetry.elapsedMin}
        backendOnline={backendOnline}
      />

      {/* Main 3-Column Workspace */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* Left: Multi-Mission Layer Panel */}
        <LayerPanel
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onChangeOpacity={handleChangeOpacity}
        />

        {/* Center: 2D OpenLayers Map or 3D DEM Relief View */}
        {mode === '3D' ? (
          <Terrain3DView
            targets={targets}
            selectedTargetId={selectedTargetId}
            onSelectTarget={setSelectedTargetId}
            routes={routes}
            selectedRouteId={selectedRouteId}
            astronautPos={astronautPos}
          />
        ) : (
          <MapView
            targets={targets}
            selectedTargetId={selectedTargetId}
            onSelectTarget={setSelectedTargetId}
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            layers={layers}
            mode={mode}
            astronautPos={astronautPos}
            replanData={replanData}
          />
        )}

        {/* Right: PLAN Dossier + Route Comparator OR FIELD Telemetry HUD */}
        <aside
          style={{
            width: '365px',
            backgroundColor: '#121821',
            borderLeft: '1px solid #1F2A37',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {mode === 'FIELD' ? (
            <FieldHUD
              route={activeRoute}
              env={env}
              progress={progress}
              onChangeProgress={setProgress}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onReset={() => {
                setIsPlaying(false);
                setProgress(0);
                setScenario('nominal');
              }}
              speedMultiplier={speedMultiplier}
              onChangeSpeed={setSpeedMultiplier}
              scenario={scenario}
              onChangeScenario={handleScenarioChange}
              o2LeftL={fieldTelemetry.o2LeftL}
              elapsedMin={fieldTelemetry.elapsedMin}
              accumulatedDoseMsv={fieldTelemetry.accumulatedDoseMsv}
              nextWaypointId={fieldTelemetry.nextWaypointId}
              distToNextWaypointM={fieldTelemetry.distToNextWaypointM}
              replanData={replanData}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflowY: 'auto',
              }}
            >
              {selectedTarget && (
                <TargetCard
                  target={selectedTarget}
                  allTargets={targets}
                  onSelectTarget={setSelectedTargetId}
                />
              )}
              <RouteComparator
                routes={routes}
                selectedRouteId={selectedRouteId}
                onSelectRoute={setSelectedRouteId}
                onStartFieldEva={() => {
                  setMode('FIELD');
                  setIsPlaying(true);
                }}
              />
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Environmental Strip */}
      <EnvironmentStrip env={env} scenario={scenario} />

      {/* Red Solar Particle Event Modal */}
      <AlertModal
        open={speModalOpen}
        replanData={replanData}
        onDismiss={() => setSpeModalOpen(false)}
      />
    </div>
  );
};
