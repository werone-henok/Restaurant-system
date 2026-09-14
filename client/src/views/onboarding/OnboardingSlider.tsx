import React, { useState } from 'react';
import { ChefHat, ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Coffee, Store } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const OnboardingSlider: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = [
    {
      icon: <ChefHat size={48} color="#f97316" />,
      title: "Restaurant Management Made Simple",
      subtitle: "One unified mobile application designed for every employee from Owner to Kitchen."
    },
    {
      icon: <ArrowRight size={48} color="#0ea5e9" />,
      title: "Instant Kitchen & Bar Routing",
      subtitle: "Orders move automatically: Waiter → Cashier → Chef / Barista → Waiter without papers or delays."
    },
    {
      icon: <Store size={48} color="#10b981" />,
      title: "Real-Time Recipe Stock Consumption",
      subtitle: "Every dish or beverage sold automatically deducts exact ingredient quantities from inventory."
    },
    {
      icon: <Sparkles size={48} color="#8b5cf6" />,
      title: "Multi-Branch & Live Analytics",
      subtitle: "Track sales, expenses, profits and waiter performance live across Addis Ababa, Adama and beyond."
    },
    {
      icon: <ShieldCheck size={48} color="#f59e0b" />,
      title: "Offline-First & Rock Solid",
      subtitle: "Keep operating and taking orders even when the internet drops. Data synchronizes safely upon reconnection."
    }
  ];

  const handleNext = () => {
    if (slideIndex < slides.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      localStorage.setItem('has_seen_onboarding', 'true');
      onComplete();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
      padding: '40px 24px',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => {
            localStorage.setItem('has_seen_onboarding', 'true');
            onComplete();
          }}
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}
        >
          Skip
        </button>
      </div>

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }} className="animate-fade-in" key={slideIndex}>
        <div style={{
          width: 96,
          height: 96,
          borderRadius: 24,
          background: 'var(--bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-md)'
        }}>
          {slides[slideIndex].icon}
        </div>

        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}>
            {slides[slideIndex].title}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 360 }}>
            {slides[slideIndex].subtitle}
          </p>
        </div>
      </div>

      <div>
        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === slideIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === slideIndex ? 'var(--primary)' : '#cbd5e1',
                transition: 'all 0.25s'
              }}
            />
          ))}
        </div>

        <button className="btn btn-primary btn-block" onClick={handleNext} style={{ height: 50, fontSize: 16 }}>
          {slideIndex === slides.length - 1 ? "Get Started" : "Continue"}
        </button>
      </div>
    </div>
  );
};
