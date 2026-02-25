/**
 * AI 助手路由 - 讯飞 MaaS API 代理 (WebSocket 方式)
 */

const express = require('express');
const crypto = require('crypto');
const WebSocket = require('ws');

const router = express.Router();

// 讯飞 MaaS API 配置
const SPARK_CONFIG = {
  appId: '8c1cd4b7eedcbbc67bb3e50552362943',
  apiKey: '8c1cd4b7eedcbbc67bb3e50552362943',
  apiSecret: 'ZDZlM2ViNGZlNWMyMDY5ZDliYTE2YzVi',
  apiHost: 'maas-api.cn-huabei-1.xf-yun.com',
  apiPath: '/v2/chat',
};

/**
 * 生成鉴权 URL (WebSocket)
 */
function getAuthUrl() {
  const now = new Date();
  const date = now.toUTCString();

  // 讯飞 v2 API 需要使用 POST 签名
  const signatureOrigin = `host: ${SPARK_CONFIG.apiHost}\ndate: ${date}\nPOST ${SPARK_CONFIG.apiPath} HTTP/1.1`;

  // HMAC-SHA256 签名，使用 apiSecret
  const signatureSha = crypto
    .createHmac('sha256', SPARK_CONFIG.apiSecret)
    .update(signatureOrigin)
    .digest('base64');

  // 构造 Authorization
  const authorizationOrigin = `api_key="${SPARK_CONFIG.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');

  // 拼接最终 URL
  const url = `wss://${SPARK_CONFIG.apiHost}${SPARK_CONFIG.apiPath}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(SPARK_CONFIG.apiHost)}`;

  console.log('=== 签名信息 ===');
  console.log('signatureOrigin:', signatureOrigin);
  console.log('signatureSha:', signatureSha);
  console.log('authorization:', authorization);

  return url;
}

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

    console.log('=== 连接讯飞 MaaS WebSocket ===');
    console.log('URL:', getAuthUrl());

    // 使用 WebSocket 连接
    const aiResponse = await new Promise((resolve, reject) => {
      const wsUrl = getAuthUrl();
      const ws = new WebSocket(wsUrl);
      
      let fullContent = '';
      let hasResolved = false;

      const cleanup = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };

      ws.on('open', () => {
        console.log('WebSocket 连接成功');
        
        const params = {
          header: {
            app_id: SPARK_CONFIG.appId,
          },
          parameter: {
            chat: {
              domain: 'generalv3.5',
              temperature: 0.5,
              max_tokens: 2048,
            },
          },
          payload: {
            message: {
              text: messages,
            },
          },
        };
        
        console.log('发送消息:', JSON.stringify(params));
        ws.send(JSON.stringify(params));
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          console.log('收到响应:', JSON.stringify(response));
          
          if (response.header && response.header.code !== 0) {
            reject(new Error(`API error: ${response.header.message}`));
            return;
          }

          const content = response.payload?.choices?.text?.[0]?.content || '';
          fullContent += content;
        } catch (e) {
          console.error('解析响应失败:', e);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket 错误:', error.message);
        if (!hasResolved) {
          hasResolved = true;
          cleanup();
          reject(error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket 连接关闭');
        if (!hasResolved) {
          hasResolved = true;
          resolve(fullContent);
        }
      });

      // 30秒超时
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          cleanup();
          reject(new Error('请求超时'));
        }
      }, 30000);
    });

    console.log('AI 回复:', aiResponse);

    return res.json({ 
      success: true, 
      message: aiResponse,
    });

  } catch (error) {
    console.error('=== AI API 错误 ===');
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message || 'AI 服务调用失败' });
  }
});

module.exports = router;
