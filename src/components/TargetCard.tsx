import React, { useState } from 'react';
import { TargetFeature } from '../types/senda';
import { ProvenanceChip } from './ProvenanceChip';

interface TargetCardProps {
  target: TargetFeature;
  allTargets: TargetFeature[];
  onSelectTarget: (id: string) => void;
}

export const TargetCard: React.FC<TargetCardProps> = ({
  target,
  allTargets,
  onSelectTarget,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const p = target.properties;
  const [lon, lat] = target.geometry.coordinates;

  const rubricBars = [
    {
      label: 'Novelty',
      val: p.rubric.novelty ?? p.rubric.novedad,
      max: 5,
      color: '#E8B04B',
    },
    {
      label: 'Habitability',
      val: p.rubric.habitability ?? p.rubric.habitabilidad,
      max: 5,
      color: '#7CD992',
    },
    {
      label: 'Human-Only',
      val: p.rubric.human_only ?? p.rubric.solo_humano,
      max: 5,
      color: '#4FC3F7',
    },
  ];

  return (
    <div
      style={{
        padding: '12px 14px',
        borderBottom: '1px solid #1F2A37',
        backgroundColor: '#121821',
      }}
    >
      {/* Quick Target Selector Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#8B98A5',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          SCIENCE TARGET DOSSIER (8 ROI)
        </span>
        <ProvenanceChip kind={p.kind || 'measured'} compact />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
          marginBottom: '10px',
        }}
      >
        {allTargets.map((t) => {
          const tid = t.properties.id;
          const active = tid === p.id;
          return (
            <button
              key={tid}
              onClick={() => {
                setImgFailed(false);
                onSelectTarget(tid);
              }}
              style={{
                border: `1px solid ${active ? '#E4572E' : '#1F2A37'}`,
                backgroundColor: active ? 'rgba(228, 87, 46, 0.22)' : '#0B0F14',
                color: active ? '#E6EDF3' : '#8B98A5',
                borderRadius: '4px',
                padding: '3px 6px',
                fontSize: '10px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tid}
            </button>
          );
        })}
      </div>

      {/* Target Title & Score */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#E6EDF3' }}>
            {p.id} · {p.name}
          </div>
          <div style={{ fontSize: '11px', color: '#8B98A5', marginTop: '2px' }}>
            {p.type_en || p.type_es}
          </div>
        </div>
        <div
          style={{
            backgroundColor: '#0B0F14',
            border: '1px solid #E8B04B',
            borderRadius: '5px',
            padding: '4px 8px',
            textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div style={{ fontSize: '9px', color: '#8B98A5' }}>RUBRIC</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#E8B04B' }}>
            {p.rubric.total_15}/15
          </div>
        </div>
      </div>

      {/* Surface POV Viewport (Mastcam / Navcam with geological outcrop rendering) */}
      <div
        style={{
          position: 'relative',
          height: '118px',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid #1F2A37',
          backgroundColor: '#0B0F14',
          marginBottom: '9px',
        }}
      >
        {!imgFailed && p.pov_image ? (
          <img
            src={p.pov_image}
            alt={p.name}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <svg
            viewBox="0 0 360 118"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <defs>
              <linearGradient id="marsSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B271E" />
                <stop offset="55%" stopColor="#6E4735" />
                <stop offset="100%" stopColor="#9C6549" />
              </linearGradient>
              <linearGradient id="marsRock" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#5C3A28" />
                <stop offset="100%" stopColor="#2E1C14" />
              </linearGradient>
            </defs>
            <rect width="360" height="118" fill="url(#marsSky)" />
            {/* Mount Sharp Boxwork Ridges & Veins */}
            <polygon
              points="0,78 48,54 105,65 168,42 232,58 295,38 360,55 360,118 0,118"
              fill="url(#marsRock)"
            />
            <polyline
              points="35,95 95,66 168,42 224,78 295,38 345,74"
              fill="none"
              stroke="#E8B04B"
              strokeWidth="1.6"
              strokeDasharray="4,2"
              opacity="0.75"
            />
            <polyline
              points="70,110 135,74 205,84 265,58"
              fill="none"
              stroke="#E6EDF3"
              strokeWidth="1.2"
              opacity="0.6"
            />
            {/* Reticle */}
            <circle
              cx="180"
              cy="64"
              r="14"
              fill="none"
              stroke="#E4572E"
              strokeWidth="1.4"
            />
            <line x1="160" y1="64" x2="200" y2="64" stroke="#E4572E" strokeWidth="1" />
            <line x1="180" y1="44" x2="180" y2="84" stroke="#E4572E" strokeWidth="1" />
          </svg>
        )}

        <div
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            backgroundColor: 'rgba(11, 15, 20, 0.85)',
            border: '1px solid #1F2A37',
            borderRadius: '3px',
            padding: '2px 6px',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#E6EDF3',
          }}
        >
          POV: {p.camera || 'MSL Mastcam / Navcam'} · Sol {p.sol}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '6px',
            backgroundColor: 'rgba(11, 15, 20, 0.85)',
            border: '1px solid #1F2A37',
            borderRadius: '3px',
            padding: '2px 6px',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#E8B04B',
          }}
        >
          Elev: {p.elev_geoid_m} m · {lat.toFixed(5)}°N, {lon.toFixed(5)}°E
        </div>
      </div>

      {/* Scientific Justification (English) */}
      <p
        style={{
          margin: '0 0 10px 0',
          fontSize: '11.5px',
          lineHeight: 1.48,
          color: '#E6EDF3',
        }}
      >
        {p.desc_en}
      </p>

      {/* 3-Bar Rubric Breakdown */}
      <div
        style={{
          backgroundColor: '#0B0F14',
          border: '1px solid #1F2A37',
          borderRadius: '5px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {rubricBars.map((b) => (
          <div
            key={b.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
            }}
          >
            <span style={{ width: '86px', color: '#8B98A5' }}>{b.label}</span>
            <div
              style={{
                flex: 1,
                height: '6px',
                backgroundColor: '#121821',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(b.val / b.max) * 100}%`,
                  height: '100%',
                  backgroundColor: b.color,
                }}
              />
            </div>
            <span
              style={{
                width: '28px',
                textAlign: 'right',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                color: '#E6EDF3',
              }}
            >
              {b.val}/5
            </span>
          </div>
        ))}
      </div>

      {/* Source Link & Metadata */}
      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#8B98A5',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span>Coord: {p.coord_source}</span>
        <a
          href={p.source_url}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#4FC3F7', textDecoration: 'none' }}
        >
          NASA MSL Log ↗
        </a>
      </div>
    </div>
  );
};
