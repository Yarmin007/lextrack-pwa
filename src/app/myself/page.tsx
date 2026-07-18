'use client';

import { useState } from 'react';

type SubTab = 'weight' | 'trips' | 'vault';

export default function MyselfPage() {
  const [activeTab, setActiveTab] = useState<SubTab>('weight');

  return (
    <main className="min-h-screen bg-slate-900 text-white p-4 max-w-md mx-auto pb-24">
      {/* Header */}
      <header className="mb-6 mt-2">
        <h1 className="text-2xl font-bold tracking-tight">Personal Space</h1>
        <p className="text-sm text-slate-400">Track logs, journeys, and secure vaults.</p>
      </header>

      {/* Segmented Sub-Tab Switcher */}
      <div className="flex bg-slate-800 p-1 rounded-xl mb-6 shadow-inner">
        <button
          onClick={() => setActiveTab('weight')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'weight'
              ? 'bg-slate-700 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ⚖️ Weight
        </button>
        <button
          onClick={() => setActiveTab('trips')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'trips'
              ? 'bg-slate-700 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🗺️ Trips
        </button>
        <button
          onClick={() => setActiveTab('vault')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'vault'
              ? 'bg-slate-700 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📂 Vault
        </button>
      </div>

      {/* Active Tab Content Area */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 shadow-xl min-h-[400px]">
        {activeTab === 'weight' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-slate-200">Weight Tracking</h2>
            {/* Weight Component Form & Logs will render here */}
            <p className="text-sm text-slate-400 italic">No logs captured yet.</p>
          </div>
        )}

        {activeTab === 'trips' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-slate-200">Trip Diary</h2>
            {/* Trip Logs Component will render here */}
            <p className="text-sm text-slate-400 italic">No trips recorded yet.</p>
          </div>
        )}

        {activeTab === 'vault' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-slate-200">Document Scanner Vault</h2>
            {/* Supabase Storage Scanner Uploader will render here */}
            <p className="text-sm text-slate-400 italic">Vault is currently empty.</p>
          </div>
        )}
      </div>
    </main>
  );
}