const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  priceRange: {
    type: [Number],
    default: [0, 2000]  // 价格区间 [min, max]
  },
  starPreference: {
    type: [Number],
    default: [3, 4, 5]  // 星级偏好
  },
  amenities: {
    type: [String],
    default: []  // 偏好设施
  },
  cityPreference: {
    type: [String],
    default: []  // 常去城市
  },
  avgPrice: {
    type: Number,
    default: 0  // 平均消费价格
  },
  totalBookings: {
    type: Number,
    default: 0  // 累计预订次数
  },
  lastSearchCity: {
    type: String,
    default: ''  // 最后搜索城市
  },
  lastSearchKeyword: {
    type: String,
    default: ''  // 最后搜索关键词
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('UserPreference', userPreferenceSchema);

