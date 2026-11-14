import React, { useState } from 'react';
import { LayerConfig } from '../types/senda';
import { ProvenanceChip } from './ProvenanceChip';

interface LayerPanelProps {
  layers: LayerConfig[];
  onToggleLayer: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  onToggleLayer,
  onChangeOpacity,
}: LayerPanelProps) => {
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>('slope');

  return (
    <aside
      style={{
        width: '268px',
        backgroundColor: '#121821',
        borderRight: '1px solid #1F2A37',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #1F2A37',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#E6EDF3',
            }}
          >
            MULTI-MISSION LAYERS
          </div>
          <div style={{ fontSize: '11px', color: '#8B98A5' }}>
            Gale Boxwork Bbox (2 × 2 km)
          </div>
        </div>
        <span
          style={{
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#E4572E',
          }}
        >
          {layers.filter((l: LayerConfig) => l.enabled).length}/{layers.length} ON
        </span>
      </div>

      {/* Layer list */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {layers.map((layer: LayerConfig) => {
          const isInfoOpen = expandedInfoId === layer.id;
          return (
            <div
              key={layer.id}
              style={{
                backgroundColor: layer.enabled ? '#0B0F14' : 'rgba(11, 15, 20, 0.45)',
                border: `1px solid ${layer.enabled ? '#1F2A37' : 'rgba(31, 42, 55, 0.5)'}`,
                borderRadius: '6px',
                padding: '8px 10px',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    flex: 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={layer.enabled}
                    onChange={() => onToggleLayer(layer.id)}
                    style={{
                      accentColor: '#E4572E',
                      width: '14px',
                      height: '14px',
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: layer.enabled ? '#E6EDF3' : '#8B98A5',
                    }}
                  >
                    {layer.name}
                  </span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ProvenanceChip kind={layer.kind} compact />
                  <button
                    onClick={() => setExpandedInfoId(isInfoOpen ? null : layer.id)}
                    title="Inspect mission provenance, resolution, date & coverage"
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: `1px solid ${isInfoOpen ? '#E4572E' : '#1F2A37'}`,
                      backgroundColor: isInfoOpen ? 'rgba(228, 87, 46, 0.2)' : '#121821',
                      color: isInfoOpen ? '#E4572E' : '#8B98A5',
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    i
                  </button>
                </div>
              </div>

              {/* Legend */}
              {layer.enabled && layer.legend.length > 0 && (
                <div
                  style={{
                    marginTop: '7px',
                    display: ' flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    paddingLeft: '22px',
                  }}
                >
                  {layer.legend.map((item: { label: string; color: string }, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#8B98A5',
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '2px',
                          backgroundColor: item.color,
                          display: 'inline-block',
                        }}
                      />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Opacity slider for raster overlays */}
              {layer.enabled &&
                !['targets', 'routes'].includes(layer.id) && (
                  <div
                    style={{
                      marginTop: '6px',
                      paddingLeft: '22px',
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
                      Opacity
                    </span>
                    <input
                      type="range"
                      min={0.15}
                      max={1}
                      step={0.05}
                      value={layer.opacity}
                      onChange={(e: { target: { value: string } }) =>
                        onChangeOpacity(layer.id, parseFloat(e.target.value))
                      }
                      style={{
                        flex: 1,
                        accentColor: '#E4572E',
                        height: '4px',
                        cursor: 'pointer',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '10px',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#E6EDF3',
                        width: '30px',
                        textAlign: 'right',
                      }}
                    >
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                )}

              {/* Provenance metadata drawer ("i" button) */}
              {isInfoOpen && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '7px 8px',
                    backgroundColor: '#121821',
                    border: '1px solid #1F2A37',
                    borderRadius: '4px',
                    fontSize: '10.5px',
                    color: '#8B98A5',
                    lineHeight: 1.45,
                  }}
                >
                  <div>
                    <strong style={{ color: '#E6EDF3' }}>Mission / Source:</strong>{' '}
                    {layer.mission} ({layer.instrument})
                  </div>
                  <div>
                    <strong style={{ color: '#E6EDF3' }}>Date / Sol:</strong>{' '}
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {layer.date_sol}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: '#E6EDF3' }}>Resolution:</strong>{' '}
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {layer.resolution}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: '#E6EDF3' }}>Coverage:</strong>{' '}
                    {layer.coverage}
                  </div>
                  <div style={{ marginTop: '3px', color: '#FFB020' }}>
                    <strong>Limitation:</strong> {layer.limitations}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reference Question Footer */}
      <div
        style={{
          marginTop: 'auto',
          padding: '10px 12px',
          borderTop: '1px solid #1F2A37',
          backgroundColor: '#0B0F14',
          fontSize: '11px',
          color: '#8B98A5',
          lineHeight: 1.4,
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#E8B04B',
            fontWeight: 700,
            marginBottom: '4px',
          }}
        >
          CENTRAL SCIENCE HYPOTHESIS
        </div>
        Why do Mount Sharp boxwork ridges resist erosion while adjacent hollows do not?
        Paired drill comparison: <strong style={{ color: '#E6EDF3' }}>T05 Valle de la Luna</strong>{' '}
        (hollow) vs. <strong style={{ color: '#E6EDF3' }}>T06 Nevado Sajama</strong> (ridge, 10 m apart).
      </div>
    </aside>
  );
};
