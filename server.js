/**
 * server.js - Express 服务器入口
 * 白塞联盟官网后台管理系统
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./database');
const { signToken, authMiddleware } = require('./auth');

const app = express();
const PORT = 3000;

// ============================================================
// 中间件
// ============================================================
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 静态文件服务
// ============================================================
// 前台首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 后台管理面板
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 其他静态资源
app.use(express.static(__dirname));

// ============================================================
// 认证接口
// ============================================================

/** POST /api/auth/login - 管理员登录 */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

  if (!admin) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const isPasswordValid = bcrypt.compareSync(password, admin.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = signToken({ id: admin.id, username: admin.username });

  res.json({
    message: '登录成功',
    token,
    user: { id: admin.id, username: admin.username }
  });
});

/** GET /api/auth/me - 获取当前用户信息 */
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const admin = db.prepare('SELECT id, username, created_at FROM admins WHERE id = ?').get(req.user.id);
  if (!admin) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json({ user: admin });
});

// ============================================================
// 知识库文章 CRUD
// ============================================================

/** GET /api/articles - 获取文章列表（支持分类筛选） */
app.get('/api/articles', authMiddleware, (req, res) => {
  const { category } = req.query;

  let articles;
  if (category && category !== 'all') {
    articles = db.prepare('SELECT * FROM articles WHERE category = ? ORDER BY created_at DESC').all(category);
  } else {
    articles = db.prepare('SELECT * FROM articles ORDER BY created_at DESC').all();
  }

  res.json({ articles });
});

/** GET /api/articles/:id - 获取文章详情 */
app.get('/api/articles/:id', authMiddleware, (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);

  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  res.json({ article });
});

/** POST /api/articles - 创建文章 */
app.post('/api/articles', authMiddleware, (req, res) => {
  const { category, title_zh, title_en, content_zh, content_en } = req.body;

  if (!category || !title_zh) {
    return res.status(400).json({ error: '分类和中文名称为必填项' });
  }

  const validCategories = ['疾病百科', '常用药物', '诊断标准', '预后管理'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: '无效的文章分类' });
  }

  const result = db.prepare(
    `INSERT INTO articles (category, title_zh, title_en, content_zh, content_en) VALUES (?, ?, ?, ?, ?)`
  ).run(category, title_zh || '', title_en || '', content_zh || '', content_en || '');

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: '文章创建成功', article });
});

