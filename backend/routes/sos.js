// backend/routes/sos.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// 创建SOS任务
router.post('/create', (req, res) => {
  const { openid, position, locationLabel, taskSource = 'manual', emergencyMode = false } = req.body;

  if (!openid) {
    return res.status(400).json({ success: false, message: '缺少 openid' });
  }

  const taskId = `task_${Date.now()}`;
  const nowMs = Date.now();
  const { latitude, longitude } = position || { latitude: 19.99839, longitude: 110.152305 };

  // 插入SOS任务
  db.run(
    `INSERT INTO sos_tasks 
     (task_id, openid, task_source, system_status, location_label, latitude, longitude, risk_value, emergency_mode, emergency_started_at, emergency_trigger_type, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      taskId,
      openid,
      taskSource,
      'sos',
      locationLabel || '未知位置',
      latitude,
      longitude,
      85,
      emergencyMode ? 1 : 0,
      emergencyMode ? nowMs : null,
      taskSource === 'manual' ? '手动 SOS' : '自动触发',
      1
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '创建失败', error: err.message });
      }

      // 插入默认紧急联系人（3条）
      const contacts = [
        { name: '妈妈', relation: '家人', phone: '138****1111' },
        { name: '室友小林', relation: '朋友', phone: '139****2222' },
        { name: '社区网格员', relation: '工作人员', phone: '137****3333' }
      ];

      let inserted = 0;
      contacts.forEach((c, i) => {
        db.run(
          `INSERT INTO emergency_contacts (sos_task_id, name, relation, phone, status) VALUES (?, ?, ?, ?, ?)`,
          [taskId, c.name, c.relation, c.phone, '待发送'],
          (err2) => {
            if (!err2) inserted++;
            if (i === contacts.length - 1) {
              // 所有联系人插入完成后返回响应
              res.json({
                success: true,
                message: 'SOS任务创建成功',
                data: {
                  taskId,
                  status: 'created',
                  emergencyContactsCount: inserted
                }
              });
            }
          }
        );
      });
    }
  );
});

// 获取SOS状态
router.get('/status/:taskId', (req, res) => {
  const { taskId } = req.params;

  db.get(
    `SELECT * FROM sos_tasks WHERE task_id = ? AND is_active = 1`,
    [taskId],
    (err, row) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      if (!row) return res.status(404).json({ success: false, message: '任务不存在或已结束' });

      // 查询关联的志愿者（固定3人，从volunteers表查）
      db.all(`SELECT * FROM volunteers ORDER BY id LIMIT 3`, [], (err2, volunteers) => {
        if (err2) return res.status(500).json({ success: false, message: err2.message });

        // 查询紧急联系人
        db.all(`SELECT * FROM emergency_contacts WHERE sos_task_id = ?`, [taskId], (err3, contacts) => {
          if (err3) return res.status(500).json({ success: false, message: err3.message });

          res.json({
            success: true,
            data: {
              taskId: row.task_id,
              taskSource: row.task_source,
              systemStatus: row.system_status,
              requesterPosition: { latitude: row.latitude, longitude: row.longitude },
              locationLabel: row.location_label,
              riskValue: row.risk_value,
              emergencyMode: Boolean(row.emergency_mode),
              emergencyStartedAt: row.emergency_started_at,
              emergencyTriggerType: row.emergency_trigger_type,
              emergencyContacts: contacts,
              volunteers: volunteers.map(v => ({
                ...v,
                isSelf: Boolean(v.is_self),
                status: v.status || '待响应',
                progress: v.progress || 0,
                etaText: v.eta_text || '待响应',
                moveStartAt: v.move_start_at || 0,
                moveDurationSec: v.move_duration_sec || 30
              })),
              updatedAt: row.updated_at
            }
          });
        });
      });
    }
  );
});

// 取消SOS（仅限手动）
router.post('/cancel/:taskId', (req, res) => {
  const { taskId } = req.params;
  const { openid } = req.body;

  db.get(`SELECT * FROM sos_tasks WHERE task_id = ? AND openid = ? AND is_active = 1`, [taskId, openid], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) return res.status(404).json({ success: false, message: '任务不存在或不属于当前用户' });

    if (row.task_source !== 'manual') {
      return res.status(400).json({ success: false, message: '仅可取消手动 SOS' });
    }

    db.run(`UPDATE sos_tasks SET is_active = 0, system_status = 'cancelled' WHERE task_id = ?`, [taskId], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: err2.message });

      res.json({ success: true, message: 'SOS任务已取消' });
    });
  });
});

// 志愿者响应
router.post('/volunteer/respond', (req, res) => {
  const { taskId, volunteerId } = req.body;
  const { openid } = req.body; // 实际应从 token 解析，此处简化

  db.get(`SELECT * FROM sos_tasks WHERE task_id = ? AND is_active = 1`, [taskId], (err, task) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' });

    // 检查志愿者是否存在且非本人
    db.get(`SELECT * FROM volunteers WHERE id = ?`, [volunteerId], (err2, vol) => {
      if (err2) return res.status(500).json({ success: false, message: err2.message });
      if (!vol) return res.status(404).json({ success: false, message: '志愿者不存在' });
      if (vol.is_self) return res.status(400).json({ success: false, message: '不能响应自己的任务' });

      const nowMs = Date.now();
      const duration = Math.floor(Math.random() * 20) + 20; // 20~40秒

      db.run(
        `UPDATE volunteers SET 
         status = '前往中', 
         progress = 1, 
         eta_text = ?, 
         move_start_at = ?, 
         move_duration_sec = ?
         WHERE id = ?`,
        [`${duration}秒`, nowMs, duration, volunteerId],
        (err3) => {
          if (err3) return res.status(500).json({ success: false, message: err3.message });

          res.json({
            success: true,
            message: '志愿者响应成功',
            data: { volunteerId, status: '前往中', etaText: `${duration}秒` }
          });
        }
      );
    });
  });
});

module.exports = router;