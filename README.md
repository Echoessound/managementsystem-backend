# 携程酒店管理系统 - 后端服务

本项目是 **携程酒店管理系统** 的后端服务，提供完整的 RESTful API，支撑 Web 管理端和移动端 App 的业务功能，包括：

- 用户注册 / 登录 / 邮箱验证码
- 酒店创建、编辑、审核、发布 / 下线
- 评论、收藏、浏览历史
- 用户偏好与智能推荐
- AI 助手问答接口

---

## 一、技术栈与架构

- **运行环境**：Node.js >= 14
- **Web 框架**：Express.js
- **数据库**：MongoDB（使用 Mongoose 作为 ODM）
- **认证**：JWT（JSON Web Token）
- **文件上传**：Multer（保存到本地 `uploads/` 目录）
- **邮件服务**：Nodemailer（QQ 邮箱 SMTP，用于验证码）
- **AI 服务**：OpenAI 兼容接口（`https://yinli.one/v1`）

整体架构为典型的 **RESTful API 服务**，前端通过 Axios / fetch 调用后端接口，使用 JWT 进行鉴权。

---

## 二、环境要求

- Node.js >= 14.0.0
- MongoDB >= 4.0（本地或远程均可）

---

## 三、安装与运行

### 1. 安装依赖

cd managesystem-backend
npm install### 2. 启动服务

npm start服务器默认运行在：

- `http://localhost:8080`

### 3. 常用脚本

# 安装依赖
npm install

# 启动开发服务器
npm start

# 生成模拟数据
node scripts/generateMockData.js---

## 四、项目结构说明

managesystem-backend/
├── server.js               # 入口文件，Express + MongoDB 初始化
├── routes/                 # 路由模块（按业务拆分）
│   ├── auth.js             # 认证（登录、注册、验证码）
│   ├── hotel.js            # 酒店管理（CRUD、审核、发布）
│   ├── review.js           # 评论管理
│   ├── favorite.js         # 收藏管理
│   ├── browsingHistory.js  # 浏览历史
│   ├── userPreference.js   # 用户偏好
│   ├── recommendation.js   # 智能推荐
│   └── ai.js               # AI 助手
├── models/                 # 数据模型（Mongoose Schema）
│   ├── User.js
│   ├── Hotel.js
│   ├── Review.js
│   ├── Favorite.js
│   ├── BrowsingHistory.js
│   └── UserPreference.js
├── uploads/                # 上传图片存储目录
├── scripts/                # 辅助脚本
│   └── generateMockData.js # 生成模拟数据
├── package.json
└── README.md               # 本文件> 更细的模型和路由说明分别见：
> - `models/README.md`
> - `routes/README.md`

---

## 五、核心模块与 API 概览

### 1. 认证模块（`routes/auth.js`）

**基础路径**：`/api/auth`

| 方法 | 路径             | 描述           | 认证 |
|------|------------------|----------------|------|
| POST | `/register`      | 用户注册       | 否   |
| POST | `/login`         | 用户登录       | 否   |
| POST | `/sendCode`      | 发送邮箱验证码 | 否   |
| POST | `/verifyCode`    | 验证邮箱验证码 | 否   |
| GET  | `/info`          | 获取当前用户   | 是   |
| POST | `/update`        | 更新用户信息   | 是   |

**要点：**

- 使用 **Nodemailer** 通过 QQ 邮箱发送验证码（邮件注册流程）。
- 登录成功后签发 JWT，前端需在请求头携带：
  - `Authorization: Bearer <token>`

---

### 2. 酒店模块（`routes/hotel.js`）

**基础路径**：`/api/hotel`

| 方法 | 路径              | 描述                       | 认证 |
|------|-------------------|----------------------------|------|
| GET  | `/list`           | 获取酒店列表（带筛选）     | 否   |
| GET  | `/detail/:id`     | 获取酒店详情               | 否   |
| POST | `/create`         | 创建酒店（含图片上传）     | 是   |
| PUT  | `/update/:id`     | 更新酒店（含图片上传）     | 是   |
| DELETE | `/:id`          | 删除酒店                   | 是   |
| POST | `/:id/submit`     | 商户提交酒店审核           | 是   |
| POST | `/:id/resubmit`   | 审核未通过后重新提交       | 是   |
| PUT  | `/:id/review`     | 管理员审核（通过/拒绝）    | 是   |
| POST | `/:id/publish`    | 发布/下架酒店（上线/下线） | 是   |

**列表筛选参数（`GET /api/hotel/list`）示例：**

- `status`: 审核状态（如 `pending`、`published`、`rejected`；支持多值：`pending,rejected`）
- `publishStatus`: 发布状态（如 `draft`、`published`；支持多值）
- `ownerId`: 商户 ID（查询某个商户自己的酒店）
- `city`: 城市名称
- `keyword`: 关键词（酒店名/地址模糊查询）
- `minPrice` / `maxPrice`: 价格区间
- `rating`: 最低评分
- `amenities`: 设施列表