/** PUT /api/articles/:id - 更新文章 */
app.put('/api/articles/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const { category, title_zh, title_en, content_zh, content_en } = req.body;

  if (category) {
    const validCategories = ['疾病百科', '常用药物', '诊断标准', '预后管理'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '无效的文章分类' });
    }
  }

  db.prepare(
    `UPDATE articles SET category = ?, title_zh = ?, title_en = ?, content_zh = ?, content_en = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
  ).run(
    category || existing.category,
    title_zh !== undefined ? title_zh : existing.title_zh,
    title_en !== undefined ? title_en : existing.title_en,
    content_zh !== undefined ? content_zh : existing.content_zh,
    content_en !== undefined ? content_en : existing.content_en,
    req.params.id
  );

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  res.json({ message: '文章更新成功', article });
});

/** DELETE /api/articles/:id - 删除文章 */
app.delete('/api/articles/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '文章不存在' });
  }

  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ message: '文章删除成功' });
});

// ============================================================
// 医生列表 CRUD
// ============================================================

/** GET /api/doctors/public - 公开获取医生列表（支持城市和专病门诊筛选） */
app.get('/api/doctors/public', (req, res) => {
  const { city, is_specialty_clinic } = req.query;

  let sql = 'SELECT * FROM doctors WHERE 1=1';
  const params = [];

  if (city && city !== 'all') {
    sql += ' AND city = ?';
    params.push(city);
  }
  if (is_specialty_clinic !== undefined && is_specialty_clinic !== '') {
    sql += ' AND is_specialty_clinic = ?';
    params.push(is_specialty_clinic ? 1 : 0);
  }

  sql += ' ORDER BY is_specialty_clinic DESC, city, created_at DESC';

  const doctors = db.prepare(sql).all(...params);
  res.json({ doctors });
});

/** GET /api/cities - 公开获取有医生的城市列表 */
app.get('/api/cities', (req, res) => {
  const cities = db.prepare("SELECT DISTINCT city FROM doctors WHERE city != '' ORDER BY city").all();
  res.json({ cities: cities.map(c => c.city) });
});

/** GET /api/doctors - 获取医生列表（支持城市筛选） */
app.get('/api/doctors', authMiddleware, (req, res) => {
  const { city } = req.query;

  let doctors;
  if (city && city !== 'all') {
    doctors = db.prepare('SELECT * FROM doctors WHERE city = ? ORDER BY created_at DESC').all(city);
  } else {
    doctors = db.prepare('SELECT * FROM doctors ORDER BY created_at DESC').all();
  }

  res.json({ doctors });
});

/** GET /api/doctors/:id - 获取医生详情 */
app.get('/api/doctors/:id', authMiddleware, (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

  if (!doctor) {
    return res.status(404).json({ error: '医生不存在' });
  }

  res.json({ doctor });
});

/** POST /api/doctors - 添加医生 */
app.post('/api/doctors', authMiddleware, (req, res) => {
  const { city, hospital, department, name_zh, name_en, title, specialty_zh, specialty_en, schedule, appointment_info, is_specialty_clinic } = req.body;

  if (!city || !hospital || !name_zh) {
    return res.status(400).json({ error: '城市、医院和中文名称为必填项' });
  }

  const result = db.prepare(
    `INSERT INTO doctors (city, hospital, department, name_zh, name_en, title, specialty_zh, specialty_en, schedule, appointment_info, is_specialty_clinic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(city, hospital, department || '', name_zh, name_en || '', title || '', specialty_zh || '', specialty_en || '', schedule || '', appointment_info || '', is_specialty_clinic ? 1 : 0);

  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: '医生添加成功', doctor });
});

/** PUT /api/doctors/:id - 更新医生信息 */
app.put('/api/doctors/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '医生不存在' });
  }

  const { city, hospital, department, name_zh, name_en, title, specialty_zh, specialty_en, schedule, appointment_info, is_specialty_clinic } = req.body;

  db.prepare(
    `UPDATE doctors SET city = ?, hospital = ?, department = ?, name_zh = ?, name_en = ?, title = ?, specialty_zh = ?, specialty_en = ?, schedule = ?, appointment_info = ?, is_specialty_clinic = ? WHERE id = ?`
  ).run(
    city || existing.city,
    hospital || existing.hospital,
    department !== undefined ? department : existing.department,
    name_zh !== undefined ? name_zh : existing.name_zh,
    name_en !== undefined ? name_en : existing.name_en,
    title !== undefined ? title : existing.title,
    specialty_zh !== undefined ? specialty_zh : existing.specialty_zh,
    specialty_en !== undefined ? specialty_en : existing.specialty_en,
    schedule !== undefined ? schedule : existing.schedule,
    appointment_info !== undefined ? appointment_info : existing.appointment_info,
    is_specialty_clinic !== undefined ? (is_specialty_clinic ? 1 : 0) : existing.is_specialty_clinic,
    req.params.id
  );

  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  res.json({ message: '医生信息更新成功', doctor });
});

/** DELETE /api/doctors/:id - 删除医生 */
app.delete('/api/doctors/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '医生不存在' });
  }

  db.prepare('DELETE FROM doctors WHERE id = ?').run(req.params.id);
  res.json({ message: '医生删除成功' });
});

// ============================================================
// 病友故事 CRUD
// ============================================================

