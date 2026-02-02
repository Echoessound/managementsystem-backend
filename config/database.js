/**
 * MongoDB 数据库连接配置
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel_manage_system';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   MongoDB 数据库连接成功                              ║
║                                                      ║
║   数据库: hotel_manage_system                        ║
║   地址: ${MONGODB_URI}              ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
        `);
    })
    .catch((err) => {
        console.error('MongoDB 连接失败:', err.message);
        process.exit(1);
    });

module.exports = mongoose;

