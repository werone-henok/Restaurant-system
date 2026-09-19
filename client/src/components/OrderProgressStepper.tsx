import React from 'react';
import { Check } from 'lucide-react';

export const ORDER_STAGES = [
  { key: 'PENDING_CASHIER', label: 'Order Placed', short: 'Placed' },
  { key: 'CONFIRMED', label: 'Payment Done', short: 'Paid' },
  { key: 'PREPARING', label: 'In Prep', short: 'Prep' },
  { key: 'READY', label: 'Ready', short: 'Ready' },
  { key: 'DELIVERED', label: 'Delivered', short: 'Done' }
];

export const OrderProgressStepper: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'CANCELLED') {
    return (
      <div style={{ padding: '6px 12px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 8, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
        ❌ Order Cancelled
      </div>
    );
  }

  const stageKeys = ORDER_STAGES.map(s => s.key);
  let currentIndex = stageKeys.indexOf(status);
  if (status === 'PARTIALLY_READY') currentIndex = 2;
  if (status === 'COMPLETED') currentIndex = 4;
  if (currentIndex === -1) currentIndex = 0;

  return (
    <div style={{ margin: '6px 0', padding: '4px 2px' }}>
      <div className="order-stepper">
        {ORDER_STAGES.map((stage, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <div key={stage.key} className="order-step-item">
              <div
                className={`order-step-dot ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                style={{
                  width: 20,
                  height: 20,
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800
                }}
              >
                {isDone ? <Check size={11} strokeWidth={3} /> : idx + 1}
              </div>
              <span style={{
                color: isCurrent ? 'var(--primary)' : isDone ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: isCurrent ? 800 : 600,
                fontSize: 10
              }}>
                {stage.short}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
