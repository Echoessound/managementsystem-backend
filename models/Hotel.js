const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true,
    index: true
  },
  district: {
    type: String,
    default: ''
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
  description: {
    type: String,
    default: ''
  },
  amenities: [{
    type: String
  }],
  contactPhone: {
    type: String,
    default: ''
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerName: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'published', 'rejected', 'offline'],
    default: 'pending',
    index: true
  },
  rejectReason: {
    type: String,
    default: ''
  },
  publishStatus: {
    type: String,
    enum: ['published', 'draft'],
    default: 'draft'
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  latitude: {
    type: Number,
    default: 0
  },
  longitude: {
    type: Number,
    default: 0
  },
  roomTypes: [{
    name: String,
    description: String,
    price: Number,
    capacity: Number,
    count: Number, // 房间数量
    bedType: String,
    area: Number,
    images: [String],
    amenities: [String]
  }]
}, {
  timestamps: true
});

// 索引
hotelSchema.index({ city: 1, status: 1 });
hotelSchema.index({ ownerId: 1 });
hotelSchema.index({ price: 1 });
hotelSchema.index({ rating: -1 });

module.exports = mongoose.model('Hotel', hotelSchema);

