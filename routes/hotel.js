const express = require('express');
const router = express.Router();
const Hotel = require('../models/Hotel');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

// 配置 multer 用于处理文件上传
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

// 获取酒店列表
router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, city, status, ownerId, keyword, minPrice, maxPrice, rating, amenities, publishStatus } = req.query;
    
    const query = {};
    
    // 城市筛选
    if (city) {
      query.city = city;
    }
    
    // 状态筛选
    if (status) {
      // 支持多状态查询，用逗号分隔，如 "pending,rejected"
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    } else if (!ownerId && !status && !publishStatus) {
      // 默认只返回已发布的酒店（商户查看自己酒店时不受此限制）
      query.status = 'published';
    }
    // 如果有 ownerId，则返回该商户的所有酒店（包括待审核的）
    
    // 发布状态筛选 - 用户端只显示已发布的酒店
    if (!ownerId && !publishStatus) {
      query.publishStatus = 'published';
    }
    
    // 允许指定 publishStatus 查询（如管理员查询草稿酒店）
    if (publishStatus) {
      if (publishStatus.includes(',')) {
        query.publishStatus = { $in: publishStatus.split(',') };
      } else {
        query.publishStatus = publishStatus;
      }
    }
    
    // 商家ID筛选
    if (ownerId) {
      query.ownerId = ownerId;
    }
    
    // 关键词搜索
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { address: { $regex: keyword, $options: 'i' } }
      ];
    }
    
    // 价格区间筛选
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
    }
    
    // 评分筛选
    if (rating !== undefined && Number(rating) > 0) {
      query.rating = { $gte: Number(rating) };
    }
    
    // 设施筛选
    if (amenities && amenities.length > 0) {
      const amenityList = Array.isArray(amenities) ? amenities : amenities.split(',');
      query.amenities = { $all: amenityList };
    }
    
    const total = await Hotel.countDocuments(query);
    const hotels = await Hotel.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(pageSize))
      .limit(Number(pageSize));
    
    res.json({
      code: 200,
      data: {
        items: hotels,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize))
      }
    });
  } catch (error) {
    console.error('获取酒店列表失败:', error);
    res.json({ code: 500, message: '获取酒店列表失败' });
  }
});

// 获取酒店详情 - 新版路径 /hotel/detail/:id (必须放在 /:id 前面)
router.get('/detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID格式
    if (!id || id === 'undefined' || id === 'null') {
      return res.json({ code: 400, message: '无效的酒店ID' });
    }
    
    // 验证是否是有效的ObjectId格式
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.json({ code: 400, message: '酒店ID格式无效' });
    }
    
    const hotel = await Hotel.findById(id);
    
    if (!hotel) {
      return res.json({ code: 404, message: '酒店不存在' });
    }
    
    // 检查酒店是否已发布，未发布的酒店不允许查看详情
    if (hotel.publishStatus !== 'published') {
      return res.json({ code: 403, message: '该酒店未发布' });
    }
    
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
    
    console.log('审核酒店:', { id, approved, reason });
    
    const hotel = await Hotel.findById(id);
    
    if (!hotel) {
      return res.json({ code: 404, message: '酒店不存在' });
    }
    
    // 审核通过
    if (approved) {
      hotel.status = 'published';
      hotel.publishStatus = 'published';  // 审核通过后自动发布
    } else {
      hotel.status = 'rejected';
      hotel.rejectReason = reason || '';
    }
    
    await hotel.save();
    
    console.log('审核成功:', hotel.status);
    
    res.json({ 
      code: 200, 
      message: approved ? '审核通过' : '审核拒绝',
      data: hotel
    });
  } catch (error) {
    console.error('审核酒店失败:', error);
    res.json({ code: 500, message: '审核失败' });
  }
});

// 获取酒店详情 - 兼容旧版前端路径 /hotel/:id
router.get('/:id', async (req, res) => {
  console.log('Caught by GET /:id:', req.params.id);
  try {
    const { id } = req.params;
    
    // 忽略 list 路由
    if (id === 'list' || id === 'search' || id === 'city' || id === 'detail') {
      return res.json({ code: 404, message: '路由不存在' });
    }

    // 忽略特定动作路由，防止被 /:id 匹配
    if (id === 'resubmit' || id === 'submit' || id === 'publish' || id === 'review') {
      return res.json({ code: 404, message: '路由不存在' });
    }

    // 验证ID格式
    if (!id || id === 'undefined' || id === 'null') {
      return res.json({ code: 400, message: '无效的酒店ID' });
    }
    
    // 验证是否是有效的ObjectId格式
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.json({ code: 400, message: '酒店ID格式无效' });
    }
    
    const hotel = await Hotel.findById(id);
    
    if (!hotel) {
      return res.json({ code: 404, message: '酒店不存在' });
    }
    
    res.json({ code: 200, data: hotel });
  } catch (error) {
    console.error('获取酒店详情失败:', error);
    res.json({ code: 500, message: '获取酒店详情失败' });
  }
});

