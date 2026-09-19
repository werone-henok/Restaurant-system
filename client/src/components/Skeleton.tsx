import React from 'react';

/* ────────────────────────────────────────────────────────────────────
   Skeleton — reusable shimmer placeholder components
   Usage:
     <Skeleton.Line width="60%" />
     <Skeleton.Title />
     <Skeleton.Circle size={40} />
     <Skeleton.Card rows={3} />
   ──────────────────────────────────────────────────────────────────── */

interface LineProps {
  width?: string | number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

const Line: React.FC<LineProps> = ({ width = '100%', height = 14, className = '', style }) => (
  <div
    className={`skeleton skeleton-text ${className}`}
    style={{ width, height, borderRadius: 999, ...style }}
  />
);

const Title: React.FC<{ width?: string | number }> = ({ width = '70%' }) => (
  <div
    className="skeleton skeleton-title"
    style={{ width, height: 20, borderRadius: 999 }}
  />
);

interface CircleProps {
  size?: number;
  className?: string;
}

const Circle: React.FC<CircleProps> = ({ size = 40, className = '' }) => (
  <div
    className={`skeleton skeleton-circle ${className}`}
    style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
  />
);

interface BlockProps {
  height?: number;
  width?: string | number;
  borderRadius?: number | string;
}

const Block: React.FC<BlockProps> = ({ height = 100, width = '100%', borderRadius = 12 }) => (
  <div
    className="skeleton"
    style={{ width, height, borderRadius }}
  />
);

/** A full card skeleton with n text rows */
interface CardProps {
  rows?: number;
  hasAvatar?: boolean;
}

const Card: React.FC<CardProps> = ({ rows = 3, hasAvatar = false }) => (
  <div className="skeleton-card">
    {hasAvatar ? (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Circle size={44} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Title width="55%" />
          <Line width="35%" height={12} />
        </div>
      </div>
    ) : (
      <Title />
    )}
    {Array.from({ length: rows }).map((_, i) => (
      <Line
        key={i}
        width={i === rows - 1 ? '65%' : '100%'}
        height={13}
      />
    ))}
  </div>
);

/** A list of Card skeletons */
interface ListProps {
  count?: number;
  rows?: number;
  hasAvatar?: boolean;
}

const List: React.FC<ListProps> = ({ count = 4, rows = 2, hasAvatar = false }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} rows={rows} hasAvatar={hasAvatar} />
    ))}
  </div>
);

export const Skeleton = { Line, Title, Circle, Block, Card, List };
