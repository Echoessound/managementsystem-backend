# 携程酒店管理系统 — 后端服务

本项目为**携程酒店管理系统**的后端 RESTful API 服务，基于 Node.js + Express + MongoDB 构建，为 Web 管理端和移动端 App 提供全部业务接口，包括用户认证、酒店管理、评论收藏、智能推荐及 AI 助手等核心功能。

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js ≥ 14 |
| Web 框架 | Express.js |
| 数据库 | MongoDB（通过 Mongoose ODM） |
| 认证 | JWT（JSON Web Token） |
| 文件上传 | Multer（存储至 `uploads/` 目录） |
| 邮件服务 | Nodemailer（QQ 邮箱 SMTP） |
| AI 接口 | OpenAI 兼容协议（`https://yinli.one/v1`） |

---

## 快速开始

### 1. 安装依赖

```bash
cd managesystem-backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并按需修改以下配置项：

```bash
cp .env.example .env
```

关键配置项说明：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `PORT` | 服务监听端口 | `8080` |
| `DATABASE_URL` | MongoDB 连接串 | `mongodb://localhost:27017/ctrip_hotel` |
| `JWT_SECRET` | JWT 签名密钥 | `your-secret-key` |
| `EMAIL_HOST` / `EMAIL_PORT` | SMTP 服务器地址与端口 | `smtp.qq.com` / `587` |
| `EMAIL_USER` / `EMAIL_PASS` | 发件邮箱账号与授权码 | — |

### 3. 初始化数据库

首次运行前，可选择生成测试数据：

```bash
# 方式一：通过 db.js 脚本（推荐）
node scripts/db.js seed

# 方式二：通过模拟数据脚本
node scripts/generateMockData.js
```

### 4. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:8080`。

---

## 项目结构

```
managesystem-backend/
├── server.js                    # 入口文件，Express + MongoDB 初始化
├── .env.example                 # 环境变量模板（复制为 .env 后使用）
├── .gitignore
├── package.json
├── routes/                      # 路由模块（按业务领域拆分）
│   ├── auth.js                  # 认证（登录、注册、邮箱验证码）
│   ├── hotel.js                 # 酒店管理（CRUD、审核、发布/下架）
│   ├── review.js                # 评论管理
│   ├── favorite.js              # 收藏管理
│   ├── browsingHistory.js       # 浏览历史
│   ├── userPreference.js        # 用户偏好
│   ├── recommendation.js         # 智能推荐
│   ├── ai.js                    # AI 助手对话
│   └── operationLog.js          # 操作日志
├── utils/
│   ├── dbFactory.js             # 数据访问层（统一的 Schema + CRUD）
│   ├── health.js                # 健康检查端点（GET /api/health）
│   └── logger.js                # 日志中间件（慢查询记录）
├── scripts/
│   ├── db.js                    # 数据库管理脚本（seed/backup/restore/status/reset）
│   └── generateMockData.js       # 生成浏览历史、收藏、偏好等模拟数据
├── uploads/                     # 用户上传图片存储目录
└── README.md                    # 本文件
```

> 详细的路由说明见 `routes/README.md`。

---

## 数据库管理脚本

`node scripts/db.js` 提供以下命令：

| 命令 | 说明 |
|------|------|
| `seed` | 生成完整测试数据（用户、酒店、评论等） |
| `backup [name]` | 备份数据库（默认文件名含时间戳） |
| `restore <name>` | 从备份文件恢复数据库 |
| `status` | 查看数据库集合统计信息 |
| `reset --confirm` | 清空所有集合（需确认） |
| `clear <col>` | 清空指定集合 |

---

## API 概览

### 认证 `/api/auth`

| 方法 | 路径 | 说明 | 需认证 |
|------|------|------|--------|
| POST | `/register` | 用户注册 | 否 |
| POST | `/login` | 用户登录 | 否 |
| POST | `/sendCode` | 发送邮箱验证码 | 否 |
| POST | `/verifyCode` | 验证邮箱验证码 | 否 |
| GET | `/info` | 获取当前用户信息 | 是 |
| POST | `/update` | 更新用户信息 | 是 |

### 酒店 `/api/hotel`

| 方法 | 路径 | 说明 | 需认证 |
|------|------|------|--------|
| GET | `/list` | 获取酒店列表（支持城市/价格/评分/关键词筛选） | 否 |
| GET | `/detail/:id` | 获取酒店详情 | 否 |
| POST | `/create` | 创建酒店（含图片上传） | 是 |
| PUT | `/update/:id` | 更新酒店信息 | 是 |
| DELETE | `/:id` | 删除酒店 | 是 |
| POST | `/:id/submit` | 商户提交审核 | 是 |
| POST | `/:id/review` | 管理员审核（通过/拒绝） | 是 |
| POST | `/:id/publish` | 发布/下架酒店 | 是 |

### 评论 `/api/review`

| 方法 | 路径 | 说明 | 需认证 |
|------|------|------|--------|
| POST | `/create` | 发表评论 | 是 |
| GET | `/hotel/:hotelId` | 获取酒店评论列表 | 否 |
| DELETE | `/:id` | 删除评论 | 是 |

### 收藏 `/api/favorite`

| 方法 | 路径 | 说明 | 需认证 |
|------|------|------|--------|
| POST | `/add` | 添加收藏 | 是 |
| DELETE | `/remove/:hotelId` | 取消收藏 | 是 |
| GET | `/list` | 获取收藏列表 | 是 |

### 浏览历史 `/api/browsingHistory`

| 方法 | 路径 | 说明 | 需认证 |
|------|------|------|--------|
| POST | `/add` | 添加浏览记录 | 是 |
| GET | `/list` | 获取浏览历史 | 是 |
| DELETE | `/clear` | 清空浏览历史 | 是 |

### 用户偏好 `/api/preference`

| 方法 | 路径 | 说明 | 需认证 |
|------|------|------|--------|
| GET | `/get` | 获取用户偏好 | 是 |
| POST | `/update` | 更新用户偏好 | 是 |

### 智能推荐 `/api/recommendation`

| 方法 | 路径 | 说明 | 需认证 |
|------|------|------|--------|
| GET | `/popular` | 获取热门酒店推荐 | 否 |
| GET | `/behavior-data` | 获取用户行为数据 | 是 |
| GET | `/similar-users` | 获取相似用户 | 是 |

### AI 助手 `/api/ai`

| 方法 | 路径 | 说明 | 需认证 |
|------|------|------|--------|
| POST | `/chat` | AI 智能对话（多轮上下文） | 否 |

### 健康检查 `GET /api/health`

返回系统运行状态、MongoDB 连接信息、内存使用情况及各集合文档数量。

---

## 数据模型

| 模型 | 说明 |
|------|------|
| `User` | 用户（角色：user / merchant / admin） |
| `Hotel` | 酒店（含审核状态、发布状态、房型） |
| `Review` | 评论（关联酒店与用户，含情感类型） |
| `Favorite` | 收藏（userId + hotelId 复合唯一索引） |
| `BrowsingHistory` | 浏览历史（含来源渠道：搜索/推荐/首页） |
| `UserPreference` | 用户偏好（价格区间、星级、设施、城市） |
| `OperationLog` | 操作日志 |
| `SlowQueryLog` | 慢查询日志 |

---

## 测试账号

使用 `node scripts/db.js seed` 初始化后可用以下账号登录：

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | `admin` | `123456` |
| 商户 | `hotel1` | `123456` |
| 普通用户 | `user1` | `123456` |
