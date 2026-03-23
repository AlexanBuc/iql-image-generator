// API key loaded via: node --env-file=.env server.js  (Node 20+, no dotenv needed)

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT    = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;

const MIME = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
};

// Proxy a request to OpenAI's image generation API
function callOpenAI(body) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        const options = {
            hostname: 'api.openai.com',
            path:     '/v1/images/generations',
            method:   'POST',
            headers: {
                'Content-Type':   'application/json',
                'Authorization':  `Bearer ${API_KEY}`,
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                try   { resolve(JSON.parse(data)); }
                catch { reject(new Error('Invalid response from OpenAI')); }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

const server = http.createServer(async (req, res) => {
    // ── API proxy ────────────────────────────────────────────────
    if (req.method === 'POST' && req.url === '/api/generate') {
        if (!API_KEY) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: { message: 'OPENAI_API_KEY is not set. Add it to your .env file.' }
            }));
            return;
        }

        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                const data   = await callOpenAI(parsed);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err.message } }));
            }
        });
        return;
    }

    // ── Static file server ───────────────────────────────────────
    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    filePath = path.join(__dirname, filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n  IQL Image Generator → http://localhost:${PORT}\n`);
    if (!API_KEY) {
        console.warn('  ⚠  OPENAI_API_KEY not found — add it to your .env file\n');
    }
});
