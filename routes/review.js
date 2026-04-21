import express from 'express';
import { ReviewDB, HotelDB } from '../utils/dbFactory.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.json({ code: 401, message: '未登录' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.id;
    req.username = decoded.username;
    next();
  } catch (error) {
    return res.json({ code: 401, message: 'token无效' });
  }
};

// 创建评论
router.post('/create', auth, async (req, res) => {
  try {
    const { hotelId, rating, content, images, type } = req.body;
    if (!hotelId || !rating || !content) return res.json({ code: 400, message: '缺少必要参数' });

    const hotel = await HotelDB.findById(hotelId);
    if (!hotel) return res.json({ code: 404, message: '酒店不存在' });

    const newReview = await ReviewDB.create({
      hotelId, userId: req.userId, userName: req.username,
      rating, content, images: images || [], type: type || 'GOOD'
    });

    // MySQL 用高效聚合查询，MongoDB 保持内存全量计算
    const stats = await ReviewDB.aggregateRating(hotelId);
    if (stats && stats.length > 0 && stats[0]._count > 0) {
      await HotelDB.updateRating(hotelId,
        Math.round((stats[0]._avg || 0) * 10) / 10, stats[0]._count);
    } else {
      const reviews = await ReviewDB.findMany({ filter: { hotelId } });
      const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
      await HotelDB.updateRating(hotelId, Math.round(avgRating * 10) / 10, reviews.length);
    }

    res.json({ code: 200, message: '评论成功', data: newReview });
  } catch (error) {
    console.error('创建评论失败:', error);
    res.json({ code: 500, message: '创建评论失败' });
  }
});

// 获取酒店评论列表
router.get('/hotel/:hotelId', async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { page = 1, pageSize = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const [reviews, total] = await Promise.all([
      ReviewDB.findMany({ filter: { hotelId }, sort: { createdAt: -1 }, skip, take: Number(pageSize) }),
      ReviewDB.count({ hotelId })
    ]);

    const groupResult = await ReviewDB.groupByRating(hotelId);
    const ratingCounts = { one: 0, two: 0, three: 0, four: 0, five: 0 };
    let totalRating = 0;

    if (groupResult && Array.isArray(groupResult)) {
      groupResult.forEach(item => {
        const rating = Number(item._id);
        const count = item._count;
        totalRating += rating * count;
        if (rating === 5) ratingCounts.five += count;
        else if (rating === 4) ratingCounts.four += count;
        else if (rating === 3) ratingCounts.three += count;
        else if (rating === 2) ratingCounts.two += count;
        else if (rating === 1) ratingCounts.one += count;
      });
    }

    const avgRating = total > 0 ? totalRating / total : 0;

    res.json({
      code: 200,
      data: {
        items: reviews, total,
        page: Number(page), pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
        ratingStats: { total, ...ratingCounts, avgRating: Math.round(avgRating * 10) / 10 }
      }
    });
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.json({ code: 500, message: '获取评论列表失败' });
  }
});

// 删除评论
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const review = await ReviewDB.findById(id);
    if (!review) return res.json({ code: 404, message: '评论不存在' });
    if (review.userId.toString() !== req.userId) return res.json({ code: 403, message: '无权限删除' });

    await ReviewDB.findByIdAndDelete(id);

    const stats = await ReviewDB.aggregateRating(review.hotelId);
    if (stats && stats.length > 0 && stats[0]._count > 0) {
      await HotelDB.updateRating(review.hotelId, Math.round((stats[0]._avg || 0) * 10) / 10, stats[0]._count);
    } else {
      await HotelDB.updateRating(review.hotelId, 0, 0);
    }

    res.json({ code: 200, message: '评论删除成功' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.json({ code: 500, message: '删除评论失败' });
  }
});

export default router;
