const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userAvatar: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  content: {
    type: String,
    required: true,
    maxLength: 1000
  },
  images: [{
    type: String
  }],
  type: {
    type: String,
    enum: ['good', 'neutral', 'bad'],
    default: 'good'
  }
}, {
  timestamps: true
});

reviewSchema.index({ hotelId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);

