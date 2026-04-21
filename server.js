import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import 'dotenv/config';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const DB_NAME = process.env.DB_NAME || 'ctrip_hotel';
const MONGO_URL = process.env.DATABASE_URL || `mongodb://localhost:27017/${DB_NAME}`;
const SLOW_RESPONSE_THRESHOLD = Number(process.env.SLOW_RESPONSE_THRESHOLD || 500);

// 全局请求日志中间件
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// 全局慢响应拦截中间件（响应时间 > SLOW_RESPONSE_THRESHOLD ms 记录到 SlowQueryLog）
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const startTime = Date.now();
  res.on('finish', async () => {
    const ms = Date.now() - startTime;
    if (ms > SLOW_RESPONSE_THRESHOLD) {
      try {
        const { SlowQueryLogDB } = await import('./utils/dbFactory.js');
        SlowQueryLogDB.create({
          collection: 'HTTP',
          method: req.method,
          query: `${req.method} ${req.path}`,
          executionTimeMs: ms,
          threshold: SLOW_RESPONSE_THRESHOLD,
          path: req.path,
          ip: req.ip || req.connection?.remoteAddress || '',
          userAgent: req.get('user-agent') || ''
        }).catch(() => {});
      } catch {}
    }
  });
  next();
});

app.use(cors());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// 对 multipart/form-data 跳过 express.json()，让 multer 处理
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 上传的图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 连接 MongoDB
mongoose.connect(MONGO_URL, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10,
}).then(() => {
  console.log(`MongoDB 连接成功 - 数据库: ${DB_NAME}`);
  console.log(`连接地址: ${MONGO_URL}`);
}).catch(err => {
  console.error('MongoDB 连接失败:', err.message);
  console.error('请确保 MongoDB 服务已启动');
});

// Mongoose 连接事件
mongoose.connection.on('error', (err) => {
  console.error('MongoDB 连接错误:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB 连接已断开，正在尝试重连...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB 已重新连接');
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n正在关闭服务器...');
  await mongoose.connection.close();
  process.exit(0);
});

// 全局未捕获异常处理
process.on('uncaughtException', (err, origin) => {
  console.error(`[UNCAUGHT] 进程崩溃原因: ${err.message}`);
  console.error('堆栈:', err.stack);
});

// 全局 Promise 拒绝处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED] 未处理的 Promise 拒绝:', reason);
});

// 导入路由（ESM）
import authRoutes from './routes/auth.js';
import hotelRoutes from './routes/hotel.js';
import reviewRoutes from './routes/review.js';
import favoriteRoutes from './routes/favorite.js';
import browsingHistoryRoutes from './routes/browsingHistory.js';
import userPreferenceRoutes from './routes/userPreference.js';
import recommendationRoutes from './routes/recommendation.js';
import aiRoutes from './routes/ai.js';
import operationLogRoutes from './routes/operationLog.js';
import { createOperationLog } from './utils/logger.js';
import healthRouter from './utils/health.js';

// 健康检查路由（放在慢响应拦截之前，避免自身被追踪）
app.use('/api', healthRouter);

// 操作日志中间件 — 全局注册，拦截所有 /api 请求
app.use(createOperationLog);

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/hotel', hotelRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/favorite', favoriteRoutes);
app.use('/api/browsingHistory', browsingHistoryRoutes);
app.use('/api/preference', userPreferenceRoutes);
app.use('/api/recommendation', recommendationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/log', operationLogRoutes);

// 启动服务器
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}（当前数据库: mongodb）`);
});