/** GET /api/stories - 获取故事列表 */
app.get('/api/stories', authMiddleware, (req, res) => {
  const stories = db.prepare('SELECT * FROM stories ORDER BY created_at DESC').all();
  res.json({ stories });
});

/** GET /api/stories/:id - 获取故事详情 */
app.get('/api/stories/:id', authMiddleware, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);

  if (!story) {
    return res.status(404).json({ error: '故事不存在' });
  }

  res.json({ story });
});

/** POST /api/stories - 创建故事 */
app.post('/api/stories', authMiddleware, (req, res) => {
  const { title_zh, title_en, summary_zh, summary_en, content_zh, content_en, author, location, published } = req.body;

  if (!title_zh) {
    return res.status(400).json({ error: '中文名称必填' });
  }

  const result = db.prepare(
    `INSERT INTO stories (title_zh, title_en, summary_zh, summary_en, content_zh, content_en, author, location, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title_zh,
    title_en || '',
    summary_zh || '',
    summary_en || '',
    content_zh || '',
    content_en || '',
    author || '',
    location || '',
    published ? 1 : 0
  );

  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: '故事创建成功', story });
});

/** PUT /api/stories/:id - 更新故事 */
app.put('/api/stories/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '故事不存在' });
  }

  const { title_zh, title_en, summary_zh, summary_en, content_zh, content_en, author, location, published } = req.body;

  db.prepare(
    `UPDATE stories SET title_zh = ?, title_en = ?, summary_zh = ?, summary_en = ?, content_zh = ?, content_en = ?, author = ?, location = ?, published = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
  ).run(
    title_zh !== undefined ? title_zh : existing.title_zh,
    title_en !== undefined ? title_en : existing.title_en,
    summary_zh !== undefined ? summary_zh : existing.summary_zh,
    summary_en !== undefined ? summary_en : existing.summary_en,
    content_zh !== undefined ? content_zh : existing.content_zh,
    content_en !== undefined ? content_en : existing.content_en,
    author !== undefined ? author : existing.author,
    location !== undefined ? location : existing.location,
    published !== undefined ? (published ? 1 : 0) : existing.published,
    req.params.id
  );

  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  res.json({ message: '故事更新成功', story });
});

/** DELETE /api/stories/:id - 删除故事 */
app.delete('/api/stories/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '故事不存在' });
  }

  db.prepare('DELETE FROM stories WHERE id = ?').run(req.params.id);
  res.json({ message: '故事删除成功' });
});

// ============================================================
// 资讯 CRUD
// ============================================================

/** GET /api/news - 公开获取资讯列表 */
app.get('/api/news', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) AS cnt FROM news').get().cnt;
  const news = db.prepare(
    'SELECT * FROM news ORDER BY is_pinned DESC, published_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  res.json({ news, total, page, limit });
});

/** GET /api/news/:id - 公开获取资讯详情 */
app.get('/api/news/:id', (req, res) => {
  const news = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  if (!news) {
    return res.status(404).json({ error: '资讯不存在' });
  }
  res.json({ news });
});

