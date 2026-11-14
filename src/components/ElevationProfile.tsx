import React from 'react';
import { RouteItem } from '../types/senda';
import { ProvenanceChip } from './ProvenanceChip';

interface ElevationProfileProps {
  route: RouteItem;
  progressRatio?: number;
  showProgress?: boolean;
}

export const ElevationProfile: React.FC<ElevationProfileProps> = ({
  route,
  progressRatio = 0,
  showProgress = false,
}) => {
  const elevs = route.elevation_m || [];
  if (elevs.length < 2) return null;

  const minZ = -3740;
  const maxZ = -3600;
  const w = 310;
  const h = 76;
  const padL = 38;
  const padR = 10;
  const padT = 10;
  const padB = 18;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const points = elevs.map((z, idx) => {
    const x = padL + (idx / (elevs.length - 1)) * plotW;
    const y = padT + (1 - (z - minZ) / (maxZ - minZ)) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const areaPoints = [
    `${padL},${padT + plotH}`,
    ...points,
    `${padL + plotW},${padT + plotH}`,
  ].join(' ');

  const progX = padL + Math.max(0, Math.min(1, progressRatio)) * plotW;
  const progIdx = Math.min(
    elevs.length - 1,
    Math.max(0, Math.round(progressRatio * (elevs.length - 1)))
  );
  const progZ = elevs[progIdx];
  const progY = padT + (1 - (progZ - minZ) / (maxZ - minZ)) * plotH;

  return (
    <div
      style={{
        backgroundColor: '#0B0F14',
        border: '1px solid #1F2A37',
        borderRadius: '6px',
        padding: '8px 10px',
        marginTop: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            color: '#8B98A5',
          }}
        >
          ELEVATION PROFILE ({route.name.toUpperCase()} · +{route.metrics.climb_m} m CLIMB)
        </span>
        <ProvenanceChip kind={route.kind || 'measured'} compact />
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '76px', display: 'block' }}>
        {/* Grid lines */}
        <line
          x1={padL}
          y1={padT}
          x2={padL + plotW}
          y2={padT}
          stroke="#1F2A37"
          strokeDasharray="2,2"
        />
        <line
          x1={padL}
          y1={padT + plotH}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="#1F2A37"
        />
        <text
          x={padL - 4}
          y={padT + 4}
          textAnchor="end"
          fill="#8B98A5"
          fontSize="8.5"
          fontFamily="JetBrains Mono"
        >
          -3605m
        </text>
        <text
          x={padL - 4}
          y={padT + plotH}
          textAnchor="end"
          fill="#8B98A5"
          fontSize="8.5"
          fontFamily="JetBrains Mono"
        >
          -3735m
        </text>

        {/* Area & Line */}
        <polygon points={areaPoints} fill={route.color} opacity="0.16" />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={route.color}
          strokeWidth="2"
        />

        {/* Progress cursor in FIELD mode */}
        {showProgress && (
          <>
            <line
              x1={progX}
              y1={padT}
              x2={progX}
              y2={padT + plotH}
              stroke="#E4572E"
              strokeWidth="1.2"
              strokeDasharray="2,2"
            />
            <circle cx={progX} cy={progY} r="3.8" fill="#E4572E" stroke="#FFF" strokeWidth="1" />
          </>
        )}

        {/* X Axis labels */}
        <text
          x={padL}
          y={h - 3}
          fill="#8B98A5"
          fontSize="8.5"
          fontFamily="JetBrains Mono"
        >
          0 m (T01 Base)
        </text>
        <text
          x={padL + plotW}
          y={h - 3}
          textAnchor="end"
          fill="#8B98A5"
          fontSize="8.5"
          fontFamily="JetBrains Mono"
        >
          {route.metrics.distance_oneway_m} m ({route.visits[route.visits.length - 1]})
        </text>
      </svg>
    </div>
  );
};
