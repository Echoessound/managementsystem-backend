import express from 'express';
import { FavoriteDB, HotelDB } from '../utils/dbFactory.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const router = express.Router();

// 统一转换字符串为 ObjectId（用于数据库查询）
function toObjectId(id) {
  if (!id) return id;
  // 如果已经是 ObjectId，直接返回
  if (id instanceof mongoose.Types.ObjectId) return id;
  // 如果是 Buffer，转为十六进制字符串再转 ObjectId
  if (Buffer.isBuffer(id)) {
    return new mongoose.Types.ObjectId(id.toString('hex'));
  }
  // 如果是有效的 24 位十六进制字符串
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

// 安全转为字符串（Mongoose Document / 纯对象 均适用）
function toStr(v) {
  if (v == null) return '';
  if (typeof v === 'object' && v._id != null) return String(v._id);
  return String(v);
}

// 认证中间件
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

// 添加收藏
router.post('/add', auth, async (req, res) => {
  try {
    const { hotelId } = req.body;
    if (!hotelId) return res.json({ code: 400, message: '缺少酒店ID' });

    const filter = { userId: toObjectId(req.userId), hotelId: toObjectId(hotelId) };
    const existingFavorite = await FavoriteDB.findOne(filter);
    if (existingFavorite) return res.json({ code: 400, message: '已经收藏过该酒店' });

    await FavoriteDB.create({ userId: toObjectId(req.userId), hotelId: toObjectId(hotelId) });
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
    await FavoriteDB.findOneAndDelete({ userId: toObjectId(req.userId), hotelId: toObjectId(hotelId) });
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
    const userObjId = toObjectId(req.userId);

    console.log('[Favorite List] userId:', req.userId, '-> userObjId:', userObjId);

    const [favorites, total] = await Promise.all([
      FavoriteDB.findMany({ filter: { userId: userObjId }, sort: { createdAt: -1 }, skip, take: Number(pageSize) }),
      FavoriteDB.count({ userId: userObjId })
    ]);

    console.log('[Favorite List] favorites count:', favorites.length, 'total:', total);
    console.log('[Favorite List] favorites raw:', JSON.stringify(favorites.map(f => ({ hotelId: f.hotelId, createdAt: f.createdAt }))));

    if (favorites.length === 0) {
      return res.json({
        code: 200,
        data: { items: [], total, page: Number(page), pageSize: Number(pageSize), totalPages: 0 }
      });
    }

    // 提取所有 hotelId（统一转字符串）
    const hotelIdStrs = favorites.map(f => toStr(f.hotelId)).filter(Boolean);
    console.log('[Favorite List] hotelIdStrs:', hotelIdStrs);

    // 用字符串 _id 查询酒店（HotelDB 内部用 { _id: { $in: [...] } } 直接查）
    const hotels = await HotelDB.findMany({
      filter: { _id: { $in: hotelIdStrs } },
      skip: 0,
      take: 1000
    });

    console.log('[Favorite List] hotels found:', hotels.length);
    console.log('[Favorite List] hotels ids:', hotels.map(h => h._id.toString()));
    console.log('[Favorite List] first hotel raw:', JSON.stringify(hotels[0]?.toObject ? hotels[0].toObject() : hotels[0]));

    // 用字符串 _id 做 map key（解决 ObjectId vs 字符串比较问题）
    const hotelMap = {};
    hotels.forEach(h => {
      // 转换为普通 JS 对象（去除 Mongoose Document 的特殊属性）
      const hotelObj = h.toObject ? h.toObject() : h;
      hotelMap[toStr(hotelObj._id)] = hotelObj;
    });

    const result = favorites
      .map(fav => {
        const hotelIdKey = toStr(fav.hotelId);
        const hotel = hotelMap[hotelIdKey];
        if (!hotel) return null;
        return {
          ...hotel,
          _id: toStr(hotel._id),
          hotelId: hotelIdKey,
          favoritedAt: toStr(fav.createdAt),
        };
      })
      .filter(item => item !== null);

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
    if (!hotelIds || !Array.isArray(hotelIds)) return res.json({ code: 400, message: '无效的酒店ID列表' });
    const userObjId = toObjectId(req.userId);

    const existingFavorites = await FavoriteDB.findMany({ filter: { userId: userObjId } });
    const existingHotelIdStrs = existingFavorites.map(f => toStr(f.hotelId));

    const newFavorites = hotelIds
      .filter(id => !existingHotelIdStrs.includes(toStr(id)))
      .map(hotelId => ({ userId: userObjId, hotelId: toObjectId(hotelId) }));

    if (newFavorites.length > 0) await FavoriteDB.insertMany(newFavorites);

    const allFavorites = await FavoriteDB.findMany({ filter: { userId: userObjId } });

    res.json({
      code: 200,
      message: '同步成功',
      data: { count: allFavorites.length, hotelIds: allFavorites.map(f => toStr(f.hotelId)) }
    });
  } catch (error) {
    console.error('同步收藏失败:', error);
    res.json({ code: 500, message: '同步收藏失败' });
  }
});

export default router;
