# 数据模型

本目录包含项目的 MongoDB 数据库 Schema 定义。

## 模型列表

### 1. Hotel（酒店）
表示酒店房源信息。

**字段说明：**
- `name`: 字符串（必填）- 酒店名称
- `address`: 字符串（必填）- 完整地址
- `city`: 字符串（必填，已索引）- 所在城市
- `district`: 字符串 - 所在区域
- `price`: 数字（必填，最小值 0）- 基础价格
- `rating`: 数字（默认 0，最大 5）- 用户评分
- `images`: 字符串数组 - 酒店图片 URL 列表
- `description`: 字符串 - 酒店描述
- `amenities`: 字符串数组 - 设施列表（如 WiFi、游泳池等）
- `contactPhone`: 字符串 - 联系电话
- `ownerId`: ObjectId（引用 User，必填）- 酒店所有者（商户）ID
- `ownerName`: 字符串 - 所有者姓名
- `status`: 字符串（枚举：pending/published/rejected/offline，默认 pending，已索引）- 管理员审核状态
- `rejectReason`: 字符串 - 拒绝原因
- `publishStatus`: 字符串（枚举：published/draft，默认 draft）- 用户端可见状态
- `reviewCount`: 数字（默认 0）- 评论数量
- `latitude`, `longitude`: 数字 - 地理坐标
- `roomTypes`: 对象数组 - 房型信息（名称、价格、容量、图片等）

**索引：**
- `city` + `status`
- `ownerId`
- `price`
- `rating`（降序）

---

### 2. Review（评论）
表示用户对酒店的评论。

**字段说明：**
- `hotelId`: ObjectId（引用 Hotel，已索引）
- `userId`: ObjectId（引用 User，必填）
- `userName`: 字符串（必填）
- `userAvatar`: 字符串 - 用户头像
- `rating`: 数字（必填，1-5）
- `content`: 字符串（必填，最大 1000 字符）
- `images`: 字符串数组 - 评论图片
- `type`: 字符串（枚举：good/neutral/bad）- 评论情感类型

**索引：**
- `hotelId` + `createdAt`（降序）

---

### 3. User（用户）
表示系统用户（普通用户、商户或管理员）。

**字段说明：**
- `username`: 字符串（必填，唯一）
- `password`: 字符串（必填）- 加密后的密码
- `phone`: 字符串（必填，唯一）
- `role`: 字符串（枚举：user/merchant/admin，默认 user）
- `avatar`: 字符串 - 头像 URL
- `gender`: 字符串（枚举：male/female/other）
- `email`: 字符串
- `idCard`: 字符串 - 身份证号
- `realName`: 字符串 - 真实姓名
- `status`: 字符串（枚举：active/inactive/banned，默认 active）

---

### 4. BrowsingHistory（浏览历史）
记录用户浏览酒店的行为。

**字段说明：**
- `userId`: ObjectId（引用 User，已索引）
- `hotelId`: ObjectId（引用 Hotel，已索引）
- `viewedAt`: 日期（默认当前时间）
- `duration`: 数字（默认 0）- 浏览时长（秒）
- `source`: 字符串（枚举：search/detail/recommendation/home）- 来源渠道

**索引：**
- `userId` + `viewedAt`（降序）

---

### 5. UserPreference（用户偏好）
存储用户行为分析和偏好数据，用于智能推荐。

**字段说明：**
- `userId`: ObjectId（引用 User，必填，唯一，已索引）
- `priceRange`: 数字数组（默认 [0, 2000]）- 价格偏好区间
- `starPreference`: 数字数组（默认 [3, 4, 5]）- 星级偏好
- `amenities`: 字符串数组 - 偏好设施
- `cityPreference`: 字符串数组 - 常去城市
- `avgPrice`: 数字（默认 0）- 平均消费价格
- `totalBookings`: 数字（默认 0）- 累计预订次数
- `lastSearchCity`: 字符串 - 最后搜索城市
- `lastSearchKeyword`: 字符串 - 最后搜索关键词

---

### 6. Favorite（收藏）
记录用户收藏的酒店。

**字段说明：**
- `userId`: ObjectId（引用 User，已索引）
- `hotelId`: ObjectId（引用 Hotel，已索引）

**索引：**
- `userId` + `hotelId`（唯一）- 防止用户重复收藏同一家酒店
