/**
 * AI 助手路由 - OpenAI 兼容 API
 * 需要用户登录后访问
 */

import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// 认证中间件
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) return res.json({ code: 401, message: '未登录' });
  console.log(`[AUTH] 请求路径: ${req.path}, Token: ${token.substring(0, 20)}...`);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log(`[AUTH] Token 验证成功, userId=${decoded.id}, username=${decoded.username}`);
    req.userId = decoded.id;
    req.username = decoded.username;
    req.role = decoded.role;
    next();
  } catch (err) {
    console.error(`[AUTH] Token 验证失败: ${err.message}`);
    return res.json({ code: 401, message: 'token无效' });
  }
};

// API 配置（建议移到 .env）
const API_CONFIG = {
  apiKey: process.env.AI_API_KEY || 'testapisecretkey',
  baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com',
  model: process.env.AI_MODEL || 'gpt-3.5-turbo',
};

/**
 * POST /api/ai/chat
 * AI 聊天接口
 */
router.post('/chat', auth, async (req, res) => {
  console.log('=== AI Chat 请求 received ===');

  try {
    let { message, history, messages: frontMessages } = req.body;

    // 支持两种格式：{ message, history } 或 { messages: [{role, content}] }
    if (frontMessages && Array.isArray(frontMessages) && frontMessages.length > 0) {
      const lastUserMsg = [...frontMessages].reverse().find(m => m.role === 'user');
      message = lastUserMsg ? lastUserMsg.content : '';
      history = frontMessages.filter(m => m.role !== 'user').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
    }

    if (!message) {
      console.log('Error: message is empty');
      return res.json({ code: 400, message: '消息不能为空' });
    }

    console.log(`User [${req.username}] message:`, message);

    // 构建消息列表
    const messages = [];

    const systemPrompt = `你是一个酒店预订助手，专门帮助用户解答关于酒店的问题。请用中文回答用户的问题。

你可以帮助用户：
1. 推荐合适的酒店
2. 解答酒店设施、入住退房政策等问题
3. 提供酒店价格信息
4. 介绍酒店位置和周边环境
5. 回答会员权益和优惠相关问题

请用友好、专业的语气回答问题。如果不确定某些信息，请告知用户建议直接联系酒店确认。`;

    messages.push({ role: 'system', content: systemPrompt });

    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      });
    }

    messages.push({ role: 'user', content: message });

    console.log('=== 调用 AI API ===');
    console.log('URL:', `${API_CONFIG.baseUrl}/v1/chat/completions`);

    const apiResponse = await fetch(`${API_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('API 错误:', apiResponse.status, errorText);
      throw new Error(`API error: ${apiResponse.status} - ${errorText}`);
    }

    const responseData = await apiResponse.json();
    console.log('API 响应:', JSON.stringify(responseData));

    const aiMessage = responseData.choices?.[0]?.message?.content || '';

    if (!aiMessage) {
      throw new Error('API 返回内容为空');
    }

    console.log('AI 回复:', aiMessage);

    return res.json({
      success: true,
      message: aiMessage,
    });

  } catch (error) {
    console.error('=== AI API 错误 ===');
    console.error('Error:', error.message);
    return res.json({ code: 500, error: error.message || 'AI 服务调用失败' });
  }
});

export default router;
