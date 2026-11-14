import React from 'react';
import { ProvenanceKind } from '../types/senda';

interface ProvenanceChipProps {
  kind?: ProvenanceKind;
  compact?: boolean;
}

export const ProvenanceChip: React.FC<ProvenanceChipProps> = ({
  kind = 'modeled',
  compact = false,
}) => {
  const raw = (kind || 'modeled').toLowerCase();
  let label: 'MEASURED' | 'MODELED' | 'ASSUMED' = 'MODELED';
  let bg = 'rgba(79, 195, 247, 0.14)';
  let border = 'rgba(79, 195, 247, 0.45)';
  let text = '#4FC3F7';

  if (raw === 'measured' || raw === 'medido') {
    label = 'MEASURED';
    bg = 'rgba(124, 217, 146, 0.14)';
    border = 'rgba(124, 217, 146, 0.45)';
    text = '#7CD992';
  } else if (raw === 'assumed' || raw === 'supuesto') {
    label = 'ASSUMED';
    bg = 'rgba(139, 152, 165, 0.16)';
    border = 'rgba(139, 152, 165, 0.45)';
    text = '#8B98A5';
  }

  return (
    <span
      title={`Data provenance: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: compact ? '1px 5px' : '2px 6px',
        fontSize: compact ? '9px' : '10px',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        letterSpacing: '0.04em',
        borderRadius: '3px',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: text,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  );
};
