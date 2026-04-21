import express from 'express';
import { HotelDB } from '../utils/dbFactory.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

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

// 获取酒店列表
router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, city, status, ownerId, keyword, minPrice, maxPrice, rating, amenities, publishStatus } = req.query;
    const filter = {};

    if (city) filter.city = city;

    if (status) {
      if (status.includes(',')) filter.status = { $in: status.split(',') };
      else filter.status = status;
    } else if (!ownerId && !status && !publishStatus) {
      filter.status = 'published';
    }

    if (!ownerId && !publishStatus) filter.publishStatus = 'published';
    if (publishStatus) {
      if (publishStatus.includes(',')) filter.publishStatus = { $in: publishStatus.split(',') };
      else filter.publishStatus = publishStatus;
    }

    if (ownerId) filter.ownerId = ownerId;

    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { address: { $regex: keyword, $options: 'i' } }
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
    }

    if (rating !== undefined && Number(rating) > 0) filter.rating = { $gte: Number(rating) };

    if (amenities && amenities.length > 0) {
      const amenityList = Array.isArray(amenities) ? amenities : amenities.split(',');
      filter.amenities = { $all: amenityList };
    }

    const total = await HotelDB.count(filter);
    const hotels = await HotelDB.findMany({
      filter,
      sort: { createdAt: -1 },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    });

    res.json({
      code: 200,
      data: { items: hotels, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) }
    });
  } catch (error) {
    console.error('获取酒店列表失败:', error);
    res.json({ code: 500, message: '获取酒店列表失败' });
  }
});

// 获取酒店详情 - 新版路径（必须放在 /:id 前面）
router.get('/detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') return res.json({ code: 400, message: '无效的酒店ID' });
    const hotel = await HotelDB.findById(id);
    if (!hotel) return res.json({ code: 404, message: '酒店不存在' });
    if (hotel.publishStatus !== 'published') return res.json({ code: 403, message: '该酒店未发布' });
    res.json({ code: 200, data: hotel });
  } catch (error) {
    console.error('获取酒店详情失败:', error);
    res.json({ code: 500, message: '获取酒店详情失败' });
  }
});

// 审核酒店（通过/拒绝）
router.put('/:id/review', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, reason } = req.body;
    const hotel = await HotelDB.findById(id);
    if (!hotel) return res.json({ code: 404, message: '酒店不存在' });
    const updateData = approved
      ? { status: 'published', publishStatus: 'published' }
      : { status: 'rejected', rejectReason: reason || '' };
    const updated = await HotelDB.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    res.json({ code: 200, message: approved ? '审核通过' : '审核拒绝', data: updated });
  } catch (error) {
    console.error('审核酒店失败:', error);
    res.json({ code: 500, message: '审核失败' });
  }
});

// 获取酒店详情 - 兼容旧版前端路径 /hotel/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'list' || id === 'search' || id === 'city' || id === 'detail') return res.json({ code: 404, message: '路由不存在' });
    if (id === 'resubmit' || id === 'submit' || id === 'publish' || id === 'review') return res.json({ code: 404, message: '路由不存在' });
    if (!id || id === 'undefined' || id === 'null') return res.json({ code: 400, message: '无效的酒店ID' });
    const hotel = await HotelDB.findById(id);
    if (!hotel) return res.json({ code: 404, message: '酒店不存在' });
    res.json({ code: 200, data: hotel });
  } catch (error) {
    console.error('获取酒店详情失败:', error);
    res.json({ code: 500, message: '获取酒店详情失败' });
  }
});

// 创建酒店
router.post('/create', upload.fields([{ name: 'images', maxCount: 10 }, { name: 'roomImages', maxCount: 20 }]), auth, async (req, res) => {
  try {
    let roomTypes = [];
    if (req.body.roomTypes) {
      try { roomTypes = JSON.parse(req.body.roomTypes); } catch (e) { console.error('解析 roomTypes 失败:', e); }
    }
    const images = req.files['images'] ? req.files['images'].map(f => `/uploads/${f.filename}`) : [];
    if (roomTypes.length > 0 && req.files['roomImages']) {
      const roomImages = req.files['roomImages'];
      roomTypes.forEach((rt) => {
        rt.images = rt.images || [];
        roomImages.forEach((img, imgIndex) => { if (imgIndex < rt.images.length + 1) rt.images.push(`/uploads/${img.filename}`); });
      });
    }
    const hotelData = {
      name: req.body.name,
      description: req.body.description || '',
      city: req.body.city,
      address: req.body.address || '',
      contactPhone: req.body.contactPhone || '',
      price: Number(req.body.price) || 0,
      images,
      amenities: req.body.amenities ? (Array.isArray(req.body.amenities) ? req.body.amenities : [req.body.amenities]) : [],
      roomTypes,
      ownerId: req.userId,
      ownerName: req.body.ownerName || '',
      status: 'pending',
      publishStatus: 'draft'
    };
    const savedHotel = await HotelDB.create(hotelData);
    res.json({ code: 200, message: '酒店创建成功', data: savedHotel });
  } catch (error) {
    console.error('创建酒店失败:', error);
    res.json({ code: 500, message: '创建酒店失败: ' + error.message });
  }
});

