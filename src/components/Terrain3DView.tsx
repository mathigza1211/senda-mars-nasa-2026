import React, { useEffect, useRef, useState } from 'react';
import { RouteItem, TargetFeature } from '../types/senda';
import { BBOX_MARS, sampleMountSharpTerrain } from '../services/api';
import { ProvenanceChip } from './ProvenanceChip';

interface Terrain3DViewProps {
  targets: TargetFeature[];
  selectedTargetId: string;
  onSelectTarget: (id: string) => void;
  routes: RouteItem[];
  selectedRouteId: string;
  astronautPos: [number, number];
}

export const Terrain3DView: React.FC<Terrain3DViewProps> = ({
  targets,
  selectedTargetId,
  routes,
  selectedRouteId,
  astronautPos,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [yaw, setYaw] = useState(-0.68);
  const [pitch, setPitch] = useState(0.58);
  const [vertExag, setVertExag] = useState<1 | 2>(1);
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0B0F14';
    ctx.fillRect(0, 0, w, h);

    const [lonMin, latMin, lonMax, latMax] = BBOX_MARS;
    const gridN = 36;
    const scale = Math.min(w, h) * 0.42;

    const project = (lon: number, lat: number, elevM: number): [number, number] => {
      const nx = (lon - lonMin) / (lonMax - lonMin) - 0.5;
      const ny = (lat - latMin) / (latMax - latMin) - 0.5;
      // Normalize elevation (-3735 m to -3605 m over 2000 m horizontal extent)
      const nz = ((elevM - -3670) / 1000.0) * vertExag * 1.8;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rx = nx * cosY - ny * sinY;
      const ry = nx * sinY + ny * cosY;

      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const py = ry * cosP - nz * sinP;

      return [w * 0.5 + rx * scale * 1.45, h * 0.54 - py * scale * 1.45];
    };

    // 1. Draw 3D DEM Mesh Quads
    for (let r = 0; r < gridN - 1; r++) {
      const lat0 = latMax - ((latMax - latMin) * r) / (gridN - 1);
      const lat1 = latMax - ((latMax - latMin) * (r + 1)) / (gridN - 1);
      for (let c = 0; c < gridN - 1; c++) {
        const lon0 = lonMin + ((lonMax - lonMin) * c) / (gridN - 1);
        const lon1 = lonMin + ((lonMax - lonMin) * (c + 1)) / (gridN - 1);

        const s00 = sampleMountSharpTerrain(lon0, lat0);
        const s10 = sampleMountSharpTerrain(lon1, lat0);
        const s11 = sampleMountSharpTerrain(lon1, lat1);
        const s01 = sampleMountSharpTerrain(lon0, lat1);

        const p00 = project(lon0, lat0, s00.elev_m);
        const p10 = project(lon1, lat0, s10.elev_m);
        const p11 = project(lon1, lat1, s11.elev_m);
        const p01 = project(lon0, lat1, s01.elev_m);

        const elevNorm = Math.max(0, Math.min(1, (s00.elev_m - -3735) / 132));
        const red = Math.round(92 + elevNorm * 78 + s00.boxwork_ridge * 35);
        const green = Math.round(58 + elevNorm * 52 + s00.boxwork_ridge * 22);
        const blue = Math.round(42 + elevNorm * 35);

        ctx.beginPath();
        ctx.moveTo(p00[0], p00[1]);
        ctx.lineTo(p10[0], p10[1]);
        ctx.lineTo(p11[0], p11[1]);
        ctx.lineTo(p01[0], p01[1]);
        ctx.closePath();
        ctx.fillStyle = `rgb(${red},${green},${blue})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(11, 15, 20, 0.35)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }

    // 2. Draw Routes on 3D Mesh
    routes.forEach((route) => {
      const isSel = route.id === selectedRouteId;
      ctx.beginPath();
      route.geometry.coordinates.forEach(([lon, lat], idx) => {
        const z = route.elevation_m[idx] ?? sampleMountSharpTerrain(lon, lat).elev_m;
        const [px, py] = project(lon, lat, z + 2.5);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = route.color;
      ctx.lineWidth = isSel ? 3.6 : 1.8;
      ctx.stroke();
    });

    // 3. Draw 8 Targets
    targets.forEach((t) => {
      const [lon, lat] = t.geometry.coordinates;
      const z = t.properties.elev_geoid_m;
      const [px, py] = project(lon, lat, z + 4);
      const isSel = t.properties.id === selectedTargetId;

      ctx.beginPath();
      ctx.arc(px, py, isSel ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? '#E4572E' : '#E8B04B';
      ctx.fill();
      ctx.strokeStyle = '#0B0F14';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.font = "700 10px 'JetBrains Mono', monospace";
      ctx.fillStyle = '#E6EDF3';
      ctx.fillText(`${t.properties.id} (${t.properties.rubric.total_15})`, px + 8, py + 3);
    });

    // 4. Draw Astronaut Position
    const astroZ = sampleMountSharpTerrain(astronautPos[0], astronautPos[1]).elev_m;
    const [ax, ay] = project(astronautPos[0], astronautPos[1], astroZ + 6);
    ctx.beginPath();
    ctx.arc(ax, ay, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#4FC3F7';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [yaw, pitch, vertExag, targets, selectedTargetId, routes, selectedRouteId, astronautPos]);

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        height: '100%',
        backgroundColor: '#0B0F14',
        cursor: 'grab',
      }}
      onMouseDown={(e) => {
        dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
      }}
      onMouseMove={(e) => {
        if (!dragRef.current.dragging) return;
        const dx = e.clientX - dragRef.current.lastX;
        const dy = e.clientY - dragRef.current.lastY;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        setYaw((y) => y + dx * 0.008);
        setPitch((p) => Math.max(0.2, Math.min(1.25, p + dy * 0.006)));
      }}
      onMouseUp={() => {
        dragRef.current.dragging = false;
      }}
      onMouseLeave={() => {
        dragRef.current.dragging = false;
      }}
    >
      <canvas
        ref={canvasRef}
        width={920}
        height={640}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* Top Overlay Controls */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          backgroundColor: 'rgba(18, 24, 33, 0.92)',
          border: '1px solid #1F2A37',
          borderRadius: '6px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
        }}
      >
        <span style={{ color: '#E6EDF3', fontWeight: 700 }}>
          3D LOCAL DEM MESH (USGS MSL Gale 1m v3)
        </span>
        <ProvenanceChip kind="measured" compact />
        <span style={{ color: '#8B98A5' }}>
          Vertical Exaggeration:{' '}
          <strong style={{ color: '#E8B04B' }}>{vertExag}×</strong>
        </span>
        <button
          onClick={() => setVertExag(vertExag === 1 ? 2 : 1)}
          style={{
            border: '1px solid #1F2A37',
            backgroundColor: '#0B0F14',
            color: '#4FC3F7',
            borderRadius: '4px',
            padding: '3px 8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          Toggle 1× / 2×
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          backgroundColor: 'rgba(18, 24, 33, 0.92)',
          border: '1px solid #1F2A37',
          borderRadius: '4px',
          padding: '5px 10px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          color: '#8B98A5',
        }}
      >
        Drag mouse to orbit 3D boxwork relief · Default 1× true-scale slope geometry
      </div>
    </div>
  );
};
