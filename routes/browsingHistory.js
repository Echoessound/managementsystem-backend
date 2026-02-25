const express = require('express');
const router = express.Router();
const BrowsingHistory = require('../models/BrowsingHistory');
const jwt = require('jsonwebtoken');

// 简单的认证中间件
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.json({ code: 401, message: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, 'your-secret-key');
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
    
    if (!hotelId) {
      return res.json({ code: 400, message: '缺少酒店ID' });
    }

    // 检查是否已存在浏览记录，如果存在则更新浏览时间
    const existingRecord = await BrowsingHistory.findOne({
      userId: req.userId,
      hotelId: hotelId
    });

    if (existingRecord) {
      existingRecord.viewedAt = new Date();
      existingRecord.duration = duration;
      existingRecord.source = source;
      await existingRecord.save();
    } else {
      const newRecord = new BrowsingHistory({
        userId: req.userId,
        hotelId: hotelId,
        duration: duration,
        source: source
      });
      await newRecord.save();
    }

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
      BrowsingHistory.find({ userId: req.userId })
        .sort({ viewedAt: -1 })
        .skip(skip)
        .limit(Number(pageSize))
        .populate('hotelId', 'name address price images rating city'),
      BrowsingHistory.countDocuments({ userId: req.userId })
    ]);

    // 过滤掉已删除的酒店
    const validList = list.filter(item => item.hotelId !== null);

    res.json({
      code: 200,
      data: {
        items: validList,
        total: validList.length,
        page: Number(page),
        pageSize: Number(pageSize),
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
    await BrowsingHistory.deleteMany({ userId: req.userId });
    res.json({ code: 200, message: '浏览历史已清空' });
  } catch (error) {
    console.error('清空浏览历史失败:', error);
    res.json({ code: 500, message: '清空浏览历史失败' });
  }
});

module.exports = router;

