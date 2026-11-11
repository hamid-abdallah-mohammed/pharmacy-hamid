const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// إنشاء الجداول (الأدوية مع حقل الصورة، وجدول المستخدمين)
pool.query(`
  CREATE TABLE IF NOT EXISTS medicines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL
  );
`).then(async () => {
  // إضافة مستخدم افتراضي للتجربة (المستخدم: admin ، كلمة المرور: 1234)
  await pool.query(`
    INSERT INTO users (username, password) 
    VALUES ('admin', '1234') 
    ON CONFLICT (username) DO NOTHING;
  `);
}).catch(err => console.error("Database setup error:", err));

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, message: 'تم تسجيل الدخول بنجاح' });
    } else {
      res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور خطأ' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب الأدوية
app.get('/api/medicines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM medicines ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة دواء جديد مع الصورة
app.post('/api/medicines', async (req, res) => {
  const { name, quantity, price, image } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO medicines (name, quantity, price, image) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, quantity, price, image || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
