const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, phone, role = 'user' } = req.body;
    
    // 检查用户是否已存在
    const existingUser = await User.findOne({ $or: [{ username }, { phone }] });
    if (existingUser) {
      return res.json({ code: 400, message: '用户名或手机号已存在' });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      username,
      password: hashedPassword,
      phone,
      role
    });
    
    await newUser.save();
    
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
    const user = await User.findOne(query);
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
      'your-secret-key',
      { expiresIn: '7d' }
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
    
    const decoded = jwt.verify(token, 'your-secret-key');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.json({ code: 404, message: '用户不存在' });
    }
    
    res.json({ code: 200, data: user });
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
    
    const decoded = jwt.verify(token, 'your-secret-key');
    const { avatar, gender, email, realName } = req.body;
    
    const updateData = {};
    if (avatar !== undefined) updateData.avatar = avatar;
    if (gender !== undefined) updateData.gender = gender;
    if (email !== undefined) updateData.email = email;
    if (realName !== undefined) updateData.realName = realName;
    
    const user = await User.findByIdAndUpdate(
      decoded.id,
      { $set: updateData },
      { new: true }
    ).select('-password');
    
    res.json({ code: 200, data: user });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.json({ code: 500, message: '更新失败' });
  }
});

// 发送验证码
router.post('/sendCode', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.json({ code: 400, message: '手机号不能为空' });
    }
    
    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // TODO: 实际项目中应该调用短信服务发送验证码
    // 这里简化为直接返回验证码
    console.log(`验证码: ${code}`);
    
    res.json({ 
      code: 200, 
      message: '验证码发送成功',
      data: { code } // 开发环境返回验证码
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.json({ code: 500, message: '发送失败' });
  }
});

module.exports = router;

