import React, { useState } from 'react';
import { DetailedReportsDashboard } from '../../components/DetailedReportsDashboard';
import { AiAssistantModal } from '../../components/AiAssistantModal';
import { useApp } from '../../context/AppContext';
import { Sparkles } from 'lucide-react';

export const OwnerView: React.FC = () => {
  const { currentBranchId, language } = useApp();
  const [showAiModal, setShowAiModal] = useState(false);

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
