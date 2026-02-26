/**
 * AI 助手路由 - OpenAI 兼容 API (https://yinli.one/v1)
 */

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// API 配置
const API_CONFIG = {
  apiKey: 'sk-CRta49aYq6R91U1u4393RaAX8IUrJkqVo0PQ5JFUeLJpYWCM',
  baseUrl: 'https://yinli.one',
  model: 'gpt-3.5-turbo',
};

/**
 * POST /api/ai/chat
 * AI 聊天接口
 */
router.post('/chat', async (req, res) => {
  console.log('=== AI Chat 请求 received ===');

  try {
    // 支持两种格式：{ message, history } 或 { messages: [{role, content}] }
    let { message, history, messages: frontMessages } = req.body;

    // 如果前端发送的是 messages 格式
    if (frontMessages && Array.isArray(frontMessages) && frontMessages.length > 0) {
      // 提取最后一条用户消息
      const lastUserMsg = [...frontMessages].reverse().find(m => m.role === 'user');
      message = lastUserMsg ? lastUserMsg.content : '';

      // 将前端消息转换为 history 格式
      history = frontMessages.filter(m => m.role !== 'user').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
    }

    if (!message) {
      console.log('Error: message is empty');
      return res.status(400).json({ error: '消息不能为空' });
    }

    console.log('User message:', message);

    // 构建消息列表
    const messages = [];

    // 添加系统提示
    const systemPrompt = `你是一个酒店预订助手，专门帮助用户解答关于酒店的问题。请用中文回答用户的问题。

你可以帮助用户：
1. 推荐合适的酒店
2. 解答酒店设施、入住退房政策等问题
3. 提供酒店价格信息
4. 介绍酒店位置和周边环境
5. 回答会员权益和优惠相关问题

请用友好、专业的语气回答问题。如果不确定某些信息，请告知用户建议直接联系酒店确认。`;

    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // 添加历史消息（如果有）
    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      });
    }

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: message,
    });

    console.log('=== 调用 AI API ===');
    console.log('URL:', `${API_CONFIG.baseUrl}/v1/chat/completions`);

    // 调用 OpenAI 兼容 API
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
    return res.status(500).json({ error: error.message || 'AI 服务调用失败' });
  }
});

module.exports = router;
