(global as any).crypto = require('crypto');

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(morgan('dev'));

const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';
const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:4002';
const postServiceUrl = process.env.POST_SERVICE_URL || 'http://localhost:4003';
const chatServiceUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:4004';

app.use('/api/auth', createProxyMiddleware({ target: authServiceUrl, changeOrigin: true, pathRewrite: { '^/api/auth': '' } }));
app.use('/api/users', createProxyMiddleware({ target: userServiceUrl, changeOrigin: true, pathRewrite: { '^/api/users': '' } }));
app.use('/api/posts', createProxyMiddleware({ target: postServiceUrl, changeOrigin: true, pathRewrite: { '^/api/posts': '' } }));
app.use('/api/chat', createProxyMiddleware({ target: chatServiceUrl, changeOrigin: true, pathRewrite: { '^/api/chat': '' } }));

app.get('/health', (req, res) => res.send('API Gateway is running'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Gateway listening on port ${PORT}`);
});
