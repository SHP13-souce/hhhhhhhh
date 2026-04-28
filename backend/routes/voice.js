const express = require('express');
const router = express.Router();

// 语音监控接口
router.get('/', (req, res) => {
  res.json({ message: 'Voice API placeholder' });
});

module.exports = router;