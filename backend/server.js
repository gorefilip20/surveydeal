const http = require('http');
const PORT = 5000;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      contract: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      network: 'local-hardhat',
      fee: '0%'
    }));
    return;
  }

  // Chains endpoint
  if (req.url === '/api/chains') {
    res.writeHead(200);
    res.end(JSON.stringify({
      chains: [
        { id: 'ETHEREUM', name: 'Ethereum', chainId: 1, nativeCurrency: 'ETH', icon: '🔷' },
        { id: 'BNB_CHAIN', name: 'BNB Chain', chainId: 56, nativeCurrency: 'BNB', icon: '🟡' },
        { id: 'POLYGON', name: 'Polygon', chainId: 137, nativeCurrency: 'MATIC', icon: '🟣' },
        { id: 'ARBITRUM', name: 'Arbitrum', chainId: 42161, nativeCurrency: 'ETH', icon: '🔵' },
        { id: 'BASE', name: 'Base', chainId: 8453, nativeCurrency: 'ETH', icon: '🔷' },
        { id: 'SOLANA', name: 'Solana', chainId: 0, nativeCurrency: 'SOL', icon: '☀️' },
        { id: 'TRON', name: 'TRON', chainId: 0, nativeCurrency: 'TRX', icon: '🔴' },
      ]
    }));
    return;
  }

  // DexScreener search proxy
  if (req.url.startsWith('/api/dexscreener/search')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const query = url.searchParams.get('q') || '';
    res.writeHead(200);
    res.end(JSON.stringify({
      query,
      pairs: [],
      message: 'DexScreener search ready - connect to real API in production'
    }));
    return;
  }

  // Chat rooms
  if (req.url === '/api/chat/rooms' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify([]));
    return;
  }

  // Default
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  SURVEYDEAL API SERVER');
  console.log('═══════════════════════════════════════════');
  console.log(`  Port: ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
  console.log(`  Chains: http://localhost:${PORT}/api/chains`);
  console.log('═══════════════════════════════════════════');
  console.log('');
});
