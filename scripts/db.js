/**
 * 数据库管理脚本
 * 用法:
 *   node scripts/db.js status       - 查看数据库状态和集合统计
 *   node scripts/db.js seed         - 生成测试数据
 *   node scripts/db.js reset        - 清空所有数据
 *   node scripts/db.js backup       - 备份数据库到 backups/ 目录
 *   node scripts/db.js restore      - 从最新备份恢复
 *   node scripts/db.js restore <name> - 从指定备份恢复
 *   node scripts/db.js clear <col>  - 清空指定集合 (users|hotels|reviews|favorites|browsing|preferences|logs)
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, exec } from 'child_process';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const DB_NAME = process.env.DB_NAME || 'ctrip_hotel';
const MONGO_URL = process.env.DATABASE_URL || `mongodb://localhost:27017/${DB_NAME}`;
const BACKUP_DIR = path.join(__dirname, '../backups');
const HOTEL_IMAGES_DIR = '/Users/echo/Desktop/hotel/未命名文件夹/酒店照片';
const ROOM_IMAGES_DIR = path.join(__dirname, '../uploads');

// ============================================================
// Schema 定义（直接从 dbFactory 复制，保证一致性）
// ============================================================

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  role: { type: String, enum: ['user', 'merchant', 'admin'], default: 'user' },
  avatar: { type: String, default: '' },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  email: { type: String, default: '' },
  idCard: { type: String, default: '' },
  realName: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive', 'banned'], default: 'active' }
}, { timestamps: true });

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true },
  city: { type: String, required: true, index: true },
  district: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  images: [{ type: String }],
  description: { type: String, default: '' },
  amenities: [{ type: String }],
  contactPhone: { type: String, default: '' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerName: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'published', 'rejected', 'offline'], default: 'pending', index: true },
  rejectReason: { type: String, default: '' },
  publishStatus: { type: String, enum: ['published', 'draft'], default: 'draft' },
  reviewCount: { type: Number, default: 0, min: 0 },
  latitude: { type: Number, default: 0 },
  longitude: { type: Number, default: 0 },
  roomTypes: [{
    name: String, description: String, price: Number,
    capacity: Number, count: Number, bedType: String,
    area: Number, images: [String], amenities: [String]
  }]
}, { timestamps: true });
hotelSchema.index({ city: 1, status: 1 });
hotelSchema.index({ ownerId: 1 });
hotelSchema.index({ price: 1 });
hotelSchema.index({ rating: -1 });

const reviewSchema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String, default: '' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  content: { type: String, required: true, maxLength: 1000 },
  images: [{ type: String }],
  type: { type: String, enum: ['good', 'neutral', 'bad'], default: 'good' }
}, { timestamps: true });
reviewSchema.index({ hotelId: 1, createdAt: -1 });

const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true }
}, { timestamps: true });
favoriteSchema.index({ userId: 1, hotelId: 1 }, { unique: true });

const browsingHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  viewedAt: { type: Date, default: Date.now },
  duration: { type: Number, default: 0 },
  source: { type: String, enum: ['search', 'detail', 'recommendation', 'home'], default: 'search' }
}, { timestamps: true });
browsingHistorySchema.index({ userId: 1, viewedAt: -1 });

const userPreferenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  priceRange: { type: [Number], default: [0, 2000] },
  starPreference: { type: [Number], default: [3, 4, 5] },
  amenities: { type: [String], default: [] },
  cityPreference: { type: [String], default: [] },
  avgPrice: { type: Number, default: 0 },
  totalBookings: { type: Number, default: 0 },
  lastSearchCity: { type: String, default: '' },
  lastSearchKeyword: { type: String, default: '' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Hotel = mongoose.model('Hotel', hotelSchema);
const Review = mongoose.model('Review', reviewSchema);
const Favorite = mongoose.model('Favorite', favoriteSchema);
const BrowsingHistory = mongoose.model('BrowsingHistory', browsingHistorySchema);
const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

// OperationLog Schema
const operationLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, default: '' },
  role: { type: String, default: '' },
  module: { type: String, required: true },
  action: { type: String, required: true },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  targetName: { type: String, default: '' },
  method: { type: String, default: 'GET' },
  path: { type: String, default: '' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  requestBody: { type: mongoose.Schema.Types.Mixed, default: null },
  responseCode: { type: Number, default: 0 },
  responseMessage: { type: String, default: '' },
  status: { type: String, enum: ['success', 'failure'], default: 'success' },
  duration: { type: Number, default: 0 },
  error: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
const OperationLog = mongoose.model('OperationLog', operationLogSchema);

// SlowQueryLog Schema（与 dbFactory.js 保持一致）
const slowQueryLogSchema = new mongoose.Schema({
  collection: { type: String, default: '' },
  method: { type: String, default: '' },
  query: { type: String, default: '' },
  executionTimeMs: { type: Number, default: 0 },
  threshold: { type: Number, default: 100 },
  module: { type: String, default: '' },
  path: { type: String, default: '' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' }
}, { timestamps: true });
const SlowQueryLog = mongoose.model('SlowQueryLog', slowQueryLogSchema);

// ============================================================
// 辅助函数
// ============================================================

function getImageFiles(dir, prefix = '') {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i) && (prefix === '' || f.startsWith(prefix)))
      .map(f => `http://localhost:8080/uploads/${f}`);
  } catch (e) {
    return [];
  }
}

function randomImages(allImages, min, max) {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...allImages].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ============================================================
// 备份加密工具（AES-256-GCM）
// ============================================================

const BACKUP_ENCRYPT_KEY = process.env.BACKUP_ENCRYPT_KEY || '';
const BACKUP_ENCRYPT_ENABLED = BACKUP_ENCRYPT_KEY.length === 64;

/**
 * 使用 AES-256-GCM 加密数据块
 * @param {Buffer} data - 待加密数据
 * @returns {Buffer} - 格式: iv(12) + authTag(16) + ciphertext
 */
