import React from 'react';
import { Check } from 'lucide-react';

export const ORDER_STAGES = [
  { key: 'PENDING_CASHIER', label: 'Order Placed', short: 'Placed', am: 'የተላከ' },
  { key: 'CONFIRMED', label: 'Confirmed', short: 'Confirmed', am: 'የተረጋገጠ' },
  { key: 'READY', label: 'Ready', short: 'Ready', am: 'ዝግጁ' },
  { key: 'DELIVERED', label: 'Delivered to Customer', short: 'Delivered', am: 'ደርሷል' },
  { key: 'COMPLETED', label: 'Done / Completed', short: 'Done', am: 'ተጠናቋል' }
];

export const OrderProgressStepper: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'CANCELLED') {
    return (
      <div style={{ padding: '6px 12px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 8, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
        ❌ Order Cancelled
      </div>
    );
  }

  let currentIndex = 0;
  if (status === 'PENDING_CASHIER') currentIndex = 0;
  else if (status === 'CONFIRMED' || status === 'PREPARING') currentIndex = 1;
  else if (status === 'PARTIALLY_READY' || status === 'READY') currentIndex = 2;
  else if (status === 'DELIVERED') currentIndex = 3;
  else if (status === 'COMPLETED') currentIndex = 5; // All 5 steps completed!

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
                  width: 22,
                  height: 22,
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  background: isDone ? '#16a34a' : isCurrent ? '#ea580c' : 'var(--bg-subtle, #f1f5f9)',
                  color: isDone || isCurrent ? '#ffffff' : 'var(--text-muted)',
                  border: isCurrent ? '2px solid #ea580c' : '1px solid var(--border)'
                }}
              >
                {isDone ? <Check size={12} strokeWidth={3} /> : idx + 1}
              </div>
              <span style={{
                color: isCurrent ? '#ea580c' : isDone ? '#16a34a' : 'var(--text-muted)',
                fontWeight: isCurrent ? 900 : 700,
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
