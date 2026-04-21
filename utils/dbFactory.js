// dbFactory.js - MongoDB 数据库访问层
// 所有数据操作均通过 Mongoose/MongoDB 进行

import mongoose from 'mongoose';

// 安全地将值转为 ObjectId（仅在有效时转换）
function toObjectId(id) {
  if (!id) return id;
  // 如果已经是 ObjectId，直接返回
  if (id instanceof mongoose.Types.ObjectId) return id;
  // 如果是 Buffer，转为十六进制字符串再转 ObjectId
  if (Buffer.isBuffer(id)) {
    return new mongoose.Types.ObjectId(id.toString('hex'));
  }
  // 如果是有效的 24 位十六进制字符串
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

// 递归处理 filter 中的 ObjectId 转换
function normalizeFilter(filter) {
  if (!filter || typeof filter !== 'object') return filter;
  const out = {};
  for (const [k, v] of Object.entries(filter)) {
    // 处理 $in 数组
    if (['_id', 'ownerId', 'userId', 'hotelId'].includes(k) && v && typeof v === 'object' && '$in' in v && Array.isArray(v.$in)) {
      out[k] = { $in: v.$in.map(id => toObjectId(id)) };
    }
    // 处理普通的 ObjectId 字段（已转换的 ObjectId 直接返回，不再二次转换）
    else if (['_id', 'ownerId', 'userId', 'hotelId'].includes(k) && v != null) {
      // 如果是已经转换的 ObjectId，直接原样返回（避免 Mongoose 二次转换）
      if (v instanceof mongoose.Types.ObjectId) {
        out[k] = v;
      } else {
        out[k] = toObjectId(v);
      }
    }
    // 处理嵌套对象
    else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = normalizeFilter(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ============================================================
// Mongoose Schema 注册
// ============================================================

// User Schema
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
mongoose.model('User', userSchema);

// Hotel Schema
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
mongoose.model('Hotel', hotelSchema);

// Review Schema
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
mongoose.model('Review', reviewSchema);

// Favorite Schema
const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true }
}, { timestamps: true });
favoriteSchema.index({ userId: 1, hotelId: 1 }, { unique: true });
mongoose.model('Favorite', favoriteSchema);

// BrowsingHistory Schema（带 TTL: 30 天自动过期）
const browsingHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  viewedAt: { type: Date, default: Date.now },
  duration: { type: Number, default: 0 },
  source: { type: String, enum: ['search', 'detail', 'recommendation', 'home'], default: 'search' }
}, { timestamps: true });
browsingHistorySchema.index({ userId: 1, viewedAt: -1 });
// TTL 索引: 30 天后自动删除
browsingHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
mongoose.model('BrowsingHistory', browsingHistorySchema);

// UserPreference Schema
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
mongoose.model('UserPreference', userPreferenceSchema);

// SlowQueryLog Schema - 慢查询日志（不设 TTL，管理员手动清理）
const slowQueryLogSchema = new mongoose.Schema({
  collection: { type: String, default: '' },       // 集合名，如 'Hotel', 'Review'
  method: { type: String, default: '' },         // 操作方法，如 'findMany', 'count', 'aggregate'
  query: { type: String, default: '' },          // 查询摘要（脱敏后的 filter 字符串）
  executionTimeMs: { type: Number, default: 0 }, // 实际耗时(ms)
  threshold: { type: Number, default: 100 },     // 触发慢查询的阈值
  module: { type: String, default: '' },          // HTTP 模块（若由请求触发）
  path: { type: String, default: '' },            // HTTP 路径（若由请求触发）
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' }
}, { timestamps: true });
slowQueryLogSchema.index({ collection: 1, createdAt: -1 });
slowQueryLogSchema.index({ createdAt: -1 });
mongoose.model('SlowQueryLog', slowQueryLogSchema);

