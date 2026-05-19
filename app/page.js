'use client';

import { useState } from 'react';

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
      if (data.proxies && data.proxies.length > 0) {
        setProxies(data.proxies);
        addLog(`Found ${data.proxies.length} free proxies from ${data.sources} sources`, 'success');
      } else {
        addLog(`Proxy scrape returned no proxies`, 'error');
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
        if (proxyData.proxies && proxyData.proxies.length > 0) {
          proxyList = proxyData.proxies;
          setProxies(proxyData.proxies);
          addLog(`Got ${proxyData.proxies.length} proxies`, 'success');
        }
      } catch (e) {
        addLog('Failed to get proxies, continuing without...', 'warn');
      }
    }

    for (let i = 0; i < settings.count; i++) {
      addLog(`--- Account ${i + 1}/${settings.count} ---`, 'info');

      try {
        const proxyToUse = proxyList.length > 0 ? proxyList[i % proxyList.length] : null;
        addLog(`Using proxy: ${proxyToUse || 'none'}`, 'info');

        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mailProvider: settings.mailProvider,
            proxy: proxyToUse,
            headless: settings.headless,
          }),
        });

        const data = await res.json();

        if (data.success) {
          addLog(`Registered: ${data.email}`, 'success');
          if (data.verified) addLog(`Email verified!`, 'success');
          addLog(`API Key: ${data.apiKey || 'pending'}`, data.apiKey && data.apiKey !== 'extraction_pending' ? 'success' : 'warn');
          setResults(prev => [...prev, data]);
        } else {
          addLog(`Failed: ${data.error}`, 'error');
          if (data.step) addLog(`  Failed at step: ${data.step}`, 'error');
        }
      } catch (err) {
        addLog(`Request error: ${err.message}`, 'error');
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
    addLog('Stopping after current task...', 'warn');
  };

  const downloadResults = () => {
    if (results.length === 0) return;
    const text = results.map(r =>
      `[${r.timestamp}]\nEmail: ${r.email}\nPassword: ${r.password}\nAPI Key: ${r.apiKey || 'N/A'}\nVerified: ${r.verified}\n${'='.repeat(50)}`
    ).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'magnific_api_keys.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Magnific Auto Register
          </h1>
          <p className="text-gray-400 mt-2 text-sm md:text-base">Auto Registration + API Key Extraction + Anti-Detect Browser</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Settings Panel */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4 text-blue-400">Settings</h2>

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
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="proxyCheck"
                  checked={settings.useProxyScraper}
                  onChange={e => setSettings({...settings, useProxyScraper: e.target.checked})}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="proxyCheck" className="text-sm text-gray-400">Auto Scrape Free Proxy</label>
              </div>
            </div>

            {/* Proxy Section */}
            <div className="mt-5 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-300">Proxies ({proxies.length})</h3>
                <button
                  onClick={scrapeProxies}
                  disabled={proxyLoading}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {proxyLoading ? 'Scraping...' : 'Scrape Proxies'}
                </button>
              </div>
              {proxies.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-2 max-h-28 overflow-y-auto text-xs text-gray-400 font-mono">
                  {proxies.slice(0, 15).map((p, i) => (
                    <div key={i} className="truncate">{p}</div>
                  ))}
                  {proxies.length > 15 && <div className="text-blue-400 mt-1">...+{proxies.length - 15} more</div>}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-5 space-y-3">
              <button
                onClick={startRegistration}
                disabled={status === 'running'}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
              >
                {status === 'running' ? 'Running...' : 'Start Registration'}
              </button>

              {status === 'running' && (
                <button
                  onClick={stopRegistration}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-all"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Logs Panel */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4 text-green-400">Logs</h2>
            <div className="bg-black rounded-lg p-3 h-80 md:h-96 overflow-y-auto font-mono text-xs space-y-0.5">
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
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-purple-400">API Keys ({results.length})</h2>
              {results.length > 0 && (
                <button
                  onClick={downloadResults}
                  className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg transition-colors"
                >
                  Download
                </button>
              )}
            </div>
            <div className="space-y-3 max-h-80 md:max-h-96 overflow-y-auto">
              {results.length === 0 && <p className="text-gray-600 text-sm">Results will appear here...</p>}
              {results.map((r, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Account #{i + 1}</div>
                  <div className="text-xs truncate"><span className="text-gray-500">Email:</span> <span className="text-blue-300">{r.email}</span></div>
                  <div className="text-xs truncate"><span className="text-gray-500">Pass:</span> <span className="text-yellow-300">{r.password}</span></div>
                  <div className="text-xs truncate"><span className="text-gray-500">Key:</span> <span className="text-green-300">{r.apiKey || 'N/A'}</span></div>
                  <div className="text-xs"><span className="text-gray-500">Verified:</span> <span className={r.verified ? 'text-green-300' : 'text-red-300'}>{r.verified ? 'Yes' : 'No'}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-600 text-xs">
          <p>Anti-Detect: WebGL + Canvas + Audio + Timezone + Fingerprint Spoofing | Proxy Auto-Rotation</p>
        </div>
      </div>
    </div>
  );
}
