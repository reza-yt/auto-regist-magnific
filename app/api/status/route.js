/**
 * API Route: /api/status
 * Health check and system info
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '2.0.0',
    features: {
      registration: true,
      emailVerification: true,
      apiKeyExtraction: true,
      proxyScraper: true,
      antiDetect: true,
      batchMode: true,
    },
    tempMailProviders: ['mail_tm', 'guerrilla'],
    proxyTypes: ['http', 'https', 'socks4', 'socks5'],
    antiDetect: [
      'WebGL spoofing',
      'Canvas noise injection',
      'AudioContext spoofing',
      'Timezone spoofing',
      'Navigator overrides',
      'WebDriver bypass',
      'Chrome runtime mock',
      'Plugin injection',
      'Battery API spoof',
      'Connection API spoof',
    ],
    limits: {
      maxDuration: '300s (Vercel Pro)',
      note: 'Vercel Hobby plan has 60s timeout. Upgrade to Pro for 300s.',
    },
    timestamp: new Date().toISOString(),
  });
}
