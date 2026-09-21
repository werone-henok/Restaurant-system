import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

interface StatusConfig {
  emoji: string;
  label: string;
  labelAm: string;
  bg: string;
  color: string;
  pulse?: boolean;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  PENDING_CASHIER: {
    emoji: '⏳',
    label: 'Pending Cashier',
    labelAm: 'ካሺየር ይጠብቃል',
    bg: '#fef3c7',
    color: '#92400e',
    pulse: true
  },
  CONFIRMED: {
    emoji: '🔄',
    label: 'Confirmed',
    labelAm: 'ተረጋግጧል',
    bg: '#dbeafe',
    color: '#1e40af'
  },
  PREPARING: {
    emoji: '🔥',
    label: 'Preparing',
    labelAm: 'እየተዘጋጀ ነው',
    bg: '#ffedd5',
    color: '#c2410c',
    pulse: true
  },
  PARTIALLY_READY: {
    emoji: '⚡',
    label: 'Partially Ready',
    labelAm: 'በከፊል ተዘጋጅቷል',
    bg: '#fef9c3',
    color: '#854d0e',
    pulse: true
  },
  READY: {
    emoji: '✅',
    label: 'Ready to Serve',
    labelAm: 'ተዘጋጅቶ አልቋል',
    bg: '#d1fae5',
    color: '#065f46',
    pulse: true
  },
  DELIVERED: {
    emoji: '📦',
    label: 'Delivered',
    labelAm: 'ለደንበኛ ደርሷል',
    bg: '#e0f2fe',
    color: '#0369a1'
  },
  COMPLETED: {
    emoji: '⭐',
    label: 'Completed & Paid',
    labelAm: 'ተከፍሎ አልቋል',
    bg: '#ecfdf5',
    color: '#047857'
  },
  CANCELLED: {
    emoji: '❌',
    label: 'Cancelled',
    labelAm: 'ተሰርዟል',
    bg: '#fee2e2',
    color: '#991b1b'
  }
};

export const UniversalStatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = false
}) => {
  const config = STATUS_MAP[status] || {
    emoji: '⚪',
    label: status,
    labelAm: status,
    bg: '#f1f5f9',
    color: '#475569'
  };

  const dimensions = {
    sm: { box: 26, font: 14 },
    md: { box: 36, font: 18 },
    lg: { box: 48, font: 24 }
  }[size];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
      }}
      title={`${config.label} (${config.labelAm})`}
    >
      <div
        style={{
          width: dimensions.box,
          height: dimensions.box,
          borderRadius: '50%',
          background: config.bg,
          color: config.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: dimensions.font,
          boxShadow: config.pulse ? `0 0 0 3px ${config.bg}` : 'none',
          animation: config.pulse ? 'pulse 2s infinite ease-in-out' : 'none',
          flexShrink: 0
        }}
      >
        <span>{config.emoji}</span>
      </div>

      {showLabel && (
        <span
          style={{
            fontSize: size === 'sm' ? 11 : 13,
            fontWeight: 800,
            color: config.color
          }}
        >
          {config.label}
        </span>
      )}
    </div>
  );
};