/** POST /api/news - 创建资讯（需认证） */
app.post('/api/news', authMiddleware, (req, res) => {
  const { title, summary, content, is_pinned } = req.body;
  if (!title) {
    return res.status(400).json({ error: '标题为必填项' });
  }
  const result = db.prepare(
    'INSERT INTO news (title, summary, content, is_pinned) VALUES (?, ?, ?, ?)'
  ).run(title, summary || '', content || '', is_pinned ? 1 : 0);
  const item = db.prepare('SELECT * FROM news WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: '资讯创建成功', news: item });
});

/** PUT /api/news/:id - 更新资讯（需认证） */
app.put('/api/news/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '资讯不存在' });
  }
  const { title, summary, content, is_pinned } = req.body;
  db.prepare(
    `UPDATE news SET title = ?, summary = ?, content = ?, is_pinned = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
  ).run(
    title !== undefined ? title : existing.title,
    summary !== undefined ? summary : existing.summary,
    content !== undefined ? content : existing.content,
    is_pinned !== undefined ? (is_pinned ? 1 : 0) : existing.is_pinned,
    req.params.id
  );
  const item = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  res.json({ message: '资讯更新成功', news: item });
});

/** DELETE /api/news/:id - 删除资讯（需认证） */
app.delete('/api/news/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '资讯不存在' });
  }
  db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
  res.json({ message: '资讯删除成功' });
});

// ============================================================
// 网站设置
// ============================================================

/** GET /api/settings - 获取网站设置 */
app.get('/api/settings', authMiddleware, (req, res) => {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  if (!settings) {
    return res.status(404).json({ error: '网站设置不存在' });
  }
  res.json({ settings });
});

/** PUT /api/settings - 更新网站设置 */
app.put('/api/settings', authMiddleware, (req, res) => {
  const { site_name_zh, site_name_en, site_description_zh, site_description_en, contact_email, wechat_group_qr_url } = req.body;

  const existing = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  if (!existing) {
    return res.status(404).json({ error: '网站设置不存在' });
  }

  db.prepare(
    `UPDATE settings SET site_name_zh = ?, site_name_en = ?, site_description_zh = ?, site_description_en = ?, contact_email = ?, wechat_group_qr_url = ? WHERE id = 1`
  ).run(
    site_name_zh !== undefined ? site_name_zh : existing.site_name_zh,
    site_name_en !== undefined ? site_name_en : existing.site_name_en,
    site_description_zh !== undefined ? site_description_zh : existing.site_description_zh,
    site_description_en !== undefined ? site_description_en : existing.site_description_en,
    contact_email !== undefined ? contact_email : existing.contact_email,
    wechat_group_qr_url !== undefined ? wechat_group_qr_url : existing.wechat_group_qr_url
  );

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json({ message: '网站设置更新成功', settings });
});

// ============================================================
// 仪表盘统计接口
// ============================================================

/** GET /api/dashboard - 仪表盘统计数据 */
app.get('/api/dashboard', authMiddleware, (req, res) => {
  const articleCount = db.prepare('SELECT COUNT(*) AS cnt FROM articles').get().cnt;
  const doctorCount = db.prepare('SELECT COUNT(*) AS cnt FROM doctors').get().cnt;
  const storyCount = db.prepare('SELECT COUNT(*) AS cnt FROM stories').get().cnt;
  const newsCount = db.prepare('SELECT COUNT(*) AS cnt FROM news').get().cnt;

  // 最近更新的内容（跨表取最近5条）
  const recentArticles = db.prepare(
    `SELECT id, 'article' AS type, title_zh AS title, updated_at FROM articles ORDER BY updated_at DESC LIMIT 5`
  ).all();
  const recentStories = db.prepare(
    `SELECT id, 'story' AS type, title_zh AS title, updated_at FROM stories ORDER BY updated_at DESC LIMIT 5`
  ).all();
  const recentNews = db.prepare(
    `SELECT id, 'news' AS type, title AS title, updated_at FROM news ORDER BY updated_at DESC LIMIT 5`
  ).all();

  const recentUpdates = [...recentArticles, ...recentStories, ...recentNews]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);

  res.json({
    stats: {
      articles: articleCount,
      doctors: doctorCount,
      stories: storyCount,
      news: newsCount
    },
    recentUpdates
  });
});

// ============================================================
// 错误处理中间件
// ============================================================
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// ============================================================
// 启动服务器
// ============================================================
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('  白塞联盟后台管理系统已启动');
  console.log('='.repeat(50));
  console.log(`  前台网站: http://localhost:${PORT}`);
  console.log(`  后台管理: http://localhost:${PORT}/admin`);
  console.log(`  默认账号: admin / behcet2025`);
  console.log('='.repeat(50));
});
