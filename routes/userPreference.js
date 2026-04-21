import express from 'express';
import { UserPreferenceDB } from '../utils/dbFactory.js';
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

// 获取用户偏好
router.get('/get', auth, async (req, res) => {
  try {
    const preference = await UserPreferenceDB.findOne({ userId: req.userId });
    if (!preference) {
      const newPref = await UserPreferenceDB.upsert({
        filter: { userId: req.userId },
        create: { userId: req.userId },
        update: {}
      });
      return res.json({ code: 200, data: newPref });
    }
    res.json({ code: 200, data: preference });
  } catch (error) {
    console.error('获取用户偏好失败:', error);
    res.json({ code: 500, message: '获取用户偏好失败' });
  }
});

// 更新用户偏好
router.post('/update', auth, async (req, res) => {
  try {
    const { priceRange, starPreference, amenities, cityPreference, avgPrice, totalBookings, lastSearchCity, lastSearchKeyword } = req.body;

    const updateData = {};
    if (priceRange) updateData.priceRange = priceRange;
    if (starPreference) updateData.starPreference = starPreference;
    if (amenities) updateData.amenities = amenities;
    if (cityPreference) updateData.cityPreference = cityPreference;
    if (avgPrice !== undefined) updateData.avgPrice = avgPrice;
    if (totalBookings !== undefined) updateData.totalBookings = totalBookings;
    if (lastSearchCity !== undefined) updateData.lastSearchCity = lastSearchCity;
    if (lastSearchKeyword !== undefined) updateData.lastSearchKeyword = lastSearchKeyword;

    const preference = await UserPreferenceDB.upsert({
      filter: { userId: req.userId },
      create: { userId: req.userId },
      update: updateData
    });

    res.json({ code: 200, message: '偏好更新成功', data: preference });
  } catch (error) {
    console.error('更新用户偏好失败:', error);
    res.json({ code: 500, message: '更新用户偏好失败' });
  }
});

export default router;
