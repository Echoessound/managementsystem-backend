# 酒店管理系统后端

## 环境要求

- Node.js >= 14.0.0
- MongoDB >= 4.0

## 安装

```bash
cd managesystem-backend
npm install
```

## 运行

```bash
npm start
```

服务器将在 http://localhost:8080 上运行。

## API 接口列表

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/info` - 获取用户信息
- `POST /api/auth/update` - 更新用户信息
- `POST /api/auth/sendCode` - 发送验证码

### 酒店接口
- `GET /api/hotel/list` - 获取酒店列表
- `GET /api/hotel/detail/:id` - 获取酒店详情
- `POST /api/hotel/create` - 创建酒店
- `PUT /api/hotel/update/:id` - 更新酒店
- `DELETE /api/hotel/delete/:id` - 删除酒店
- `POST /api/hotel/submit/:id` - 提交审核
- `POST /api/hotel/resubmit/:id` - 重新提交审核

### 评论接口
- `POST /api/review/create` - 创建评论
- `GET /api/review/hotel/:hotelId` - 获取酒店评论
- `DELETE /api/review/:id` - 删除评论

### 收藏接口
- `POST /api/favorite/add` - 添加收藏
- `DELETE /api/favorite/remove/:hotelId` - 取消收藏
- `GET /api/favorite/list` - 获取收藏列表
- `POST /api/favorite/sync` - 批量同步收藏

### 浏览历史接口
- `POST /api/browsing/add` - 添加浏览记录
- `GET /api/browsing/list` - 获取浏览历史
- `DELETE /api/browsing/clear` - 清空浏览历史

### 用户偏好接口
- `GET /api/preference/get` - 获取用户偏好
- `POST /api/preference/update` - 更新用户偏好

### 推荐接口
- `GET /api/recommendation/behavior-data` - 获取行为数据 /api/recomm
- `GETendation/similar-users` - 获取相似用户
- `GET /api/recommendation/popular` - 获取热门推荐

## 生成模拟数据

```bash
node scripts/generateMockData.js
```

## 数据库

MongoDB 数据库名称: `ctrip_hotel`

