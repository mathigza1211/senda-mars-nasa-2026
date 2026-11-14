import React from 'react';
import {
  AlertLevel,
  EnvData,
  ReplanResponse,
  RouteItem,
  ScenarioType,
} from '../types/senda';
import { ProvenanceChip } from './ProvenanceChip';
import { ElevationProfile } from './ElevationProfile';

interface FieldHUDProps {
  route: RouteItem;
  env: EnvData;
  progress: number; // 0 to 1
  onChangeProgress: (val: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  speedMultiplier: 1 | 10 | 60;
  onChangeSpeed: (s: 1 | 10 | 60) => void;
  scenario: ScenarioType;
  onChangeScenario: (sc: ScenarioType) => void;
  o2LeftL: number;
  elapsedMin: number;
  accumulatedDoseMsv: number;
  nextWaypointId: string;
  distToNextWaypointM: number;
  replanData: ReplanResponse | null;
}

const SCENARIO_BUTTONS: { id: ScenarioType; label: string; desc: string }[] = [
  { id: 'nominal', label: 'Nominal EVA', desc: 'Standard telemetry' },
  {
    id: 'solar_storm',
    label: 'Solar storm',
    desc: 'SPE alert → Shelter T08 (38% shielding)',
  },
  {
    id: 'dust_storm',
    label: 'Dust storm',
    desc: 'τ = 3.5 · Speed ×0.7',
  },
  {
    id: 'suit_leak',
    label: 'Suit leak (×1.5)',
    desc: 'O₂ consumption ×1.5 · Return now',
  },
  {
    id: 'injury',
    label: 'Injury (×0.5)',
    desc: 'Walking speed ×0.5 · Caution',
  },
  {
    id: 'blocked_path',
    label: 'Blocked path',
    desc: 'Slope > 20° ahead · A* detour',
  },
];

export const FieldHUD: React.FC<FieldHUDProps> = ({
  route,
  env,
  progress,
  onChangeProgress,
  isPlaying,
  onTogglePlay,
  onReset,
  speedMultiplier,
  onChangeSpeed,
  scenario,
  onChangeScenario,
  o2LeftL,
  elapsedMin,
  accumulatedDoseMsv,
  nextWaypointId,
  distToNextWaypointM,
  replanData,
}) => {
  const alertLevel: AlertLevel = replanData?.alert.level || 'info';
  const alertColor =
    alertLevel === 'return now'
      ? '#FF5A5F'
      : alertLevel === 'caution'
      ? '#FFB020'
      : '#4FC3F7';

  const o2Min = Math.round(o2LeftL * 0.8);
  const o2Max = Math.round(o2LeftL * 1.2);
  const tankCap = env.physiology.plss_o2_capacity_L || 300;
  const o2Pct = Math.max(0, Math.min(100, Math.round((o2LeftL / tankCap) * 100)));

  const reserve = replanData?.alert.reserve;

  return (
    <div
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* 1. Simulation Transport Controls */}
      <div
        style={{
          backgroundColor: '#0B0F14',
          border: '1px solid #1F2A37',
          borderRadius: '6px',
          padding: '10px',
        }}
      >
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
              fontWeight: 700,
              color: '#8B98A5',
            }}
          >
            FIELD EVA TELEMETRY SIMULATOR ({route.name.toUpperCase()})
          </span>
          <ProvenanceChip kind="modeled" compact />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={onTogglePlay}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: '4px',
              padding: '7px 10px',
              backgroundColor: isPlaying ? '#FFB020' : '#E4572E',
              color: '#0B0F14',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isPlaying ? '⏸ PAUSE EVA' : '▶ PLAY EVA'}
          </button>

          <button
            onClick={onReset}
            style={{
              border: '1px solid #1F2A37',
              borderRadius: '4px',
              padding: '7px 10px',
              backgroundColor: '#121821',
              color: '#E6EDF3',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            ↺ RESET
          </button>

          {([1, 10, 60] as const).map((spd) => (
            <button
              key={spd}
              onClick={() => onChangeSpeed(spd)}
              style={{
                border: `1px solid ${speedMultiplier === spd ? '#4FC3F7' : '#1F2A37'}`,
                borderRadius: '4px',
                padding: '7px 8px',
                backgroundColor:
                  speedMultiplier === spd ? 'rgba(79, 195, 247, 0.2)' : '#121821',
                color: speedMultiplier === spd ? '#4FC3F7' : '#8B98A5',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ×{spd}
            </button>
          ))}
        </div>

        {/* Manual Scrubber */}
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#8B98A5',
            }}
          >
            Traverse
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={progress}
            onChange={(e) => onChangeProgress(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#E4572E', cursor: 'pointer' }}
          />
          <span
            style={{
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#E6EDF3',
              width: '36px',
              textAlign: 'right',
            }}
          >
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>

      {/* 2. Large Mission Gauges (O2, Time, Dose, Next Waypoint) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}
      >
        {/* O2 Remaining */}
        <div
          style={{
            gridColumn: '1 / -1',
            backgroundColor: '#0B0F14',
            border: `1px solid ${alertColor}`,
            borderRadius: '6px',
            padding: '10px 12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#8B98A5',
                fontWeight: 700,
              }}
            >
              PLSS REMAINING O₂ (CAPACITY {tankCap} L)
            </span>
            <ProvenanceChip kind={env.physiology.kind} compact />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginTop: '4px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span style={{ fontSize: '21px', fontWeight: 700, color: alertColor }}>
              {Math.round(o2LeftL)} L{' '}
              <span style={{ fontSize: '13px', color: '#8B98A5', fontWeight: 500 }}>
                ({o2Min}–{o2Max} L)
              </span>
            </span>
            <span style={{ fontSize: '12px', color: '#E6EDF3', fontWeight: 700 }}>
              {o2Pct}%
            </span>
          </div>

          {/* O2 Bar */}
          <div
            style={{
              marginTop: '6px',
              height: '7px',
              backgroundColor: '#121821',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${o2Pct}%`,
                height: '100%',
                backgroundColor: alertColor,
                transition: 'width 0.2s ease',
              }}
            />
          </div>

          {reserve && (
            <div
              style={{
                marginTop: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10.5px',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#8B98A5',
              }}
            >
              <span>Walkback Req (×1.3): {reserve.o2_return_required_L} L</span>
              <span style={{ color: alertColor, fontWeight: 700 }}>
                Safe Margin: {reserve.margin_L} L (
                {Math.round(reserve.margin_ratio * 100)}%)
              </span>
            </div>
          )}
        </div>

        {/* Elapsed Time */}
        <div
          style={{
            backgroundColor: '#0B0F14',
            border: '1px solid #1F2A37',
            borderRadius: '6px',
            padding: '9px 10px',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: '#8B98A5' }}>ELAPSED TIME</span>
            <ProvenanceChip kind="modeled" compact />
          </div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: '#E6EDF3',
              marginTop: '4px',
            }}
          >
            {elapsedMin} min
          </div>
          <div style={{ fontSize: '10px', color: '#8B98A5', marginTop: '2px' }}>
            Plan: {route.metrics.duration_min} min
          </div>
        </div>

        {/* Accumulated Radiation Dose */}
        <div
          style={{
            backgroundColor: '#0B0F14',
            border: `1px solid ${scenario === 'solar_storm' ? '#FF5A5F' : '#1F2A37'}`,
            borderRadius: '6px',
            padding: '9px 10px',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: '#8B98A5' }}>ACCUM. DOSE</span>
            <ProvenanceChip kind={env.radiation.kind} compact />
          </div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: scenario === 'solar_storm' ? '#FF5A5F' : '#4FC3F7',
              marginTop: '4px',
            }}
          >
            {accumulatedDoseMsv.toFixed(3)} mSv
          </div>
          <div style={{ fontSize: '10px', color: '#8B98A5', marginTop: '2px' }}>
            Limit: {env.radiation.limits.event_30day_limit_mSv} mSv (30d)
          </div>
        </div>

        {/* Next Waypoint & Distance */}
        <div
          style={{
            gridColumn: '1 / -1',
            backgroundColor: '#0B0F14',
            border: '1px solid #1F2A37',
            borderRadius: '6px',
            padding: '9px 11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: '#8B98A5' }}>NEXT WAYPOINT</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#E8B04B' }}>
              {scenario === 'solar_storm'
                ? 'T08 Eastern Boxwork Shelter'
                : nextWaypointId}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#8B98A5' }}>DISTANCE TO GO</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#E6EDF3' }}>
              {distToNextWaypointM} m
            </div>
          </div>
        </div>
      </div>

      {/* 3. Active 3-Level Alert Banner */}
      {replanData && (
        <div
          style={{
            backgroundColor:
              alertLevel === 'return now'
                ? 'rgba(255, 90, 95, 0.14)'
                : alertLevel === 'caution'
                ? 'rgba(255, 176, 32, 0.14)'
                : 'rgba(79, 195, 247, 0.12)',
            border: `1.5px solid ${alertColor}`,
            borderRadius: '6px',
            padding: '9px 11px',
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
                fontSize: '11px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                color: alertColor,
              }}
            >
              [{alertLevel.toUpperCase()}] {replanData.alert.title}
            </span>
            <ProvenanceChip kind="modeled" compact />
          </div>
          <div style={{ fontSize: '11.5px', color: '#E6EDF3', lineHeight: 1.4 }}>
            {replanData.alert.message}
          </div>
          {replanData.alert.shelter_target && (
            <div
              style={{
                marginTop: '5px',
                fontSize: '11px',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#7CD992',
                fontWeight: 700,
              }}
            >
              ✓ Rerouted to {replanData.alert.shelter_target} · Estimated dose reduction:{' '}
              {replanData.alert.shielding_reduction_pct}%
            </div>
          )}
        </div>
      )}

      {/* 4. Contingency Demo Scenario Menu (5 Scenarios + Nominal) */}
      <div
        style={{
          backgroundColor: '#0B0F14',
          border: '1px solid #1F2A37',
          borderRadius: '6px',
          padding: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '7px',
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
            CONTINGENCY SCENARIOS (DEMO TRIGGER)
          </span>
          <ProvenanceChip kind="assumed" compact />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
          }}
        >
          {SCENARIO_BUTTONS.map((btn) => {
            const active = scenario === btn.id;
            const isCritical = btn.id === 'solar_storm' || btn.id === 'suit_leak';
            const borderCol = active
              ? isCritical
                ? '#FF5A5F'
                : '#FFB020'
              : '#1F2A37';
            return (
              <button
                key={btn.id}
                onClick={() => onChangeScenario(btn.id)}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  borderRadius: '5px',
                  border: `1.5px solid ${borderCol}`,
                  backgroundColor: active
                    ? isCritical
                      ? 'rgba(255, 90, 95, 0.18)'
                      : 'rgba(255, 176, 32, 0.16)'
                    : '#121821',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    color: active ? '#FFFFFF' : '#E6EDF3',
                  }}
                >
                  {btn.label}
                </div>
                <div style={{ fontSize: '9.5px', color: '#8B98A5', marginTop: '2px' }}>
                  {btn.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Live Elevation Profile with Astronaut Position */}
      <ElevationProfile route={route} progressRatio={progress} showProgress />
    </div>
  );
};
