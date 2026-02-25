const express = require('express');
const router = express.Router();
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

// 添加收藏
router.post('/add', auth, async (req, res) => {
  try {
    const { hotelId } = req.body;
    
    if (!hotelId) {
      return res.json({ code: 400, message: '缺少酒店ID' });
    }

    // 检查是否已存在收藏
    const existingFavorite = await Favorite.findOne({
      userId: req.userId,
      hotelId: hotelId
    });

    if (existingFavorite) {
      return res.json({ code: 400, message: '已经收藏过该酒店' });
    }

    const newFavorite = new Favorite({
      userId: req.userId,
      hotelId: hotelId
    });
    
    await newFavorite.save();

    res.json({ code: 200, message: '收藏成功' });
  } catch (error) {
    console.error('添加收藏失败:', error);
    res.json({ code: 500, message: '添加收藏失败' });
  }
});

// 取消收藏
router.delete('/remove/:hotelId', auth, async (req, res) => {
  try {
    const { hotelId } = req.params;
    
    await Favorite.findOneAndDelete({
      userId: req.userId,
      hotelId: hotelId
    });

    res.json({ code: 200, message: '取消收藏成功' });
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.json({ code: 500, message: '取消收藏失败' });
  }
});

// 获取收藏列表
router.get('/list', auth, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    
    const skip = (Number(page) - 1) * Number(pageSize);
    
    const [favorites, total] = await Promise.all([
      Favorite.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(pageSize)),
      Favorite.countDocuments({ userId: req.userId })
    ]);

    // 获取酒店详情
    const hotelIds = favorites.map(f => f.hotelId);
    console.log('收藏的酒店IDs:', hotelIds);
    
    // 确保hotelId是有效的ObjectId
    const mongoose = require('mongoose');
    const validHotelIds = hotelIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    console.log('有效的酒店IDs:', validHotelIds);
    
    const hotels = await Hotel.find({ _id: { $in: validHotelIds } });
    console.log('数据库中的酒店:', hotels.map(h => h._id.toString()));

    // 构建返回数据，保留原始收藏时间
    const result = favorites.map(fav => {
      const hotel = hotels.find(h => h._id.toString() === fav.hotelId.toString());
      if (!hotel) {
        console.log('未找到酒店:', fav.hotelId);
        return null;
      }
      return {
        ...hotel.toObject(),
        favoritedAt: fav.createdAt,
        hotelId: fav.hotelId
      };
    }).filter(item => item !== null);

    res.json({
      code: 200,
      data: {
        items: result,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize))
      }
    });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.json({ code: 500, message: '获取收藏列表失败' });
  }
});

// 批量同步本地收藏
router.post('/sync', auth, async (req, res) => {
  try {
    const { hotelIds } = req.body;
    
    if (!hotelIds || !Array.isArray(hotelIds)) {
      return res.json({ code: 400, message: '无效的酒店ID列表' });
    }

    // 获取用户当前所有收藏
    const existingFavorites = await Favorite.find({ userId: req.userId });
    const existingHotelIds = existingFavorites.map(f => f.hotelId.toString());

    // 添加不存在的收藏
    const newFavorites = hotelIds
      .filter(id => !existingHotelIds.includes(id))
      .map(hotelId => ({
        userId: req.userId,
        hotelId: hotelId
      }));

    if (newFavorites.length > 0) {
      await Favorite.insertMany(newFavorites, { ordered: false });
    }

    // 获取更新后的所有收藏
    const allFavorites = await Favorite.find({ userId: req.userId });
    
    res.json({ 
      code: 200, 
      message: '同步成功',
      data: {
        count: allFavorites.length,
        hotelIds: allFavorites.map(f => f.hotelId)
      }
    });
  } catch (error) {
    console.error('同步收藏失败:', error);
    res.json({ code: 500, message: '同步收藏失败' });
  }
});

module.exports = router;

