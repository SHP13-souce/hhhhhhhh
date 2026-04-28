const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// 用户相关接口
router.get('/', (req, res) => {
  res.json({ message: 'User API placeholder' });
});
// 注册接口
router.post('/register', async (req, res) => {
  const { username, password, phone, role = 'user', nickname } = req.body;

  // 参数校验
  if (!username || !password) {
    return res.status(400).json({
      code: 400,
      message: '用户名和密码不能为空'
    });
  }

  try {
    // 检查用户名是否已存在
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, existingUser) => {
      if (err) {
        return res.status(500).json({
          code: 500,
          message: '服务器错误',
          error: err.message
        });
      }

      if (existingUser) {
        return res.status(400).json({
          code: 400,
          message: '用户名已存在'
        });
      }

      // 加密密码
      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          return res.status(500).json({
            code: 500,
            message: '密码加密失败'
          });
        }

        // 插入新用户
        db.run(
          `INSERT INTO users (username, password, phone, role, nickname) 
           VALUES (?, ?, ?, ?, ?)`,
          [username, hashedPassword, phone, role, nickname],
          function(err) {
            if (err) {
              return res.status(500).json({
                code: 500,
                message: '注册失败',
                error: err.message
              });
            }

            // 返回新用户信息（不包含密码）
            db.get(
              'SELECT id, username, phone, role, nickname, created_at FROM users WHERE id = ?',
              [this.lastID],
              (err, newUser) => {
                if (err) {
                  return res.status(500).json({
                    code: 500,
                    message: '获取用户信息失败'
                  });
                }

                res.json({
                  code: 200,
                  message: '注册成功',
                  data: newUser
                });
              }
            );
          }
        );
      });
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 登录接口
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      code: 400,
      message: '用户名和密码不能为空'
    });
  }

  try {
    // 查找用户
    db.get(
      'SELECT id, username, password, phone, role, nickname, created_at FROM users WHERE username = ?',
      [username],
      async (err, user) => {
        if (err) {
          return res.status(500).json({
            code: 500,
            message: '服务器错误',
            error: err.message
          });
        }

        if (!user) {
          return res.status(400).json({
            code: 400,
            message: '用户名或密码错误'
          });
        }

        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(400).json({
            code: 400,
            message: '用户名或密码错误'
          });
        }

        // 生成 JWT token
        const token = jwt.sign(
          { userId: user.id, username: user.username, role: user.role },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '7d' }
        );

        // 返回用户信息和 token
        res.json({
          code: 200,
          message: '登录成功',
          data: {
            token,
            user: {
              id: user.id,
              username: user.username,
              phone: user.phone,
              role: user.role,
              nickname: user.nickname
            }
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 获取当前用户信息中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '未提供访问令牌'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
    if (err) {
      return res.status(403).json({
        code: 403,
        message: '令牌无效'
      });
    }
    req.user = decoded;
    next();
  });
};

// 获取当前用户信息接口
router.get('/me', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, username, phone, role, nickname, created_at FROM users WHERE id = ?',
    [req.user.userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({
          code: 500,
          message: '服务器错误',
          error: err.message
        });
      }

      if (!user) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在'
        });
      }

      res.json({
        code: 200,
        message: '获取成功',
        data: user
      });
    }
  );
});

module.exports = router;