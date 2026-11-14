import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import ImageStatic from 'ol/source/ImageStatic';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import { Style, Stroke, Fill, Circle as CircleStyle, Text as TextStyle } from 'ol/style';
import {
  AlertLevel,
  LayerConfig,
  ReplanResponse,
  RouteItem,
  TargetFeature,
} from '../types/senda';
import { BBOX_MARS, sampleMountSharpTerrain } from '../services/api';

interface MapViewProps {
  targets: TargetFeature[];
  selectedTargetId: string;
  onSelectTarget: (id: string) => void;
  routes: RouteItem[];
  selectedRouteId: string;
  onSelectRoute: (id: string) => void;
  layers: LayerConfig[];
  mode: 'PLAN' | 'FIELD' | '3D';
  astronautPos: [number, number];
  replanData: ReplanResponse | null;
}

/**
 * Generates a georeferenced data-URI raster canvas for each scientific layer
 * covering BBOX_MARS = [137.37204, -4.8126, 137.40596, -4.7788].
 */
function buildRasterLayerDataUrl(
  layerId: string,
  width = 360,
  height = 360
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const [lonMin, latMin, lonMax, latMax] = BBOX_MARS;

  for (let py = 0; py < height; py++) {
    const lat = latMax - ((latMax - latMin) * py) / (height - 1);
    for (let px = 0; px < width; px++) {
      const lon = lonMin + ((lonMax - lonMin) * px) / (width - 1);
      const idx = (py * width + px) * 4;
      const sample = sampleMountSharpTerrain(lon, lat);

      if (layerId === 'ortho') {
        // HiRISE LRGB false-color / natural-color Martian boxwork bedrock
        const elevNorm = Math.max(0, Math.min(1, (sample.elev_m - -3735) / 132));
        const ridge = sample.boxwork_ridge;
        // Rustic Canyon crater rim near T01
        const dCrater = Math.hypot(lon - 137.396, lat - -4.785);
        const craterRim =
          dCrater > 0.0011 && dCrater < 0.0019
            ? Math.exp(-Math.pow((dCrater - 0.0015) / 0.0003, 2)) * 28
            : 0;

        const r = Math.min(
          255,
          Math.max(35, Math.round(118 + elevNorm * 58 + ridge * 38 + craterRim))
        );
        const g = Math.min(
          255,
          Math.max(25, Math.round(74 + elevNorm * 42 + ridge * 28 + craterRim * 0.7))
        );
        const b = Math.min(
          255,
          Math.max(20, Math.round(54 + elevNorm * 28 + ridge * 22 + craterRim * 0.5))
        );
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      } else if (layerId === 'relief') {
        const sNext = sampleMountSharpTerrain(lon + 0.00012, lat - 0.00012);
        const dz = sNext.elev_m - sample.elev_m;
        const shade = Math.max(15, Math.min(245, Math.round(135 + dz * 85)));
        data[idx] = shade;
        data[idx + 1] = shade;
        data[idx + 2] = shade + 8;
        data[idx + 3] = 175;
      } else if (layerId === 'slope') {
        if (sample.slope_deg > 20) {
          // Impassable (#FF5A5F)
          data[idx] = 255;
          data[idx + 1] = 90;
          data[idx + 2] = 95;
          data[idx + 3] = 210;
        } else if (sample.slope_deg >= 10) {
          // Caution (#FFB020)
          data[idx] = 255;
          data[idx + 1] = 176;
          data[idx + 2] = 32;
          data[idx + 3] = 165;
        } else {
          // Passable (#7CD992)
          data[idx] = 124;
          data[idx + 1] = 217;
          data[idx + 2] = 146;
          data[idx + 3] = 95;
        }
      } else if (layerId === 'risk') {
        const rk = sample.risk;
        data[idx] = Math.round(60 + rk * 195);
        data[idx + 1] = Math.round(190 * (1 - rk * 0.75));
        data[idx + 2] = Math.round(90 * (1 - rk));
        data[idx + 3] = Math.round(90 + rk * 120);
      } else if (layerId === 'crism') {
        // MRO CRISM Sulfate / Vein spectral index (magenta/cyan/amber palette)
        const c = sample.crism;
        data[idx] = Math.round(110 + c * 140);
        data[idx + 1] = Math.round(60 + (1 - Math.abs(c - 0.5) * 2) * 140);
        data[idx + 2] = Math.round(220 - c * 80);
        data[idx + 3] = Math.round(70 + c * 115);
      } else if (layerId === 'shielding') {
        // Natural topographic radiation shielding (%)
        const sh = Math.min(1, sample.shielding_pct / 40.0);
        data[idx] = Math.round(30 * (1 - sh));
        data[idx + 1] = Math.round(140 + sh * 110);
        data[idx + 2] = Math.round(200 + sh * 55);
        data[idx + 3] = Math.round(65 + sh * 145);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Subtle coordinate grid overlay on ortho
  if (layerId === 'ortho') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const p = (width * i) / 8;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(width, p);
      ctx.stroke();
    }
  }

  return canvas.toDataURL('image/png');
}

export const MapView: React.FC<MapViewProps> = ({
  targets,
  selectedTargetId,
  onSelectTarget,
  routes,
  selectedRouteId,
  layers,
  mode,
  astronautPos,
  replanData,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const rasterLayersRef = useRef<Record<string, ImageLayer<ImageStatic>>>({});
  const routesSourceRef = useRef<VectorSource>(new VectorSource());
  const targetsSourceRef = useRef<VectorSource>(new VectorSource());
  const fieldSourceRef = useRef<VectorSource>(new VectorSource());

  const [cursorTelemetry, setCursorTelemetry] = useState<{
    lon: number;
    lat: number;
    elev_m: number;
    slope_deg: number;
    shielding_pct: number;
  }>({
    lon: 137.389,
    lat: -4.7957,
    elev_m: -3668.4,
    slope_deg: 6.2,
    shielding_pct: 14.0,
  });

  // 1. Initialize OpenLayers Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const rasterIds = ['ortho', 'relief', 'slope', 'risk', 'crism', 'shielding'];
    const createdRasters: Record<string, ImageLayer<ImageStatic>> = {};

    rasterIds.forEach((id) => {
      const url = buildRasterLayerDataUrl(id);
      const lyr = new ImageLayer({
        source: new ImageStatic({
          url,
          imageExtent: BBOX_MARS,
          projection: 'EPSG:4326',
        }),
        visible: id === 'ortho' || id === 'relief',
        opacity: id === 'ortho' ? 1.0 : 0.55,
      });
      createdRasters[id] = lyr;
    });
    rasterLayersRef.current = createdRasters;

    const fieldVectorLayer = new VectorLayer({
      source: fieldSourceRef.current,
      zIndex: 10,
    });

    const routesVectorLayer = new VectorLayer({
      source: routesSourceRef.current,
      zIndex: 20,
    });

    const targetsVectorLayer = new VectorLayer({
      source: targetsSourceRef.current,
      zIndex: 30,
    });

    const map = new Map({
      target: mapContainerRef.current,
      layers: [
        createdRasters.ortho,
        createdRasters.relief,
        createdRasters.crism,
        createdRasters.shielding,
        createdRasters.risk,
        createdRasters.slope,
        fieldVectorLayer,
        routesVectorLayer,
        targetsVectorLayer,
      ],
      view: new View({
        projection: 'EPSG:4326',
        center: [137.3885, -4.7962],
        zoom: 14.8,
        minZoom: 13,
        maxZoom: 18,
        extent: [
          BBOX_MARS[0] - 0.008,
          BBOX_MARS[1] - 0.008,
          BBOX_MARS[2] + 0.008,
          BBOX_MARS[3] + 0.008,
        ],
      }),
    });

    map.on('pointermove', (evt) => {
      const [lon, lat] = evt.coordinate as [number, number];
      if (
        lon >= BBOX_MARS[0] &&
        lon <= BBOX_MARS[2] &&
        lat >= BBOX_MARS[1] &&
        lat <= BBOX_MARS[3]
      ) {
        const s = sampleMountSharpTerrain(lon, lat);
        setCursorTelemetry({
          lon: Number(lon.toFixed(5)),
          lat: Number(lat.toFixed(5)),
          elev_m: s.elev_m,
          slope_deg: s.slope_deg,
          shielding_pct: s.shielding_pct,
        });
      }
    });

    map.on('singleclick', (evt) => {
      map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        const tId = feature.get('targetId');
        if (typeof tId === 'string') {
          onSelectTarget(tId);
          return true;
        }
        return false;
      });
    });

    mapRef.current = map;

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [onSelectTarget]);

  // 2. Sync Layer visibility and opacity
  useEffect(() => {
    layers.forEach((l) => {
      const rLayer = rasterLayersRef.current[l.id];
      if (rLayer) {
        rLayer.setVisible(l.enabled);
        rLayer.setOpacity(l.opacity);
      }
    });
  }, [layers]);

  // 3. Render Routes Vector Layer
  useEffect(() => {
    const src = routesSourceRef.current;
    src.clear();

    const routesLayerCfg = layers.find((l) => l.id === 'routes');
    if (routesLayerCfg && !routesLayerCfg.enabled) return;

    routes.forEach((route) => {
      const isSelected = route.id === selectedRouteId;
      const lineFeature = new Feature({
        geometry: new LineString(route.geometry.coordinates),
        routeId: route.id,
      });

      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: route.color,
            width: isSelected ? 4.5 : 2.2,
            lineDash: route.placeholder && !isSelected ? [6, 5] : undefined,
          }),
          zIndex: isSelected ? 25 : 12,
        })
      );
      src.addFeature(lineFeature);
    });

    // Draw emergency replanned route in FIELD mode when active
    if (mode === 'FIELD' && replanData?.route) {
      const repFeature = new Feature({
        geometry: new LineString(replanData.route.geometry.coordinates),
      });
      repFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: replanData.route.color || '#FF5A5F',
            width: 4,
            lineDash: [8, 6],
          }),
          zIndex: 40,
        })
      );
      src.addFeature(repFeature);
    }
  }, [routes, selectedRouteId, layers, mode, replanData]);

  // 4. Render Science Targets Vector Layer
  useEffect(() => {
    const src = targetsSourceRef.current;
    src.clear();

    const targetsLayerCfg = layers.find((l) => l.id === 'targets');
    if (targetsLayerCfg && !targetsLayerCfg.enabled) return;

    targets.forEach((t) => {
      const { id, rubric, is_base, is_shelter } = t.properties;
      const isSelected = id === selectedTargetId;
      const feat = new Feature({
        geometry: new Point(t.geometry.coordinates),
        targetId: id,
      });

      const fillColor = is_base
        ? '#4FC3F7'
        : is_shelter
        ? '#7CD992'
        : isSelected
        ? '#E4572E'
        : '#E8B04B';

      feat.setStyle(
        new Style({
          image: new CircleStyle({
            radius: isSelected ? 11 : 8.5,
            fill: new Fill({ color: fillColor }),
            stroke: new Stroke({
              color: isSelected ? '#FFFFFF' : '#0B0F14',
              width: isSelected ? 2.5 : 1.8,
            }),
          }),
          text: new TextStyle({
            text: `${id} (${rubric.total_15})`,
            offsetY: -16,
            font: "700 11px 'JetBrains Mono', monospace",
            fill: new Fill({ color: '#E6EDF3' }),
            stroke: new Stroke({ color: '#0B0F14', width: 3.5 }),
          }),
          zIndex: isSelected ? 50 : 30,
        })
      );

      src.addFeature(feat);
    });
  }, [targets, selectedTargetId, layers]);

  // 5. Render FIELD Mode Safe Return Zone Polygon & Astronaut Marker
  useEffect(() => {
    const src = fieldSourceRef.current;
    src.clear();
    if (mode !== 'FIELD') return;

    if (replanData?.safe_return_zone) {
      const lvl: AlertLevel = replanData.alert.level;
      const strokeColor =
        lvl === 'return now'
          ? '#FF5A5F'
          : lvl === 'caution'
          ? '#FFB020'
          : '#4FC3F7';
      const fillColor =
        lvl === 'return now'
          ? 'rgba(255, 90, 95, 0.14)'
          : lvl === 'caution'
          ? 'rgba(255, 176, 32, 0.14)'
          : 'rgba(79, 195, 247, 0.13)';

      const polyFeature = new Feature({
        geometry: new Polygon(replanData.safe_return_zone.geometry.coordinates),
      });
      polyFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: strokeColor,
            width: 2,
            lineDash: [6, 4],
          }),
          fill: new Fill({ color: fillColor }),
        })
      );
      src.addFeature(polyFeature);
    }

    const astroFeature = new Feature({
      geometry: new Point(astronautPos),
    });
    astroFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 9,
          fill: new Fill({ color: '#E4572E' }),
          stroke: new Stroke({ color: '#FFFFFF', width: 2.5 }),
        }),
        text: new TextStyle({
          text: 'EVA CREW',
          offsetY: 18,
          font: "700 11px 'JetBrains Mono', monospace",
          fill: new Fill({ color: '#FFFFFF' }),
          stroke: new Stroke({ color: '#0B0F14', width: 3.5 }),
        }),
        zIndex: 60,
      })
    );
    src.addFeature(astroFeature);
  }, [mode, astronautPos, replanData]);

  return (
    <div style={{ position: 'relative', flex: 1, height: '100%', backgroundColor: '#0B0F14' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top-Left Fixed DEM Resolution Limitation Disclaimer (Required by Section 6) */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          backgroundColor: 'rgba(18, 24, 33, 0.92)',
          border: '1px solid #1F2A37',
          borderLeft: '3px solid #FFB020',
          borderRadius: '4px',
          padding: '6px 10px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          color: '#E6EDF3',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
        }}
      >
        <span style={{ color: '#FFB020', fontWeight: 700 }}>DEM NOTICE:</span> Obstacles &lt; 2 m
        not visible in DEM (verify via Mastcam/Navcam POV)
      </div>

      {/* Top-Right Route Legend Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          backgroundColor: 'rgba(18, 24, 33, 0.92)',
          border: '1px solid #1F2A37',
          borderRadius: '5px',
          padding: '7px 11px',
          display: 'flex',
          gap: '12px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              width: '12px',
              height: '3px',
              backgroundColor: '#E8B04B',
              display: 'inline-block',
            }}
          />
          <span>Scientific</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              width: '12px',
              height: '3px',
              backgroundColor: '#4FC3F7',
              display: 'inline-block',
            }}
          />
          <span>Fast</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              width: '12px',
              height: '3px',
              backgroundColor: '#7CD992',
              display: 'inline-block',
            }}
          />
          <span>Safe</span>
        </div>
      </div>

      {/* Bottom-Left Metric Scale Bar + Live Cursor Coordinates */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        {/* Scale Bar */}
        <div
          style={{
            backgroundColor: 'rgba(18, 24, 33, 0.92)',
            border: '1px solid #1F2A37',
            borderRadius: '4px',
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            color: '#E6EDF3',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '6px',
              borderLeft: '2px solid #E6EDF3',
              borderRight: '2px solid #E6EDF3',
              borderBottom: '2px solid #E6EDF3',
            }}
          />
          <span>250 m (IAU Mars 2015)</span>
        </div>

        {/* Cursor Telemetry */}
        <div
          style={{
            backgroundColor: 'rgba(18, 24, 33, 0.92)',
            border: '1px solid #1F2A37',
            borderRadius: '4px',
            padding: '5px 12px',
            display: 'flex',
            gap: '14px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            color: '#8B98A5',
          }}
        >
          <span>
            LAT <strong style={{ color: '#E6EDF3' }}>{cursorTelemetry.lat}°N</strong>
          </span>
          <span>
            LON <strong style={{ color: '#E6EDF3' }}>{cursorTelemetry.lon}°E</strong>
          </span>
          <span>
            ELEV <strong style={{ color: '#E8B04B' }}>{cursorTelemetry.elev_m} m</strong>
          </span>
          <span>
            SLOPE{' '}
            <strong
              style={{
                color:
                  cursorTelemetry.slope_deg > 20
                    ? '#FF5A5F'
                    : cursorTelemetry.slope_deg >= 10
                    ? '#FFB020'
                    : '#7CD992',
              }}
            >
              {cursorTelemetry.slope_deg}°
            </strong>
          </span>
          <span>
            SHIELDING{' '}
            <strong style={{ color: '#4FC3F7' }}>{cursorTelemetry.shielding_pct}%</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
