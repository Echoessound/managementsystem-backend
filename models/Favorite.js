const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

// 复合索引：确保用户不能重复收藏同一家酒店
favoriteSchema.index({ userId: 1, hotelId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);

