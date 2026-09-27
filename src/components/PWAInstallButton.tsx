import React, { useState } from 'react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { Download, Smartphone, Monitor, Share, X, WifiOff, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeDeviceTab, setActiveDeviceTab] = useState<'ios' | 'android' | 'desktop'>(
    isIOS ? 'ios' : 'android'
  );

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="no-print flex items-center gap-1.5 rounded-xl px-3 h-[42px] text-xs font-semibold transition active:scale-95 cursor-pointer"
        style={{
          background: 'var(--accent)',
          color: '#FFFFFF',
          border: 'none',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
          whiteSpace: 'nowrap',
        }}
        title="Installer l'application sur téléphone, Mac ou PC"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Installer l’App</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print"
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl"
            style={{
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Icône Pavé HT"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl shrink-0"
                />
                <div>
                  <h3
                    style={{
                      fontFamily: 'Archivo, sans-serif',
                      fontSize: '16px',
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    Installer « Pavé HT » (PWA)
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--stone)', margin: '2px 0 0' }}>
                    Fonctionne hors-ligne sur iPhone, Android, Mac & PC
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{
                  background: 'var(--bg)',
                  color: 'var(--stone)',
                  border: '1px solid var(--line)',
                }}
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe && (
              <div
                className="p-3 rounded-xl mb-3 text-xs"
                style={{
                  background: 'var(--clay-soft)',
                  color: '#92400E',
                  border: '1px solid #FCD34D',
                }}
              >
                <strong>Astuce :</strong> Ouvrez d’abord l’application dans un onglet complet de
                votre navigateur (bouton <em>Ouvrir dans un nouvel onglet</em> en haut à droite de
                l’aperçu) pour déclencher l’installation directe en 1 clic.
              </div>
            )}

            {/* Platform Selector Tabs */}
            <div
              className="grid grid-cols-3 gap-1.5 p-1 rounded-xl mb-3.5"
              style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
            >
              <button
                type="button"
                onClick={() => setActiveDeviceTab('ios')}
                className="py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
                style={{
                  background: activeDeviceTab === 'ios' ? 'var(--accent)' : 'transparent',
                  color: activeDeviceTab === 'ios' ? '#FFFFFF' : 'var(--stone)',
                  border: 'none',
                }}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDeviceTab('android')}
                className="py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
                style={{
                  background: activeDeviceTab === 'android' ? 'var(--accent)' : 'transparent',
                  color: activeDeviceTab === 'android' ? '#FFFFFF' : 'var(--stone)',
                  border: 'none',
                }}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDeviceTab('desktop')}
                className="py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
                style={{
                  background: activeDeviceTab === 'desktop' ? 'var(--accent)' : 'transparent',
                  color: activeDeviceTab === 'desktop' ? '#FFFFFF' : 'var(--stone)',
                  border: 'none',
                }}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>PC / Mac</span>
              </button>
            </div>

            {/* Platform Instructions */}
            <div
              className="p-3.5 rounded-xl space-y-2.5 text-xs"
              style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
            >
              {activeDeviceTab === 'ios' && (
                <>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{ background: 'var(--accent)', color: '#fff', fontSize: '11px' }}
                    >
                      1
                    </span>
                    <span>
                      Ouvrez ce lien dans <strong>Safari</strong> sur votre iPhone ou iPad.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{ background: 'var(--accent)', color: '#fff', fontSize: '11px' }}
                    >
                      2
                    </span>
                    <span className="flex items-center flex-wrap gap-1">
                      Appuyez sur le bouton <strong>Partager</strong>
                      <Share className="w-3.5 h-3.5 inline" style={{ color: 'var(--accent)' }} /> en
                      bas de l’écran.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{ background: 'var(--accent)', color: '#fff', fontSize: '11px' }}
                    >
                      3
                    </span>
                    <span>
                      Faites défiler et choisissez <strong>Sur l’écran d’accueil</strong> puis{' '}
                      <strong>Ajouter</strong>.
                    </span>
                  </div>
                </>
              )}

              {activeDeviceTab === 'android' && (
                <>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{ background: 'var(--accent)', color: '#fff', fontSize: '11px' }}
                    >
                      1
                    </span>
                    <span>
                      Ouvrez l’application dans <strong>Chrome</strong> sur votre smartphone
                      Android.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{ background: 'var(--accent)', color: '#fff', fontSize: '11px' }}
                    >
                      2
                    </span>
                    <span>
                      Appuyez sur le menu <strong>⋮</strong> (en haut à droite) puis sur{' '}
                      <strong>Installer l’application</strong> ou{' '}
                      <strong>Ajouter à l’écran d’accueil</strong>.
                    </span>
                  </div>
                </>
              )}

              {activeDeviceTab === 'desktop' && (
                <>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{ background: 'var(--accent)', color: '#fff', fontSize: '11px' }}
                    >
                      1
                    </span>
                    <span>
                      Dans <strong>Chrome</strong> ou <strong>Edge</strong> (PC / Mac), cliquez sur
                      l’icône <strong>Installer</strong> située à droite de la barre d’adresse URL.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{ background: 'var(--accent)', color: '#fff', fontSize: '11px' }}
                    >
                      2
                    </span>
                    <span>
                      Sur Mac avec <strong>Safari</strong> : cliquez sur{' '}
                      <strong>Fichier &gt; Ajouter au Dock</strong>.
                    </span>
                  </div>
                </>
              )}

              <div
                className="pt-2 mt-2 flex items-center gap-1.5"
                style={{ borderTop: '1px solid var(--line)', color: 'var(--accent)' }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">
                  Une fois installée, l’application s’ouvre plein écran et fonctionne même sans
                  réseau sur chantier.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              style={{
                background: 'var(--ink)',
                color: '#FFFFFF',
                border: 'none',
              }}
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-lg no-print"
      style={{
        background: '#D97706',
        color: '#FFFFFF',
      }}
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Mode Hors-Ligne actif — Calculateur & devis disponibles</span>
    </div>
  );
};
