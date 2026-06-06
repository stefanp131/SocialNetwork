const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const targetApp = express();
targetApp.post('/register', (req, res) => res.json({ success: true, targetRoute: '/register' }));
targetApp.post('/api/auth/register', (req, res) => res.json({ success: true, targetRoute: '/api/auth/register' }));
targetApp.use((req, res) => res.status(404).send('Not Found in Target'));

targetApp.listen(4001, () => {
  const gateway = express();
  gateway.use('/api/auth', createProxyMiddleware({ target: 'http://localhost:4001', changeOrigin: true, pathRewrite: { '^/api/auth': '' } }));
  
  gateway.listen(4000, async () => {
    try {
      const fetch = require('node-fetch');
      const res = await fetch('http://localhost:4000/api/auth/register', { method: 'POST' });
      const text = await res.text();
      console.log('STATUS:', res.status);
      console.log('RESPONSE:', text);
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
});
