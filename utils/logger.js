/**
 * 操作日志中间件
 * 使用 res.on('finish') 确保每个请求只记录一次日志
 *
 * 拦截: res.json(), res.status().json(), res.send()
 */

import jwt from 'jsonwebtoken';
import { OperationLogDB } from './dbFactory.js';

function extractUserInfo(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return { userId: null, username: '', role: '' };
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return { userId: decoded.id || null, username: decoded.username || '', role: decoded.role || '' };
  } catch {
    return { userId: null, username: '', role: '' };
  }
}

function inferModuleAndAction(req) {
  const path = req.path;
  const method = req.method;

  const moduleMap = {
    '/api/auth': 'auth', '/api/hotel': 'hotel', '/api/review': 'review',
    '/api/favorite': 'favorite', '/api/browsingHistory': 'browsingHistory',
    '/api/preference': 'userPreference', '/api/recommendation': 'recommendation',
    '/api/ai': 'ai', '/api/log': 'operationLog',
  };

  let module = 'system';
  for (const [prefix, m] of Object.entries(moduleMap)) {
    if (path.startsWith(prefix)) { module = m; break; }
  }

  const actionMap = {
    GET: {
      list: 'query', detail: 'query', info: 'query', popular: 'query',
      'behavior-data': 'query', 'similar-users': 'query', stats: 'query',
      user: 'query', target: 'query', export: 'query', get: 'query'
    },
    POST: {
      create: 'create', add: 'add', register: 'register', login: 'login',
      logout: 'logout', sendCode: 'send', verifyCode: 'verify',
      submit: 'submit', publish: 'publish', sync: 'sync',
      update: 'update', chat: 'chat', review: 'approve', clear: 'clear'
    },
    PUT: { update: 'update', review: 'approve' },
    DELETE: { delete: 'delete', remove: 'remove', clear: 'clear' },
  };

  const segments = path.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || '';
  let action = 'other';
  const methodActions = actionMap[method] || {};
  if (methodActions[lastSegment]) {
    action = methodActions[lastSegment];
  } else if (method === 'POST') {
    action = 'create';
  } else if (method === 'PUT') {
    action = 'update';
  } else if (method === 'DELETE') {
    action = 'delete';
  } else {
    action = 'query';
  }
  return { module, action };
}

// 提取路径中真正的资源 ID（跳过路由关键字，只取 ObjectId 格式）
function extractTargetId(req) {
  const skip = new Set([
    'list', 'detail', 'search', 'city', 'get', 'create', 'update', 'delete',
    'publish', 'submit', 'resubmit', 'review', 'add', 'remove', 'sync', 'clear',
    'info', 'hotel', 'favorite', 'browsingHistory', 'preference', 'recommendation',
    'ai', 'auth', 'sendCode', 'verifyCode', 'stats', 'user', 'target', 'export'
  ]);
  const segments = req.path.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    // 跳过非 ObjectId 格式的词段（如 'api', 'hotel', 'update' 等）
    if (skip.has(seg)) continue;
    // ObjectId: 24位十六进制
    if (/^[0-9a-fA-F]{24}$/.test(seg)) return seg;
    // 也允许其他数字 ID
    if (/^\d+$/.test(seg)) return seg;
  }
  return '';
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || '';
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return null;
  const sensitive = ['password', 'token', 'authorization', 'secret', 'apiKey', 'api_key', 'mailPass', 'mail_pass'];
  const sanitized = {};
  for (const [k, v] of Object.entries(body)) {
    if (sensitive.includes(k.toLowerCase())) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'string' && v.length > 500) {
      sanitized[k] = v.slice(0, 500) + '...';
    } else {
      sanitized[k] = v;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

export function createOperationLog(req, res, next) {
  if (!req.path.startsWith('/api')) return next();

  const startTime = Date.now();
  const { userId, username, role } = extractUserInfo(req);
  const { module, action } = inferModuleAndAction(req);
  const targetId = extractTargetId(req);
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';

  let responseBody = null;
  let responseCode = 200;
  let responseMessage = '';
  let logged = false;

  // 统一记录日志的方法
  function doLog(body) {
    if (logged) return;
    logged = true;

    responseBody = body;
    responseCode = body?.code || res.statusCode || 200;
    responseMessage = body?.message || body?.error || '';
    const isSuccess = responseCode === 200 || responseCode === 201;
    const status = isSuccess ? 'success' : 'failure';
    const duration = Date.now() - startTime;

    OperationLogDB.create({
      userId: userId || null,
      username,
      role,
      module,
      action,
      targetType: module.charAt(0).toUpperCase() + module.slice(1),
      targetId,
      targetName: body?.data?.name || body?.data?.username || body?.data?.hotelName || '',
      method: req.method,
      path: req.originalUrl || req.url,
      ip,
      userAgent,
      requestBody: sanitizeBody(req.body),
      responseCode,
      responseMessage,
      status,
      duration,
      error: status === 'failure' ? responseMessage : '',
      metadata: { query: req.query && Object.keys(req.query).length > 0 ? req.query : undefined }
    }).catch(err => console.error('[OperationLog] Failed to save log:', err.message));
  }

  // 保存原始方法引用
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalStatus = res.status.bind(res);

  // 包装 res.json
  res.json = function (body) {
    doLog(body);
    return originalJson(body);
  };

  // 包装 res.send
  res.send = function (body) {
    doLog(null);
    return originalSend(body);
  };

  // 包装 res.status().json() 链式
  res.status = function (code) {
    const statusChain = originalStatus(code);
    statusChain.json = function (body) {
      doLog(body);
      return originalJson(body);
    };
    statusChain.send = function (body) {
      doLog(null);
      return originalSend(body);
    };
    return statusChain;
  };

  // 使用 'finish' 事件兜底（捕获所有未拦截的响应路径）
  res.on('finish', () => {
    if (!logged) {
      doLog(null);
    }
  });

  next();
}

export async function logOperation({ req, userId, username, role, module, action, targetType, targetId, targetName, responseCode, responseMessage, status, error, metadata }) {
  try {
    await OperationLogDB.create({
      userId: userId || null,
      username: username || '',
      role: role || '',
      module,
      action,
      targetType: targetType || module.charAt(0).toUpperCase() + module.slice(1),
      targetId: targetId || '',
      targetName: targetName || '',
      method: req?.method || 'POST',
      path: req?.originalUrl || req?.url || '',
      ip: req ? getClientIp(req) : '',
      userAgent: req?.headers?.['user-agent'] || '',
      requestBody: req ? sanitizeBody(req.body) : null,
      responseCode: responseCode || 200,
      responseMessage: responseMessage || '',
      status: status || 'success',
      duration: 0,
      error: error || '',
      metadata: metadata || {}
    });
  } catch (err) {
    console.error('[OperationLog] Manual log failed:', err.message);
  }
}
