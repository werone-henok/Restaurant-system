import React, { useState, useEffect } from 'react';

export const AnimatedCounter: React.FC<{
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}> = ({ value, suffix = '', prefix = '', decimals = 0 }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!value || isNaN(value)) {
      setDisplay(0);
      return;
    }

    const duration = 700; // ms
    const steps = 25;
    const stepTime = duration / steps;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step += 1;
      current += increment;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(current);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
};