// SlowQueryLog 数据访问
export const SlowQueryLogDB = {
  create: async (data) => {
    return new (mongoose.model('SlowQueryLog'))(data).save();
  },

  findMany: async ({ filter = {}, sort = { createdAt: -1 }, skip = 0, take = 50 } = {}) => {
    return mongoose.model('SlowQueryLog').find(filter).sort(sort).skip(skip).limit(take);
  },

  count: async (filter = {}) => {
    return mongoose.model('SlowQueryLog').countDocuments(filter);
  },

  deleteMany: async (filter = {}) => {
    return mongoose.model('SlowQueryLog').deleteMany(filter);
  },

  countByCollection: async (filter = {}) => {
    return mongoose.model('SlowQueryLog').aggregate([
      { $match: filter },
      { $group: { _id: '$collection', count: { $sum: 1 }, avgMs: { $avg: '$executionTimeMs' } } },
      { $sort: { count: -1 } }
    ]);
  },
};

/**
 * 慢查询追踪包装器
 * @param {string} collection  集合名
 * @param {string} method       操作名
 * @param {string} queryStr     查询摘要
 * @param {Function} fn        实际执行的异步查询函数
 * @param {object} reqInfo      可选：{ module, path, ip, userAgent }
 */
export async function trackedQuery(collection, method, queryStr, fn, reqInfo = {}) {
  const threshold = Number(process.env.SLOW_QUERY_THRESHOLD || 100);
  const start = Date.now();
  let result;
  try {
    result = await fn();
  } finally {
    const ms = Date.now() - start;
    if (ms > threshold) {
      SlowQueryLogDB.create({
        collection, method, query: queryStr,
        executionTimeMs: ms, threshold,
        module: reqInfo.module || '',
        path: reqInfo.path || '',
        ip: reqInfo.ip || '',
        userAgent: reqInfo.userAgent || ''
      }).catch(() => {});
    }
  }
  return result;
}

// 辅助：从对象生成简短的查询摘要（脱敏）
export function querySummary(obj) {
  if (!obj) return '';
  try {
    const safe = { ...obj };
    const redact = ['password', 'token', 'authorization', 'secret', 'apiKey', 'mailPass'];
    redact.forEach(k => { if (k in safe) safe[k] = '[REDACTED]'; });
    return JSON.stringify(safe);
  } catch {
    return String(obj);
  }
}

