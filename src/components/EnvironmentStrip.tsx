import React from 'react';
import { EnvData, ScenarioType } from '../types/senda';
import { ProvenanceChip } from './ProvenanceChip';

interface EnvironmentStripProps {
  env: EnvData;
  scenario: ScenarioType;
}

export const EnvironmentStrip: React.FC<EnvironmentStripProps> = ({
  env,
  scenario,
}) => {
  const curve = env.temperature.hourly_curve || [];
  const minT = -80;
  const maxT = -5;
  const w = 440;
  const h = 64;
  const padL = 32;
  const padR = 10;
  const padT = 8;
  const padB = 16;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const pts = curve.map((pt) => {
    const x = padL + (pt.hour_num / 23) * plotW;
    const y = padT + (1 - (pt.temp_C - minT) / (maxT - minT)) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const evaStartX = padL + (9.5 / 23) * plotW;
  const evaEndX = padL + (15.5 / 23) * plotW;

  const activeTau =
    scenario === 'dust_storm'
      ? env.dust.dust_storm_tau
      : env.dust.optical_depth_tau;
  const activeDoseRate =
    scenario === 'solar_storm'
      ? `${env.radiation.solar_storm.unshielded_dose_rate_mSv_per_hr} mSv/hr (SPE!)`
      : `${env.radiation.gcr_dose_mSv_per_sol} mSv/sol`;

  return (
    <footer
      style={{
        height: '86px',
        backgroundColor: '#121821',
        borderTop: '1px solid #1F2A37',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: '16px',
        flexShrink: 0,
        zIndex: 15,
      }}
    >
      {/* Left: Diurnal Temperature Curve + Shaded EVA Window (09:30–15:30) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '175px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '10px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                color: '#8B98A5',
              }}
            >
              REMS DIURNAL TEMP
            </span>
            <ProvenanceChip kind={env.temperature.kind} compact />
          </div>
          <div
            style={{
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: '#E6EDF3',
              marginTop: '2px',
            }}
          >
            {env.temperature.eva_window_mean_C} °C{' '}
            <span style={{ fontSize: '11px', color: '#8B98A5', fontWeight: 400 }}>
              ({env.temperature.min_C} to {env.temperature.max_C} °C)
            </span>
          </div>
          <div
            style={{
              fontSize: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#7CD992',
              marginTop: '2px',
            }}
          >
            EVA Window: {env.eva_window.start}–{env.eva_window.end} LTST
          </div>
        </div>

        {/* SVG Temperature Curve */}
        <svg
          viewBox={`0 0 ${w} ${h}`}
          style={{
            width: '390px',
            height: '66px',
            backgroundColor: '#0B0F14',
            border: '1px solid #1F2A37',
            borderRadius: '5px',
          }}
        >
          {/* Shaded EVA Window (09:30 - 15:30) */}
          <rect
            x={evaStartX}
            y={padT}
            width={evaEndX - evaStartX}
            height={plotH}
            fill="rgba(124, 217, 146, 0.16)"
            stroke="rgba(124, 217, 146, 0.45)"
            strokeDasharray="2,2"
          />
          <text
            x={(evaStartX + evaEndX) / 2}
            y={padT + 9}
            textAnchor="middle"
            fill="#7CD992"
            fontSize="8.5"
            fontFamily="JetBrains Mono"
            fontWeight="700"
          >
            EVA WINDOW (09:30–15:30)
          </text>

          {/* Y axis labels */}
          <text
            x={padL - 4}
            y={padT + 6}
            textAnchor="end"
            fill="#8B98A5"
            fontSize="8"
            fontFamily="JetBrains Mono"
          >
            -12°C
          </text>
          <text
            x={padL - 4}
            y={padT + plotH}
            textAnchor="end"
            fill="#8B98A5"
            fontSize="8"
            fontFamily="JetBrains Mono"
          >
            -76°C
          </text>

          {/* Curve */}
          <polyline
            points={pts.join(' ')}
            fill="none"
            stroke="#E8B04B"
            strokeWidth="2"
          />

          {/* X axis labels */}
          <text x={padL} y={h - 3} fill="#8B98A5" fontSize="8" fontFamily="JetBrains Mono">
            00:00
          </text>
          <text
            x={evaStartX}
            y={h - 3}
            textAnchor="middle"
            fill="#7CD992"
            fontSize="8"
            fontFamily="JetBrains Mono"
          >
            09:30
          </text>
          <text
            x={evaEndX}
            y={h - 3}
            textAnchor="middle"
            fill="#7CD992"
            fontSize="8"
            fontFamily="JetBrains Mono"
          >
            15:30
          </text>
          <text
            x={padL + plotW}
            y={h - 3}
            textAnchor="end"
            fill="#8B98A5"
            fontSize="8"
            fontFamily="JetBrains Mono"
          >
            23:00
          </text>
        </svg>
      </div>

      {/* Right: 4 Environmental Telemetry Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(135px, 1fr))',
          gap: '10px',
          flex: 1,
        }}
      >
        {/* Pressure */}
        <div
          style={{
            backgroundColor: '#0B0F14',
            border: '1px solid #1F2A37',
            borderRadius: '5px',
            padding: '7px 10px',
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
              }}
            >
              PRESSURE (REMS)
            </span>
            <ProvenanceChip kind={env.atmosphere.kind} compact />
          </div>
          <div
            style={{
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: '#E6EDF3',
              marginTop: '4px',
            }}
          >
            {env.atmosphere.pressure_Pa} Pa{' '}
            <span style={{ fontSize: '10px', color: '#8B98A5', fontWeight: 400 }}>
              ({env.atmosphere.pressure_range_Pa[0]}–{env.atmosphere.pressure_range_Pa[1]})
            </span>
          </div>
        </div>

        {/* Radiation Dose Rate */}
        <div
          style={{
            backgroundColor: '#0B0F14',
            border: `1px solid ${scenario === 'solar_storm' ? '#FF5A5F' : '#1F2A37'}`,
            borderRadius: '5px',
            padding: '7px 10px',
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
              }}
            >
              RAD DOSE RATE
            </span>
            <ProvenanceChip
              kind={scenario === 'solar_storm' ? 'modeled' : env.radiation.kind}
              compact
            />
          </div>
          <div
            style={{
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: scenario === 'solar_storm' ? '#FF5A5F' : '#4FC3F7',
              marginTop: '4px',
            }}
          >
            {activeDoseRate}{' '}
            {scenario !== 'solar_storm' && (
              <span style={{ fontSize: '10px', color: '#8B98A5', fontWeight: 400 }}>
                (0.58–0.70)
              </span>
            )}
          </div>
        </div>

        {/* Dust Status */}
        <div
          style={{
            backgroundColor: '#0B0F14',
            border: `1px solid ${scenario === 'dust_storm' ? '#FFB020' : '#1F2A37'}`,
            borderRadius: '5px',
            padding: '7px 10px',
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
              }}
            >
              DUST OPACITY (τ)
            </span>
            <ProvenanceChip kind={env.dust.kind} compact />
          </div>
          <div
            style={{
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: scenario === 'dust_storm' ? '#FFB020' : '#E6EDF3',
              marginTop: '4px',
            }}
          >
            τ = {activeTau}{' '}
            <span style={{ fontSize: '10px', color: '#8B98A5', fontWeight: 400 }}>
              ({scenario === 'dust_storm' ? 'Storm Alert' : env.dust.status})
            </span>
          </div>
        </div>

        {/* Sunset & EVA Horizon */}
        <div
          style={{
            backgroundColor: '#0B0F14',
            border: '1px solid #1F2A37',
            borderRadius: '5px',
            padding: '7px 10px',
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
              }}
            >
              SUNSET / HORIZON
            </span>
            <ProvenanceChip kind={env.time.kind} compact />
          </div>
          <div
            style={{
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: '#E8B04B',
              marginTop: '4px',
            }}
          >
            {env.time.sunset} LTST{' '}
            <span style={{ fontSize: '10px', color: '#8B98A5', fontWeight: 400 }}>
              (Dawn {env.time.sunrise})
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
