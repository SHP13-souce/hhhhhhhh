/// backend/server.js
const express = require('express');
const cors = require('cors');
const db = require('./db');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
require('dotenv').config();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 路由模块（删除重复的 userRoutes 定义）
const sosRoutes = require('./routes/sos');
const userRoutes = require('./routes/user'); // ✅ 改为 users（复数）
const voiceRoutes = require('./routes/voice');
const logRoutes = require('./routes/log');

// 统一使用复数形式 API
app.use('/api/sos', sosRoutes);
app.use('/api/user', userRoutes);            // ✅ 改为 /api/users（复数）
app.use('/api/voice', voiceRoutes);
app.use('/api/log', logRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('❌ 全局错误:', err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 后端服务启动成功！`);
  console.log(`📍 访问地址: http://localhost:${PORT}`);
  console.log(`📁 数据库存储: ./data.db`);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭数据库连接...');
  db.close(() => {
    console.log('✅ 数据库连接已关闭');
    process.exit(0);
  });
});