**实现要点：**

- 使用 `multer` 的 `upload.fields` 处理：
  - 酒店图片：`images`
  - 房型图片：`roomImages`
- `update` 接口中同时处理：
  - 旧图片 URL（字符串）
  - 新上传图片文件（`File`/`Buffer`）

---

### 3. 评论模块（`routes/review.js`）

**基础路径**：`/api/review`

| 方法 | 路径                    | 描述           | 认证 |
|------|-------------------------|----------------|------|
| POST | `/create`               | 创建评论       | 是   |
| GET  | `/hotel/:hotelId`       | 获取酒店评论   | 否   |
| DELETE | `/:id`                | 删除评论       | 是   |

评论与酒店详情（移动端/管理端）联动，用于展示真实评价数量和详情。

---

### 4. 收藏模块（`routes/favorite.js`）

**基础路径**：`/api/favorite`

| 方法 | 路径                   | 描述               | 认证 |
|------|------------------------|--------------------|------|
| POST | `/add`                 | 添加收藏           | 是   |
| DELETE | `/remove/:hotelId`   | 取消收藏           | 是   |
| GET  | `/list`                | 获取收藏列表       | 是   |
| POST | `/sync`                | 批量同步收藏状态   | 是   |

与移动端 `Favorites` 页面结合，支持本地缓存与服务端同步。

---

### 5. 浏览历史模块（`routes/browsingHistory.js`）

**基础路径**：`/api/browsingHistory`

| 方法 | 路径         | 描述           | 认证 |
|------|--------------|----------------|------|
| POST | `/add`       | 添加浏览记录   | 是   |
| GET  | `/list`      | 获取浏览历史   | 是   |
| DELETE | `/clear`   | 清空浏览历史   | 是   |

与移动端 `BrowsingHistory` 页面功能对应。

---

### 6. 用户偏好模块（`routes/userPreference.js`）

**基础路径**：`/api/preference`

| 方法 | 路径    | 描述           | 认证 |
|------|---------|----------------|------|
| GET  | `/get`  | 获取用户偏好   | 是   |
| POST | `/update` | 更新用户偏好 | 是   |

用于个性化推荐：价格偏好、星级偏好、常去城市等。

---

### 7. 推荐模块（`routes/recommendation.js`）

**基础路径**：`/api/recommendation`

| 方法 | 路径                 | 描述               | 认证 |
|------|----------------------|--------------------|------|
| GET  | `/behavior-data`     | 获取用户行为数据   | 是   |
| GET  | `/similar-users`     | 获取相似用户       | 是   |
| GET  | `/popular`           | 获取热门酒店推荐   | 否   |

（可扩展个性化推荐接口，如 `/for-you`）

---

### 8. AI 助手模块（`routes/ai.js`）

**基础路径**：`/api/ai`

| 方法 | 路径    | 描述           | 认证 |
|------|---------|----------------|------|
| POST | `/chat` | AI 智能助手对话 | 否   |

**实现说明：**

- 使用 `fetch` 请求 `https://yinli.one/v1/chat/completions`
- 请求体兼容 OpenAI Chat Completion 协议：
  - `model`
  - `messages`（包含 system、user、assistant）
- 支持将多轮对话上下文传入，实现连续对话

---

## 六、数据模型概览（简要）

> 详细字段说明见 `models/README.md`。

### 1. User（用户）

- 角色：`user` / `merchant` / `admin`
- 字段：用户名、密码（加密）、邮箱、电话、角色、状态、头像、实名信息等

### 2. Hotel（酒店）

- 基础信息：名称、描述、地址、城市、价格、评分
- 图片：`images`（字符串数组）
- 设施：`amenities`（字符串数组）
- 状态：
  - 审核状态：`status`（pending/published/rejected/offline）
  - 发布状态：`publishStatus`（draft/published）
- 关联：`ownerId`（商户）、`roomTypes`（房型）、`rejectReason`

### 3. Review（评论）

- 关联：`hotelId`、`userId`
- 内容：评分、文字内容、图片、情感类型（好评/中评/差评）

### 4. Favorite（收藏）

- `userId` + `hotelId` 复合唯一索引（避免重复收藏）

### 5. BrowsingHistory（浏览历史）

- 记录用户查看酒店的时间、来源渠道（搜索/推荐/首页等）

### 6. UserPreference（用户偏好）

- 价格区间、星级偏好、常用设施、常去城市、平均消费等

---

## 七、生成模拟数据

为方便开发与测试，可执行以下脚本生成模拟数据：

node scripts/generateMockData.js生成内容包括：用户、酒店、评论、收藏等。

---

## 八、数据库配置

- **数据库名称**：`ctrip_hotel`
- 默认连接串在 `server.js` 中配置为：

mongoose.connect('mongodb://localhost:27017/ctrip_hotel', { ... });如需连接远程 MongoDB，可自行修改连接字符串或使用环境变量。

---
