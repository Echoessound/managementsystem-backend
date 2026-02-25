/**
 * 完整数据生成脚本
 * 运行: node scripts/seedData.js
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// 图片源目录 - 使用后端 uploads 目录中的图片
const HOTEL_IMAGES_DIR = '/Users/echo/Desktop/hotel/未命名文件夹/酒店照片';
const ROOM_IMAGES_DIR = path.join(__dirname, '../uploads');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/ctrip_hotel', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB 连接成功'))
  .catch(err => { console.error(err); process.exit(1); });

// 用户模型
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  phone: String,
  role: { type: String, default: 'user' },
  avatar: String,
  gender: String,
  email: String,
  status: { type: String, default: 'active' }
});
const User = mongoose.model('User', userSchema);

// 酒店模型
const hotelSchema = new mongoose.Schema({
  name: String,
  address: String,
  city: String,
  district: String,
  price: Number,
  rating: Number,
  images: [String],
  description: String,
  amenities: [String],
  contactPhone: String,
  ownerId: mongoose.Schema.Types.ObjectId,
  status: { type: String, default: 'published' },
  publishStatus: { type: String, default: 'published' },
  reviewCount: Number,
  latitude: Number,
  longitude: Number,
  roomTypes: [{
    name: String,
    description: String,
    price: Number,
    capacity: Number,
    bedType: String,
    area: Number,
    images: [String],
    amenities: [String]
  }]
}, { timestamps: true });
const Hotel = mongoose.model('Hotel', hotelSchema);

// 评论模型
const reviewSchema = new mongoose.Schema({
  hotelId: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  userName: String,
  rating: Number,
  content: String,
  images: [String],
  type: { type: String, default: 'good' }
}, { timestamps: true });
const Review = mongoose.model('Review', reviewSchema);

// 收藏模型
const favoriteSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  hotelId: mongoose.Schema.Types.ObjectId
}, { timestamps: true });
const Favorite = mongoose.model('Favorite', favoriteSchema);

// 浏览历史模型
const browsingHistorySchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  hotelId: mongoose.Schema.Types.ObjectId,
  viewedAt: Date,
  duration: Number,
  source: String
}, { timestamps: true });
const BrowsingHistory = mongoose.model('BrowsingHistory', browsingHistorySchema);

// 用户偏好模型
const userPreferenceSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  priceRange: [Number],
  starPreference: [Number],
  amenities: [String],
  cityPreference: [String],
  avgPrice: Number,
  totalBookings: Number
}, { timestamps: true });
const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

// 酒店数据模板
const hotelTemplates = [
  { city: '北京', name: '王府井希尔顿酒店', district: '东城区', price: 1288, rating: 4.8 },
  { city: '北京', name: '三里屯洲际酒店', district: '朝阳区', price: 1588, rating: 4.9 },
  { city: '北京', name: '金融街威斯汀酒店', district: '西城区', price: 988, rating: 4.7 },
  { city: '北京', name: '国贸大酒店', district: '朝阳区', price: 1188, rating: 4.8 },
  { city: '北京', name: '长城饭店', district: '朝阳区', price: 788, rating: 4.5 },
  { city: '上海', name: '外滩华尔道夫酒店', district: '黄浦区', price: 2888, rating: 4.9 },
  { city: '上海', name: '浦东香格里拉大酒店', district: '浦东新区', price: 1688, rating: 4.8 },
  { city: '上海', name: '静安香格里拉大酒店', district: '静安区', price: 1588, rating: 4.7 },
  { city: '上海', name: '浦东丽思卡尔顿酒店', district: '浦东新区', price: 2588, rating: 4.9 },
  { city: '上海', name: '外滩悦榕庄酒店', district: '黄浦区', price: 2288, rating: 4.8 },
  { city: '广州', name: '天河希尔顿酒店', district: '天河区', price: 888, rating: 4.6 },
  { city: '广州', name: '珠江新城四季酒店', district: '天河区', price: 1888, rating: 4.8 },
  { city: '广州', name: '白天鹅宾馆', district: '荔湾区', price: 988, rating: 4.7 },
  { city: '广州', name: '广州花园酒店', district: '越秀区', price: 788, rating: 4.5 },
  { city: '深圳', name: '福田香格里拉大酒店', district: '福田区', price: 1288, rating: 4.7 },
  { city: '深圳', name: '华侨城洲际酒店', district: '南山区', price: 1488, rating: 4.8 },
  { city: '深圳', name: '深圳湾万象城希尔顿', district: '南山区', price: 1088, rating: 4.6 },
  { city: '深圳', name: '东部华侨城茵特拉根酒店', district: '盐田区', price: 1388, rating: 4.7 },
  { city: '杭州', name: '西湖四季酒店', district: '西湖区', price: 1688, rating: 4.9 },
  { city: '杭州', name: '西子湖四季酒店', district: '西湖区', price: 2588, rating: 4.9 },
  { city: '杭州', name: '杭州西溪悦榕庄', district: '西湖区', price: 1988, rating: 4.8 },
  { city: '杭州', name: '杭州香格里拉饭店', district: '西湖区', price: 988, rating: 4.6 },
  { city: '成都', name: '香格里拉大酒店', district: '锦江区', price: 988, rating: 4.7 },
  { city: '成都', name: '博舍酒店', district: '锦江区', price: 1288, rating: 4.8 },
  { city: '成都', name: '成都瑞吉酒店', district: '锦江区', price: 1588, rating: 4.8 },
  { city: '成都', name: '成都香格里拉大酒店', district: '锦江区', price: 1088, rating: 4.7 },
  { city: '重庆', name: '解放碑威斯汀酒店', district: '渝中区', price: 788, rating: 4.6 },
  { city: '重庆', name: '江北希尔顿酒店', district: '江北区', price: 688, rating: 4.5 },
  { city: '重庆', name: '重庆丽思卡尔顿酒店', district: '江北区', price: 1888, rating: 4.9 },
  { city: '重庆', name: '重庆JW万豪酒店', district: '渝中区', price: 888, rating: 4.7 },
  { city: '西安', name: '威斯汀大酒店', district: '高新区', price: 888, rating: 4.7 },
  { city: '西安', name: '钟楼饭店', district: '碑林区', price: 588, rating: 4.5 },
  { city: '西安', name: '西安香格里拉大酒店', district: '高新区', price: 988, rating: 4.7 },
  { city: '西安', name: '西安凯悦酒店', district: '碑林区', price: 788, rating: 4.6 },
  { city: '南京', name: '金陵饭店', district: '鼓楼区', price: 788, rating: 4.6 },
  { city: '南京', name: '河西希尔顿酒店', district: '建邺区', price: 688, rating: 4.5 },
  { city: '南京', name: '南京香格里拉大酒店', district: '鼓楼区', price: 888, rating: 4.7 },
  { city: '南京', name: '南京绿地洲际酒店', district: '鼓楼区', price: 788, rating: 4.6 },
  { city: '苏州', name: '苏州工业园区香格里拉', district: '工业园区', price: 988, rating: 4.7 },
  { city: '苏州', name: '苏州洲际酒店', district: '工业园区', price: 888, rating: 4.6 },
  { city: '苏州', name: '苏州希尔顿酒店', district: '姑苏区', price: 688, rating: 4.5 },
  { city: '厦门', name: '厦门康莱德酒店', district: '思明区', price: 1288, rating: 4.8 },
  { city: '厦门', name: '厦门香格里拉大酒店', district: '思明区', price: 988, rating: 4.7 },
  { city: '厦门', name: '厦门海悦山庄酒店', district: '思明区', price: 788, rating: 4.6 },
  { city: '三亚', name: '亚特兰蒂斯酒店', district: '海棠湾', price: 3888, rating: 4.9 },
  { city: '三亚', name: '海棠湾希尔顿度假酒店', district: '海棠湾', price: 1888, rating: 4.7 },
  { city: '三亚', name: '三亚香格里拉度假酒店', district: '海棠湾', price: 1588, rating: 4.7 },
  { city: '三亚', name: '三亚瑞吉度假酒店', district: '亚龙湾', price: 2688, rating: 4.8 },
  { city: '武汉', name: '光谷希尔顿酒店', district: '东湖新区', price: 688, rating: 4.5 },
  { city: '武汉', name: '武汉香格里拉大酒店', district: '江岸区', price: 788, rating: 4.6 },
  { city: '武汉', name: '武汉万达瑞华酒店', district: '武昌区', price: 988, rating: 4.7 },
  { city: '长沙', name: '梅溪湖金茂豪华精选酒店', district: '岳麓区', price: 888, rating: 4.6 },
  { city: '长沙', name: '长沙希尔顿酒店', district: '芙蓉区', price: 688, rating: 4.5 },
  { city: '长沙', name: '长沙香格里拉大酒店', district: '岳麓区', price: 888, rating: 4.6 },
];

const amenitiesList = ['wifi', 'parking', 'pool', 'gym', 'restaurant', 'airconditioning', 'elevator', 'shuttle', 'spa', 'bar'];
const roomTypesList = [
  { name: '豪华大床房', bedType: '大床', capacity: 2, area: 35 },
  { name: '豪华双床房', bedType: '双床', capacity: 2, area: 38 },
  { name: '行政大床房', bedType: '大床', capacity: 2, area: 45 },
  { name: '行政套房', bedType: '大床', capacity: 2, area: 65 },
  { name: '豪华套房', bedType: '大床', capacity: 3, area: 80 },
  { name: '总统套房', bedType: '大床', capacity: 4, area: 150 },
];

const reviewContents = [
  '酒店位置非常好，出行很方便，服务也很周到，房间干净整洁，推荐！',
  '性价比很高，设施齐全，早餐种类丰富，下次还会选择。',
  '房间很大，床睡起来很舒服，浴室也很干净，总体很满意。',
  '地理位置优越，靠近地铁站，周边配套设施完善。',
  '服务人员态度热情专业，房间装修很有品味，会推荐给朋友。',
  '环境优雅安静，适合商务出差，会议室设施完善。',
  '前台办理入住效率很高，房间景观不错，可以看到城市风景。',
  '游泳池和健身房很棒，设施维护得很好，体验不错。',
  '餐厅美食味道很好，价格适中，下次还会来用餐。',
  '整体超出预期，尤其是服务细节做得很好，感动！',
  '酒店位置便利，性价比超高，房间隔音效果好，睡眠质量有保障。',
  '早餐很丰富，中西结合，餐厅环境优雅，服务人员态度好。',
  '房间装修很新，智能化程度高，电动窗帘、智能马桶都有。',
  '周边购物方便，楼下就是商场，买东西吃饭都很方便。',
  '酒店工作人员都很专业，解决问题效率很高，值得推荐。',
];

// 获取图片文件列表
function getImageFiles(dir, prefix = '') {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i) && (prefix === '' || f.startsWith(prefix)))
      .map(f => `http://localhost:8080/uploads/${f}`);
  } catch (e) {
    console.log(`读取目录失败: ${dir}`);
    return [];
  }
}

// 随机选择图片
function randomImages(allImages, min, max) {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...allImages].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function generateData() {
  try {
    console.log('开始生成数据...\n');

    // 1. 清空现有数据
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await Review.deleteMany({});
    await Favorite.deleteMany({});
    await BrowsingHistory.deleteMany({});
    await UserPreference.deleteMany({});
    console.log('✓ 已清空现有数据');

    // 2. 获取图片
    const hotelImages = getImageFiles(HOTEL_IMAGES_DIR);
    const roomImages = getImageFiles(ROOM_IMAGES_DIR, 'room_');

    // 如果本地图片为空，使用网络占位图
    const placeholderHotelImages = hotelImages.length > 0 ? hotelImages : [
      'https://picsum.photos/800/600?random=1',
      'https://picsum.photos/800/600?random=2',
      'https://picsum.photos/800/600?random=3',
      'https://picsum.photos/800/600?random=4',
      'https://picsum.photos/800/600?random=5',
      'https://picsum.photos/800/600?random=6',
      'https://picsum.photos/800/600?random=7',
      'https://picsum.photos/800/600?random=8',
    ];
    const placeholderRoomImages = roomImages.length > 0 ? roomImages : [
      'https://picsum.photos/400/300?random=10',
      'https://picsum.photos/400/300?random=11',
      'https://picsum.photos/400/300?random=12',
      'https://picsum.photos/400/300?random=13',
    ];

    console.log(`✓ 获取到 ${hotelImages.length} 张酒店图片, ${roomImages.length} 张房型图片`);

    // 3. 生成用户
    const users = [];
    const password = await bcrypt.hash('123456', 10);

    // 创建管理员
    users.push({
      username: 'admin',
      password,
      phone: '13800000000',
      role: 'admin',
      email: 'admin@hotel.com'
    });

    // 创建商家
    for (let i = 1; i <= 5; i++) {
      users.push({
        username: `hotel${i}`,
        password,
        phone: `1380000000${i}`,
        role: 'merchant',
        email: `hotel${i}@hotel.com`
      });
    }

    // 创建普通用户
    const userNames = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '陈十二'];
    for (let i = 0; i < 10; i++) {
      users.push({
        username: `user${i + 1}`,
        password,
        phone: `139${String(i).padStart(8, '0')}`,
        role: 'user',
        email: `user${i + 1}@example.com`,
        gender: ['male', 'female'][i % 2]
      });
    }

    const createdUsers = await User.insertMany(users);
    console.log(`✓ 已生成 ${createdUsers.length} 个用户`);

    const merchants = createdUsers.filter(u => u.role === 'merchant');
    const normalUsers = createdUsers.filter(u => u.role === 'user');

    // 4. 生成酒店
    const hotels = [];
    for (let i = 0; i < hotelTemplates.length; i++) {
      const template = hotelTemplates[i];
      const merchant = merchants[i % merchants.length];

      // 随机选择3-5个设施
      const shuffledAmenities = [...amenitiesList].sort(() => 0.5 - Math.random());
      const hotelAmenities = shuffledAmenities.slice(0, Math.floor(Math.random() * 3) + 3);

      // 为每个酒店生成2-4个房型
      const hotelRoomTypes = [];
      const roomCount = Math.floor(Math.random() * 3) + 2;
      const shuffledRooms = [...roomTypesList].sort(() => 0.5 - Math.random());

      for (let j = 0; j < roomCount; j++) {
        const room = shuffledRooms[j];
        const roomPrice = Math.floor(template.price * (0.6 + Math.random() * 0.8));

        hotelRoomTypes.push({
          name: room.name,
          description: `${room.area}平米${room.bedType}，配备${hotelAmenities.slice(0, 3).join('、')}`,
          price: roomPrice,
          capacity: room.capacity,
          bedType: room.bedType,
          area: room.area,
          images: randomImages(placeholderRoomImages, 1, 3),
          amenities: hotelAmenities.slice(0, 4)
        });
      }

      // 根据城市设置不同的经纬度
      const cityCoords = {
        '北京': { lat: 39.9, lng: 116.4 },
        '上海': { lat: 31.2, lng: 121.5 },
        '广州': { lat: 23.1, lng: 113.3 },
        '深圳': { lat: 22.5, lng: 114.1 },
        '杭州': { lat: 30.3, lng: 120.2 },
        '成都': { lat: 30.6, lng: 104.1 },
        '重庆': { lat: 29.6, lng: 106.5 },
        '西安': { lat: 34.3, lng: 108.9 },
        '南京': { lat: 32.1, lng: 118.8 },
        '苏州': { lat: 31.3, lng: 120.6 },
        '厦门': { lat: 24.5, lng: 118.1 },
        '三亚': { lat: 18.3, lng: 109.5 },
        '武汉': { lat: 30.6, lng: 114.3 },
        '长沙': { lat: 28.2, lng: 112.9 },
      };
      const coords = cityCoords[template.city] || { lat: 39.9, lng: 116.4 };

      hotels.push({
        name: template.name,
        address: `${template.district}XX路${Math.floor(Math.random() * 500) + 1}号`,
        city: template.city,
        district: template.district,
        price: template.price,
        rating: template.rating,
        images: randomImages(placeholderHotelImages, 3, 5),
        description: `${template.name}位于${template.city}市${template.district}，是一家五星级酒店。酒店设施齐全，服务周到，是您商务出差和旅游度假的理想选择。`,
        amenities: hotelAmenities,
        contactPhone: `400-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
        ownerId: merchant._id,
        status: 'published',
        publishStatus: 'published',
        reviewCount: Math.floor(Math.random() * 200) + 10,
        latitude: coords.lat + (Math.random() - 0.5) * 0.1,
        longitude: coords.lng + (Math.random() - 0.5) * 0.1,
        roomTypes: hotelRoomTypes
      });
    }

    const createdHotels = await Hotel.insertMany(hotels);
    console.log(`✓ 已生成 ${createdHotels.length} 家酒店及房型`);

    // 5. 生成评论
    const reviews = [];
    for (const hotel of createdHotels) {
      const reviewCount = Math.floor(Math.random() * 15) + 5;

      for (let i = 0; i < reviewCount; i++) {
        const user = normalUsers[Math.floor(Math.random() * normalUsers.length)];
        const rating = [4, 4, 4, 5, 5, 5, 5, 3, 3][Math.floor(Math.random() * 9)];

        reviews.push({
          hotelId: hotel._id,
          userId: user._id,
          userName: user.username,
          rating: rating,
          content: reviewContents[Math.floor(Math.random() * reviewContents.length)],
          images: randomImages(placeholderRoomImages, 1, 3),
          type: rating >= 4 ? 'good' : rating >= 3 ? 'neutral' : 'bad'
        });
      }
    }

    await Review.insertMany(reviews);
    console.log(`✓ 已生成 ${reviews.length} 条评论`);

    // 6. 生成收藏记录
    const favorites = [];
    for (const user of normalUsers) {
      const favCount = Math.floor(Math.random() * 8) + 3;
      const shuffledHotels = [...createdHotels].sort(() => 0.5 - Math.random());

      for (let i = 0; i < favCount; i++) {
        favorites.push({
          userId: user._id,
          hotelId: shuffledHotels[i]._id
        });
      }
    }

    await Favorite.insertMany(favorites);
    console.log(`✓ 已生成 ${favorites.length} 条收藏记录`);

    // 7. 生成浏览历史
    const browsingHistories = [];
    for (const user of normalUsers) {
      const browseCount = Math.floor(Math.random() * 10) + 5;
      const shuffledHotels = [...createdHotels].sort(() => 0.5 - Math.random());

      for (let i = 0; i < browseCount; i++) {
        const viewedAt = new Date();
        viewedAt.setDate(viewedAt.getDate() - Math.floor(Math.random() * 30));

        browsingHistories.push({
          userId: user._id,
          hotelId: shuffledHotels[i]._id,
          viewedAt: viewedAt,
          duration: Math.floor(Math.random() * 300) + 30,
          source: ['search', 'detail', 'recommendation', 'home'][Math.floor(Math.random() * 4)]
        });
      }
    }

    await BrowsingHistory.insertMany(browsingHistories);
    console.log(`✓ 已生成 ${browsingHistories.length} 条浏览历史`);

    // 8. 生成用户偏好
    const preferences = [];
    for (const user of normalUsers) {
      preferences.push({
        userId: user._id,
        priceRange: [
          Math.floor(Math.random() * 500) + 200,
          Math.floor(Math.random() * 1000) + 1000
        ],
        starPreference: [3, 4, 5].filter(() => Math.random() > 0.4),
        amenities: amenitiesList.slice(0, Math.floor(Math.random() * 4) + 2),
        cityPreference: ['北京', '上海', '广州', '深圳'].slice(0, Math.floor(Math.random() * 3) + 1),
        avgPrice: Math.floor(Math.random() * 800) + 400,
        totalBookings: Math.floor(Math.random() * 15)
      });
    }

    await UserPreference.insertMany(preferences);
    console.log(`✓ 已生成 ${preferences.length} 条用户偏好`);

    console.log('\n========================================');
    console.log('✅ 所有测试数据生成完成！');
    console.log('========================================\n');
    console.log('测试账号：');
    console.log('  管理员: admin / 123456 (手机: 13800000000)');
    console.log('  商家: hotel1 / 123456 (手机: 13800000001)');
    console.log('  用户: user1 / 123456 (手机: 13900000000)');
    console.log('');
    console.log('数据库: ctrip_hotel');
    console.log('酒店数量: ' + createdHotels.length);
    console.log('评论数量: ' + reviews.length);

    process.exit(0);
  } catch (error) {
    console.error('生成数据失败:', error);
    process.exit(1);
  }
}

generateData();






