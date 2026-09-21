import React, { useState } from 'react';
import { tactileFeedback, speak } from '../../utils/feedback';

interface OnboardingProps {
  onComplete: () => void;
}

export const OnboardingSlider: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = [
    {
      emoji: '🏪',
      title: "GourmetOS Restaurant",
      titleAm: "የጎርሜት ኦኤስ ሬስቶራንት",
      subtitle: "Smart hospitality platform built for every team member.",
      subtitleAm: "ለሁሉም ሠራተኞች የተዘጋጀ ቀላልና ዘመናዊ አሰራር።",
      bg: '#ffedd5',
      color: '#c2410c'
    },
    {
      emoji: '📝',
      title: "Fast Touch Ordering",
      titleAm: "ፈጣን ትዕዛዝ መውሰድ",
      subtitle: "Tap dishes to build tables and send straight to cashier.",
      subtitleAm: "ምግቦችን በመንካት በቀላሉ ትዕዛዝ ወደ ካሺየር ይላኩ።",
      bg: '#e0f2fe',
      color: '#0369a1'
    },
    {
      emoji: '🔥',
      title: "Kitchen & Bar Production",
      titleAm: "የኩሽናና ባር ማሳያ",
      subtitle: "Instant paperless tickets for Chefs and Baristas.",
      subtitleAm: "ያለ ወረቀት ትዕዛዞች በቀጥታ ለኩሽና እና ባሪስታ ይደርሳሉ።",
      bg: '#fee2e2',
      color: '#b91c1c'
    },
    {
      emoji: '✅',
      title: "Ready to Serve",
      titleAm: "ተዘጋጅቶ ለደንበኛ ማድረስ",
      subtitle: "Visual notifications the second orders are prepared.",
      subtitleAm: "ምግቡ ሲደርስ ወዲያውኑ ማሳወቂያ ይደርሳል።",
      bg: '#d1fae5',
      color: '#047857'
    },
    {
      emoji: '💰',
      title: "Instant Cash & Telebirr",
      titleAm: "ጥሬ ገንዘብና ቴሌብር ክፍያ",
      subtitle: "Settle bills, split payments, and print receipts in seconds.",
      subtitleAm: "ክፍያዎችን በጥሬ ገንዘብ ወይም በቴሌብር ወዲያውኑ ይቀበሉ።",
      bg: '#fef3c7',
      color: '#b45309'
    },
    {
      emoji: '📦',
      title: "Automatic Recipe Stocking",
      titleAm: "የዕቃ ክምችት ቁጥጥር",
      subtitle: "Ingredients automatically deduct with every sold dish.",
      subtitleAm: "እያንዳንዱ ምግብ ሲሸጥ ግብዓቶች ከክምችት ይቀነሳሉ።",
      bg: '#f3e8ff',
      color: '#7e22ce'
    }
  ];

  const handleNext = () => {
    tactileFeedback('click');
    if (slideIndex < slides.length - 1) {
      const nextIdx = slideIndex + 1;
      setSlideIndex(nextIdx);
      speak(slides[nextIdx].title, 'en');
    } else {
      tactileFeedback('success');
      localStorage.setItem('has_seen_onboarding', 'true');
      onComplete();
    }
  };

  const current = slides[slideIndex];

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
            tactileFeedback('click');
            localStorage.setItem('has_seen_onboarding', 'true');
            onComplete();
          }}
          style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}
        >
          Skip / ዝለል
        </button>
      </div>

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }} className="animate-fade-in" key={slideIndex}>
        <div style={{
          width: 110,
          height: 110,
          borderRadius: 28,
          background: current.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 54,
          boxShadow: 'var(--shadow-md)'
        }}>
          {current.emoji}
        </div>

        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
            {current.title}
          </h2>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', display: 'block', marginBottom: 12 }}>
            {current.titleAm}
          </span>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 340, margin: '0 auto' }}>
            {current.subtitle}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4, maxWidth: 340, margin: '4px auto 0' }}>
            {current.subtitleAm}
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
          {slideIndex === slides.length - 1 ? "Get Started / ጀምር" : "Continue / ቀጥል"}
        </button>
      </div>
    </div>
  );
};
