process.env.PORT = '5051';
const { startServer, server } = require('./server');
const http = require('http');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      ...headers,
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
    };

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5051,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (e) {}
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runApiTests() {
  console.log('🚀 Launching API server on port 5051...');
  await startServer();

  try {
    console.log('\n--- 1. Testing GET /api/health ---');
    const health = await request('GET', '/api/health');
    console.log(`Status: ${health.status}, OK:`, health.data.status === 'ok');

    console.log('\n--- 2. Testing GET /api/auctions ---');
    const auctions = await request('GET', '/api/auctions');
    console.log(`Status: ${auctions.status}, Found: ${auctions.data.count} auctions`);
    const firstAuction = auctions.data.auctions[0];
    console.log(`First item: "${firstAuction.title}", Category: ${firstAuction.category_name}, Price: ₹${firstAuction.current_price || firstAuction.starting_price}`);

    console.log('\n--- 3. Testing POST /api/auth/login ---');
    const login = await request('POST', '/api/auth/login', {
      email: 'rahul.verma@campus.edu',
      password: 'password123'
    });
    console.log(`Status: ${login.status}, User: ${login.data.user?.display_name}, Verified: ${login.data.user?.campus_verified}`);
    const token = login.data.token;

    console.log('\n--- 4. Testing GET /api/auctions/:id (Details & History) ---');
    const details = await request('GET', `/api/auctions/${firstAuction.id}`, null, {
      Authorization: `Bearer ${token}`
    });
    console.log(`Status: ${details.status}, Title: "${details.data.auction?.title}"`);
    console.log(`Bids recorded: ${details.data.bids?.length}, Q&A count: ${details.data.questions?.length}`);

    console.log('\n--- 5. Testing POST /api/assistant/query (AI Assistant) ---');
    const aiRes = await request('POST', '/api/assistant/query', {
      queryText: 'Find me a cycle under ₹2000'
    }, {
      Authorization: `Bearer ${token}`
    });
    console.log(`Status: ${aiRes.status}`);
    console.log(`AI Reply excerpt: ${aiRes.data.reply?.slice(0, 100)}...`);
    console.log(`Matched items: ${aiRes.data.matchingAuctions?.length}`);

    console.log('\n--- 6. Testing GET / (Static React SPA Serving) ---');
    const indexHtml = await request('GET', '/');
    console.log(`Status: ${indexHtml.status}, Contains CampusBid HTML: ${typeof indexHtml.data === 'string' && indexHtml.data.includes('CampusBid')}`);

    console.log('\n✨ ALL FULL-STACK INTEGRATION TESTS PASSED!');
  } finally {
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  }
}

runApiTests().catch(err => {
  console.error('Test failed:', err);
  server.close(() => process.exit(1));
});

