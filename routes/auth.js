/**
 * 认证路由
 * POST /api/auth/sendCode - 发送邮箱验证码
 * POST /api/auth/register - 用户注册
 * POST /api/auth/login - 用户登录
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// 模拟数据库（内存存储）- 验证码
const verificationCodes = {};

// 邮箱验证码发送配置
const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
        user: 'echo_chat@foxmail.com',
        pass: 'hykiffnwauducjhg'
    }
});

/**
 * 生成验证码
 */
function generateCode() {
    return crypto.randomBytes(3).toString('hex'); // 6位验证码
}

/**
 * 发送验证码
 * POST /api/auth/sendCode
 * Body: { email }
 */
router.post('/sendCode', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({ code: 400, message: '请提供邮箱地址' });
    }

    // 生成验证码
    const code = generateCode();
    verificationCodes[email] = {
        code,
        expires: Date.now() + 5 * 60 * 1000 // 5分钟有效
    };

    // 发送邮件
    const mailOptions = {
        from: '"酒店管理系统" <echo_chat@foxmail.com>',
        to: email,
        subject: '酒店管理系统 - 验证码',
        html: `
            <h2>您的验证码是: <strong style="color: #1890ff;">${code}</strong></h2>
            <p>验证码将在5分钟后过期，请尽快使用。</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('邮件发送失败:', error);
            return res.json({ code: 500, message: '验证码发送失败' });
        }
        console.log(`[邮件发送成功] 收件人: ${email}`);
        res.json({ code: 200, message: '验证码已发送' });
    });
});

/**
 * 用户注册
 * POST /api/auth/register
 * Body: { username, password, email, code, role, phone }
 */
router.post('/register', async (req, res) => {
    const { username, password, email, code, role, phone } = req.body;

    // 参数验证
    if (!username || !password || !email || !code) {
        return res.json({ code: 400, message: '缺少必填参数' });
    }

    // 验证验证码
    const storedCode = verificationCodes[email];
    if (!storedCode) {
        return res.json({ code: 400, message: '请先获取验证码' });
    }
    if (Date.now() > storedCode.expires) {
        delete verificationCodes[email];
        return res.json({ code: 400, message: '验证码已过期' });
    }
    if (code !== storedCode.code) {
        return res.json({ code: 400, message: '验证码错误' });
    }

    try {
        // 检查用户是否已存在
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });
        if (existingUser) {
            if (existingUser.email === email) {
                return res.json({ code: 400, message: '该邮箱已注册' });
            }
            return res.json({ code: 400, message: '用户名已被占用' });
        }

        // 创建用户
        const newUser = new User({
            username,
            password, // 实际项目应该加密存储
            email,
            role: role || 'user',
            phone
        });

        await newUser.save();
        delete verificationCodes[email]; // 清除验证码

        console.log(`[注册成功] 用户: ${username}, 邮箱: ${email}`);
        res.json({
            code: 200,
            message: '注册成功',
            data: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error('注册失败:', error);
        res.json({ code: 500, message: '注册失败' });
    }
});

/**
 * 用户登录
 * POST /api/auth/login
 * Body: { username, password }
 */

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.json({ code: 400, message: '请提供用户名和密码' });
    }

    try {
        // 查找用户
        const user = await User.findOne({ username, password });//查找用户

        if (!user) {
            return res.json({ code: 401, message: '用户名或密码错误' });
        }

        // 生成 token
        const token = crypto.randomBytes(32).toString('hex');
        user.token = token;
        await user.save();

        console.log(`[登录成功] 用户: ${username}`);
        res.json({
            code: 200,
            message: '登录成功',
            data: {//返回用户信息和token
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                },
                token//返回token
            }
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.json({ code: 500, message: '登录失败' });
    }
});

module.exports = router;
