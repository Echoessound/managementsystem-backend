/**
 * 操作日志管理 API
 * 仅限管理员访问
 */

import express from 'express';
import { OperationLogDB, SlowQueryLogDB } from '../utils/dbFactory.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const router = express.Router();

// 管理员权限校验
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.json({ code: 401, message: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.role !== 'admin') {
      return res.json({ code: 403, message: '需要管理员权限' });
    }
    req.userId = decoded.id;
    req.username = decoded.username;
    req.role = decoded.role;
    next();
  } catch {
    return res.json({ code: 401, message: 'token无效' });
  }
};

// 获取操作日志列表
router.get('/list', adminAuth, async (req, res) => {
  try {
    const {
      page = 1, pageSize = 20,
      module, action, status, userId,
      startDate, endDate, keyword,
      sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    const filter = {};

    if (module) filter.module = module;
    if (action) filter.action = action;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (keyword) {
      filter.$or = [
        { username: { $regex: keyword, $options: 'i' } },
        { targetName: { $regex: keyword, $options: 'i' } },
        { ip: { $regex: keyword, $options: 'i' } },
        { error: { $regex: keyword, $options: 'i' } }
      ];
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (Number(page) - 1) * Number(pageSize);

    const [logs, total, byModule, byUser] = await Promise.all([
      OperationLogDB.findMany({ filter, sort, skip, take: Number(pageSize) }),
      OperationLogDB.count(filter),
      OperationLogDB.countByModule(filter),
      OperationLogDB.countByUser(filter)
    ]);

    res.json({
      code: 200,
      data: {
        items: logs,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
        stats: {
          byModule,
          byUser: byUser.slice(0, 20),
          total
        }
      }
    });
  } catch (error) {
    console.error('获取日志列表失败:', error);
    res.json({ code: 500, message: '获取日志列表失败' });
  }
});

// 获取日志统计概览
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const [todayStats, weekStats, successRate, byModule, byPeriod, byUser] = await Promise.all([
      OperationLogDB.count({ createdAt: { $gte: new Date(new Date().toDateString()) } }),
      OperationLogDB.countByPeriod({ period: 'day', filter: { createdAt: { $gte: since } } }),
      OperationLogDB.getSuccessRate({ createdAt: { $gte: since } }),
      OperationLogDB.countByModule({ createdAt: { $gte: since } }),
      OperationLogDB.countByPeriod({ period: 'hour', filter: { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      OperationLogDB.countByUser({ createdAt: { $gte: since } })
    ]);

    res.json({
      code: 200,
      data: {
        todayCount: todayStats,
        weekTrend: weekStats,
        successRate,
        byModule,
        byHour: byPeriod,
        topUsers: byUser.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.json({ code: 500, message: '获取统计失败' });
  }
});

// 获取特定用户的操作日志
router.get('/user/:userId', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, pageSize = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const [logs, total] = await Promise.all([
      OperationLogDB.findMany({
        filter: { userId },
        sort: { createdAt: -1 },
        skip,
        take: Number(pageSize)
      }),
      OperationLogDB.count({ userId })
    ]);

    res.json({
      code: 200,
      data: { items: logs, total, page: Number(page), pageSize: Number(pageSize) }
    });
  } catch (error) {
    console.error('获取用户日志失败:', error);
    res.json({ code: 500, message: '获取用户日志失败' });
  }
});

// 获取特定目标的操作日志
router.get('/target/:targetId', adminAuth, async (req, res) => {
  try {
    const { targetId } = req.params;
    const { page = 1, pageSize = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const [logs, total] = await Promise.all([
      OperationLogDB.findMany({
        filter: { targetId },
        sort: { createdAt: -1 },
        skip,
        take: Number(pageSize)
      }),
      OperationLogDB.count({ targetId })
    ]);

    res.json({
      code: 200,
      data: { items: logs, total, page: Number(page), pageSize: Number(pageSize) }
    });
  } catch (error) {
    console.error('获取目标日志失败:', error);
    res.json({ code: 500, message: '获取目标日志失败' });
  }
});

// 清空日志
router.delete('/clear', adminAuth, async (req, res) => {
  try {
    const { days, beforeDate, module } = req.body;

    if (!days && !beforeDate) {
      return res.json({ code: 400, message: '请指定 days 或 beforeDate' });
    }

    const filter = {};
    if (beforeDate) {
      filter.createdAt = { $lt: new Date(beforeDate) };
    } else if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(days));
      filter.createdAt = { $lt: cutoff };
    }
    if (module) filter.module = module;

    const result = await OperationLogDB.deleteMany(filter);
    res.json({
      code: 200,
      message: `已删除 ${result.deletedCount} 条日志`,
      data: { deletedCount: result.deletedCount }
    });
  } catch (error) {
    console.error('清空日志失败:', error);
    res.json({ code: 500, message: '清空日志失败' });
  }
});

// 导出日志（CSV）
router.get('/export', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, module, status, limit = 1000 } = req.query;

    const filter = {};
    if (module) filter.module = module;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const logs = await OperationLogDB.findMany({
      filter,
      sort: { createdAt: -1 },
      skip: 0,
      take: Number(limit)
    });

    const headers = ['时间', '用户', '角色', '模块', '动作', '目标类型', '目标ID', '目标名称', '方法', '路径', 'IP', '响应码', '状态', '耗时(ms)', '错误信息'];
    const rows = logs.map(log => [
      log.createdAt?.toISOString() || '',
      log.username || '',
      log.role || '',
      log.module || '',
      log.action || '',
      log.targetType || '',
      log.targetId || '',
      log.targetName || '',
      log.method || '',
      log.path || '',
      log.ip || '',
      log.responseCode || 0,
      log.status || '',
      log.duration || 0,
      log.error || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=operation_logs_${Date.now()}.csv`);
    res.send('\ufeff' + csv);
  } catch (error) {
    console.error('导出日志失败:', error);
    res.json({ code: 500, message: '导出日志失败' });
  }
});

// 获取所有集合的索引列表
router.get('/indexes', adminAuth, async (req, res) => {
  try {
    const { collection } = req.query;
    const collections = collection
      ? [collection]
      : ['users', 'hotels', 'reviews', 'favorites', 'browsinghistories', 'userpreferences', 'operationlogs', 'slowquerylogs'];

    const results = [];
    for (const col of collections) {
      try {
        const indexes = await mongoose.connection.db.collection(col).indexes();
        results.push({ collection: col, indexes });
      } catch (e) {
        results.push({ collection: col, error: e.message });
      }
    }

    res.json({ code: 200, data: results });
  } catch (error) {
    console.error('获取索引列表失败:', error);
    res.json({ code: 500, message: '获取索引列表失败' });
  }
});

// 重建指定集合的索引
router.post('/indexes/rebuild', adminAuth, async (req, res) => {
  try {
    const { collection, indexName } = req.body;

    if (!collection) {
      return res.json({ code: 400, message: '请指定 collection' });
    }

    if (indexName) {
      // 重建指定索引
      await mongoose.connection.db.collection(collection).dropIndex(indexName);
      res.json({ code: 200, message: `索引 ${indexName} 已删除，请在业务低峰期重新运行 db.js seed 或手动创建` });
    } else {
      // 重建集合所有索引
      const result = await mongoose.connection.db.collection(collection).reIndex();
      res.json({ code: 200, message: `${collection} 所有索引已重建`, data: result });
    }
  } catch (error) {
    console.error('重建索引失败:', error);
    res.json({ code: 500, message: '重建索引失败: ' + error.message });
  }
});

// 获取慢查询日志列表
router.get('/slow-queries', adminAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 50, collection, days = 7 } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const filter = {};
    if (collection) filter.collection = collection;
    if (Number(days) > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(days));
      filter.createdAt = { $gte: cutoff };
    }

    const [items, total, byCollection] = await Promise.all([
      SlowQueryLogDB.findMany({ filter, sort: { createdAt: -1 }, skip, take: Number(pageSize) }),
      SlowQueryLogDB.count(filter),
      SlowQueryLogDB.countByCollection(filter)
    ]);

    res.json({
      code: 200,
      data: {
        items,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
        stats: { byCollection }
      }
    });
  } catch (error) {
    console.error('获取慢查询日志失败:', error);
    res.json({ code: 500, message: '获取慢查询日志失败' });
  }
});

// 清空慢查询日志
router.delete('/slow-queries/clear', adminAuth, async (req, res) => {
  try {
    const { days, beforeDate, collection } = req.body;

    const filter = {};
    if (beforeDate) {
      filter.createdAt = { $lt: new Date(beforeDate) };
    } else if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(days));
      filter.createdAt = { $lt: cutoff };
    }
    if (collection) filter.collection = collection;

    const result = await SlowQueryLogDB.deleteMany(filter);
    res.json({ code: 200, message: `已删除 ${result.deletedCount} 条慢查询记录`, data: { deletedCount: result.deletedCount } });
  } catch (error) {
    console.error('清空慢查询日志失败:', error);
    res.json({ code: 500, message: '清空慢查询日志失败' });
  }
});

export default router;