function encryptAESGCM(data) {
  const key = Buffer.from(BACKUP_ENCRYPT_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(0x30, key, iv); // AES-256-GCM
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]); // 12 + 16 + ciphertext
}

/**
 * 使用 AES-256-GCM 解密数据块
 * @param {Buffer} data - 格式: iv(12) + authTag(16) + ciphertext
 * @returns {Buffer} - 解密后数据
 */
function decryptAESGCM(data) {
  const key = Buffer.from(BACKUP_ENCRYPT_KEY, 'hex');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv(0x30, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ============================================================
// 命令实现
// ============================================================

async function status() {
  await connect();

  const collections = ['users', 'hotels', 'reviews', 'favorites', 'browsinghistories', 'userpreferences', 'operationlogs'];
  const stats = {};

  for (const col of collections) {
    try {
      const count = await mongoose.connection.db.collection(col).countDocuments();
      stats[col] = count;
    } catch (e) {
      stats[col] = `错误: ${e.message}`;
    }
  }

  console.log('\n========================================');
  console.log(`  数据库: ${DB_NAME}`);
  console.log(`  状态: 已连接`);
  console.log('========================================');
  console.log('  集合统计:');
  console.log(`    用户 (users):           ${stats.users}`);
  console.log(`    酒店 (hotels):         ${stats.hotels}`);
  console.log(`    评论 (reviews):        ${stats.reviews}`);
  console.log(`    收藏 (favorites):      ${stats.favorites}`);
  console.log(`    浏览历史 (browsing):   ${stats.browsinghistories}`);
  console.log(`    用户偏好 (preferences):${stats.userpreferences}`);
  console.log(`    操作日志 (logs):        ${stats.operationlogs}`);
  console.log('========================================');

  await disconnect();
}

async function seed() {
  await connect();

  console.log('开始生成测试数据...\n');

  const hotelImages = getImageFiles(HOTEL_IMAGES_DIR);
  const roomImages = getImageFiles(ROOM_IMAGES_DIR, 'room_');

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

  console.log(`图片: ${hotelImages.length} 张酒店图片, ${roomImages.length} 张房型图片`);

  // 清空现有数据
  await Promise.all([
    User.deleteMany({}),
    Hotel.deleteMany({}),
    Review.deleteMany({}),
    Favorite.deleteMany({}),
    BrowsingHistory.deleteMany({}),
    UserPreference.deleteMany({})
  ]);
  console.log('已清空现有数据');

  // 生成用户
  const users = [];
  const password = await bcrypt.hash('123456', 10);

  users.push({ username: 'admin', password, phone: '13800000000', role: 'admin', email: 'admin@hotel.com' });
  for (let i = 1; i <= 5; i++) {
    users.push({ username: `hotel${i}`, password, phone: `1380000000${i}`, role: 'merchant', email: `hotel${i}@hotel.com` });
  }
  const userNames = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '陈十二'];
  for (let i = 0; i < 10; i++) {
    users.push({
      username: userNames[i],
      password, phone: `139${String(i).padStart(8, '0')}`,
      role: 'user', email: `user${i + 1}@example.com`,
      gender: ['male', 'female'][i % 2]
    });
  }

  const createdUsers = await User.insertMany(users);
  console.log(`已生成 ${createdUsers.length} 个用户`);

  const merchants = createdUsers.filter(u => u.role === 'merchant');
  const normalUsers = createdUsers.filter(u => u.role === 'user');

  // 酒店模板
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

  const cityCoords = {
    '北京': { lat: 39.9, lng: 116.4 }, '上海': { lat: 31.2, lng: 121.5 },
    '广州': { lat: 23.1, lng: 113.3 }, '深圳': { lat: 22.5, lng: 114.1 },
    '杭州': { lat: 30.3, lng: 120.2 }, '成都': { lat: 30.6, lng: 104.1 },
    '重庆': { lat: 29.6, lng: 106.5 }, '西安': { lat: 34.3, lng: 108.9 },
    '南京': { lat: 32.1, lng: 118.8 }, '苏州': { lat: 31.3, lng: 120.6 },
    '厦门': { lat: 24.5, lng: 118.1 }, '三亚': { lat: 18.3, lng: 109.5 },
    '武汉': { lat: 30.6, lng: 114.3 }, '长沙': { lat: 28.2, lng: 112.9 },
  };

  // 生成酒店
  const hotels = [];
  for (let i = 0; i < hotelTemplates.length; i++) {
    const t = hotelTemplates[i];
    const merchant = merchants[i % merchants.length];
    const shuffledAmenities = [...amenitiesList].sort(() => 0.5 - Math.random());
    const hotelAmenities = shuffledAmenities.slice(0, Math.floor(Math.random() * 3) + 3);

    const roomCount = Math.floor(Math.random() * 3) + 2;
    const shuffledRooms = [...roomTypesList].sort(() => 0.5 - Math.random());
    const hotelRoomTypes = [];
    for (let j = 0; j < roomCount; j++) {
      const room = shuffledRooms[j];
      hotelRoomTypes.push({
        name: room.name, description: `${room.area}平米${room.bedType}，配备${hotelAmenities.slice(0, 3).join('、')}`,
        price: Math.floor(t.price * (0.6 + Math.random() * 0.8)),
        capacity: room.capacity, bedType: room.bedType, area: room.area,
        images: randomImages(placeholderRoomImages, 1, 3),
        amenities: hotelAmenities.slice(0, 4)
      });
    }

    const coords = cityCoords[t.city] || { lat: 39.9, lng: 116.4 };
    hotels.push({
      name: t.name, address: `${t.district}XX路${Math.floor(Math.random() * 500) + 1}号`,
      city: t.city, district: t.district, price: t.price, rating: t.rating,
      images: randomImages(placeholderHotelImages, 3, 5),
      description: `${t.name}位于${t.city}市${t.district}，是一家五星级酒店。酒店设施齐全，服务周到，是您商务出差和旅游度假的理想选择。`,
      amenities: hotelAmenities, contactPhone: `400-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
      ownerId: merchant._id, status: 'published', publishStatus: 'published',
      reviewCount: Math.floor(Math.random() * 200) + 10,
      latitude: coords.lat + (Math.random() - 0.5) * 0.1,
      longitude: coords.lng + (Math.random() - 0.5) * 0.1,
      roomTypes: hotelRoomTypes
    });
  }

  const createdHotels = await Hotel.insertMany(hotels);
  console.log(`已生成 ${createdHotels.length} 家酒店及房型`);

  // 生成评论
  const reviews = [];
  for (const hotel of createdHotels) {
    const reviewCount = Math.floor(Math.random() * 15) + 5;
    for (let i = 0; i < reviewCount; i++) {
      const user = normalUsers[Math.floor(Math.random() * normalUsers.length)];
      const rating = [4, 4, 4, 5, 5, 5, 5, 3, 3][Math.floor(Math.random() * 9)];
      reviews.push({
        hotelId: hotel._id, userId: user._id, userName: user.username,
        rating, content: reviewContents[Math.floor(Math.random() * reviewContents.length)],
        images: randomImages(placeholderRoomImages, 1, 3),
        type: rating >= 4 ? 'good' : rating >= 3 ? 'neutral' : 'bad'
      });
    }
  }
  await Review.insertMany(reviews);
  console.log(`已生成 ${reviews.length} 条评论`);

  // 生成收藏
  const favorites = [];
  for (const user of normalUsers) {
    const shuffledHotels = [...createdHotels].sort(() => 0.5 - Math.random());
    for (let i = 0; i < Math.floor(Math.random() * 8) + 3 && i < createdHotels.length; i++) {
      favorites.push({ userId: user._id, hotelId: shuffledHotels[i]._id });
    }
  }
  await Favorite.insertMany(favorites);
  console.log(`已生成 ${favorites.length} 条收藏记录`);

  // 生成浏览历史
  const browsingHistories = [];
  for (const user of normalUsers) {
    const shuffledHotels = [...createdHotels].sort(() => 0.5 - Math.random());
    for (let i = 0; i < Math.floor(Math.random() * 10) + 5 && i < createdHotels.length; i++) {
      const viewedAt = new Date();
      viewedAt.setDate(viewedAt.getDate() - Math.floor(Math.random() * 30));
      browsingHistories.push({
        userId: user._id, hotelId: shuffledHotels[i]._id, viewedAt,
        duration: Math.floor(Math.random() * 300) + 30,
        source: ['search', 'detail', 'recommendation', 'home'][Math.floor(Math.random() * 4)]
      });
    }
  }
  await BrowsingHistory.insertMany(browsingHistories);
  console.log(`已生成 ${browsingHistories.length} 条浏览历史`);

  // 生成用户偏好
  const preferences = [];
  for (const user of normalUsers) {
    preferences.push({
      userId: user._id,
      priceRange: [Math.floor(Math.random() * 500) + 200, Math.floor(Math.random() * 1000) + 1000],
      starPreference: [3, 4, 5].filter(() => Math.random() > 0.4),
      amenities: amenitiesList.slice(0, Math.floor(Math.random() * 4) + 2),
      cityPreference: ['北京', '上海', '广州', '深圳'].slice(0, Math.floor(Math.random() * 3) + 1),
      avgPrice: Math.floor(Math.random() * 800) + 400,
      totalBookings: Math.floor(Math.random() * 15)
    });
  }
  await UserPreference.insertMany(preferences);
  console.log(`已生成 ${preferences.length} 条用户偏好`);

  console.log('\n========================================');
  console.log('测试账号:');
  console.log('  管理员: admin / 123456 (手机: 13800000000)');
  console.log('  商家: hotel1 / 123456 (手机: 13800000001)');
  console.log('  用户: 张三 / 123456 (手机: 13900000000)');
  console.log('========================================\n');

  await disconnect();
}

async function reset() {
  await connect();

  const confirm = process.argv[3];
  if (confirm !== '--confirm') {
    console.log('警告: 此操作将清空数据库中的所有数据！');
    console.log('如需确认，请运行: node scripts/db.js reset --confirm');
    await disconnect();
    return;
  }

  console.log('正在清空所有集合...');
  await Promise.all([
    User.deleteMany({}), Hotel.deleteMany({}), Review.deleteMany({}),
    Favorite.deleteMany({}), BrowsingHistory.deleteMany({}), UserPreference.deleteMany({}),
    OperationLog.deleteMany({}), SlowQueryLog.deleteMany({})
  ]);
  console.log('所有数据已清空');
  await disconnect();
}

async function clearCollection(name) {
  const collectionMap = {
    users: User, hotels: Hotel, reviews: Review,
    favorites: Favorite, browsing: BrowsingHistory, preferences: UserPreference,
    logs: OperationLog, slowlogs: SlowQueryLog
  };
  const model = collectionMap[name];
  if (!model) {
    console.log(`未知集合: ${name}`);
    console.log('可用集合: users, hotels, reviews, favorites, browsing, preferences, logs');
    return;
  }

  await connect();
  await model.deleteMany({});
  console.log(`集合 ${name} 已清空`);
  await disconnect();
}

function backup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `${DB_NAME}_${timestamp}`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  const tarPath = path.join(BACKUP_DIR, `${backupName}.tar`);
  const finalPath = BACKUP_ENCRYPT_ENABLED
    ? path.join(BACKUP_DIR, `${backupName}.enc`)
    : tarPath;

  console.log(`正在备份数据库 ${DB_NAME}...`);
  console.log(`输出路径: ${finalPath}`);

  try {
    // 1. mongodump
    execSync(`mongodump --uri="${MONGO_URL}" --out="${backupPath}"`, { stdio: 'inherit' });

    // 2. 打包为 tar（使用 gzip 压缩）
    execSync(`tar -czf "${tarPath}" -C "${BACKUP_DIR}" "${backupName}"`, { stdio: 'inherit' });

    // 3. 可选加密
    if (BACKUP_ENCRYPT_ENABLED) {
      console.log('加密备份文件（AES-256-GCM）...');
      const tarData = fs.readFileSync(tarPath);
      const encrypted = encryptAESGCM(tarData);
      fs.writeFileSync(finalPath, encrypted);
      fs.unlinkSync(tarPath); // 删除未加密的 tar
      console.log(`加密备份成功: ${finalPath}`);
    } else {
      console.log(`备份成功（未加密）: ${tarPath}`);
    }

    // 清理 dump 目录
    fs.rmSync(backupPath, { recursive: true, force: true });

    // 4. 清理超过 10 个旧备份（按修改时间排序）
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith(DB_NAME) && (f.endsWith('.tar') || f.endsWith('.enc')))
      .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (backups.length > 10) {
      backups.slice(10).forEach(b => {
        fs.rmSync(b.path, { recursive: true, force: true });
        console.log(`已删除旧备份: ${b.name}`);
      });
    }
  } catch (e) {
    console.error('备份失败，请确保已安装 mongodump 和 tar');
    console.error('或者检查 MongoDB 是否正在运行');
    if (fs.existsSync(backupPath)) fs.rmSync(backupPath, { recursive: true, force: true });
    if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
  }
}

async function restore(backupName) {
  let targetBackup;
  let isEncrypted = false;

  if (backupName) {
    targetBackup = path.join(BACKUP_DIR, backupName);
    if (!fs.existsSync(targetBackup)) {
      console.error(`备份不存在: ${targetBackup}`);
      _listBackups();
      return;
    }
    isEncrypted = backupName.endsWith('.enc');
  } else {
    if (!fs.existsSync(BACKUP_DIR)) {
      console.error('没有找到备份目录，请先运行 backup 命令');
      return;
    }
    const backups = _getBackupList();
    if (backups.length === 0) {
      console.error('没有找到任何备份');
      return;
    }
    targetBackup = backups[0].path;
    isEncrypted = backups[0].name.endsWith('.enc');
    console.log(`使用最新备份: ${backups[0].name}`);
  }

  await connect();

  const restoreTar = path.join(BACKUP_DIR, `__restore_tmp__${Date.now()}.tar`);
  const restoreDir = path.join(BACKUP_DIR, `__restore_tmp_dir__${Date.now()}`);

  try {
    if (isEncrypted) {
      if (!BACKUP_ENCRYPT_ENABLED) {
        console.error('该备份已加密，但未配置 BACKUP_ENCRYPT_KEY，无法解密恢复');
        await disconnect();
        return;
      }
      console.log('解密备份文件...');
      const encrypted = fs.readFileSync(targetBackup);
      const decrypted = decryptAESGCM(encrypted);
      fs.writeFileSync(restoreTar, decrypted);
      console.log('解密完成');
    } else {
      fs.copyFileSync(targetBackup, restoreTar);
    }

    console.log('解压备份文件...');
    fs.mkdirSync(restoreDir, { recursive: true });
    execSync(`tar -xzf "${restoreTar}" -C "${restoreDir}"`, { stdio: 'inherit' });

    const extracted = fs.readdirSync(restoreDir)[0];
    const dumpPath = path.join(restoreDir, extracted, DB_NAME);

    if (!fs.existsSync(dumpPath)) {
      console.error(`备份格式错误，找不到 ${dumpPath}`);
      await disconnect();
      return;
    }

    console.log(`正在恢复数据库 ${DB_NAME}...`);
    execSync(`mongorestore --uri="${MONGO_URL}" --drop --quiet "${dumpPath}"`, { stdio: 'inherit' });
    console.log('恢复成功');
  } catch (e) {
    console.error('恢复失败:', e.message);
  } finally {
    if (fs.existsSync(restoreTar)) fs.unlinkSync(restoreTar);
    if (fs.existsSync(restoreDir)) fs.rmSync(restoreDir, { recursive: true, force: true });
    await disconnect();
  }
}

function _getBackupList() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(DB_NAME) && (f.endsWith('.tar') || f.endsWith('.enc')))
    .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
}

function _listBackups() {
  const backups = _getBackupList();
  if (backups.length === 0) {
    console.log('没有找到任何备份');
    return;
  }
  console.log('可用备份:');
  backups.forEach(b => console.log(`  ${b.name}${b.name.endsWith('.enc') ? ' [加密]' : ''}`));
}

// ============================================================
// 连接管理
// ============================================================

async function connect() {
  try {
    await mongoose.connect(MONGO_URL, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
  } catch (err) {
    console.error(`\n无法连接到 MongoDB (${MONGO_URL})`);
    console.error('请确保:');
    console.error('  1. MongoDB 服务已启动');
    console.error('  2. 数据库地址配置正确 (.env 中的 DATABASE_URL)');
    process.exit(1);
  }
}

async function disconnect() {
  await mongoose.connection.close();
}

// ============================================================
// 入口
// ============================================================

const cmd = process.argv[2];

console.log('');
switch (cmd) {
  case 'status':
    await status();
    break;
  case 'seed':
    await seed();
    break;
  case 'reset':
    await reset();
    break;
  case 'backup':
    backup();
    break;
  case 'restore':
    await restore(process.argv[3]);
    break;
  case 'clear':
    await clearCollection(process.argv[3]);
    break;
  default:
    console.log('数据库管理脚本');
    console.log('');
    console.log('用法: node scripts/db.js <command>');
    console.log('');
    console.log('命令:');
    console.log('  status               查看数据库状态和集合统计');
    console.log('  seed                 生成测试数据');
    console.log('  reset                清空所有数据 (需加 --confirm)');
    console.log('  backup               备份数据库到 backups/ 目录（支持 AES-256-GCM 加密）');
    console.log('  restore [name]       从备份恢复（加密/未加密均可，自动检测）');
    console.log('  clear <col>          清空指定集合');
    console.log('');
    console.log('集合名: users, hotels, reviews, favorites, browsing, preferences, logs, slowlogs');
    console.log('加密: 备份加密功能通过 .env 中的 BACKUP_ENCRYPT_KEY 启用');
}