// 创建酒店 - 处理多文件上传
router.post('/create', upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'roomImages', maxCount: 20 }
]), auth, async (req, res) => {
  try {
    console.log('接收到的数据:', req.body);
    console.log('上传的文件:', req.files);
    
    // 解析 roomTypes JSON 字符串
    let roomTypes = [];
    if (req.body.roomTypes) {
      try {
        roomTypes = JSON.parse(req.body.roomTypes);
      } catch (e) {
        console.error('解析 roomTypes 失败:', e);
      }
    }
    
    // 处理酒店图片
    const images = req.files['images'] ? req.files['images'].map(f => `/uploads/${f.filename}`) : [];
    
    // 处理房型图片
    if (roomTypes && roomTypes.length > 0 && req.files['roomImages']) {
      const roomImages = req.files['roomImages'];
      roomTypes.forEach((rt, index) => {
        rt.images = rt.images || [];
        // 简单分配：按顺序分配图片到房型
        roomImages.forEach((img, imgIndex) => {
          if (imgIndex < rt.images.length + 1) {
            rt.images.push(`/uploads/${img.filename}`);
          }
        });
      });
    }
    
    const hotelData = {
      name: req.body.name,
      description: req.body.description || '',
      city: req.body.city,
      address: req.body.address || '',
      contactPhone: req.body.contactPhone || '',
      price: Number(req.body.price) || 0,
      images: images,
      amenities: req.body.amenities ? (Array.isArray(req.body.amenities) ? req.body.amenities : [req.body.amenities]) : [],
      roomTypes: roomTypes,
      ownerId: req.userId,
      ownerName: req.body.ownerName || '',
      status: 'pending',  // 新创建的酒店需要审核
      publishStatus: 'draft'  // 默认草稿状态
    };
    
    console.log('准备保存酒店数据:', JSON.stringify(hotelData));
    
    const newHotel = new Hotel(hotelData);
    const savedHotel = await newHotel.save();
    
    console.log('酒店创建成功, ID:', savedHotel._id);
    console.log('酒店完整数据:', JSON.stringify(savedHotel));
    
    res.json({ code: 200, message: '酒店创建成功', data: newHotel });
  } catch (error) {
    console.error('创建酒店失败:', error);
    console.error('错误详情:', error.message, error.stack);
    res.json({ code: 500, message: '创建酒店失败: ' + error.message });
  }
});

// 发布/下架酒店
console.log('Registering route: POST /:id/publish');
router.post('/:id/publish', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { publish } = req.body;
    
    const hotel = await Hotel.findById(id);
    
    if (!hotel) {
      return res.json({ code: 404, message: '酒店不存在' });
    }
    
    // 检查权限
    if (hotel.ownerId.toString() !== req.userId) {
      return res.json({ code: 403, message: '无权限操作' });
    }
    
    // 只有审核通过或已下线的酒店才能发布/下架
    if (hotel.status !== 'published' && hotel.status !== 'offline') {
      return res.json({ code: 400, message: '酒店未通过审核，无法发布' });
    }
    
    // 如果要发布（publish=true）且当前发布状态已是published，则不允许重复发布
    if (publish && hotel.publishStatus === 'published') {
      return res.json({ code: 400, message: '酒店已发布' });
    }
    
    // 如果要下架（publish=false）且当前发布状态已是draft，则不允许重复下架
    if (!publish && hotel.publishStatus === 'draft') {
      return res.json({ code: 400, message: '酒店已下架' });
    }
    
    hotel.publishStatus = publish ? 'published' : 'draft';
    await hotel.save();
    
    res.json({ 
      code: 200, 
      message: publish ? '酒店已发布' : '酒店已下架',
      data: hotel 
    });
  } catch (error) {
    console.error('发布/下架酒店失败:', error);
    res.json({ code: 500, message: '操作失败' });
  }
});

