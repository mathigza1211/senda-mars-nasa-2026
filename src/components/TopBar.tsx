import React from 'react';
import { EnvData } from '../types/senda';
import { ProvenanceChip } from './ProvenanceChip';

interface TopBarProps {
  env: EnvData;
  mode: 'PLAN' | 'FIELD' | '3D';
  onModeChange: (mode: 'PLAN' | 'FIELD' | '3D') => void;
  elapsedMin: number;
  backendOnline: boolean;
}

function formatSolarTime(baseTime: string, addMinutes: number): string {
  const parts = baseTime.split(':').map(Number);
  const startMin = (parts[0] || 9) * 60 + (parts[1] || 30);
  const total = (startMin + Math.floor(addMinutes)) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export const TopBar: React.FC<TopBarProps> = ({
  env,
  mode,
  onModeChange,
  elapsedMin,
  backendOnline,
}) => {
  const currentLTST = formatSolarTime(env.time.local_solar_time, mode === 'FIELD' ? elapsedMin : 0);

  return (
    <header
      style={{
        height: '52px',
        backgroundColor: '#121821',
        borderBottom: '1px solid #1F2A37',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Left: Brand & Site */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '5px',
              backgroundColor: '#E4572E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: '15px',
              color: '#0B0F14',
              boxShadow: '0 0 12px rgba(228, 87, 46, 0.45)',
            }}
          >
            S
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '15px',
                  letterSpacing: '0.08em',
                  color: '#E6EDF3',
                }}
              >
                SENDA
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: '#E4572E',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}
              >
                EVA MISSION CONTROL
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#8B98A5' }}>
              Safe paths to Martian science
            </div>
          </div>
        </div>

        <div
          style={{
            height: '24px',
            width: '1px',
            backgroundColor: '#1F2A37',
          }}
        />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#E6EDF3' }}>
              {env.site.name}
            </span>
            <ProvenanceChip kind={env.site.kind} compact />
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#8B98A5',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Center: −4.7957°N, 137.3890°E · Elev −3735 m to −3605 m (MOLA Areoid)
          </div>
        </div>
      </div>

      {/* Center: Martian Clock */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          backgroundColor: '#0B0F14',
          border: '1px solid #1F2A37',
          borderRadius: '6px',
          padding: '5px 12px',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div>
          <span style={{ fontSize: '10px', color: '#8B98A5', marginRight: '6px' }}>
            CURIOSITY SOL
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#E8B04B' }}>
            {env.time.sol}
          </span>
        </div>
        <span style={{ color: '#1F2A37' }}>|</span>
        <div>
          <span style={{ fontSize: '10px', color: '#8B98A5', marginRight: '6px' }}>
            MY {env.time.mars_year}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#E6EDF3' }}>
            Ls {env.time.ls_deg}°
          </span>
        </div>
        <span style={{ color: '#1F2A37' }}>|</span>
        <div>
          <span style={{ fontSize: '10px', color: '#8B98A5', marginRight: '6px' }}>
            LTST
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#4FC3F7' }}>
            {currentLTST}
          </span>
        </div>
        <ProvenanceChip kind={env.time.kind} compact />
      </div>

      {/* Right: Backend Status & Mode Switcher (PLAN | FIELD | 3D) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          title={
            backendOnline
              ? 'Connected to FastAPI senda_physics.py engine'
              : 'Using local /data JSONs + embedded physics engine (Phase 1)'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: '#0B0F14',
            border: '1px solid #1F2A37',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            color: backendOnline ? '#7CD992' : '#8B98A5',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: backendOnline ? '#7CD992' : '#E8B04B',
            }}
          />
          {backendOnline ? 'API: FASTAPI LIVE' : 'DATA: /DATA JSON'}
        </div>

        <div
          style={{
            display: 'flex',
            backgroundColor: '#0B0F14',
            border: '1px solid #1F2A37',
            borderRadius: '6px',
            padding: '2px',
          }}
        >
          {(['PLAN', 'FIELD', '3D'] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  backgroundColor: active ? '#E4572E' : 'transparent',
                  color: active ? '#0B0F14' : '#8B98A5',
                  transition: 'all 0.15s ease',
                }}
              >
                {m === '3D' ? '3D DEM' : m}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
