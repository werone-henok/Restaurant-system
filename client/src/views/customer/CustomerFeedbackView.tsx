import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Utensils, 
  Sparkles, 
  Clock, 
  Volume2, 
  ThumbsUp, 
  ThumbsDown, 
  User, 
  Phone, 
  Mail, 
  Send, 
  CheckCircle2, 
  ArrowRight,
  Globe,
  MapPin,
  Coffee,
  HeartHandshake
} from 'lucide-react';
import { getApiBaseUrl } from '../../api/client';
import { FEEDBACK_TRANSLATIONS, type FeedbackLanguage } from '../../i18n/feedbackTranslations';
import { tactileFeedback } from '../../utils/feedback';

export const CustomerFeedbackView: React.FC = () => {
  const [lang, setLang] = useState<FeedbackLanguage>(() => {
    const saved = localStorage.getItem('feedback_language');
    if (saved === 'am' || saved === 'om' || saved === 'en') return saved;
    return 'en';
  });

  const t = FEEDBACK_TRANSLATIONS[lang];

  // URL parameters parsing
  const searchParams = new URLSearchParams(window.location.search);
  const initialBranchId = searchParams.get('branch') || '';
  const initialTable = searchParams.get('table') || '';
  const orderId = searchParams.get('order') || '';

  // Branch & restaurant information state
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [isLoadingBranch, setIsLoadingBranch] = useState(true);

  // Form states
  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId);
  const [tableNumber, setTableNumber] = useState(initialTable);
  const [selectedWaiterId, setSelectedWaiterId] = useState('');
  const [selectedWaiterName, setSelectedWaiterName] = useState('');

  // Ratings
  const [overallRating, setOverallRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [foodRating, setFoodRating] = useState<number>(0);
  const [serviceRating, setServiceRating] = useState<number>(0);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(0);
  const [ambianceRating, setAmbianceRating] = useState<number>(0);

  // Selected quick tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Dish-level feedback: Map of item name -> boolean (true: liked, false: disliked)
  const [dishesFeedback, setDishesFeedback] = useState<Record<string, boolean>>({});

  // Text & customer info
  const [comment, setComment] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const changeLanguage = (newLang: FeedbackLanguage) => {
    tactileFeedback('click');
    setLang(newLang);
    localStorage.setItem('feedback_language', newLang);
  };

  // Load branch information and options from server
  useEffect(() => {
    async function fetchBranchData() {
      setIsLoadingBranch(true);
      try {
        const targetId = initialBranchId || 'default';
        const res = await fetch(`${getApiBaseUrl()}/feedback/branch-info/${targetId}`);
        if (res.ok) {
          const data = await res.json();
          setBranchInfo(data);
          if (data.branch?.id) {
            setSelectedBranchId(data.branch.id);
          }
        }
      } catch (err) {
        console.warn('[Feedback] Failed to fetch branch details:', err);
      } finally {
        setIsLoadingBranch(false);
      }
    }
    fetchBranchData();
  }, [initialBranchId]);

  const toggleTag = (tagText: string) => {
    tactileFeedback('click');
    setSelectedTags(prev => 
      prev.includes(tagText) ? prev.filter(t => t !== tagText) : [...prev, tagText]
    );
  };

  const handleDishToggle = (dishName: string, liked: boolean) => {
    tactileFeedback('click');
    setDishesFeedback(prev => {
      const next = { ...prev };
      if (next[dishName] === liked) {
        delete next[dishName]; // toggle off
      } else {
        next[dishName] = liked;
      }
      return next;
    });
  };

  const getRatingDescriptor = (stars: number) => {
    switch (stars) {
      case 1: return { text: t.rating_1, emoji: '😠', color: '#ef4444' };
      case 2: return { text: t.rating_2, emoji: '🙁', color: '#f97316' };
      case 3: return { text: t.rating_3, emoji: '😐', color: '#eab308' };
      case 4: return { text: t.rating_4, emoji: '🙂', color: '#10b981' };
      case 5: return { text: t.rating_5, emoji: '🌟', color: '#8b5cf6' };
      default: return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (overallRating === 0) {
      tactileFeedback('error');
      setErrorMessage(t.error_select_rating);
      return;
    }

    setIsSubmitting(true);
    tactileFeedback('click');

    try {
      // Append selected tags to comment if any
      let finalComment = comment.trim();
      if (selectedTags.length > 0) {
        const tagsNote = `Tags: [${selectedTags.join(', ')}]`;
        finalComment = finalComment ? `${tagsNote}\n${finalComment}` : tagsNote;
      }

      // Convert dishesFeedback map to array of objects
      const dishesList = Object.entries(dishesFeedback).map(([name, liked]) => ({
        name,
        liked
      }));

      const payload = {
        branch_id: selectedBranchId || branchInfo?.branch?.id || 'branch_default',
        table_number: tableNumber.trim() || undefined,
        order_id: orderId || undefined,
        waiter_id: selectedWaiterId || undefined,
        waiter_name: selectedWaiterName || undefined,
        overall_rating: overallRating,
        food_rating: foodRating || undefined,
        service_rating: serviceRating || undefined,
        cleanliness_rating: cleanlinessRating || undefined,
        ambiance_rating: ambianceRating || undefined,
        comment: finalComment || undefined,
        dishes_feedback: dishesList,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        language: lang
      };

      const res = await fetch(`${getApiBaseUrl()}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || t.error_submission_failed);
      }

      tactileFeedback('success');
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      tactileFeedback('error');
      setErrorMessage(err.message || t.error_submission_failed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setIsSubmitted(false);
    setOverallRating(0);
    setFoodRating(0);
    setServiceRating(0);
    setCleanlinessRating(0);
    setAmbianceRating(0);
    setSelectedTags([]);
    setDishesFeedback({});
    setComment('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
  };

  const currentDescriptor = getRatingDescriptor(hoverRating || overallRating);

  const availableTags = [
    { id: 'delicious', label: t.tag_delicious_food, icon: '🍔' },
    { id: 'fast_service', label: t.tag_fast_service, icon: '⚡' },
    { id: 'friendly_staff', label: t.tag_friendly_staff, icon: '🤝' },
    { id: 'clean_place', label: t.tag_clean_place, icon: '✨' },
    { id: 'great_coffee', label: t.tag_great_coffee, icon: '☕' },
    { id: 'fresh_bakery', label: t.tag_fresh_bakery, icon: '🍰' },
    { id: 'slow_service', label: t.tag_slow_service, icon: '⏳', negative: true },
    { id: 'cold_food', label: t.tag_cold_food, icon: '❄️', negative: true },
    { id: 'too_loud', label: t.tag_too_loud, icon: '📢', negative: true },
    { id: 'needs_attention', label: t.tag_needs_attention, icon: '⚠️', negative: true },
  ];

  const restaurantName = branchInfo?.settings?.restaurant_name || t.app_name_fallback;
  const restaurantSlogan = branchInfo?.settings?.slogan || t.tagline_fallback;
  const logoUrl = branchInfo?.settings?.logo_url || '/logo.png';
  const branchName = branchInfo?.branch?.name || '';

  // ── Thank You Screen ────────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #090d16 0%, #111827 100%)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        <div style={{
          maxWidth: 440,
          width: '100%',
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          padding: '36px 24px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)'
          }}>
            <CheckCircle2 size={42} color="#ffffff" strokeWidth={2.5} />
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12, color: '#ffffff' }}>
            {t.thank_you_title}
          </h2>

          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#94a3b8', marginBottom: 16 }}>
            {t.thank_you_msg}
          </p>

          <p style={{ fontSize: 13, lineHeight: 1.5, color: '#64748b', marginBottom: 28 }}>
            {t.thank_you_sub}
          </p>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 16,
            padding: '14px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10
          }}>
            <HeartHandshake size={20} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
              {restaurantName} • {branchName || 'Addis Ababa'}
            </span>
          </div>

          <button
            onClick={handleResetForm}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#000000',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 6px 20px rgba(245, 158, 11, 0.3)'
            }}
          >
            <span>{t.submit_another_btn}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Main Customer Feedback View ─────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0b0f19 0%, #111827 50%, #0f172a 100%)',
      color: '#f8fafc',
      padding: '16px 12px 60px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* ── Top Bar: Trilingual Language Switcher ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(10px)',
          borderRadius: 20,
          padding: '6px 10px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
            <Globe size={15} color="#f59e0b" />
            <span style={{ fontWeight: 600 }}>Language / ቋንቋ</span>
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => changeLanguage('en')}
              style={{
                padding: '5px 10px',
                borderRadius: 14,
                border: 'none',
                background: lang === 'en' ? '#f59e0b' : 'transparent',
                color: lang === 'en' ? '#000000' : '#94a3b8',
                fontWeight: 800,
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => changeLanguage('am')}
              style={{
                padding: '5px 10px',
                borderRadius: 14,
                border: 'none',
                background: lang === 'am' ? '#f59e0b' : 'transparent',
                color: lang === 'am' ? '#000000' : '#94a3b8',
                fontWeight: 800,
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              አማርኛ
            </button>
            <button
              type="button"
              onClick={() => changeLanguage('om')}
              style={{
                padding: '5px 10px',
                borderRadius: 14,
                border: 'none',
                background: lang === 'om' ? '#f59e0b' : 'transparent',
                color: lang === 'om' ? '#000000' : '#94a3b8',
                fontWeight: 800,
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Afaan Oromoo
            </button>
          </div>
        </div>

        {/* ── Restaurant Brand Header ── */}
        <div style={{
          textAlign: 'center',
          marginBottom: 20,
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 24,
          padding: '20px 16px',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {logoUrl && (
            <img 
              src={logoUrl} 
              alt={restaurantName}
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              style={{
                width: 64,
                height: 64,
                objectFit: 'contain',
                borderRadius: 16,
                marginBottom: 10,
                background: 'rgba(255,255,255,0.05)',
                padding: 4
              }}
            />
          )}

          <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 4px', color: '#ffffff', letterSpacing: '-0.3px' }}>
            {restaurantName}
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
            {restaurantSlogan}
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 12,
            padding: '4px 12px',
            fontSize: 12,
            color: '#fbbf24'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
              <MapPin size={13} />
              {branchName || 'Main Branch'}
            </span>
            {tableNumber && (
              <span style={{ fontWeight: 800, borderLeft: '1px solid rgba(245, 158, 11, 0.3)', paddingLeft: 10 }}>
                {t.table_label}: {tableNumber}
              </span>
            )}
          </div>
        </div>

        {/* ── Form Container ── */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 1. OVERALL STAR RATING CARD (HERO) */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 24,
            padding: '24px 16px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 4px', color: '#ffffff' }}>
              {t.overall_experience_title}
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>
              {t.tap_to_rate}
            </p>

            {/* Stars row */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = (hoverRating || overallRating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      tactileFeedback('click');
                      setOverallRating(star);
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 6,
                      transform: isLit ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      touchAction: 'manipulation'
                    }}
                  >
                    <Star
                      size={36}
                      fill={isLit ? '#f59e0b' : 'none'}
                      color={isLit ? '#f59e0b' : '#475569'}
                      strokeWidth={1.8}
                      style={{
                        filter: isLit ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))' : 'none'
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Dynamic Descriptor / Reaction */}
            {currentDescriptor ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${currentDescriptor.color}`,
                borderRadius: 20,
                padding: '6px 16px',
                animation: 'fade-in 0.2s ease'
              }}>
                <span style={{ fontSize: 18 }}>{currentDescriptor.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: currentDescriptor.color }}>
                  {currentDescriptor.text}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                ☆☆☆☆☆
              </span>
            )}
          </div>

          {/* 2. ASPECT RATINGS (FOOD, SERVICE, CLEANLINESS, AMBIANCE) */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 20,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="#f59e0b" />
              {t.aspects_title}
            </h3>

            {/* Food Aspect */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                <Utensils size={14} color="#f97316" />
                <span>{t.aspect_food}</span>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { tactileFeedback('click'); setFoodRating(v === foodRating ? 0 : v); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 3,
                      cursor: 'pointer'
                    }}
                  >
                    <Star size={18} fill={foodRating >= v ? '#f97316' : 'none'} color={foodRating >= v ? '#f97316' : '#475569'} />
                  </button>
                ))}
              </div>
            </div>

            {/* Service Aspect */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                <Clock size={14} color="#06b6d4" />
                <span>{t.aspect_service}</span>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { tactileFeedback('click'); setServiceRating(v === serviceRating ? 0 : v); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 3,
                      cursor: 'pointer'
                    }}
                  >
                    <Star size={18} fill={serviceRating >= v ? '#06b6d4' : 'none'} color={serviceRating >= v ? '#06b6d4' : '#475569'} />
                  </button>
                ))}
              </div>
            </div>

            {/* Cleanliness Aspect */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                <Sparkles size={14} color="#10b981" />
                <span>{t.aspect_cleanliness}</span>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { tactileFeedback('click'); setCleanlinessRating(v === cleanlinessRating ? 0 : v); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 3,
                      cursor: 'pointer'
                    }}
                  >
                    <Star size={18} fill={cleanlinessRating >= v ? '#10b981' : 'none'} color={cleanlinessRating >= v ? '#10b981' : '#475569'} />
                  </button>
                ))}
              </div>
            </div>

            {/* Ambiance Aspect */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                <Volume2 size={14} color="#a855f7" />
                <span>{t.aspect_ambiance}</span>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { tactileFeedback('click'); setAmbianceRating(v === ambianceRating ? 0 : v); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 3,
                      cursor: 'pointer'
                    }}
                  >
                    <Star size={18} fill={ambianceRating >= v ? '#a855f7' : 'none'} color={ambianceRating >= v ? '#a855f7' : '#475569'} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. QUICK HIGHLIGHT TAGS */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 20,
            padding: '16px'
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#f1f5f9' }}>
              {t.quick_tags_title}
            </h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.label);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.label)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 14,
                      border: isSelected 
                        ? (tag.negative ? '1px solid #ef4444' : '1px solid #f59e0b') 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      background: isSelected 
                        ? (tag.negative ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)') 
                        : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected 
                        ? (tag.negative ? '#fca5a5' : '#fde68a') 
                        : '#cbd5e1',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. DISHES TASTED (OPTIONAL) */}
          {branchInfo?.menuItems && branchInfo.menuItems.length > 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: 20,
              padding: '16px'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 4px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Coffee size={15} color="#f59e0b" />
                {t.dishes_title}
              </h3>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 10px' }}>
                {t.dishes_subtitle}
              </p>

              <div className="no-scrollbar" style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 4
              }}>
                {branchInfo.menuItems.slice(0, 15).map((dish: any) => {
                  const state = dishesFeedback[dish.name];
                  return (
                    <div
                      key={dish.id}
                      style={{
                        flexShrink: 0,
                        width: 140,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: state !== undefined 
                          ? (state ? '1px solid #10b981' : '1px solid #ef4444')
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 14,
                        padding: '10px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        textAlign: 'center'
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lang === 'am' && dish.name_amharic ? dish.name_amharic : dish.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 8 }}>
                        {dish.price} ETB
                      </span>

                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleDishToggle(dish.name, true)}
                          style={{
                            flex: 1,
                            padding: '4px 0',
                            borderRadius: 8,
                            border: 'none',
                            background: state === true ? '#10b981' : 'rgba(255,255,255,0.06)',
                            color: state === true ? '#ffffff' : '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <ThumbsUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDishToggle(dish.name, false)}
                          style={{
                            flex: 1,
                            padding: '4px 0',
                            borderRadius: 8,
                            border: 'none',
                            background: state === false ? '#ef4444' : 'rgba(255,255,255,0.06)',
                            color: state === false ? '#ffffff' : '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <ThumbsDown size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. WAITER & TABLE SELECTION (IF NOT AUTO-FILLED) */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 20,
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10
          }}>
            {/* Table input */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                {t.table_label}
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 4"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  padding: '9px 12px',
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>

            {/* Waiter selector */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                {t.waiter_label}
              </label>
              <select
                value={selectedWaiterId}
                onChange={(e) => {
                  setSelectedWaiterId(e.target.value);
                  const found = branchInfo?.waiters?.find((w: any) => w.id === e.target.value);
                  setSelectedWaiterName(found ? found.full_name : '');
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  padding: '9px 8px',
                  color: '#ffffff',
                  fontSize: 12,
                  outline: 'none'
                }}
              >
                <option value="">{t.select_waiter_placeholder}</option>
                {branchInfo?.waiters?.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. OPEN TEXT REVIEW / SUGGESTION */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 20,
            padding: '16px'
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px', color: '#f1f5f9' }}>
              {t.comment_title}
            </h3>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.comment_placeholder}
              maxLength={1500}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 14,
                padding: '12px',
                color: '#ffffff',
                fontSize: 13,
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical'
              }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b', marginTop: 4 }}>
              {comment.length} / 1500
            </div>
          </div>

          {/* 7. OPTIONAL CONTACT DETAILS */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 20,
            padding: '16px'
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 2px', color: '#f1f5f9' }}>
              {t.contact_title}
            </h3>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 12px' }}>
              {t.contact_subtitle}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <User size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t.name_placeholder}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: '10px 12px 10px 36px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <Phone size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t.phone_placeholder}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: '10px 12px 10px 36px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder={t.email_placeholder}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: '10px 12px 10px 36px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: 14,
              padding: '12px 16px',
              color: '#fca5a5',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center'
            }}>
              {errorMessage}
            </div>
          )}

          {/* 8. SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 16,
              border: 'none',
              background: overallRating > 0 
                ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' 
                : 'rgba(255, 255, 255, 0.1)',
              color: overallRating > 0 ? '#000000' : '#94a3b8',
              fontWeight: 900,
              fontSize: 15,
              cursor: overallRating > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: overallRating > 0 ? '0 8px 25px rgba(245, 158, 11, 0.35)' : 'none',
              transition: 'all 0.2s ease',
              marginTop: 4
            }}
          >
            {isSubmitting ? (
              <span>{t.submitting_btn}</span>
            ) : (
              <>
                <Send size={18} />
                <span>{t.submit_btn}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#475569' }}>
          Powered by GourmetOS • Secure Customer Review System
        </div>
      </div>
    </div>
  );
};
