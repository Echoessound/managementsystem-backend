import express from 'express';
import { BrowsingHistoryDB } from '../utils/dbFactory.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.json({ code: 401, message: '未登录' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.json({ code: 401, message: 'token无效' });
  }
};

// 添加浏览记录
router.post('/add', auth, async (req, res) => {
  try {
    const { hotelId, duration = 0, source = 'search' } = req.body;
    if (!hotelId) return res.json({ code: 400, message: '缺少酒店ID' });

    // upsert: 已存在则更新浏览时间，否则创建新记录
    await BrowsingHistoryDB.upsert({
      filter: { userId: req.userId, hotelId },
      create: { userId: req.userId, hotelId, duration, source },
      update: { viewedAt: new Date(), duration, source }
    });

    res.json({ code: 200, message: '浏览记录添加成功' });
  } catch (error) {
    console.error('添加浏览记录失败:', error);
    res.json({ code: 500, message: '添加浏览记录失败' });
  }
});

// 获取用户浏览历史
router.get('/list', auth, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const [list, total] = await Promise.all([
      BrowsingHistoryDB.findMany({
        filter: { userId: req.userId },
        sort: { viewedAt: -1 },
        skip,
        take: Number(pageSize),
        includeHotel: true
      }),
      BrowsingHistoryDB.count({ userId: req.userId })
    ]);

    // 过滤掉已删除的酒店
    const validList = list.filter(item => item.hotelId !== null);

    res.json({
      code: 200,
      data: {
        items: validList, total: validList.length,
        page: Number(page), pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize))
      }
    });
  } catch (error) {
    console.error('获取浏览历史失败:', error);
    res.json({ code: 500, message: '获取浏览历史失败' });
  }
});

// 清空浏览历史
router.delete('/clear', auth, async (req, res) => {
  try {
    await BrowsingHistoryDB.deleteMany({ userId: req.userId });
    res.json({ code: 200, message: '浏览历史已清空' });
  } catch (error) {
    console.error('清空浏览历史失败:', error);
    res.json({ code: 500, message: '清空浏览历史失败' });
  }
});

export default router;
