/**
 * 数据库健康检查模块
 * 提供系统级别的健康状态端点
 */

import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

async function safeCount(name) {
  try {
    return await mongoose.connection.db.collection(name).countDocuments();
  } catch {
    return -1;
  }
}

/**
 * GET /api/health
 * 返回系统健康状态
 */
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const mem = process.memoryUsage();
  const memUsedMB = Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100;
  const memTotalMB = Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100;

  let mongoStatus = 'down';
  let mongoLatency = null;

  try {
    const pingStart = Date.now();
    await mongoose.connection.db.admin().ping();
    mongoLatency = Date.now() - pingStart;
    mongoStatus = 'up';
  } catch (e) {
    mongoStatus = 'down';
  }

  let status = 'ok';
  if (mongoStatus === 'down') {
    status = 'error';
  } else if (memUsedMB / memTotalMB > 0.85 || mongoLatency > 1000) {
    status = 'degraded';
  }

  const actualResponseTime = Date.now() - startTime;
  const userCount = await safeCount('users');
  const hotelCount = await safeCount('hotels');
  const reviewCount = await safeCount('reviews');
  const logCount = await safeCount('operationlogs');
  const slowLogCount = await safeCount('slowquerylogs');

  res.json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    responseTime: actualResponseTime,
    mongodb: {
      status: mongoStatus,
      latencyMs: mongoLatency,
      host: mongoose.connection.host || 'unknown',
      name: mongoose.connection.name || 'unknown'
    },
    memory: {
      rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      heapUsedMB: memUsedMB,
      heapTotalMB: memTotalMB,
      usagePercent: Math.round(memUsedMB / memTotalMB * 10000) / 100
    },
    collections: {
      users: userCount,
      hotels: hotelCount,
      reviews: reviewCount,
      operationlogs: logCount,
      slowquerylogs: slowLogCount
    }
  });
});

export default router;
