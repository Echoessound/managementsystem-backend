# 路由接口文档

本目录包含后端 API 路由定义，所有路由均挂载在 `/api` 基础路径下。

---

## 1. hotel.js（酒店管理）

**挂载路径：** `/api/hotel`

**功能说明：** 酒店 CRUD、审核、发布/下架、列表查询。

| 方法 | 路径 | 说明 | 认证 | 参数 |
|------|------|------|------|------|
| GET | `/list` | 获取酒店列表（分页、筛选） | 否 | `page`, `pageSize`, `city`, `status`, `publishStatus`, `ownerId`, `keyword`, `minPrice`, `maxPrice`, `rating`, `amenities` |
| GET | `/detail/:id` | 获取酒店详情 | 否 | `id`（酒店 ObjectId） |
| GET | `/:id` | 获取酒店基本信息 | 否 | `id`（酒店 ObjectId） |
| POST | `/create` | 创建新酒店 | 是 | `FormData`（含图片文件） |
| PUT | `/update/:id` | 更新酒店信息 | 是 | `id`，`FormData`（含图片文件） |
| DELETE | `/:id` | 删除酒店 | 是 | `id` |
| POST | `/:id/publish` | 发布/下架酒店 | 是 | `id`，`publish`（布尔值） |
| POST | `/:id/submit` | 提交审核 | 是 | `id` |
| POST | `/:id/resubmit` | 重新提交审核 | 是 | `id` |
| PUT | `/:id/review` | 管理员审核酒店 | 是 | `id`，`status`（pending/published/rejected），`rejectReason` |

---

## 2. auth.js（认证与用户）

**挂载路径：** `/api/auth`

**功能说明：** 用户注册、登录、信息获取/更新、邮箱验证码。

| 方法 | 路径 | 说明 | 认证 | 参数 |
|------|------|------|------|------|
| POST | `/register` | 用户注册 | 否 | `username`, `password`, `phone`, `role`, `email` |
| POST | `/login` | 用户登录 | 否 | `username`, `password` |
| GET | `/info` | 获取当前用户信息 | 是 | - |
| POST | `/update` | 更新用户信息 | 是 | `email`, `avatar`, `gender`, `realName`, `idCard` 等 |
| POST | `/sendCode` | 发送邮箱验证码 | 否 | `email` |
| POST | `/verifyCode` | 验证邮箱验证码 | 否 | `email`, `code` |

---

## 3. review.js（评论管理）

**挂载路径：** `/api/review`

**功能说明：** 酒店评论的创建、查询、删除。

| 方法 | 路径 | 说明 | 认证 | 参数 |
|------|------|------|------|------|
| POST | `/create` | 发表评论 | 是 | `hotelId`, `rating`, `content`, `images`, `type` |
| GET | `/hotel/:hotelId` | 获取酒店评论列表 | 否 | `hotelId`, `page`, `pageSize` |
| DELETE | `/:id` | 删除评论 | 是 | `id` |

---

## 4. favorite.js（收藏管理）

**挂载路径：** `/api/favorite`

**功能说明：** 酒店收藏的添加、移除、列表查询。

| 方法 | 路径 | 说明 | 认证 | 参数 |
|------|------|------|------|------|
| POST | `/add` | 添加收藏 | 是 | `hotelId` |
| DELETE | `/remove/:hotelId` | 取消收藏 | 是 | `hotelId` |
| GET | `/list` | 获取收藏列表 | 是 | `page`, `pageSize` |
| POST | `/sync` | 同步收藏状态 | 是 | `hotelIds`（数组） |

---

## 5. recommendation.js（智能推荐）

**挂载路径：** `/api/recommendation`

**功能说明：** 基于用户行为的智能推荐服务。

| 方法 | 路径 | 说明 | 认证 | 参数 |
|------|------|------|------|------|
| GET | `/behavior-data` | 获取用户行为数据 | 是 | - |
| GET | `/similar-users` | 获取相似用户列表 | 是 | - |
| GET | `/popular` | 获取热门酒店推荐 | 否 | `city`, `limit` |

---

## 6. userPreference.js（用户偏好）

**挂载路径：** `/api/userPreference`

**功能说明：** 读取和更新用户偏好设置，用于个性化推荐。

| 方法 | 路径 | 说明 | 认证 | 参数 |
|------|------|------|------|------|
| GET | `/get` | 获取用户偏好 | 是 | - |
| POST | `/update` | 更新用户偏好 | 是 | `priceRange`, `starPreference`, `amenities`, `cityPreference` 等 |

---

## 7. browsingHistory.js（浏览历史）

**挂载路径：** `/api/browsingHistory`

**功能说明：** 记录和查询用户浏览历史。

| 方法 | 路径 | 说明 | 认证 | 参数 |
|------|------|------|------|------|
| POST | `/add` | 添加浏览记录 | 是 | `hotelId`, `duration`, `source` |
| GET | `/list` | 获取浏览历史列表 | 是 | `page`, `pageSize` |
| DELETE | `/clear` | 清空浏览历史 | 是 | - |

---

## 8. ai.js（AI 助手）

**挂载路径：** `/api/ai`

**功能说明：** AI 智能助手对话功能。

| 方法 | 路径 | 说明 | 认证 | 参数 |
|------|------|------|------|------|
| POST | `/chat` | 发送消息获取 AI 回复 | 否 | `messages`（数组，含 role 和 content） |

**请求体示例：**
```json
{
  "messages": [
    { "role": "system", "content": "你是一个酒店助手..." },
    { "role": "user", "content": "推荐一家上海的酒店" }
  ]
}
```

---

## 9. operationLog.js（操作日志）

**挂载路径：** `/api/operationLog`

**功能说明：** 记录并查询用户在系统中的关键操作。

| 方法 | 路径 | 说明 | 认证 | 参数 |
|------|------|------|------|------|
| GET | `/list` | 获取操作日志列表 | 是 | `page`, `pageSize`, `action`, `userId` |
| POST | `/create` | 记录操作日志 | 是 | `action`, `targetType`, `targetId`, `details` |
| DELETE | `/clear` | 清空所有日志 | 是 | - |

---

## 通用说明

- **认证方式：** 除公开接口外，均需在请求头携带 `Authorization: Bearer <token>`（JWT Token）。
- **文件上传：** 涉及图片上传的接口使用 `multipart/form-data` 格式，由 `multer` 中间件处理。
- **返回格式：** 统一 JSON 格式，`code: 200` 表示成功，`code: 500` 或其他表示错误。

