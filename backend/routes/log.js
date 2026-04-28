const express = require('express');
const router = express.Router();

// 日志接口
router.get('/', (req, res) => {
  res.json({ message: 'Log API placeholder' });
});

module.exports = router;