const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Hotel = require('../models/Hotel');
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
    
    if (!hotelId || !rating || !content) {
      return res.json({ code: 400, message: '缺少必要参数' });
    }
    
    // 检查酒店是否存在
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.json({ code: 404, message: '酒店不存在' });
    }
    
    const newReview = new Review({
      hotelId,
      userId: req.userId,
      userName: req.username,
      rating,
      content,
      images: images || [],
      type: type || 'good'
    });
    
    await newReview.save();
    
    // 更新酒店评分和评论数
    const reviews = await Review.find({ hotelId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    await Hotel.findByIdAndUpdate(hotelId, {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length
    });
    
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
      Review.find({ hotelId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(pageSize)),
      Review.countDocuments({ hotelId })
    ]);
    
    // 计算评分统计
    const allReviews = await Review.find({ hotelId });
    const ratingCounts = { one: 0, two: 0, three: 0, four: 0, five: 0 };
    let totalRating = 0;
    
    allReviews.forEach(review => {
      totalRating += review.rating;
      if (review.rating === 5) ratingCounts.five++;
      else if (review.rating === 4) ratingCounts.four++;
      else if (review.rating === 3) ratingCounts.three++;
      else if (review.rating === 2) ratingCounts.two++;
      else ratingCounts.one++;
    });
    
    const avgRating = allReviews.length > 0 ? totalRating / allReviews.length : 0;
    
    res.json({
      code: 200,
      data: {
        items: reviews,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
        ratingStats: {
          total: allReviews.length,
          ...ratingCounts,
          avgRating: Math.round(avgRating * 10) / 10
        }
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
    
    const review = await Review.findById(id);
    if (!review) {
      return res.json({ code: 404, message: '评论不存在' });
    }
    
    // 检查权限
    if (review.userId.toString() !== req.userId) {
      return res.json({ code: 403, message: '无权限删除' });
    }
    
    await Review.findByIdAndDelete(id);
    
    // 更新酒店评分和评论数
    const reviews = await Review.find({ hotelId: review.hotelId });
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await Hotel.findByIdAndUpdate(review.hotelId, {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: reviews.length
      });
    } else {
      await Hotel.findByIdAndUpdate(review.hotelId, {
        rating: 0,
        reviewCount: 0
      });
    }
    
    res.json({ code: 200, message: '评论删除成功' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.json({ code: 500, message: '删除评论失败' });
  }
});

module.exports = router;

