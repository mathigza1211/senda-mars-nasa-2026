import React from 'react';
import { RouteItem } from '../types/senda';
import { ProvenanceChip } from './ProvenanceChip';
import { ElevationProfile } from './ElevationProfile';

interface RouteComparatorProps {
  routes: RouteItem[];
  selectedRouteId: string;
  onSelectRoute: (id: string) => void;
  onStartFieldEva: () => void;
}

export const RouteComparator: React.FC<RouteComparatorProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  onStartFieldEva,
}) => {
  const activeRoute =
    routes.find((r) => r.id === selectedRouteId) || routes[0];

  return (
    <div style={{ padding: '12px 14px', flex: 1, overflowY: 'auto' }}>
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
          A* ROUTE COMPARATOR (ROUND-TRIP BUDGET)
        </span>
        <ProvenanceChip kind="modeled" compact />
      </div>

      {/* 3 Route Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {routes.map((route) => {
          const isSelected = route.id === selectedRouteId;
          const m = route.metrics;
          const [o2Cen, o2Min, o2Max] = m.o2_L;

          return (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              style={{
                backgroundColor: isSelected ? '#0B0F14' : 'rgba(11, 15, 20, 0.55)',
                border: `1.5px solid ${isSelected ? route.color : '#1F2A37'}`,
                borderRadius: '6px',
                padding: '9px 11px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Route Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: route.color,
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#E6EDF3',
                    }}
                  >
                    {route.name} Profile
                  </span>
                  <ProvenanceChip
                    kind={route.placeholder ? 'modeled' : 'measured'}
                    compact
                  />
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRoute(route.id);
                  }}
                  style={{
                    border: `1px solid ${isSelected ? route.color : '#1F2A37'}`,
                    backgroundColor: isSelected ? route.color : '#121821',
                    color: isSelected ? '#0B0F14' : '#8B98A5',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isSelected ? 'SELECTED' : 'Select route'}
                </button>
              </div>

              {/* Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '5px 10px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                }}
              >
                <div>
                  <span style={{ color: '#8B98A5' }}>Dist (1-way): </span>
                  <strong style={{ color: '#E6EDF3' }}>{m.distance_oneway_m} m</strong>
                </div>
                <div>
                  <span style={{ color: '#8B98A5' }}>Duration: </span>
                  <strong style={{ color: '#E6EDF3' }}>{m.duration_min} min</strong>
                </div>
                <div>
                  <span style={{ color: '#8B98A5' }}>Climb / Grade: </span>
                  <strong style={{ color: '#E6EDF3' }}>
                    +{m.climb_m} m (
                    {m.max_grade_pct !== null && m.max_grade_pct !== undefined
                      ? `${m.max_grade_pct}%`
                      : 'no data'}
                    )
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#8B98A5' }}>GCR Dose: </span>
                  <strong style={{ color: '#4FC3F7' }}>{m.dose_gcr_mSv} mSv</strong>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#8B98A5' }}>O₂ Budget: </span>
                  <strong style={{ color: route.color }}>
                    {o2Cen} L ({o2Min}–{o2Max})
                  </strong>
                  <span style={{ color: '#8B98A5', marginLeft: '6px' }}>
                    · {m.energy_MJ} MJ
                  </span>
                </div>
              </div>

              {/* Visited Targets */}
              <div
                style={{
                  marginTop: '6px',
                  paddingTop: '5px',
                  borderTop: '1px solid rgba(31, 42, 55, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#8B98A5',
                }}
              >
                <span>Visits: {route.visits.join(' → ')}</span>
                <span>
                  Stops:{' '}
                  {m.stops.map((s) => `${s.target} (${s.min}m)`).join(', ')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Elevation Profile of Active Route */}
      {activeRoute && <ElevationProfile route={activeRoute} />}

      {/* Launch FIELD Simulation CTA */}
      <button
        onClick={onStartFieldEva}
        style={{
          marginTop: '10px',
          width: '100%',
          padding: '9px 12px',
          borderRadius: '6px',
          border: '1px solid #E4572E',
          backgroundColor: 'rgba(228, 87, 46, 0.18)',
          color: '#E6EDF3',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        START FIELD EVA SIMULATION ({activeRoute?.name.toUpperCase()}) →
      </button>
    </div>
  );
};
