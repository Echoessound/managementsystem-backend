import express from 'express';
import { BrowsingHistoryDB, FavoriteDB, HotelDB } from '../utils/dbFactory.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.json({ code: 401, message: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.json({ code: 401, message: 'token无效' });
  }
};

// 获取用户行为数据集（用于训练）
router.get('/behavior-data', auth, async (req, res) => {
  try {
    const { limit = 1000 } = req.query;

    const browsingHistory = await BrowsingHistoryDB.findMany({
      filter: { userId: req.userId },
      sort: { viewedAt: -1 },
      skip: 0,
      take: Number(limit),
      includeHotel: true
    });

    const favorites = await FavoriteDB.findMany({
      filter: { userId: req.userId }
    });

    // 补充收藏酒店详情
    const favoriteHotelIds = favorites.map(f => f.hotelId);
    const favoriteHotels = favoriteHotelIds.length ? await HotelDB.findMany({
      filter: { _id: { $in: favoriteHotelIds } },
      skip: 0,
      take: 1000
    }) : [];
    const favHotelMap = {};
    favoriteHotels.forEach(h => { favHotelMap[h._id || h.id] = h; });

    // 补充浏览历史酒店详情
    const browseHotelIds = browsingHistory
      .map(b => (typeof b.hotelId === 'object' ? b.hotelId?._id : b.hotelId))
      .filter(Boolean);
    const browseHotels = browseHotelIds.length ? await HotelDB.findMany({
      filter: { _id: { $in: browseHotelIds } },
      skip: 0,
      take: 1000
    }) : [];
    const browseHotelMap = {};
    browseHotels.forEach(h => { browseHotelMap[h._id || h.id] = h; });

    const behaviorData = {
      userId: req.userId,
      browseHistory: browsingHistory.map(item => {
        const hotelRef = item.hotelId;
        const hotel = typeof hotelRef === 'object' ? hotelRef : browseHotelMap[hotelRef];
        return {
          hotelId: hotel?._id || hotel?.id,
          hotelName: hotel?.name,
          price: hotel?.price,
          rating: hotel?.rating,
          city: hotel?.city,
          amenities: hotel?.amenities,
          viewedAt: item.viewedAt,
          duration: item.duration,
          source: item.source
        };
      }),
      favorites: favorites.map(item => {
        const hotel = favHotelMap[item.hotelId];
        return {
          hotelId: hotel?._id || hotel?.id,
          hotelName: hotel?.name,
          price: hotel?.price,
          rating: hotel?.rating,
          city: hotel?.city,
          amenities: hotel?.amenities,
          favoritedAt: item.createdAt
        };
      }),
      totalBrowsed: browsingHistory.length,
      totalFavorites: favorites.length
    };

    res.json({ code: 200, data: behaviorData });
  } catch (error) {
    console.error('获取行为数据失败:', error);
    res.json({ code: 500, message: '获取行为数据失败' });
  }
});

// 获取相似用户推荐（协同过滤简化版）
router.get('/similar-users', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const userFavorites = await FavoriteDB.findMany({ filter: { userId: req.userId } });
    const userHotelIds = userFavorites.map(f => String(f.hotelId));

    const similarFavorites = await FavoriteDB.findMany({
      filter: {
        userId: { $ne: req.userId },
        hotelId: { $in: userHotelIds }
      }
    });

    const userScore = {};
    similarFavorites.forEach(fav => {
      const otherUserId = String(fav.userId);
      userScore[otherUserId] = (userScore[otherUserId] || 0) + 1;
    });

    const sortedUsers = Object.entries(userScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Number(limit));

    res.json({
      code: 200,
      data: { similarUsers: sortedUsers.map(([userId, score]) => ({ userId, score })) }
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

    const hotels = await HotelDB.findMany({
      filter: query,
      sort: { rating: -1, reviewCount: -1 },
      skip: 0,
      take: Number(limit)
    });

    res.json({ code: 200, data: hotels });
  } catch (error) {
    console.error('获取热门推荐失败:', error);
    res.json({ code: 500, message: '获取热门推荐失败' });
  }
});

export default router;
