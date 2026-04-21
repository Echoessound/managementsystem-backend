import express from 'express';
import { UserDB } from '../utils/dbFactory.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const router = express.Router();

// 邮件发送配置
const transporter = nodemailer.createTransport({
  service: 'qq',
  auth: {
    user: 'echo_chat@foxmail.com',
    pass: 'znuxbscaicpvdaed'
  }
});

// 验证码缓存（5分钟有效）
const codeCache = new Map();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, phone, role = 'user' } = req.body;

    // 检查用户是否已存在
    const existingUser = await UserDB.findOne({ $or: [{ username }, { phone }] });
    if (existingUser) {
      return res.json({ code: 400, message: '用户名或手机号已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await UserDB.create({
      username,
      password: hashedPassword,
      phone,
      role
    });

    res.json({ code: 200, message: '注册成功' });
  } catch (error) {
    console.error('注册失败:', error);
    res.json({ code: 500, message: '注册失败' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { phone, username, password } = req.body;

    // 支持手机号或用户名登录
    const query = phone ? { phone } : { username };

    // 查找用户
    const user = await UserDB.findOne(query);
    if (!user) {
      return res.json({ code: 404, message: '用户不存在' });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.json({ code: 401, message: '密码错误' });
    }

    // 生成token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      code: 200,
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.json({ code: 500, message: '登录失败' });
  }
});

// 获取用户信息
router.get('/info', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.json({ code: 401, message: '未登录' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await UserDB.findById(decoded.id);

    if (!user) {
      return res.json({ code: 404, message: '用户不存在' });
    }

    // 移除密码字段
    const { password, ...userWithoutPassword } = user;

    res.json({ code: 200, data: userWithoutPassword });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.json({ code: 401, message: 'token无效' });
  }
});

// 更新用户信息
router.post('/update', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.json({ code: 401, message: '未登录' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const { avatar, gender, email, realName } = req.body;

    const updateData = {};
    if (avatar !== undefined) updateData.avatar = avatar;
    if (gender !== undefined) updateData.gender = gender;
    if (email !== undefined) updateData.email = email;
    if (realName !== undefined) updateData.realName = realName;

    const user = await UserDB.findByIdAndUpdate(
      decoded.id,
      { $set: updateData },
      { new: true }
    );

    // 移除密码字段
    const { password, ...userWithoutPassword } = user;

    res.json({ code: 200, data: userWithoutPassword });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.json({ code: 500, message: '更新失败' });
  }
});

// 发送验证码
router.post('/sendCode', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({ code: 400, message: '邮箱不能为空' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.json({ code: 400, message: '邮箱格式不正确' });
    }

    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const mailOptions = {
      from: 'echo_chat@foxmail.com',
      to: email,
      subject: '携程酒店管理系统 - 验证码',
      html: `
        <div style="padding: 20px; background: #f5f5f5; border-radius: 8px;">
          <h2 style="color: #333;">您好，您的验证码是：</h2>
          <p style="font-size: 32px; font-weight: bold; color: #1890ff; letter-spacing: 8px;">${code}</p>
          <p style="color: #666; margin-top: 20px;">验证码有效期为 5 分钟，请尽快完成验证。</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">如果不是您本人操作，请忽略此邮件。</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`验证码已发送到 ${email}: ${code}`);

    codeCache.set(email, { code, expires: Date.now() + 5 * 60 * 1000 });

    res.json({ code: 200, message: '验证码发送成功' });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.json({ code: 500, message: '发送失败' });
  }
});

// 验证验证码
router.post('/verifyCode', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.json({ code: 400, message: '邮箱和验证码不能为空' });
    }

    const cached = codeCache.get(email);
    if (!cached) {
      return res.json({ code: 400, message: '请先获取验证码' });
    }

    if (Date.now() > cached.expires) {
      codeCache.delete(email);
      return res.json({ code: 400, message: '验证码已过期' });
    }

    if (cached.code !== code) {
      return res.json({ code: 400, message: '验证码错误' });
    }

    codeCache.delete(email);

    res.json({ code: 200, message: '验证成功' });
  } catch (error) {
    console.error('验证验证码失败:', error);
    res.json({ code: 500, message: '验证失败' });
  }
});

export default router;
