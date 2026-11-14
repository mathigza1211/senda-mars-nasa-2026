import React from 'react';
import { ReplanResponse } from '../types/senda';
import { ProvenanceChip } from './ProvenanceChip';

interface AlertModalProps {
  open: boolean;
  replanData: ReplanResponse | null;
  onDismiss: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  open,
  replanData,
  onDismiss,
}) => {
  if (!open || !replanData) return null;

  const { alert, route } = replanData;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 15, 20, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          width: '490px',
          backgroundColor: '#121821',
          border: '2px solid #FF5A5F',
          borderRadius: '8px',
          boxShadow: '0 0 36px rgba(255, 90, 95, 0.45)',
          padding: '20px 22px',
          color: '#E6EDF3',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          <span
            style={{
              backgroundColor: '#FF5A5F',
              color: '#0B0F14',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '3px',
            }}
          >
            LEVEL 3 EMERGENCY · RETURN NOW
          </span>
          <ProvenanceChip kind="modeled" />
        </div>

        <h2
          style={{
            margin: '0 0 8px 0',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '18px',
            color: '#FF5A5F',
            letterSpacing: '0.02em',
          }}
        >
          SOLAR PARTICLE EVENT — go to nearest shelter
        </h2>

        <p style={{ margin: '0 0 14px 0', fontSize: '13px', lineHeight: 1.5, color: '#E6EDF3' }}>
          {alert.message}
        </p>

        {/* Shelter & Shielding Reduction Summary */}
        <div
          style={{
            backgroundColor: '#0B0F14',
            border: '1px solid #1F2A37',
            borderRadius: '6px',
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: '#8B98A5' }}>DESIGNATED SHELTER</div>
            <div style={{ fontWeight: 700, color: '#7CD992', marginTop: '3px' }}>
              {alert.shelter_target || 'T08'} · Eastern Boxwork Wall
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#8B98A5' }}>
              EST. DOSE REDUCTION
            </div>
            <div style={{ fontWeight: 700, color: '#4FC3F7', marginTop: '3px' }}>
              −{alert.shielding_reduction_pct}% (Sky-View Blocking)
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#8B98A5' }}>SHELTER DISTANCE</div>
            <div style={{ fontWeight: 700, color: '#E6EDF3', marginTop: '3px' }}>
              {route.metrics.distance_oneway_m} m ({route.metrics.duration_min} min)
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#8B98A5' }}>O₂ REQUIRED TO SHELTER</div>
            <div style={{ fontWeight: 700, color: '#E8B04B', marginTop: '3px' }}>
              {route.metrics.o2_L[0]} L ({route.metrics.o2_L[1]}–{route.metrics.o2_L[2]} L)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onDismiss}
            style={{
              border: 'none',
              borderRadius: '5px',
              padding: '9px 16px',
              backgroundColor: '#FF5A5F',
              color: '#0B0F14',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ACKNOWLEDGE & FOLLOW RED SHELTER ROUTE (→ T08)
          </button>
        </div>
      </div>
    </div>
  );
};
