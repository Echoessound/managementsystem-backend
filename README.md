# 酒店管理系统后端

基于 Node.js + Express + MongoDB 的酒店管理系统后端 API 服务。

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web 框架
- **MongoDB** - 数据库
- **Mongoose** - MongoDB ODM
- **Cors** - 跨域中间件
- **Nodemailer** - 邮件发送
- **Body-Parser** - 请求体解析

## 项目结构

```
managesystem-backend/
├── package.json       # 项目配置
├── server.js          # 主入口文件
├── config/
│   └── database.js    # MongoDB 连接配置
├── models/
│   ├── User.js        # 用户模型
│   └── Hotel.js       # 酒店模型
├── routes/
│   ├── auth.js        # 认证路由
│   └── hotel.js       # 酒店管理路由
└── README.md          # 说明文档
```

## API 接口

### 认证接口

| 接口 | 方法 | 说明 | 请求体 |
|------|------|------|--------|
| `/api/auth/sendCode` | POST | 发送邮箱验证码 | `{ email }` |
| `/api/auth/register` | POST | 用户注册 | `{ username, password, email, code, role, phone }` |
| `/api/auth/login` | POST | 用户登录 | `{ username, password }` |

### 酒店管理接口

| 接口 | 方法 | 说明 | 请求体/参数 |
|------|------|------|-------------|
| `/api/hotel/create` | POST | 创建酒店 | `{ name, description, city, price, ... }` |
| `/api/hotel/list` | GET | 获取酒店列表 | `?page=1&pageSize=10&city=北京` |
| `/api/hotel/:id` | GET | 获取酒店详情 | `id` 路径参数 |
| `/api/hotel/:id` | PUT | 更新酒店 | `{ name, description, ... }` |
| `/api/hotel/:id` | DELETE | 删除酒店 | `id` 路径参数 |

## MongoDB 配置

### 本地 MongoDB

确保本地 MongoDB 服务已启动：

```bash
mongod
```

默认连接地址：`mongodb://localhost:27017/hotel_manage_system`

### 云数据库

可以使用环境变量配置云数据库地址：

```bash
export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/hotel_manage_system?retryWrites=true&w=majority"
npm start
```

## 快速开始

### 1. 安装依赖

```bash
cd managesystem-backend
npm install
```

### 2. 安装 MongoDB

**macOS (使用 Homebrew):**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian:**
```bash
sudo apt-get install mongodb
sudo systemctl start mongodb
```

**Windows:**
下载并安装 [MongoDB Community Server](https://www.mongodb.com/try/download/community)

### 3. 启动服务

```bash
npm start
```

服务启动后访问 `http://localhost:8080/` 查看 API 文档。

## 前端配置

前端 `vite.config.ts` 已配置代理到后端：

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
```

## 数据模型

### User (用户)

```javascript
{
  username: String,      // 用户名（唯一）
  password: String,      // 密码
  email: String,         // 邮箱（唯一）
  phone: String,         // 电话
  role: String,          // 角色: admin/user/merchant
  status: String,        // 状态: active/inactive
  token: String,         // 登录令牌
  createdAt: Date,       // 创建时间
  updatedAt: Date        // 更新时间
}
```

### Hotel (酒店)

```javascript
{
  name: String,          // 酒店名称
  description: String,   // 描述
  address: String,       // 地址
  city: String,          // 城市
  price: Number,         // 基础价格
  rating: Number,        // 评分 (0-5)
  images: [String],      // 图片列表
  amenities: [String],   // 设施列表
  roomTypes: [{
    name: String,        // 房型名称
    price: Number,       // 价格
    capacity: Number,    // 容纳人数
    count: Number        // 房间数量
  }],
  contactPhone: String,  // 联系电话
  checkInTime: String,   // 入住时间
  checkOutTime: String,  // 退房时间
  ownerId: String,       // 所有者ID
  ownerName: String,     // 所有者名称
  status: String,        // 审核状态: pending/approved/rejected
  publishStatus: String, // 发布状态: published/unpublished
  rejectReason: String,  // 拒绝原因
  license: [String],     // 营业执照
  createdAt: Date,       // 创建时间
  updatedAt: Date        // 更新时间
}
```

## 邮件配置

编辑 `routes/auth.js`，配置 SMTP：

```javascript
const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
        user: 'your-email@qq.com', // 你的邮箱
        pass: 'your-auth-code'     // SMTP 授权码
    }
});
```

## 注意事项

- 确保 MongoDB 服务已启动
- 数据库: `hotel_manage_system` 会自动创建
- 集合: `users`、`hotels` 会自动创建
