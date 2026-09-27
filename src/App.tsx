/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PaveCalculator } from './components/PaveCalculator';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import { Printer } from 'lucide-react';

export default function App() {
  return (
    <div className="wrap">
      <OfflineIndicator />

      <header className="head-row no-print">
        <div>
          <h1>Pavé + transport</h1>
          <p>Prix de revient, marge et transport — HT & TTC</p>
        </div>

        <div className="top-actions no-print">
          <PWAInstallButton />

          <button
            className="action-icon-btn"
            id="printBtn"
            type="button"
            title="Imprimer"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </header>

      <PaveCalculator />
    </div>
  );
}