// 发布/下架酒店
router.post('/:id/publish', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { publish } = req.body;
    const hotel = await HotelDB.findById(id);
    if (!hotel) return res.json({ code: 404, message: '酒店不存在' });
    if (hotel.ownerId.toString() !== req.userId) return res.json({ code: 403, message: '无权限操作' });
    if (hotel.status !== 'published' && hotel.status !== 'offline') return res.json({ code: 400, message: '酒店未通过审核，无法发布' });
    if (publish && hotel.publishStatus === 'published') return res.json({ code: 400, message: '酒店已发布' });
    if (!publish && hotel.publishStatus === 'draft') return res.json({ code: 400, message: '酒店已下架' });
    const updated = await HotelDB.findByIdAndUpdate(id, { $set: { publishStatus: publish ? 'published' : 'draft' } }, { new: true });
    res.json({ code: 200, message: publish ? '酒店已发布' : '酒店已下架', data: updated });
  } catch (error) {
    console.error('发布/下架酒店失败:', error);
    res.json({ code: 500, message: '操作失败' });
  }
});

// 更新酒店
router.put('/update/:id', auth, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'roomImages', maxCount: 30 }]), async (req, res) => {
  try {
    const { id } = req.params;
    const hotel = await HotelDB.findById(id);
    if (!hotel) return res.json({ code: 404, message: '酒店不存在' });
    if (hotel.ownerId.toString() !== req.userId) return res.json({ code: 403, message: '无权限修改' });
    let updateData = { ...req.body };
    if (req.files && req.files['images']) updateData.images = req.files['images'].map(f => `/uploads/${f.filename}`);
    if (req.files && req.files['roomImages']) {
      if (updateData.roomTypes && typeof updateData.roomTypes === 'string') {
        try {
          const roomTypes = JSON.parse(updateData.roomTypes);
          const roomImages = req.files['roomImages'];
          roomTypes.forEach((rt) => {
            rt.images = rt.images || [];
            roomImages.forEach((img, imgIndex) => { if (imgIndex < rt.images.length + 1) rt.images.push(`/uploads/${img.filename}`); });
          });
          updateData.roomTypes = roomTypes;
        } catch (e) { console.error('解析 roomTypes 失败:', e); }
      }
    }
    if (updateData.roomTypes && typeof updateData.roomTypes === 'string') {
      try {
        updateData.roomTypes = JSON.parse(updateData.roomTypes);
        updateData.roomTypes.forEach(rt => {
          if (rt.price) rt.price = Number(rt.price);
          if (rt.count) rt.count = Number(rt.count);
          if (rt.capacity) rt.capacity = Number(rt.capacity);
          if (rt.area) rt.area = Number(rt.area);
        });
      } catch (e) { console.error('解析 roomTypes 失败:', e); }
    }
    const updatedHotel = await HotelDB.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    res.json({ code: 200, message: '酒店更新成功', data: updatedHotel });
  } catch (error) {
    console.error('更新酒店失败:', error);
    res.json({ code: 500, message: '更新酒店失败' });
  }
});

// 删除酒店
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const hotel = await HotelDB.findById(id);
    if (!hotel) return res.json({ code: 404, message: '酒店不存在' });
    if (hotel.ownerId.toString() !== req.userId) return res.json({ code: 403, message: '无权限删除' });
    await HotelDB.findByIdAndDelete(id);
    res.json({ code: 200, message: '酒店删除成功' });
  } catch (error) {
    console.error('删除酒店失败:', error);
    res.json({ code: 500, message: '删除酒店失败' });
  }
});

// 提交审核
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const hotel = await HotelDB.findById(id);
    if (!hotel) return res.json({ code: 404, message: '酒店不存在' });
    if (hotel.ownerId.toString() !== req.userId) return res.json({ code: 403, message: '无权限操作' });
    await HotelDB.findByIdAndUpdate(id, { $set: { status: 'pending' } });
    res.json({ code: 200, message: '提交审核成功' });
  } catch (error) {
    console.error('提交审核失败:', error);
    res.json({ code: 500, message: '提交审核失败' });
  }
});

// 再次审核（重新提交）
router.post('/:id/resubmit', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const hotel = await HotelDB.findById(id);
    if (!hotel) return res.json({ code: 404, message: '酒店不存在' });
    if (hotel.ownerId.toString() !== req.userId) return res.json({ code: 403, message: '无权限操作' });
    if (hotel.status === 'published') return res.json({ code: 400, message: '酒店已通过审核，无需重新提交' });
    const updated = await HotelDB.findByIdAndUpdate(id, { $set: { status: 'pending', rejectReason: '' } }, { new: true });
    res.json({ code: 200, message: '已提交审核，请等待管理员审核', data: updated });
  } catch (error) {
    console.error('重新提交审核失败:', error);
    res.json({ code: 500, message: '重新提交审核失败' });
  }
});

export default router;
