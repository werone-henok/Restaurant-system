import React, { useState } from 'react';
import { DetailedReportsDashboard } from '../../components/DetailedReportsDashboard';
import { AiAssistantModal } from '../../components/AiAssistantModal';
import { useApp } from '../../context/AppContext';
import { Sparkles, Eye, EyeOff } from 'lucide-react';
import { api } from '../../api/client';
import { gToast } from '../../utils/toast';
import { tactileFeedback } from '../../utils/feedback';

export const OwnerView: React.FC = () => {
  const { currentBranchId, language, settings, refreshSettings } = useApp();
  const [showAiModal, setShowAiModal] = useState(false);
  const [isTogglingHistory, setIsTogglingHistory] = useState(false);

  const isStaffHistoryVisible = settings?.staff_history_visible !== 0;

  const handleToggleHistory = async () => {
    try {
      setIsTogglingHistory(true);
      tactileFeedback('click');
      const targetState = !isStaffHistoryVisible;
      await api.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          staff_history_visible: targetState ? 1 : 0
        })
      });
      refreshSettings();
      gToast.success(
        targetState
          ? (language === 'am' ? 'የሰራተኞች የትዕዛዝ ታሪክ እንዲታይ ተደርጓል' : 'Staff order history is now visible')
          : (language === 'am' ? 'የሰራተኞች የትዕዛዝ ታሪክ ተደብቋል' : 'Staff order history is now hidden from staff')
      );
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update staff history setting');
    } finally {
      setIsTogglingHistory(false);
    }
  };

  return (
    <div className="view-body animate-fade-in">
      {/* Executive AI Intelligence Banner for Owner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
          borderRadius: 18,
          padding: '14px 18px',
          marginBottom: 16,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 8px 24px rgba(124, 58, 237, 0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <Sparkles size={24} color="#fef08a" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
              {language === 'am' ? 'የባለቤት AI የስራ አመራር አማካሪ' : 'Executive AI Business Intelligence'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.9, fontWeight: 600 }}>
              {language === 'am' 
                ? 'የቀጥታ ገቢ፣ የትርፍ ህዳግ፣ የአክሲዮን እጥረቶች እና ስልታዊ ምክሮች' 
                : 'Live revenue, profit margins, stock depletion risks & operational advice'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          style={{
            background: '#ffffff',
            color: '#7c3aed',
            border: 'none',
            borderRadius: 12,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            transition: 'transform 0.15s ease'
          }}
        >
          <Sparkles size={16} color="#7c3aed" />
          <span>{language === 'am' ? 'AI አማካሪውን ክፈት' : 'Launch AI Advisor'}</span>
        </button>
      </div>

      {/* Executive Staff History Privacy Quick Control */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: isStaffHistoryVisible ? '#ecfdf5' : '#fef2f2',
              color: isStaffHistoryVisible ? '#059669' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${isStaffHistoryVisible ? '#a7f3d0' : '#fecaca'}`
            }}
          >
            {isStaffHistoryVisible ? <Eye size={20} /> : <EyeOff size={20} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 14, color: 'var(--text-main)' }}>
                {language === 'am' ? 'የሰራተኞች የትዕዛዝ ታሪክ ማሳያ' : 'Staff Order History Visibility'}
              </strong>
              <span
                style={{
                  background: isStaffHistoryVisible ? '#ecfdf5' : '#fef2f2',
                  color: isStaffHistoryVisible ? '#059669' : '#dc2626',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6
                }}
              >
                {isStaffHistoryVisible 
                  ? (language === 'am' ? 'የሚታይ (VISIBLE)' : 'VISIBLE TO STAFF')
                  : (language === 'am' ? 'የተደበቀ (HIDDEN)' : 'HIDDEN FROM STAFF')}
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              {language === 'am'
                ? 'ለአስተናጋጅ፣ ካሺየር፣ ማብሰያ፣ ባሪስታ እና ኬክ ካውንተር የትዕዛዝ ታሪክ ማሳያ ወይም መደበቂያ ፈጣን መቆጣጠሪያ'
                : 'Quick executive toggle to show or hide order history for waiters, cashiers, chefs, baristas, and bakery staff.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isTogglingHistory}
          onClick={handleToggleHistory}
          style={{
            background: isStaffHistoryVisible ? '#fef2f2' : '#ecfdf5',
            color: isStaffHistoryVisible ? '#dc2626' : '#059669',
            border: `1.5px solid ${isStaffHistoryVisible ? '#fecaca' : '#a7f3d0'}`,
            borderRadius: 12,
            padding: '9px 16px',
            fontSize: 12,
            fontWeight: 800,
            cursor: isTogglingHistory ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'all 0.15s ease'
          }}
        >
          {isStaffHistoryVisible ? <EyeOff size={15} /> : <Eye size={15} />}
          <span>
            {isStaffHistoryVisible
              ? (language === 'am' ? 'ታሪክን ደብቅ (Hide History)' : 'Hide Staff History')
              : (language === 'am' ? 'ታሪክን አሳይ (Show History)' : 'Show Staff History')}
          </span>
        </button>
      </div>

      <DetailedReportsDashboard />

      <AiAssistantModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        branchId={currentBranchId}
        language={language}
        userRole="owner"
      />
    </div>
  );
};
