'use client';

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [proxies, setProxies] = useState([]);
  const [settings, setSettings] = useState({
    count: 1,
    mailProvider: 'mail_tm',
    headless: true,
    useProxyScraper: true,
  });
  const [proxyLoading, setProxyLoading] = useState(false);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, msg, type }]);
  };

  // Scrape free proxies
  const scrapeProxies = async () => {
    setProxyLoading(true);
    addLog('Scraping free proxies from internet...', 'info');
    try {
      const res = await fetch('/api/proxy-scrape');
      const data = await res.json();
      if (data.proxies) {
        setProxies(data.proxies);
        addLog(`Found ${data.proxies.length} free proxies from ${data.sources} sources`, 'success');
      } else {
        addLog(`Proxy scrape failed: ${data.error}`, 'error');
      }
    } catch (err) {
      addLog(`Proxy scrape error: ${err.message}`, 'error');
    }
    setProxyLoading(false);
  };

  // Start registration
  const startRegistration = async () => {
    if (status === 'running') return;
    setStatus('running');
    setLogs([]);
    addLog('Starting registration process...', 'info');

    // Scrape proxies first if enabled
    let proxyList = proxies;
    if (settings.useProxyScraper && proxies.length === 0) {
      addLog('Fetching proxies first...', 'info');
      try {
        const proxyRes = await fetch('/api/proxy-scrape');
        const proxyData = await proxyRes.json();
        if (proxyData.proxies) {
          proxyList = proxyData.proxies;
          setProxies(proxyData.proxies);
          addLog(`Got ${proxyData.proxies.length} proxies`, 'success');
        }
      } catch (e) {
        addLog('Failed to get proxies, continuing without...', 'warn');
      }
    }

    for (let i = 0; i < settings.count; i++) {
      if (status === 'stopped') break;
      addLog(`--- Account ${i + 1}/${settings.count} ---`, 'info');

      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mailProvider: settings.mailProvider,
            proxy: proxyList[i % Math.max(proxyList.length, 1)] || null,
            headless: settings.headless,
          }),
        });

        const data = await res.json();

        if (data.success) {
          addLog(`✓ Registered: ${data.email}`, 'success');
          addLog(`✓ API Key: ${data.apiKey?.substring(0, 16)}...`, 'success');
          setResults(prev => [...prev, data]);
        } else {
          addLog(`✗ Failed: ${data.error}`, 'error');
          if (data.step) addLog(`  Failed at step: ${data.step}`, 'error');
        }
      } catch (err) {
        addLog(`✗ Request error: ${err.message}`, 'error');
      }

      // Delay between registrations
      if (i < settings.count - 1) {
        const delay = 10 + Math.random() * 10;
        addLog(`Waiting ${delay.toFixed(0)}s before next...`, 'info');
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }

    setStatus('idle');
    addLog('Process complete!', 'success');
  };

  const stopRegistration = () => {
    setStatus('stopped');
    addLog('Stopping...', 'warn');
  };

  const downloadResults = () => {
    const text = results.map(r =>
      `[${r.timestamp}]\nEmail: ${r.email}\nPassword: ${r.password}\nAPI Key: ${r.apiKey}\n${'='.repeat(50)}`
    ).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'magnific_api_keys.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Magnific Auto Register
          </h1>
          <p className="text-gray-400 mt-2">Auto Registration + API Key Extraction + Anti-Detect Browser</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">⚙️ Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Jumlah Akun</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.count}
                  onChange={e => setSettings({...settings, count: parseInt(e.target.value) || 1})}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Mail Provider</label>
                <select
                  value={settings.mailProvider}
                  onChange={e => setSettings({...settings, mailProvider: e.target.value})}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-blue-500 outline-none"
                >
                  <option value="mail_tm">Mail.tm (Gratis)</option>
                  <option value="guerrilla">Guerrilla Mail (Gratis)</option>
                  <option value="kopeechka">Kopeechka (Berbayar - Paling Reliable)</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.useProxyScraper}
                  onChange={e => setSettings({...settings, useProxyScraper: e.target.checked})}
                  className="w-4 h-4 rounded"
                />
                <label className="text-sm text-gray-400">Auto Scrape Free Proxy</label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.headless}
                  onChange={e => setSettings({...settings, headless: e.target.checked})}
                  className="w-4 h-4 rounded"
                />
                <label className="text-sm text-gray-400">Headless Mode</label>
              </div>
            </div>

            {/* Proxy Section */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-300">🌐 Proxies ({proxies.length})</h3>
                <button
                  onClick={scrapeProxies}
                  disabled={proxyLoading}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg disabled:opacity-50"
                >
                  {proxyLoading ? 'Scraping...' : 'Scrape Proxies'}
                </button>
              </div>
              {proxies.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-2 max-h-32 overflow-y-auto text-xs text-gray-400">
                  {proxies.slice(0, 20).map((p, i) => (
                    <div key={i} className="truncate">{p}</div>
                  ))}
                  {proxies.length > 20 && <div className="text-blue-400">...and {proxies.length - 20} more</div>}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <button
                onClick={startRegistration}
                disabled={status === 'running'}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-all glow"
              >
                {status === 'running' ? '⏳ Running...' : '🚀 Start Registration'}
              </button>

              {status === 'running' && (
                <button
                  onClick={stopRegistration}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-all"
                >
                  ⏹ Stop
                </button>
              )}
            </div>
          </div>

          {/* Logs Panel */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4 text-green-400">📋 Logs</h2>
            <div className="bg-black rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs space-y-1">
              {logs.length === 0 && <p className="text-gray-600">Logs will appear here...</p>}
              {logs.map((log, i) => (
                <div key={i} className={`${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'warn' ? 'text-yellow-400' :
                  'text-gray-300'
                }`}>
                  <span className="text-gray-600">[{log.time}]</span> {log.msg}
                </div>
              ))}
            </div>
          </div>

          {/* Results Panel */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-purple-400">🔑 API Keys ({results.length})</h2>
              {results.length > 0 && (
                <button
                  onClick={downloadResults}
                  className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg"
                >
                  📥 Download
                </button>
              )}
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.length === 0 && <p className="text-gray-600 text-sm">Results will appear here...</p>}
              {results.map((r, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Account #{i + 1}</div>
                  <div className="text-xs truncate"><span className="text-gray-500">Email:</span> <span className="text-blue-300">{r.email}</span></div>
                  <div className="text-xs truncate"><span className="text-gray-500">Pass:</span> <span className="text-yellow-300">{r.password}</span></div>
                  <div className="text-xs truncate"><span className="text-gray-500">Key:</span> <span className="text-green-300">{r.apiKey}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-gray-600 text-xs">
          <p>⚠️ Tool ini untuk keperluan edukasi dan development. Gunakan secara bertanggung jawab.</p>
          <p className="mt-1">Anti-Detect: WebGL + Canvas + Audio + Timezone + Fingerprint Spoofing | Proxy Auto-Rotation</p>
        </div>
      </div>
    </div>
  );
}