// OperationLog Schema - 操作日志（带 TTL: 90 天自动过期）
const operationLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, default: '' },
  role: { type: String, default: '' },
  module: {
    type: String,
    required: true,
    enum: ['auth', 'hotel', 'review', 'favorite', 'browsingHistory', 'userPreference', 'recommendation', 'ai', 'system'],
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['login', 'logout', 'register', 'create', 'update', 'delete', 'approve', 'reject', 'publish', 'offline', 'submit', 'query', 'add', 'remove', 'sync', 'clear', 'send', 'verify', 'chat', 'other'],
    index: true
  },
  targetType: { type: String, default: '' },   // 操作对象类型: Hotel, Review, User, ...
  targetId: { type: String, default: '' },    // 操作对象ID
  targetName: { type: String, default: '' },  // 操作对象名称（如酒店名）
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
  path: { type: String, default: '' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  requestBody: { type: mongoose.Schema.Types.Mixed, default: null },
  responseCode: { type: Number, default: 0 },
  responseMessage: { type: String, default: '' },
  status: { type: String, enum: ['success', 'failure'], default: 'success', index: true },
  duration: { type: Number, default: 0 },   // 耗时(ms)
  error: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
operationLogSchema.index({ userId: 1, createdAt: -1 });
operationLogSchema.index({ module: 1, action: 1, createdAt: -1 });
operationLogSchema.index({ targetId: 1 });
operationLogSchema.index({ status: 1, createdAt: -1 });
// TTL 索引: 90 天后自动删除（createdAt 字段由 timestamps: true 管理）
operationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
mongoose.model('OperationLog', operationLogSchema);

// ============================================================
// User 数据访问
// ============================================================

export const UserDB = {
  findById: async (id) => {
    return mongoose.model('User').findById(id).select('-password');
  },

  findOne: async (query) => {
    return mongoose.model('User').findOne(query);
  },

  create: async (data) => {
    return new (mongoose.model('User'))(data).save();
  },

  findByIdAndUpdate: async (id, updateData, options = {}) => {
    return mongoose.model('User').findByIdAndUpdate(id, updateData, { new: options.new ?? true });
  },
};

// ============================================================
// Hotel 数据访问
// ============================================================

export const HotelDB = {
  findMany: async ({ filter = {}, sort = { createdAt: -1 }, skip = 0, take = 10 } = {}) => {
    const normalized = normalizeFilter(filter);
    console.log('[HotelDB.findMany] filter:', JSON.stringify(filter), '-> normalized:', JSON.stringify(normalized));
    return mongoose.model('Hotel').find(normalized).sort(sort).skip(skip).limit(take);
  },

  count: async (filter = {}) => {
    return mongoose.model('Hotel').countDocuments(filter);
  },

  findById: async (id) => {
    return mongoose.model('Hotel').findById(id);
  },

  findByIdAndUpdate: async (id, updateData, options = {}) => {
    return mongoose.model('Hotel').findByIdAndUpdate(id, updateData, { new: options.new ?? true });
  },

  findByIdAndDelete: async (id) => {
    return mongoose.model('Hotel').findByIdAndDelete(id);
  },

  create: async (data) => {
    return new (mongoose.model('Hotel'))(data).save();
  },

  updateRating: async (hotelId, rating, reviewCount) => {
    return mongoose.model('Hotel').findByIdAndUpdate(hotelId, { $set: { rating, reviewCount } });
  },
};

// ============================================================
// Review 数据访问
// ============================================================

export const ReviewDB = {
  findMany: async ({ filter = {}, sort = { createdAt: -1 }, skip = 0, take = 10 } = {}) => {
    return mongoose.model('Review').find(normalizeFilter(filter)).sort(sort).skip(skip).limit(take);
  },

  count: async (filter = {}) => {
    const q = (typeof filter === 'object' && 'filter' in filter) ? filter.filter : filter;
    return mongoose.model('Review').countDocuments(q);
  },

  create: async (data) => {
    return new (mongoose.model('Review'))(data).save();
  },

  findById: async (id) => {
    return mongoose.model('Review').findById(id);
  },

  findByIdAndDelete: async (id) => {
    return mongoose.model('Review').findByIdAndDelete(id);
  },

  aggregateRating: async (hotelId) => {
    return mongoose.model('Review').aggregate([
      { $match: { hotelId: toObjectId(hotelId) } },
      {
        $group: {
          _id: null,
          _avg: { $avg: '$rating' },
          _count: { $sum: 1 }
        }
      }
    ]);
  },

  groupByRating: async (hotelId) => {
    return mongoose.model('Review').aggregate([
      { $match: { hotelId: toObjectId(hotelId) } },
      {
        $group: {
          _id: '$rating',
          _count: { $sum: 1 }
        }
      }
    ]);
  },
};

// ============================================================
// Favorite 数据访问
// ============================================================

export const FavoriteDB = {
  findMany: async ({ filter = {}, sort = { createdAt: -1 }, skip = 0, take = 20 } = {}) => {
    return mongoose.model('Favorite').find(normalizeFilter(filter)).sort(sort).skip(skip).limit(take);
  },

  count: async (filter = {}) => {
    // 兼容 { filter: {...} } 嵌套格式（来自 dbFactory 内部）
    const q = (typeof filter === 'object' && 'filter' in filter) ? filter.filter : filter;
    return mongoose.model('Favorite').countDocuments(q);
  },

  findOne: async (filter = {}) => {
    return mongoose.model('Favorite').findOne(filter);
  },

  create: async (data) => {
    return new (mongoose.model('Favorite'))(data).save();
  },

  findOneAndDelete: async (filter = {}) => {
    return mongoose.model('Favorite').findOneAndDelete(filter);
  },

  insertMany: async (dataArr) => {
    return mongoose.model('Favorite').insertMany(dataArr, { ordered: false });
  },
};

// ============================================================
// BrowsingHistory 数据访问
// ============================================================

export const BrowsingHistoryDB = {
  findMany: async ({ filter = {}, sort = { viewedAt: -1 }, skip = 0, take = 20, includeHotel = false } = {}) => {
    let q = mongoose.model('BrowsingHistory').find(filter).sort(sort).skip(skip).limit(take);
    if (includeHotel) {
      q = q.populate('hotelId', 'name address price images rating city');
    }
    return q;
  },

  count: async (filter = {}) => {
    return mongoose.model('BrowsingHistory').countDocuments(filter);
  },

  upsert: async ({ filter, create, update } = {}) => {
    const existing = await mongoose.model('BrowsingHistory').findOne(filter);
    if (existing) {
      Object.assign(existing, update);
      return existing.save();
    }
    return new (mongoose.model('BrowsingHistory'))({ ...filter, ...create }).save();
  },

  deleteMany: async (filter = {}) => {
    return mongoose.model('BrowsingHistory').deleteMany(filter);
  },
};

// ============================================================
// UserPreference 数据访问
// ============================================================

export const UserPreferenceDB = {
  findOne: async (filter = {}) => {
    return mongoose.model('UserPreference').findOne(filter);
  },

  upsert: async ({ filter, create, update } = {}) => {
    return mongoose.model('UserPreference').findOneAndUpdate(filter, { $set: update }, { upsert: true, new: true });
  },
};

// ============================================================
// Recommendation 辅助查询
// ============================================================

export const RecommendationDB = {
  findPopularHotels: async ({ city, limit = 10 } = {}) => {
    const filter = { status: 'published' };
    if (city) filter.city = city;
    return mongoose.model('Hotel').find(filter)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(Number(limit));
  },
};

// ============================================================
// OperationLog 数据访问
// ============================================================

export const OperationLogDB = {
  create: async (data) => {
    return new (mongoose.model('OperationLog'))(data).save();
  },

  findMany: async ({ filter = {}, sort = { createdAt: -1 }, skip = 0, take = 20 } = {}) => {
    return mongoose.model('OperationLog').find(filter).sort(sort).skip(skip).limit(take);
  },

  count: async (filter = {}) => {
    return mongoose.model('OperationLog').countDocuments(filter);
  },

  deleteMany: async (filter = {}) => {
    return mongoose.model('OperationLog').deleteMany(filter);
  },

  // 按模块统计操作次数
  countByModule: async (filter = {}) => {
    return mongoose.model('OperationLog').aggregate([
      { $match: filter },
      { $group: { _id: '$module', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
  },

  // 按用户统计操作次数
  countByUser: async (filter = {}) => {
    return mongoose.model('OperationLog').aggregate([
      { $match: filter },
      { $group: { _id: { userId: '$userId', username: '$username' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
  },

  // 按时间段统计（每日/每小时）
  countByPeriod: async ({ period = 'day', filter = {} } = {}) => {
    const formats = {
      hour: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } },
      day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
    };
    return mongoose.model('OperationLog').aggregate([
      { $match: filter },
      { $group: { _id: formats[period] || formats.day, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
  },

  // 获取成功率统计
  getSuccessRate: async (filter = {}) => {
    const result = await mongoose.model('OperationLog').aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    const stats = { success: 0, failure: 0, total: 0 };
    result.forEach(item => {
      if (item._id === 'success') stats.success = item.count;
      else if (item._id === 'failure') stats.failure = item.count;
    });
    stats.total = stats.success + stats.failure;
    stats.rate = stats.total > 0 ? Math.round((stats.success / stats.total) * 10000) / 100 : 0;
    return stats;
  },
};
