const mongoose = require('mongoose');

const browsingHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  viewedAt: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number,
    default: 0  // 浏览时长(秒)
  },
  source: {
    type: String,
    enum: ['search', 'detail', 'recommendation', 'home'],
    default: 'search'
  }
}, {
  timestamps: true
});

// 复合索引：用户浏览历史按时间倒序
browsingHistorySchema.index({ userId: 1, viewedAt: -1 });

module.exports = mongoose.model('BrowsingHistory', browsingHistorySchema);
