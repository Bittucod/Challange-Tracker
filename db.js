const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'applications.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
  }
});

// Helper for promise-based queries
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getRow = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const getAllRows = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Initialize schema
const initDb = async () => {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      address_city TEXT,
      experience TEXT NOT NULL,
      past_channels TEXT,
      never_worked_before INTEGER DEFAULT 0,
      whatsapp TEXT NOT NULL,
      alt_phone TEXT,
      telegram TEXT,
      instagram TEXT,
      skills TEXT,
      task_link TEXT NOT NULL,
      status TEXT DEFAULT 'Pending',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
  `;

  return new Promise((resolve, reject) => {
    db.exec(createTableSQL, (err) => {
      if (err) {
        console.error('Error initializing database tables:', err);
        return reject(err);
      }
      console.log('Database initialized successfully.');
      resolve();
    });
  });
};

// CRUD Operations
const createApplication = async (data) => {
  const sql = `
    INSERT INTO applications (
      full_name,
      address_city,
      experience,
      past_channels,
      never_worked_before,
      whatsapp,
      alt_phone,
      telegram,
      instagram,
      skills,
      task_link,
      status,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', '')
  `;

  const skillsStr = Array.isArray(data.skills)
    ? data.skills.join(', ')
    : (data.skills || '');

  const params = [
    data.full_name?.trim() || '',
    data.address_city?.trim() || '',
    data.experience || 'Beginner',
    data.past_channels?.trim() || '',
    data.never_worked_before ? 1 : 0,
    data.whatsapp?.trim() || '',
    data.alt_phone?.trim() || '',
    data.telegram?.trim() || '',
    data.instagram?.trim() || '',
    skillsStr,
    data.task_link?.trim() || ''
  ];

  const result = await runQuery(sql, params);
  return getRow('SELECT * FROM applications WHERE id = ?', [result.lastID]);
};

const getApplications = async (filter = {}) => {
  let sql = 'SELECT * FROM applications WHERE 1=1';
  const params = [];

  if (filter.status && filter.status !== 'all') {
    sql += ' AND status = ?';
    params.push(filter.status);
  }

  if (filter.experience && filter.experience !== 'all') {
    sql += ' AND experience = ?';
    params.push(filter.experience);
  }

  if (filter.search && filter.search.trim()) {
    sql += ' AND (full_name LIKE ? OR whatsapp LIKE ? OR telegram LIKE ? OR instagram LIKE ? OR skills LIKE ?)';
    const term = `%${filter.search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  sql += ' ORDER BY id DESC';

  return getAllRows(sql, params);
};

const getApplicationById = async (id) => {
  return getRow('SELECT * FROM applications WHERE id = ?', [id]);
};

const updateApplication = async (id, updates) => {
  const fields = [];
  const params = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    params.push(updates.status);
  }

  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    params.push(updates.notes);
  }

  if (fields.length === 0) return null;

  params.push(id);
  const sql = `UPDATE applications SET ${fields.join(', ')} WHERE id = ?`;
  await runQuery(sql, params);
  return getApplicationById(id);
};

const deleteApplication = async (id) => {
  const app = await getApplicationById(id);
  if (!app) return null;
  await runQuery('DELETE FROM applications WHERE id = ?', [id]);
  return app;
};

const getStats = async () => {
  const total = await getRow('SELECT COUNT(*) as count FROM applications');
  const pending = await getRow("SELECT COUNT(*) as count FROM applications WHERE status = 'Pending'");
  const reviewing = await getRow("SELECT COUNT(*) as count FROM applications WHERE status = 'Reviewing'");
  const shortlisted = await getRow("SELECT COUNT(*) as count FROM applications WHERE status = 'Shortlisted'");
  const hired = await getRow("SELECT COUNT(*) as count FROM applications WHERE status = 'Hired'");
  const rejected = await getRow("SELECT COUNT(*) as count FROM applications WHERE status = 'Rejected'");
  const today = await getRow("SELECT COUNT(*) as count FROM applications WHERE date(created_at, 'localtime') = date('now', 'localtime')");

  return {
    total: total?.count || 0,
    pending: pending?.count || 0,
    reviewing: reviewing?.count || 0,
    shortlisted: shortlisted?.count || 0,
    hired: hired?.count || 0,
    rejected: rejected?.count || 0,
    today: today?.count || 0,
  };
};

module.exports = {
  db,
  initDb,
  createApplication,
  getApplications,
  getApplicationById,
  updateApplication,
  deleteApplication,
  getStats,
};
