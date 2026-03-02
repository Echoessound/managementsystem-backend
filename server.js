const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');

const app = express();

// 全局请求日志中间件 (放在最前面)
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.use(cors());

// 配置 multer 用于处理文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// 对 multipart/form-data 跳过 express.json()，让 multer 处理
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 上传的图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 连接数据库
const DB_NAME = 'ctrip_hotel';
mongoose.connect(`mongodb://localhost:27017/${DB_NAME}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log(`MongoDB 连接成功 - 数据库: ${DB_NAME}`);
}).catch(err => {
  console.error('MongoDB 连接失败:', err);
});

// 导入模型
const User = require('./models/User');
const Hotel = require('./models/Hotel');
const Review = require('./models/Review');
const Favorite = require('./models/Favorite');
const BrowsingHistory = require('./models/BrowsingHistory');
const UserPreference = require('./models/UserPreference');

// 导入路由
const authRoutes = require('./routes/auth');
const hotelRoutes = require('./routes/hotel');

console.log('Loading hotel routes...');
const reviewRoutes = require('./routes/review');
const favoriteRoutes = require('./routes/favorite');
const browsingHistoryRoutes = require('./routes/browsingHistory');
const userPreferenceRoutes = require('./routes/userPreference');
const recommendationRoutes = require('./routes/recommendation');
const aiRoutes = require('./routes/ai');

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/hotel', hotelRoutes);
console.log('Hotel routes mounted at /api/hotel');
app.use('/api/review', reviewRoutes);
app.use('/api/favorite', favoriteRoutes);
app.use('/api/browsingHistory', browsingHistoryRoutes);
app.use('/api/preference', userPreferenceRoutes);
app.use('/api/recommendation', recommendationRoutes);
app.use('/api/ai', aiRoutes);

// 启动服务器
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

