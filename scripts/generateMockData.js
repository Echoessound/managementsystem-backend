/**
 * 生成模拟数据脚本
 * 运行: node scripts/generateMockData.js
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const BrowsingHistory = require('../models/BrowsingHistory');
const Favorite = require('../models/Favorite');
const UserPreference = require('../models/UserPreference');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/ctrip_hotel', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB 连接成功');
  return generateMockData();
}).then(() => {
  console.log('模拟数据生成完成');
  process.exit(0);
}).catch(err => {
  console.error('错误:', err);
  process.exit(1);
});

async function generateMockData() {
  // 清空现有数据
  await BrowsingHistory.deleteMany({});
  await Favorite.deleteMany({});
  await UserPreference.deleteMany({});
  
  console.log('已清空现有数据');
  
  // 获取所有酒店和用户
  const hotels = await Hotel.find({ status: 'published' }).limit(50);
  const users = await User.find().limit(20);
  
  if (hotels.length === 0) {
    console.log('没有找到酒店数据，请先确保酒店数据存在');
    return;
  }
  
  if (users.length === 0) {
    console.log('没有找到用户数据，请先确保用户数据存在');
    return;
  }
  
  // 生成浏览历史 (每个用户 5-15 条)
  const browsingHistories = [];
  for (const user of users) {
    const browseCount = Math.floor(Math.random() * 11) + 5;
    const shuffledHotels = [...hotels].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < browseCount && i < shuffledHotels.length; i++) {
      const hotel = shuffledHotels[i];
      const viewedAt = new Date();
      viewedAt.setDate(viewedAt.getDate() - Math.floor(Math.random() * 30)); // 最近30天内
      
      browsingHistories.push({
        userId: user._id,
        hotelId: hotel._id,
        viewedAt: viewedAt,
        duration: Math.floor(Math.random() * 300) + 10, // 10-310秒
        source: ['search', 'detail', 'recommendation', 'home'][Math.floor(Math.random() * 4)]
      });
    }
  }
  
  await BrowsingHistory.insertMany(browsingHistories);
  console.log(`生成 ${browsingHistories.length} 条浏览历史`);
  
  // 生成收藏记录 (每个用户 3-10 条)
  const favorites = [];
  for (const user of users) {
    const favCount = Math.floor(Math.random() * 8) + 3;
    const shuffledHotels = [...hotels].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < favCount && i < shuffledHotels.length; i++) {
      const hotel = shuffledHotels[i];
      
      favorites.push({
        userId: user._id,
        hotelId: hotel._id
      });
    }
  }
  
  await Favorite.insertMany(favorites);
  console.log(`生成 ${favorites.length} 条收藏记录`);
  
  // 生成用户偏好
  const preferences = [];
  for (const user of users) {
    preferences.push({
      userId: user._id,
      priceRange: [
        Math.floor(Math.random() * 500),
        Math.floor(Math.random() * 1000) + 500
      ],
      starPreference: [3, 4, 5].filter(() => Math.random() > 0.5),
      amenities: ['wifi', 'parking', 'pool', 'gym', 'restaurant'].slice(0, Math.floor(Math.random() * 5) + 1),
      cityPreference: ['北京', '上海', '广州', '深圳'].slice(0, Math.floor(Math.random() * 3) + 1),
      avgPrice: Math.floor(Math.random() * 1000) + 200,
      totalBookings: Math.floor(Math.random() * 20)
    });
  }
  
  await UserPreference.insertMany(preferences);
  console.log(`生成 ${preferences.length} 条用户偏好`);
  
  console.log('所有模拟数据生成完成!');
}

