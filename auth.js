/**
 * auth.js - JWT 鉴权中间件
 * 包含 JWT 签发函数和验证中间件
 */

const jwt = require('jsonwebtoken');

/** JWT 密钥，生产环境应使用环境变量 */
const JWT_SECRET = process.env.JWT_SECRET || 'behcet-alliance-secret-key-2025';

/** Token 有效期：24 小时 */
const TOKEN_EXPIRES_IN = '24h';

/**
 * 签发 JWT Token
 * @param {object} payload - 要编码的数据，如 { id, username }
 * @returns {string} JWT token 字符串
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

/**
 * JWT 鉴权中间件
 * 验证请求头中的 Bearer Token，成功后将用户信息挂载到 req.user
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌，请先登录' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '认证令牌已过期，请重新登录' });
    }
    return res.status(401).json({ error: '无效的认证令牌' });
  }
}

module.exports = { signToken, authMiddleware };
