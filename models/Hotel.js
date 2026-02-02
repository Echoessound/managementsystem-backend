/**
 * 酒店数据模型
 */

const mongoose = require('mongoose');

const roomTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    count: {
        type: Number,
        required: true,
        min: 0
    },
    amenities: [String]
}, { _id: false });

const hotelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    description: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    city: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    images: [{
        type: String
    }],
    amenities: [{
        type: String
    }],
    roomTypes: [roomTypeSchema],
    contactPhone: {
        type: String,
        default: ''
    },
    checkInTime: {
        type: String,
        default: '14:00'
    },
    checkOutTime: {
        type: String,
        default: '12:00'
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    ownerName: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    publishStatus: {
        type: String,
        enum: ['published', 'unpublished'],
        default: 'unpublished'
    },
    rejectReason: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Hotel', hotelSchema);
