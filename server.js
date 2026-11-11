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

// إعادة بناء جدول المستخدمين والأدوية والطلبات بدقة
pool.query(`
  CREATE TABLE IF NOT EXISTS medicines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    symptoms TEXT NOT NULL,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(100),
    phone VARCHAR(30),
    country_code VARCHAR(10) DEFAULT '+249',
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL,
    role VARCHAR(20) DEFAULT 'customer'
  );

  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100),
    items TEXT,
    total DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(async () => {
  await pool.query(`
    INSERT INTO users (fullname, phone, country_code, email, password, role) 
    VALUES ('مدير النظام', '912345678', '+249', 'admin@pharmacy.com', '1234', 'admin') 
    ON CONFLICT (email) DO NOTHING;
  `);
}).catch(err => console.error("Database setup error:", err));

// تسجيل حساب جديد مع الاسم والهاتف والدولة
app.post('/api/register', async (req, res) => {
  const { fullname, phone, country_code, email, password } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (fullname, phone, country_code, email, password, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING email, role, fullname',
      [fullname, phone, country_code || '+249', email, password, 'customer']
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: 'البريد الإلكتروني مستخدم من قبل أو هناك خطأ في البيانات' });
  }
});

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT email, role, fullname FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(401).json({ success: false, message: 'البريد أو كلمة المرور غير صحيحة' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/medicines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM medicines ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/medicines', async (req, res) => {
  const { name, price, symptoms, image } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO medicines (name, price, symptoms, image) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, price, symptoms || '', image || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checkout', async (req, res) => {
  const { email, items, total } = req.body;
  try {
    await pool.query(
      'INSERT INTO orders (email, items, total) VALUES ($1, $2, $3)',
      [email, JSON.stringify(items), total]
    );
    res.json({ success: true, message: 'تم إتمام الطلب بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
