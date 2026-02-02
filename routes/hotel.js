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

/**
 * 创建酒店
 * POST /api/hotel/create
 * Body: { name, description, address, city, price, rating, images, amenities, roomTypes, contactPhone, checkInTime, checkOutTime, ownerId }
 */
router.post('/create', async (req, res) => {
    const {
        name, description, address, city, price, rating,
        images, amenities, roomTypes, contactPhone,
        checkInTime, checkOutTime, ownerId, ownerName
    } = req.body;

    // 参数验证
    if (!name || !city || !price || !ownerId) {
        return res.json({ code: 400, message: '缺少必填参数（名称、城市、价格、ownerId）' });
    }

    try {
        const newHotel = new Hotel({
            name,
            description: description || '',
            address: address || '',
            city,
            price: Number(price),
            rating: Number(rating) || 0,
            images: images || [],
            amenities: amenities || [],
            roomTypes: roomTypes || [],
            contactPhone: contactPhone || '',
            checkInTime: checkInTime || '14:00',
            checkOutTime: checkOutTime || '12:00',
            ownerId,
            ownerName: ownerName || ''
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
router.put('/:id', async (req, res) => {
    try {
        const updatedHotel = await Hotel.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: new Date() },
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
