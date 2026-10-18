import React, { useState, useEffect, useRef } from 'react';
import { Printer, Download, X, QrCode as QrIcon, Table as TableIcon, Sparkles } from 'lucide-react';
import { generateQrDataUrl, buildFeedbackUrl } from '../utils/qrCode';
import { tactileFeedback } from '../utils/feedback';

interface PrintableTableTentModalProps {
  branchId: string;
  branchName: string;
  restaurantName: string;
  logoUrl?: string;
  availableTables: Array<{ id: string; table_number: string; name: string }>;
  onClose: () => void;
}

export const PrintableTableTentModal: React.FC<PrintableTableTentModalProps> = ({
  branchId,
  branchName,
  restaurantName,
  logoUrl,
  availableTables,
  onClose
}) => {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const targetUrl = buildFeedbackUrl(branchId, selectedTable || undefined);

  useEffect(() => {
    async function updateQr() {
      setIsGenerating(true);
      try {
        const url = await generateQrDataUrl(targetUrl, { width: 350, margin: 1 });
        setQrDataUrl(url);
      } catch (err) {
        console.error('Failed to generate QR:', err);
      } finally {
        setIsGenerating(false);
      }
    }
    updateQr();
  }, [targetUrl]);

  const handlePrint = () => {
    tactileFeedback('click');
    window.print();
  };

  const handleDownloadQr = () => {
    tactileFeedback('click');
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QRCode_${restaurantName.replace(/\s+/g, '_')}_${branchName.replace(/\s+/g, '_')}${selectedTable ? `_Table_${selectedTable}` : ''}.png`;
    a.click();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      {/* Print Stylesheet injection to print ONLY the table tent card */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-tent-area, #printable-tent-area * {
            visibility: visible !important;
          }
          #printable-tent-area {
            position: absolute !important;
            left: 50% !important;
            top: 20px !important;
            transform: translateX(-50%) !important;
            width: 100% !important;
            max-width: 480px !important;
            box-shadow: none !important;
            border: 1px dashed #ccc !important;
          }
        }
      `}</style>

      <div style={{
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
        borderRadius: 24,
        width: '100%',
        maxWidth: 580,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        color: 'var(--text-main, #ffffff)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <QrIcon size={20} color="#f59e0b" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                Printable QR Table Tents & Stands
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
                High-resolution QR code generator for tables, stands & counters
              </p>
            </div>
          </div>

          <button
            onClick={() => { tactileFeedback('click'); onClose(); }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: 10,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body & Config */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Table Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted, #94a3b8)' }}>
              Scope:
            </span>

            <button
              type="button"
              onClick={() => setSelectedTable('')}
              style={{
                padding: '6px 14px',
                borderRadius: 12,
                border: !selectedTable ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                background: !selectedTable ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: !selectedTable ? '#fbbf24' : '#94a3b8',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              General Branch Stand
            </button>

            {availableTables.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TableIcon size={14} color="#94a3b8" />
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  style={{
                    background: '#0f172a',
                    border: selectedTable ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '6px 12px',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    outline: 'none'
                  }}
                >
                  <option value="">Specific Table...</option>
                  {availableTables.map(t => (
                    <option key={t.id} value={t.table_number}>
                      Table #{t.table_number} {t.name ? `(${t.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Printable Tent Card Preview (What actually prints!) */}
          <div
            id="printable-tent-area"
            ref={printRef}
            style={{
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: 20,
              padding: '24px 20px',
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
              border: '2px solid #e2e8f0',
              fontFamily: "'Inter', sans-serif"
            }}
          >
            {/* Logo & Restaurant Name */}
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                style={{
                  width: 52,
                  height: 52,
                  objectFit: 'contain',
                  margin: '0 auto 8px',
                  display: 'block'
                }}
              />
            )}
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 2px', color: '#0f172a' }}>
              {restaurantName}
            </h2>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 14px' }}>
              {branchName} {selectedTable ? `• TABLE ${selectedTable}` : '• GUEST EXPERIENCE'}
            </p>

            {/* High-Resolution QR Code */}
            <div style={{
              background: '#f8fafc',
              border: '2px dashed #cbd5e1',
              borderRadius: 16,
              padding: 14,
              display: 'inline-block',
              margin: '0 auto 14px'
            }}>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  style={{ width: 190, height: 190, display: 'block' }}
                />
              ) : (
                <div style={{ width: 190, height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span>Generating QR...</span>
                </div>
              )}
            </div>

            {/* Trilingual Call to Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                Scan to Rate Your Dining Experience
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                የእርስዎን አስተያየት ለመስጠት QR ኮዱን ስካን ያድርጉ
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                Yaada keessan nuuf qooduuf koodii QR kana iskaan godhaa
              </div>
            </div>

            {/* Table stand fold guide */}
            <div style={{
              marginTop: 18,
              paddingTop: 10,
              borderTop: '1px dotted #94a3b8',
              fontSize: 10,
              color: '#94a3b8',
              letterSpacing: 0.5
            }}>
              ✂ CUT & FOLD GUIDELINE • PLACE ON TABLE STAND OR CASHIER COUNTER
            </div>
          </div>

          {/* Quick Info Box */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 11,
            color: 'var(--text-muted, #94a3b8)',
            wordBreak: 'break-all'
          }}>
            <span style={{ fontWeight: 700, color: '#f59e0b' }}>Target URL: </span>
            {targetUrl}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10
        }}>
          <button
            type="button"
            onClick={handleDownloadQr}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'transparent',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Download size={15} />
            Download PNG
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              color: '#000000',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
            }}
          >
            <Printer size={16} />
            Print Table Stands
          </button>
        </div>
      </div>
    </div>
  );
};
