/**
 * 酒店管理系统后端 - 主入口文件
 * 端口: 8080
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('./config/database'); // 引入 MongoDB 连接

const authRoutes = require('./routes/auth');
const hotelRoutes = require('./routes/hotel');

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