// 更新酒店
router.put('/update/:id', auth, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'roomImages', maxCount: 30 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('更新酒店请求 - ID:', id);
    console.log('Token 用户ID:', req.userId);
    console.log('请求体:', req.body);
    
    const hotel = await Hotel.findById(id);
    
    if (!hotel) {
      return res.json({ code: 404, message: '酒店不存在' });
    }
    
    console.log('酒店 ownerId:', hotel.ownerId);
    console.log('酒店 ownerId 类型:', typeof hotel.ownerId);
    console.log('req.userId 类型:', typeof req.userId);
    
    // 检查权限
    if (hotel.ownerId.toString() !== req.userId) {
      return res.json({ code: 403, message: '无权限修改' });
    }
    
    // 处理更新数据
    let updateData = { ...req.body };
    
    // 处理酒店图片
    if (req.files && req.files['images']) {
      const images = req.files['images'].map(f => `/uploads/${f.filename}`);
      updateData.images = images;
    }
    
    // 处理房型图片
    if (req.files && req.files['roomImages']) {
      // 需要解析 roomTypes 并更新图片
      if (updateData.roomTypes && typeof updateData.roomTypes === 'string') {
        try {
          const roomTypes = JSON.parse(updateData.roomTypes);
          const roomImages = req.files['roomImages'];
          roomTypes.forEach((rt, index) => {
            rt.images = rt.images || [];
            roomImages.forEach((img, imgIndex) => {
              if (imgIndex < rt.images.length + 1) {
                rt.images.push(`/uploads/${img.filename}`);
              }
            });
          });
          updateData.roomTypes = roomTypes;
        } catch (e) {
          console.error('解析 roomTypes 失败:', e);
        }
      }
    }
    
    // 解析 roomTypes 字符串
    if (updateData.roomTypes && typeof updateData.roomTypes === 'string') {
      try {
        console.log('更新酒店 - 接收到的 roomTypes 字符串:', updateData.roomTypes);
        updateData.roomTypes = JSON.parse(updateData.roomTypes);
        
        // 确保 price 和 count 是数字类型
        updateData.roomTypes.forEach(rt => {
            if (rt.price) rt.price = Number(rt.price);
            if (rt.count) rt.count = Number(rt.count);
            if (rt.capacity) rt.capacity = Number(rt.capacity);
            if (rt.area) rt.area = Number(rt.area);
        });
        
        console.log('更新酒店 - 解析后的 roomTypes 对象:', updateData.roomTypes);
      } catch (e) {
        console.error('解析 roomTypes 失败:', e);
      }
    }
    
    const updatedHotel = await Hotel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    
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
    const hotel = await Hotel.findById(id);
    
    if (!hotel) {
      return res.json({ code: 404, message: '酒店不存在' });
    }
    
    // 检查权限
    if (hotel.ownerId.toString() !== req.userId) {
      return res.json({ code: 403, message: '无权限删除' });
    }
    
    await Hotel.findByIdAndDelete(id);
    
    res.json({ code: 200, message: '酒店删除成功' });
  } catch (error) {
    console.error('删除酒店失败:', error);
    res.json({ code: 500, message: '删除酒店失败' });
  }
});

// 提交审核
console.log('Registering route: POST /:id/submit');
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const hotel = await Hotel.findById(id);
    
    if (!hotel) {
      return res.json({ code: 404, message: '酒店不存在' });
    }
    
    if (hotel.ownerId.toString() !== req.userId) {
      return res.json({ code: 403, message: '无权限操作' });
    }
    
    hotel.status = 'pending';
    await hotel.save();
    
    res.json({ code: 200, message: '提交审核成功' });
  } catch (error) {
    console.error('提交审核失败:', error);
    res.json({ code: 500, message: '提交审核失败' });
  }
});

console.log('--- Hotel.js loaded ---');
console.log('Loading Hotel module...');

// 再次审核（重新提交）
console.log('Registering route: POST /:id/resubmit');
router.post('/:id/resubmit', auth, async (req, res) => {
  console.log('HIT /:id/resubmit route with id:', req.params.id);
  console.log('收到重新提交审核请求:', req.params.id);
  try {
    const { id } = req.params;
    const hotel = await Hotel.findById(id);
    
    if (!hotel) {
      return res.json({ code: 404, message: '酒店不存在' });
    }
    
    if (hotel.ownerId.toString() !== req.userId) {
      return res.json({ code: 403, message: '无权限操作' });
    }
    
    // 只有已发布状态的酒店不能重新提交
    if (hotel.status === 'published') {
      return res.json({ code: 400, message: '酒店已通过审核，无需重新提交' });
    }
    
    hotel.status = 'pending';
    hotel.rejectReason = '';
    await hotel.save();
    
    res.json({ code: 200, message: '已提交审核，请等待管理员审核', data: hotel });
  } catch (error) {
    console.error('重新提交审核失败:', error);
    res.json({ code: 500, message: '重新提交审核失败' });
  }
});

module.exports = router;

