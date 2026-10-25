import autocannon from 'autocannon';
const url = process.env.STRESS_URL || 'http://localhost:4000/graphql';
const connections = Number(process.env.CONNECTIONS || 100);
const duration = Number(process.env.DURATION || 20);
const query = JSON.stringify({ query: '{ releases { id name status } }' });
console.log(`Read-only GraphQL stress test: ${url}; connections=${connections}; duration=${duration}s`);
const result = await autocannon({ url, connections, duration, method: 'POST', headers: { 'content-type': 'application/json' }, body: query, timeout: 10 });
autocannon.printResult(result);
console.log(JSON.stringify({ url, connections, duration, requests: result.requests, latency: result.latency, errors: result.errors, timeouts: result.timeouts, non2xx: result.non2xx }, null, 2));
