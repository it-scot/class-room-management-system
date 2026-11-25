// src/components/ConnectScreen.jsx
// Clean one-time onboarding screen to connect the mobile app with a SCOT Gantt API Key.

import React, { useState } from 'react';
import { KeyRound, Server, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { verifyApiKey } from '../services/scheduleApi';

const ConnectScreen = ({ defaultBaseUrl, defaultApiKey, onConnected }) => {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl || 'http://localhost:3001');
  const [apiKey, setApiKey] = useState(defaultApiKey || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async (e) => {
    e.preventDefault();
    setError('');
    if (!baseUrl.trim() || !apiKey.trim()) {
      setError('Please enter both the Portal Server URL and your Gantt API Key.');
      return;
    }

    setLoading(true);
    try {
      const info = await verifyApiKey(baseUrl, apiKey);
      onConnected({
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        apiKey: apiKey.trim(),
        buildings: info.buildings,
      });
    } catch (err) {
      setError(err.message || 'Could not verify API key. Please check the URL and key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#11192e] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">SCOT Live Schedule</h1>
          <p className="text-xs text-slate-400">
            Connect with your read-only Gantt API key from the SCOT Admin Panel.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/15 border border-red-500/35 px-3.5 py-2.5 text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              Portal Server URL
            </label>
            <input
              type="url"
              required
              placeholder="https://your-scot-portal.vercel.app"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full rounded-xl bg-[#0b1120] border border-white/10 px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Gantt API Key
            </label>
            <input
              type="password"
              required
              placeholder="scot_gantt_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-xl bg-[#0b1120] border border-white/10 px-3.5 py-3 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm py-3.5 shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying Key…
              </>
            ) : (
              <>
                Connect Schedule App
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 flex items-start gap-2.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Read-only schedule viewer. No employee login required and no portal write access is exposed.
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConnectScreen;
