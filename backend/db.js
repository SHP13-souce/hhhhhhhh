const sqlite3 = require('sqlite3').verbose();

// 创建数据库文件（自动在当前目录生成 data.db）
const db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
  } else {
    console.log('✅ 数据库连接成功');
    // 初始化表
    initTables();
  }
});

// 初始化数据表
function initTables() {
  const sql = `
    -- 用户表（传统账号体系）
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'user',
      nickname TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SOS任务表
    CREATE TABLE IF NOT EXISTS sos_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      location_label TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      phone TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    -- 志愿者表（保留）
    CREATE TABLE IF NOT EXISTS volunteers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      job TEXT,
      honor TEXT,
      is_self BOOLEAN DEFAULT 0,
      status TEXT DEFAULT '待响应',
      progress INTEGER DEFAULT 0,
      eta_text TEXT DEFAULT '待响应',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      init_latitude REAL NOT NULL,
      init_longitude REAL NOT NULL,
      move_start_at INTEGER,
      move_duration_sec INTEGER DEFAULT 30,
      auto_respond_at INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 紧急联系人表
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sos_task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      relation TEXT,
      phone TEXT NOT NULL,
      notified BOOLEAN DEFAULT 0,
      notify_time TEXT,
      status TEXT DEFAULT '待发送',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 语音监控计划表
    CREATE TABLE IF NOT EXISTS voice_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      time_slot TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    -- 系统日志表
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      message TEXT NOT NULL,
      level TEXT DEFAULT 'info',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(sql, (err) => {
    if (err) {
      console.error('❌ 表初始化失败:', err.message);
    } else {
      console.log('✅ 数据库表初始化完成');
      
      // 插入默认志愿者
      insertDefaultVolunteers();
    }
  });
}

// 插入默认志愿者数据
function insertDefaultVolunteers() {
  const volunteers = [
    { name: '王秀兰', age: 46, job: '村医', honor: '优秀互助志愿者', is_self: 1, 
      latitude: 19.99868, longitude: 110.15264, init_latitude: 19.99868, init_longitude: 110.15264 },
    { name: '李秋芳', age: 52, job: '社区互助志愿者', honor: '连续三年五星评价', is_self: 0,
      latitude: 19.99812, longitude: 110.15202, init_latitude: 19.99812, init_longitude: 110.15202 },
    { name: '张玉兰', age: 39, job: '社区网格员', honor: '应急处置标兵', is_self: 0,
      latitude: 19.99798, longitude: 110.15272, init_latitude: 19.99798, init_longitude: 110.15272 }
  ];

  let inserted = 0;
  volunteers.forEach(vol => {
    db.run(
      `INSERT OR IGNORE INTO volunteers 
       (name, age, job, honor, is_self, latitude, longitude, init_latitude, init_longitude, move_duration_sec) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vol.name, vol.age, vol.job, vol.honor, vol.is_self, vol.latitude, vol.longitude, 
       vol.init_latitude, vol.init_longitude, 30],
      function(err) {
        if (err) {
          console.warn(`⚠️ 志愿者 ${vol.name} 插入失败:`, err.message);
        } else if (this.changes > 0) {
          inserted++;
        }
      }
    );
  });

  setTimeout(() => {
    if (inserted > 0) {
      console.log(`✅ 成功插入 ${inserted} 名默认志愿者`);
    } else {
      console.log('ℹ️ 默认志愿者已存在，跳过插入');
    }
  }, 500);
}

module.exports = db;