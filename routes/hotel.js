/**
 * 酒店管理路由
 * POST /api/hotel/create - 创建酒店
 * GET /api/hotel/list - 获取酒店列表
 * GET /api/hotel/:id - 获取酒店详情
 * PUT /api/hotel/:id - 更新酒店
 * DELETE /api/hotel/:id - 删除酒店
 */

const express = require('express');
const router = express.Router();
const Hotel = require('../models/Hotel');
const multer = require('multer');
const path = require('path');

// 配置文件上传中间件 (内联定义，避免循环依赖或文件缺失问题)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

/**
 * 创建酒店
 * POST /api/hotel/create
 * Body: { name, description, address, city, price, rating, images, amenities, roomTypes, contactPhone, checkInTime, checkOutTime, ownerId }
 */
router.post('/create', upload.any(), async (req, res) => {
    const {
        name, description, address, city, price, rating,
        amenities, contactPhone,
        checkInTime, checkOutTime, ownerId, ownerName
    } = req.body;

    // 手动解析 roomTypes (如果 req.body.roomTypes 不是数组而是对象)
    let roomTypes = req.body.roomTypes;
    if (!Array.isArray(roomTypes) && roomTypes) {
        // 处理 MultiPart 解析出的嵌套对象格式
        const parsedRoomTypes = [];
        Object.keys(roomTypes).forEach(key => {
            if (key.startsWith('roomTypes[')) {
                // 提取索引
                const match = key.match(/\[(\d+)\]\[(\w+)\]/);
                if (match) {
                    const index = parseInt(match[1]);
                    const field = match[2];
                    if (!parsedRoomTypes[index]) parsedRoomTypes[index] = {};
                    parsedRoomTypes[index][field] = roomTypes[key];
                }
            }
        });
        roomTypes = parsedRoomTypes.filter(rt => Object.keys(rt).length > 0);
    } else if (!roomTypes) {
        roomTypes = [];
    }

    // 参数验证
    // 参数验证
    if (!name || !city || !price || !ownerId) {
        return res.json({ code: 400, message: '缺少必填参数'+ name + city + price + ownerId + roomTypes });
    }

    try {
        // 处理图片文件路径
        const images = req.files
            ? req.files.filter(f => f.fieldname === 'images').map(f => `/uploads/${f.filename}`)
            : [];

        const newHotel = new Hotel({
            name,
            description,
            address,
            city,
            price,
            rating,
            images,
            amenities,
            roomTypes,
            contactPhone,
            checkInTime,
            checkOutTime,
            ownerId,
            ownerName
        });

        await newHotel.save();

        console.log(`[创建酒店] ID: ${newHotel._id}, 名称: ${name}, 城市: ${city}`);
        res.json({
            code: 200,
            message: '酒店信息录入成功',
            data: newHotel
        });
    } catch (error) {
        console.error('创建酒店失败:', error);
        res.json({ code: 500, message: '创建酒店失败' });
    }
});

/**
 * 获取酒店列表
 * GET /api/hotel/list
 * Query: { page, pageSize, city, status, ownerId }
 */
router.get('/list', async (req, res) => {
    const { page = 1, pageSize = 10, city, status, ownerId } = req.query;

    try {
        const query = {};
        if (city) query.city = city;
        if (status) query.status = status;
        if (ownerId) query.ownerId = ownerId;

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

/**
 * 获取酒店详情
 * GET /api/hotel/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id);

        if (!hotel) {
            return res.json({ code: 404, message: '酒店不存在' });
        }

        res.json({
            code: 200,
            data: hotel
        });
    } catch (error) {
        console.error('获取酒店详情失败:', error);
        res.json({ code: 500, message: '获取酒店详情失败' });
    }
});

/**
 * 更新酒店
 * PUT /api/hotel/:id
 */
router.put('/:id', upload.any(), async (req, res) => {
    try {
        // 处理上传的文件
        const uploadedImages = req.files
            ? req.files.filter(f => f.fieldname === 'images').map(f => `/uploads/${f.filename}`)
            : [];

        let updateData = { ...req.body, updatedAt: new Date() };

        // 解析 roomTypes (如果 req.body.roomTypes 不是数组而是对象)
        if (updateData.roomTypes && !Array.isArray(updateData.roomTypes)) {
            const parsedRoomTypes = [];
            Object.keys(updateData.roomTypes).forEach(key => {
                if (key.startsWith('roomTypes[')) {
                    const match = key.match(/\[(\d+)\]\[(\w+)\]/);
                    if (match) {
                        const index = parseInt(match[1]);
                        const field = match[2];
                        if (!parsedRoomTypes[index]) parsedRoomTypes[index] = {};
                        parsedRoomTypes[index][field] = updateData.roomTypes[key];
                    }
                }
            });
            updateData.roomTypes = parsedRoomTypes.filter(rt => Object.keys(rt).length > 0);
        }

        // 处理图片更新逻辑
        if (uploadedImages.length > 0) {
            updateData.images = uploadedImages;
        } else if (updateData.images && typeof updateData.images === 'string') {
            // 尝试解析前端传来的 JSON 字符串（包含原图片URL列表）
            try {
                updateData.images = JSON.parse(updateData.images);
            } catch (e) {
                console.warn('解析 images 失败', e);
            }
        } else {
            // 如果既没有新图片，也没有传递原图片列表，则从 updateData 中移除 images 字段
            // 以免覆盖数据库中的原图片
            delete updateData.images;
        }

        const updatedHotel = await Hotel.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!updatedHotel) {
            return res.json({ code: 404, message: '酒店不存在' });
        }

        console.log(`[更新酒店] ID: ${updatedHotel._id}, 名称: ${updatedHotel.name}`);
        res.json({
            code: 200,
            message: '更新成功',
            data: updatedHotel
        });
    } catch (error) {
        console.error('更新酒店失败:', error);
        res.json({ code: 500, message: '更新酒店失败' });
    }
});

/**
 * 删除酒店
 * DELETE /api/hotel/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const deletedHotel = await Hotel.findByIdAndDelete(req.params.id);

        if (!deletedHotel) {
            return res.json({ code: 404, message: '酒店不存在' });
        }

        console.log(`[删除酒店] ID: ${deletedHotel._id}, 名称: ${deletedHotel.name}`);
        res.json({
            code: 200,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除酒店失败:', error);
        res.json({ code: 500, message: '删除酒店失败' });
    }
});

module.exports = router;
