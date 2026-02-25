const express = require('express');
const router = express.Router();
const BrowsingHistory = require('../models/BrowsingHistory');
const Favorite = require('../models/Favorite');
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
    next();
  } catch (error) {
    return res.json({ code: 401, message: 'token无效' });
  }
};

// 获取用户行为数据集(用于训练)
router.get('/behavior-data', auth, async (req, res) => {
  try {
    const { limit = 1000 } = req.query;
    
    // 获取用户的浏览历史
    const browsingHistory = await BrowsingHistory.find({ userId: req.userId })
      .sort({ viewedAt: -1 })
      .limit(Number(limit))
      .populate('hotelId', 'name price rating city amenities');
    
    // 获取用户的收藏
    const favorites = await Favorite.find({ userId: req.userId })
      .populate('hotelId', 'name price rating city amenities');
    
    // 构建行为数据
    const behaviorData = {
      userId: req.userId,
      browseHistory: browsingHistory.map(item => ({
        hotelId: item.hotelId?._id,
        hotelName: item.hotelId?.name,
        price: item.hotelId?.price,
        rating: item.hotelId?.rating,
        city: item.hotelId?.city,
        amenities: item.hotelId?.amenities,
        viewedAt: item.viewedAt,
        duration: item.duration,
        source: item.source
      })),
      favorites: favorites.map(item => ({
        hotelId: item.hotelId?._id,
        hotelName: item.hotelId?.name,
        price: item.hotelId?.price,
        rating: item.hotelId?.rating,
        city: item.hotelId?.city,
        amenities: item.hotelId?.amenities,
        favoritedAt: item.createdAt
      })),
      totalBrowsed: browsingHistory.length,
      totalFavorites: favorites.length
    };
    
    res.json({ code: 200, data: behaviorData });
  } catch (error) {
    console.error('获取行为数据失败:', error);
    res.json({ code: 500, message: '获取行为数据失败' });
  }
});

// 获取相似用户推荐(协同过滤简化版)
router.get('/similar-users', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // 获取当前用户的收藏
    const userFavorites = await Favorite.find({ userId: req.userId });
    const userHotelIds = userFavorites.map(f => f.hotelId.toString());
    
    // 查找也收藏了这些酒店的其他用户
    const similarFavorites = await Favorite.find({
      hotelId: { $in: userHotelIds },
      userId: { $ne: req.userId }
    });
    
    // 统计其他用户的收藏频率
    const userScore = {};
    similarFavorites.forEach(fav => {
      const otherUserId = fav.userId.toString();
      userScore[otherUserId] = (userScore[otherUserId] || 0) + 1;
    });
    
    // 排序并获取最相似的用户
    const sortedUsers = Object.entries(userScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Number(limit));
    
    res.json({ 
      code: 200, 
      data: {
        similarUsers: sortedUsers.map(([userId, score]) => ({ userId, score }))
      }
    });
  } catch (error) {
    console.error('获取相似用户失败:', error);
    res.json({ code: 500, message: '获取相似用户失败' });
  }
});

// 获取热门酒店推荐
router.get('/popular', async (req, res) => {
  try {
    const { city, limit = 10 } = req.query;
    
    const query = { status: 'published' };
    if (city) query.city = city;
    
    // 基于浏览量和评分计算热门酒店
    const popularHotels = await Hotel.find(query)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(Number(limit));
    
    res.json({ code: 200, data: popularHotels });
  } catch (error) {
    console.error('获取热门推荐失败:', error);
    res.json({ code: 500, message: '获取热门推荐失败' });
  }
});

module.exports = router;

