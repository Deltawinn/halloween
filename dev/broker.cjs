const aedes = require('aedes')();
const http = require('http');
const ws = require('websocket-stream');
const server = http.createServer();
ws.createServer({ server }, aedes.handle);
let n = 0;
aedes.on('publish', (p, c) => { if (c) n++; });
setInterval(() => process.stdout.write(`msgs:${n}\n`), 30000);
server.listen(8883, () => console.log('broker ws://localhost:8883'));
