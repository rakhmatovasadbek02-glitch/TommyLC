const express  = require('express');
const { Pool } = require('pg');
const path     = require('path');
const cors     = require('cors');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ══════════════════════════════════════
   DB INIT — create all tables on startup
══════════════════════════════════════ */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      first_name  TEXT NOT NULL,
      last_name   TEXT NOT NULL,
      phone       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'Admin',
      avatar      TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS students (
      id          TEXT PRIMARY KEY,
      first_name  TEXT NOT NULL,
      last_name   TEXT NOT NULL,
      phone       TEXT,
      level       TEXT,
      status      TEXT DEFAULT 'Active',
      exam        TEXT,
      exam_date   DATE,
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id          TEXT PRIMARY KEY,
      first_name  TEXT NOT NULL,
      last_name   TEXT NOT NULL,
      phone       TEXT,
      password    TEXT,
      status      TEXT DEFAULT 'Active',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password TEXT;
    ALTER TABLE teachers DROP COLUMN IF EXISTS email;
    ALTER TABLE teachers DROP COLUMN IF EXISTS rate;
    ALTER TABLE teachers DROP COLUMN IF EXISTS specs;
    ALTER TABLE teachers DROP COLUMN IF EXISTS levels;
    ALTER TABLE teachers DROP COLUMN IF EXISTS bio;

    CREATE TABLE IF NOT EXISTS classrooms (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      capacity    INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS groups (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      teacher      TEXT,
      room         TEXT,
      level        TEXT,
      lang         TEXT DEFAULT 'UZ',
      max_students INTEGER,
      sched_type   TEXT DEFAULT 'odd',
      custom_days  JSONB DEFAULT '[]',
      time         TEXT,
      duration     INTEGER DEFAULT 90,
      start_date   DATE,
      notes        TEXT,
      student_ids  JSONB DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE groups ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'UZ';

    CREATE TABLE IF NOT EXISTS invoices (
      id          TEXT PRIMARY KEY,
      number      TEXT,
      student_id  TEXT,
      description TEXT,
      items       JSONB DEFAULT '[]',
      total       NUMERIC DEFAULT 0,
      due_date    DATE,
      status      TEXT DEFAULT 'Pending',
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id          SERIAL PRIMARY KEY,
      group_id    TEXT NOT NULL,
      date        DATE NOT NULL,
      student_id  TEXT NOT NULL,
      status      TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(group_id, date, student_id)
    );

    CREATE TABLE IF NOT EXISTS leads (
      id            TEXT PRIMARY KEY,
      first_name    TEXT NOT NULL,
      last_name     TEXT NOT NULL,
      phone_student TEXT,
      phone_father  TEXT,
      phone_mother  TEXT,
      phone_other   TEXT,
      current_level TEXT,
      test_result   TEXT,
      status        TEXT DEFAULT 'Registration',
      group_id      TEXT,
      is_trial      BOOLEAN DEFAULT FALSE,
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity (
      id          SERIAL PRIMARY KEY,
      text        TEXT NOT NULL,
      color       TEXT,
      actor       TEXT,
      role        TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed default CEO if no users exist
  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO users (id, first_name, last_name, phone, password, role, avatar)
      VALUES ('u1','Admin','TommyLC','90 000 00 01','admin123','CEO','AT')
      ON CONFLICT DO NOTHING
    `);
    console.log('Seeded default CEO: phone=90 000 00 01  password=admin123');
  }

  console.log('Database ready');
}

/* ══════════════════════════════════════
   AUTH
══════════════════════════════════════ */
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE REPLACE(phone,\' \',\'\')=$1 AND password=$2',
    [phone.replace(/\s/g,''), password]
  );
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
  const u = rows[0];
  res.json({
    id: u.id, name: u.first_name+' '+u.last_name,
    role: u.role, avatar: u.avatar, phone: u.phone
  });
});

/* ══════════════════════════════════════
   USERS
══════════════════════════════════════ */
app.get('/api/users', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at');
  res.json(rows.map(u => ({
    id: u.id, firstName: u.first_name, lastName: u.last_name,
    name: u.first_name+' '+u.last_name, phone: u.phone,
    role: u.role, avatar: u.avatar
  })));
});

app.post('/api/users', async (req, res) => {
  const { id, firstName, lastName, phone, password, role } = req.body;
  const avatar = (firstName[0]+(lastName[0]||'')).toUpperCase();
  await pool.query(
    'INSERT INTO users(id,first_name,last_name,phone,password,role,avatar) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [id, firstName, lastName, phone, password, role, avatar]
  );
  res.json({ ok: true });
});

app.put('/api/users/:id', async (req, res) => {
  const { firstName, lastName, phone, password, role } = req.body;
  const avatar = (firstName[0]+(lastName[0]||'')).toUpperCase();
  if (password) {
    await pool.query(
      'UPDATE users SET first_name=$1,last_name=$2,phone=$3,password=$4,role=$5,avatar=$6 WHERE id=$7',
      [firstName, lastName, phone, password, role, avatar, req.params.id]
    );
  } else {
    await pool.query(
      'UPDATE users SET first_name=$1,last_name=$2,phone=$3,role=$4,avatar=$5 WHERE id=$6',
      [firstName, lastName, phone, role, avatar, req.params.id]
    );
  }
  res.json({ ok: true });
});

app.delete('/api/users/:id', async (req, res) => {
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

/* ══════════════════════════════════════
   STUDENTS
══════════════════════════════════════ */
app.get('/api/students', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM students ORDER BY created_at DESC');
  res.json(rows.map(s => ({
    id: s.id, firstName: s.first_name, lastName: s.last_name,
    phone: s.phone, level: s.level, status: s.status,
    exam: s.exam, examDate: s.exam_date, notes: s.notes, createdAt: s.created_at
  })));
});

app.post('/api/students', async (req, res) => {
  const { id, firstName, lastName, phone, level, status, exam, examDate, notes } = req.body;
  await pool.query(
    'INSERT INTO students(id,first_name,last_name,phone,level,status,exam,exam_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, firstName, lastName, phone||null, level||null, status||'Active', exam||null, examDate||null, notes||null]
  );
  res.json({ ok: true });
});

app.put('/api/students/:id', async (req, res) => {
  const { firstName, lastName, phone, level, status, exam, examDate, notes } = req.body;
  await pool.query(
    'UPDATE students SET first_name=$1,last_name=$2,phone=$3,level=$4,status=$5,exam=$6,exam_date=$7,notes=$8 WHERE id=$9',
    [firstName, lastName, phone||null, level||null, status||'Active', exam||null, examDate||null, notes||null, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/students/:id', async (req, res) => {
  await pool.query('DELETE FROM students WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

/* ══════════════════════════════════════
   TEACHERS
══════════════════════════════════════ */
app.get('/api/teachers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,first_name,last_name,phone,status,created_at FROM teachers ORDER BY created_at DESC');
    res.json(rows.map(t => ({
      id: t.id, firstName: t.first_name, lastName: t.last_name,
      phone: t.phone, status: t.status, createdAt: t.created_at
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teachers', async (req, res) => {
  const { id, firstName, lastName, phone, password, status } = req.body;
  await pool.query(
    'INSERT INTO teachers(id,first_name,last_name,phone,password,status) VALUES($1,$2,$3,$4,$5,$6)',
    [id, firstName, lastName, phone||null, password||null, status||'Active']
  );
  res.json({ ok: true });
});

app.put('/api/teachers/:id', async (req, res) => {
  const { firstName, lastName, phone, password, status } = req.body;
  if (password) {
    await pool.query(
      'UPDATE teachers SET first_name=$1,last_name=$2,phone=$3,password=$4,status=$5 WHERE id=$6',
      [firstName, lastName, phone||null, password, status||'Active', req.params.id]
    );
  } else {
    await pool.query(
      'UPDATE teachers SET first_name=$1,last_name=$2,phone=$3,status=$4 WHERE id=$5',
      [firstName, lastName, phone||null, status||'Active', req.params.id]
    );
  }
  res.json({ ok: true });
});

app.delete('/api/teachers/:id', async (req, res) => {
  await pool.query('DELETE FROM teachers WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

/* ══════════════════════════════════════
   CLASSROOMS
══════════════════════════════════════ */
app.get('/api/classrooms', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM classrooms ORDER BY name');
  res.json(rows.map(r => ({ id: r.id, name: r.name, capacity: r.capacity })));
});

app.post('/api/classrooms', async (req, res) => {
  const { id, name, capacity } = req.body;
  await pool.query('INSERT INTO classrooms(id,name,capacity) VALUES($1,$2,$3)', [id, name, capacity||null]);
  res.json({ ok: true });
});

app.put('/api/classrooms/:id', async (req, res) => {
  const { name, capacity } = req.body;
  // Also update groups referencing the old name
  const old = await pool.query('SELECT name FROM classrooms WHERE id=$1', [req.params.id]);
  if (old.rows[0] && old.rows[0].name !== name) {
    await pool.query('UPDATE groups SET room=$1 WHERE room=$2', [name, old.rows[0].name]);
  }
  await pool.query('UPDATE classrooms SET name=$1,capacity=$2 WHERE id=$3', [name, capacity||null, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/classrooms/:id', async (req, res) => {
  await pool.query('DELETE FROM classrooms WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

/* ══════════════════════════════════════
   GROUPS
══════════════════════════════════════ */
app.get('/api/groups', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM groups ORDER BY created_at DESC');
    res.json(rows.map(g => ({
      id: g.id, name: g.name, teacher: g.teacher, room: g.room,
      level: g.level, lang: g.lang, maxStudents: g.max_students,
      schedType: g.sched_type, customDays: g.custom_days,
      time: g.time, duration: g.duration, startDate: g.start_date,
      notes: g.notes, studentIds: g.student_ids, createdAt: g.created_at
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/groups', async (req, res) => {
  try {
    const { id, name, teacher, room, level, lang, maxStudents, schedType, customDays, time, duration, startDate, notes, studentIds } = req.body;
    await pool.query(
      'INSERT INTO groups(id,name,teacher,room,level,lang,max_students,sched_type,custom_days,time,duration,start_date,notes,student_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
      [id, name, teacher||null, room||null, level||null, lang||'UZ', maxStudents||null, schedType||'odd', JSON.stringify(customDays||[]), time||null, duration||90, startDate||null, notes||null, JSON.stringify(studentIds||[])]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/groups/:id', async (req, res) => {
  try {
    const { name, teacher, room, level, lang, maxStudents, schedType, customDays, time, duration, startDate, notes, studentIds } = req.body;
    await pool.query(
      'UPDATE groups SET name=$1,teacher=$2,room=$3,level=$4,lang=$5,max_students=$6,sched_type=$7,custom_days=$8,time=$9,duration=$10,start_date=$11,notes=$12,student_ids=$13 WHERE id=$14',
      [name, teacher||null, room||null, level||null, lang||'UZ', maxStudents||null, schedType||'odd', JSON.stringify(customDays||[]), time||null, duration||90, startDate||null, notes||null, JSON.stringify(studentIds||[]), req.params.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/groups/:id', async (req, res) => {
  await pool.query('DELETE FROM groups WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

/* ══════════════════════════════════════
   INVOICES
══════════════════════════════════════ */
app.get('/api/invoices', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
  res.json(rows.map(i => ({
    id: i.id, number: i.number, studentId: i.student_id,
    desc: i.description, items: i.items, total: i.total,
    dueDate: i.due_date, status: i.status, notes: i.notes, createdAt: i.created_at
  })));
});

app.post('/api/invoices', async (req, res) => {
  const { id, number, studentId, desc, items, total, dueDate, status, notes } = req.body;
  await pool.query(
    'INSERT INTO invoices(id,number,student_id,description,items,total,due_date,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, number, studentId, desc, JSON.stringify(items||[]), total||0, dueDate||null, status||'Pending', notes||null]
  );
  res.json({ ok: true });
});

app.put('/api/invoices/:id', async (req, res) => {
  const { studentId, desc, items, total, dueDate, status, notes } = req.body;
  await pool.query(
    'UPDATE invoices SET student_id=$1,description=$2,items=$3,total=$4,due_date=$5,status=$6,notes=$7 WHERE id=$8',
    [studentId, desc, JSON.stringify(items||[]), total||0, dueDate||null, status||'Pending', notes||null, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/invoices/:id', async (req, res) => {
  await pool.query('DELETE FROM invoices WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

/* ══════════════════════════════════════
   ATTENDANCE
══════════════════════════════════════ */
app.get('/api/attendance/:groupId/:date', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT student_id, status FROM attendance WHERE group_id=$1 AND date=$2',
    [req.params.groupId, req.params.date]
  );
  res.json(rows.map(r => ({ studentId: r.student_id, status: r.status })));
});

app.post('/api/attendance/:groupId/:date', async (req, res) => {
  const { records } = req.body; // [{studentId, status}]
  // Delete existing for this session then re-insert
  await pool.query('DELETE FROM attendance WHERE group_id=$1 AND date=$2', [req.params.groupId, req.params.date]);
  for (const r of records) {
    await pool.query(
      'INSERT INTO attendance(group_id,date,student_id,status) VALUES($1,$2,$3,$4)',
      [req.params.groupId, req.params.date, r.studentId, r.status]
    );
  }
  res.json({ ok: true });
});

/* ══════════════════════════════════════
   LEADS
══════════════════════════════════════ */
app.get('/api/leads', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    res.json(rows.map(l => ({
      id: l.id, firstName: l.first_name, lastName: l.last_name,
      phoneStudent: l.phone_student, phoneFather: l.phone_father,
      phoneMother: l.phone_mother, phoneOther: l.phone_other,
      currentLevel: l.current_level, testResult: l.test_result,
      status: l.status, groupId: l.group_id, isTrial: l.is_trial,
      notes: l.notes, createdAt: l.created_at
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/leads', async (req, res) => {
  try {
    const { id, firstName, lastName, phoneStudent, phoneFather, phoneMother, phoneOther, currentLevel, testResult, notes } = req.body;
    await pool.query(
      `INSERT INTO leads(id,first_name,last_name,phone_student,phone_father,phone_mother,phone_other,current_level,test_result,notes,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Registration')`,
      [id, firstName, lastName, phoneStudent||null, phoneFather||null, phoneMother||null, phoneOther||null, currentLevel||null, testResult||null, notes||null]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/leads/:id', async (req, res) => {
  try {
    const { firstName, lastName, phoneStudent, phoneFather, phoneMother, phoneOther, currentLevel, testResult, status, groupId, isTrial, notes } = req.body;
    await pool.query(
      `UPDATE leads SET first_name=$1,last_name=$2,phone_student=$3,phone_father=$4,phone_mother=$5,phone_other=$6,
       current_level=$7,test_result=$8,status=$9,group_id=$10,is_trial=$11,notes=$12 WHERE id=$13`,
      [firstName, lastName, phoneStudent||null, phoneFather||null, phoneMother||null, phoneOther||null,
       currentLevel||null, testResult||null, status||'Registration', groupId||null, isTrial||false, notes||null, req.params.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Move lead to Trial — assign group
app.post('/api/leads/:id/to-trial', async (req, res) => {
  try {
    const { groupId } = req.body;
    await pool.query(
      `UPDATE leads SET status='Trial', group_id=$1, is_trial=TRUE WHERE id=$2`,
      [groupId, req.params.id]
    );
    // Add to group's student_ids
    const lead = await pool.query('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (lead.rows[0]) {
      const grp = await pool.query('SELECT student_ids FROM groups WHERE id=$1', [groupId]);
      if (grp.rows[0]) {
        const ids = grp.rows[0].student_ids || [];
        if (!ids.includes(req.params.id)) {
          ids.push(req.params.id);
          await pool.query('UPDATE groups SET student_ids=$1 WHERE id=$2', [JSON.stringify(ids), groupId]);
        }
      }
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Move lead to Payment (after trial)
app.post('/api/leads/:id/to-payment', async (req, res) => {
  try {
    await pool.query(`UPDATE leads SET status='Payment' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Convert lead to permanent student
app.post('/api/leads/:id/convert', async (req, res) => {
  try {
    const lead = await pool.query('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (!lead.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    const l = lead.rows[0];
    // Insert into students
    await pool.query(
      `INSERT INTO students(id,first_name,last_name,phone,level,status)
       VALUES($1,$2,$3,$4,$5,'Active') ON CONFLICT(id) DO UPDATE SET status='Active'`,
      [l.id, l.first_name, l.last_name, l.phone_student||l.phone_father||l.phone_mother||l.phone_other, l.current_level]
    );
    // Update lead status
    await pool.query(`UPDATE leads SET status='Student' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/leads/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM leads WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════
   ACTIVITY LOG
══════════════════════════════════════ */
app.get('/api/activity', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM activity ORDER BY created_at DESC LIMIT 50');
  res.json(rows.map(a => ({
    text: a.text, color: a.color, actor: a.actor, role: a.role,
    time: new Date(a.created_at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
  })));
});

app.post('/api/activity', async (req, res) => {
  const { text, color, actor, role } = req.body;
  await pool.query('INSERT INTO activity(text,color,actor,role) VALUES($1,$2,$3,$4)', [text, color||null, actor||null, role||null]);
  res.json({ ok: true });
});

/* ── Catch-all → serve index ── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Global unhandled route errors
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3000;
initDB().then(() => app.listen(PORT, () => console.log(`TommyLC running on port ${PORT}`)));