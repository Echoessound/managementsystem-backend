/**
 * 酒店管理系统后端 - 主入口文件
 * 端口: 8080
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('./config/database'); // 引入 MongoDB 连接

const authRoutes = require('./routes/auth');
const hotelRoutes = require('./routes/hotel');

const app = express();
const PORT = process.env.PORT || 8080;

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 配置文件上传中间件
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 使用时间戳 + 原始文件名
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // 静态文件服务

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/hotel', hotelRoutes);

// 根路径
app.get('/', (req, res) => {
    res.json({
        message: '酒店管理系统 API 服务已启动',
        version: '1.0.0',
        database: 'MongoDB',
        endpoints: {
            auth: {
                sendCode: 'POST /api/auth/sendCode',
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login'
            },
            hotel: {
                create: 'POST /api/hotel/create',
                list: 'GET /api/hotel/list',
                detail: 'GET /api/hotel/:id',
                update: 'PUT /api/hotel/:id',
                delete: 'DELETE /api/hotel/:id'
            }
        }
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   酒店管理系统后端服务已启动                          ║
║                                                      ║
║   本地地址: http://localhost:${PORT}                   ║
║   API 文档: http://localhost:${PORT}/                  ║
║   数据库: MongoDB                                    ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
    `);
});

module.exports = app;

