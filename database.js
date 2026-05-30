/**
 * database.js - SQLite 数据库初始化 + 种子数据
 * 使用 better-sqlite3 同步 API，首次启动自动建表并插入示例数据
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// 确保 data 目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'behcet.db');
const db = new Database(dbPath);

// 开启 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * 建表语句 — 使用 CREATE TABLE IF NOT EXISTS
 */
function createTables() {
  // 管理员表
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 知识库文章表
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK(category IN ('疾病百科', '常用药物', '诊断标准', '预后管理')),
      title_zh TEXT NOT NULL DEFAULT '',
      title_en TEXT NOT NULL DEFAULT '',
      content_zh TEXT NOT NULL DEFAULT '',
      content_en TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 医生列表表
  db.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city TEXT NOT NULL DEFAULT '',
      hospital TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      name_zh TEXT NOT NULL DEFAULT '',
      name_en TEXT NOT NULL DEFAULT '',
      specialty_zh TEXT NOT NULL DEFAULT '',
      specialty_en TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 病友故事表
  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_zh TEXT NOT NULL DEFAULT '',
      title_en TEXT NOT NULL DEFAULT '',
      summary_zh TEXT NOT NULL DEFAULT '',
      summary_en TEXT NOT NULL DEFAULT '',
      content_zh TEXT NOT NULL DEFAULT '',
      content_en TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 网站设置表（单行配置）
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      site_name_zh TEXT NOT NULL DEFAULT '',
      site_name_en TEXT NOT NULL DEFAULT '',
      site_description_zh TEXT NOT NULL DEFAULT '',
      site_description_en TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      wechat_group_qr_url TEXT NOT NULL DEFAULT ''
    )
  `);
}

/**
 * 种子数据 — 仅在各表为空时插入
 */
function seedData() {
  // 管理员种子
  const adminCount = db.prepare('SELECT COUNT(*) AS cnt FROM admins').get().cnt;
  if (adminCount === 0) {
    const hashedPassword = bcrypt.hashSync('behcet2025', 10);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hashedPassword);
    console.log('[DB] 已创建默认管理员账号: admin / behcet2025');
  }

  // 知识库文章种子
  const articleCount = db.prepare('SELECT COUNT(*) AS cnt FROM articles').get().cnt;
  if (articleCount === 0) {
    const insertArticle = db.prepare(
      `INSERT INTO articles (category, title_zh, title_en, content_zh, content_en) VALUES (?, ?, ?, ?, ?)`
    );

    insertArticle.run(
      '疾病百科',
      '什么是白塞病？',
      'What is Behcet\'s Disease?',
      '白塞病（Behcet\'s Disease）是一种慢性、全身性血管炎症性疾病，属于自身免疫性疾病范畴。其主要临床表现为反复发作的口腔溃疡、生殖器溃疡、眼部炎症及皮肤损害。白塞病可累及多个器官系统，包括消化道、血管、神经系统等，严重时可危及生命。\n\n该病以土耳其皮肤科医生 Hulusi Behcet 的名字命名，1937年他首次描述了口腔溃疡、生殖器溃疡和眼部炎症三联征。白塞病在丝绸之路沿线国家发病率较高，因此也被称为"丝绸之路病"。中国是白塞病的高发地区之一。',
      'Behcet\'s Disease is a chronic, systemic vasculitis characterized by recurrent oral ulcers, genital ulcers, eye inflammation, and skin lesions. It is an autoimmune condition that can affect multiple organ systems including the digestive tract, blood vessels, and nervous system.\n\nThe disease is named after Turkish dermatologist Hulusi Behcet, who first described the triad of oral ulcers, genital ulcers, and eye inflammation in 1937. Behcet\'s Disease has a higher prevalence along the Silk Road, and China is one of the high-incidence regions.'
    );

    insertArticle.run(
      '常用药物',
      '白塞病常用药物概览',
      'Common Medications for Behcet\'s Disease',
      '白塞病目前无特效根治药物，治疗目标是控制急性发作、预防复发及脏器损害。常用药物包括：\n\n1. 秋水仙碱（Colchicine）：控制口腔和生殖器溃疡发作，是基础治疗用药。\n2. 糖皮质激素：用于急性发作期控制炎症，如泼尼松、地塞米松等。\n3. 免疫抑制剂：如硫唑嘌呤、环孢素、甲氨蝶呤等，用于重症或激素无效的患者。\n4. 生物制剂：如英夫利昔单抗（类克），针对难治性眼白塞、神经白塞等重症。\n\n⚠ 具体用药方案须在专科医生指导下制定，切勿自行增减药量。',
      'There is currently no cure for Behcet\'s Disease; treatment aims to control acute flares, prevent recurrences, and reduce organ damage. Common medications include:\n\n1. Colchicine: Controls oral and genital ulcer outbreaks, a foundational treatment.\n2. Corticosteroids: Used during acute flares to control inflammation (e.g., prednisone, dexamethasone).\n3. Immunosuppressants: Azathioprine, cyclosporine, methotrexate for severe or steroid-resistant cases.\n4. Biologics: Infliximab for refractory ocular/neuro-Behcet and other severe manifestations.\n\n⚠ Specific treatment plans must be developed under specialist guidance.'
    );

    insertArticle.run(
      '诊断标准',
      '白塞病诊断标准（ICBD）',
      'International Criteria for Behcet\'s Disease (ICBD)',
      '国际白塞病诊断标准（ICBD 2013）采用评分制，总分≥4分可诊断：\n\n| 临床表现 | 分值 |\n|---------|------|\n| 口腔溃疡（复发性） | 2分 |\n| 生殖器溃疡（复发性） | 2分 |\n| 眼部损害 | 2分 |\n| 皮肤损害 | 1分 |\n| 血管表现 | 1分 |\n| 神经系统表现 | 1分 |\n| 针刺反应阳性 | 1分 |\n\n注：白塞病属于排他性诊断，需排除其他可引起类似症状的疾病。确诊应由风湿免疫科专科医生完成。',
      'The International Criteria for Behcet\'s Disease (ICBD 2013) uses a scoring system. A score ≥4 establishes the diagnosis:\n\n| Clinical Feature | Score |\n|-----------------|-------|\n| Oral ulcers (recurrent) | 2 |\n| Genital ulcers (recurrent) | 2 |\n| Ocular lesions | 2 |\n| Skin lesions | 1 |\n| Vascular manifestations | 1 |\n| Neurological manifestations | 1 |\n| Positive pathergy test | 1 |\n\nNote: Behcet\'s Disease is a diagnosis of exclusion. Diagnosis should be confirmed by a rheumatology specialist.'
    );

    insertArticle.run(
      '预后管理',
      '白塞病患者日常管理指南',
      'Daily Management Guide for Behcet\'s Disease Patients',
      '白塞病是一种慢性疾病，虽然目前无法根治，但通过规范的日常管理，大多数患者可以有效控制病情，维持良好的生活质量。\n\n【定期随访】\n- 每3-6个月进行一次专科复查\n- 眼部受累者需定期眼科检查\n- 长期用药者定期监测肝肾功能\n\n【生活方式】\n- 保证充足睡眠，避免熬夜\n- 均衡饮食，避免辛辣刺激食物\n- 适度运动，增强免疫力\n- 戒烟限酒\n\n【口腔护理】\n- 使用软毛牙刷，选择温和牙膏\n- 避免过硬、过烫的食物\n- 发作期可用漱口水辅助护理\n\n【心理调适】\n- 接纳疾病，积极面对\n- 参加病友互助活动\n- 必要时寻求专业心理咨询',
      'Behcet\'s Disease is chronic but manageable. With proper daily management, most patients can effectively control their condition and maintain a good quality of life.\n\n[Regular Follow-ups]\n- Specialist review every 3-6 months\n- Regular eye exams for those with ocular involvement\n- Monitor liver/kidney function for long-term medication users\n\n[Lifestyle]\n- Ensure adequate sleep, avoid late nights\n- Balanced diet, avoid spicy/irritating foods\n- Moderate exercise to boost immunity\n- Quit smoking, limit alcohol\n\n[Oral Care]\n- Use a soft-bristle toothbrush and mild toothpaste\n- Avoid hard, hot foods\n- Use mouthwash during flare-ups\n\n[Psychological Well-being]\n- Accept the condition and stay positive\n- Join patient support groups\n- Seek professional counseling when needed'
    );

    console.log('[DB] 已插入 4 篇知识库种子文章');
  }

  // 医生种子
  const doctorCount = db.prepare('SELECT COUNT(*) AS cnt FROM doctors').get().cnt;
  if (doctorCount === 0) {
    const insertDoctor = db.prepare(
      `INSERT INTO doctors (city, hospital, department, name_zh, name_en, specialty_zh, specialty_en) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const doctors = [
      { city: '北京', hospital: '北京协和医院', department: '风湿免疫科', name_zh: '张风湿 教授', name_en: 'Prof. Zhang Rheumatology', specialty_zh: '风湿免疫疾病、白塞病、系统性血管炎', specialty_en: 'Rheumatic diseases, Behcet\'s Disease, Systemic vasculitis' },
      { city: '北京', hospital: '北京大学人民医院', department: '风湿免疫科', name_zh: '李风湿 副教授', name_en: 'Assoc. Prof. Li Rheumatology', specialty_zh: '系统性自身免疫病、白塞病', specialty_en: 'Systemic autoimmune diseases, Behcet\'s Disease' },
      { city: '北京', hospital: '北京同仁医院', department: '眼科', name_zh: '王眼科 教授', name_en: 'Prof. Wang Ophthalmology', specialty_zh: '葡萄膜炎、眼部白塞病、眼底病', specialty_en: 'Uveitis, Ocular Behcet\'s Disease, Fundus diseases' },
      { city: '上海', hospital: '上海瑞金医院', department: '风湿免疫科', name_zh: '陈风湿 教授', name_en: 'Prof. Chen Rheumatology', specialty_zh: '白塞病、类风湿关节炎、系统性疾病', specialty_en: 'Behcet\'s Disease, Rheumatoid arthritis, Systemic diseases' },
      { city: '上海', hospital: '复旦大学附属华山医院', department: '神经科', name_zh: '刘神经 教授', name_en: 'Prof. Liu Neurology', specialty_zh: '神经白塞病、中枢神经系统血管炎', specialty_en: 'Neuro-Behcet\'s Disease, CNS vasculitis' },
      { city: '广州', hospital: '中山大学附属第一医院', department: '风湿免疫科', name_zh: '吴风湿 教授', name_en: 'Prof. Wu Rheumatology', specialty_zh: '白塞病、脊柱关节炎、系统性血管炎', specialty_en: 'Behcet\'s Disease, Spondyloarthritis, Systemic vasculitis' },
      { city: '成都', hospital: '四川大学华西医院', department: '风湿免疫科', name_zh: '赵风湿 教授', name_en: 'Prof. Zhao Rheumatology', specialty_zh: '白塞病、系统性自身免疫性疾病', specialty_en: 'Behcet\'s Disease, Systemic autoimmune diseases' },
    ];

    const insertMany = db.transaction((docs) => {
      for (const doc of docs) {
        insertDoctor.run(doc.city, doc.hospital, doc.department, doc.name_zh, doc.name_en, doc.specialty_zh, doc.specialty_en);
      }
    });
    insertMany(doctors);
    console.log('[DB] 已插入 7 位医生种子数据');
  }

  // 病友故事种子
  const storyCount = db.prepare('SELECT COUNT(*) AS cnt FROM stories').get().cnt;
  if (storyCount === 0) {
    const insertStory = db.prepare(
      `INSERT INTO stories (title_zh, title_en, summary_zh, summary_en, content_zh, content_en, author, location, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const stories = [
      {
        title_zh: '漫长的确诊路',
        title_en: 'The Long Road to Diagnosis',
        summary_zh: '从2021年开始，我反复出现口腔溃疡，起初以为是上火，用了各种偏方都不管用。随后眼睛开始出问题，辗转多家医院，被误诊为多种疾病……直到遇到协和的风湿免疫科医生，才终于确诊为白塞病。',
        summary_en: 'Starting in 2021, I had recurrent oral ulcers. I thought it was just "internal heat" and tried various folk remedies, but nothing worked. Then my eyes started having problems. After going to multiple hospitals and being misdiagnosed with various conditions... I finally met a rheumatology & immunology doctor at Peking Union Medical College Hospital who diagnosed me with Behcet\'s Disease.',
        content_zh: '从2021年开始，我反复出现口腔溃疡，起初以为是上火，用了各种偏方都不管用。随后眼睛开始出问题，辗转多家医院，被误诊为多种疾病……直到遇到协和的风湿免疫科医生，才终于确诊为白塞病。\n\n被确诊的那天，我坐在诊室门口哭了很久。医生说这是终身性疾病，需要长期用药，我当时觉得天都塌了。回家的路上，我一直在问自己：为什么是我？\n\n但时间证明，白塞病并不是人生的终点。经过两年多的治疗和调整，我的病情已经基本稳定。虽然偶尔还会有口腔溃疡发作，但已经不像以前那样频繁和严重了。\n\n我想告诉每一位正在经历确诊过程的朋友：不要放弃，找一个好的风湿免疫科医生，遵医嘱治疗，生活会慢慢好起来的。',
        content_en: 'Starting in 2021, I had recurrent oral ulcers. I thought it was just "internal heat" and tried various folk remedies, but nothing worked. Then my eyes started having problems. After being misdiagnosed at multiple hospitals, I finally met a rheumatology & immunology doctor at Peking Union Medical College Hospital who diagnosed me with Behcet\'s Disease.\n\nI cried for a long time sitting outside the clinic that day. The doctor said it was a lifelong condition requiring long-term medication. I felt like my world had collapsed.\n\nBut time proved that Behcet\'s Disease is not the end of life. After more than two years of treatment and adjustment, my condition has stabilized. Although I still occasionally get oral ulcers, they are no longer as frequent or severe.\n\nTo every friend going through the diagnosis process: don\'t give up. Find a good rheumatologist, follow their treatment plan, and life will gradually get better.',
        author: '患者小明',
        location: '北京',
        published: 1
      },
      {
        title_zh: '与病共舞',
        title_en: 'Dancing with the Disease',
        summary_zh: '被确诊时我哭了整整三天。但当我意识到哭泣解决不了任何问题后，我开始系统学习白塞病知识，找到适合自己的治疗方案，调整生活节奏。现在我依然热爱生活——跳舞、绘画，照样过得精彩。',
        summary_en: 'I cried for three whole days when I was diagnosed. But when I realized that crying couldn\'t solve anything, I started systematically learning about Behcet\'s Disease, found a treatment plan that works for me, and adjusted my life rhythm. I still love life—dancing, painting, and living wonderfully.',
        content_zh: '被确诊时我哭了整整三天。但当我意识到哭泣解决不了任何问题后，我开始系统学习白塞病知识，找到适合自己的治疗方案，调整生活节奏。现在我依然热爱生活——跳舞、绘画，照样过得精彩。\n\n我和医生充分沟通，制定了适合我的治疗方案——秋水仙碱控制口腔溃疡发作，眼科定期复查。经过半年调整，病情逐渐稳定下来。\n\n我想告诉病友们：白塞病确实改变了我的生活，但它没有夺走我热爱生活的能力。找到适合自己的节奏，学会与疾病和平共处，你会发现生活依然有很多美好值得期待。',
        content_en: 'I cried for three whole days when I was diagnosed. But when I realized that crying couldn\'t solve anything, I started systematically learning about Behcet\'s Disease, found a treatment plan that works for me, and adjusted my life rhythm. I still love life—dancing, painting, and living wonderfully.\n\nI communicated thoroughly with my doctor and developed a treatment plan—colchicine to control oral ulcer outbreaks, regular ophthalmology check-ups. After six months of adjustment, my condition gradually stabilized.\n\nTo my fellow patients: Behcet\'s Disease has indeed changed my life, but it hasn\'t taken away my ability to love life. Find your own rhythm, learn to coexist peacefully with the disease, and you\'ll find that life still has many wonderful things worth looking forward to.',
        author: '患者晓雯',
        location: '上海',
        published: 1
      },
      {
        title_zh: '联盟让我不再孤单',
        title_en: 'The Alliance Made Me No Longer Alone',
        summary_zh: '患病的最初两年，我一直以为只有自己是这样，网上搜到的信息残缺不全，家人也不理解。加入白塞病联盟后，遇见了许多同路人，大家互相分享经验、加油打气，那种不孤单的感觉真的很治愈。',
        summary_en: 'During the first two years of illness, I thought I was the only one. The information online was incomplete, and my family didn\'t understand. After joining the Behcet\'s Alliance, I met many fellow travelers who shared experiences and encouraged each other. That feeling of not being alone was truly healing.',
        content_zh: '患病的最初两年，我一直以为只有自己是这样，网上搜到的信息残缺不全，家人也不理解。加入白塞病联盟后，遇见了许多同路人，大家互相分享经验、加油打气，那种不孤单的感觉真的很治愈。\n\n在联盟里，有人分享就医经验，推荐靠谱的医生；有人分享用药心得，提醒注意事项；还有人只是安静地听你倾诉，给你一个温暖的拥抱。这些看似微小的善意，对一个孤独的病患来说，意义非凡。\n\n如果你正在独自面对白塞病，我想对你说：不要一个人扛，加入我们，你不需要独自面对这一切。',
        content_en: 'During the first two years of illness, I thought I was the only one. The information online was incomplete, and my family didn\'t understand. After joining the Behcet\'s Alliance, I met many fellow travelers who shared experiences and encouraged each other. That feeling of not being alone was truly healing.\n\nIn the alliance, some share medical experiences and recommend reliable doctors; others share medication tips and precautions; and some just quietly listen and give you a warm hug. These seemingly small acts of kindness mean the world to a lonely patient.\n\nIf you\'re facing Behcet\'s Disease alone, I want to tell you: don\'t carry it by yourself. Join us, you don\'t have to face this alone.',
        author: '患者大伟',
        location: '成都',
        published: 1
      }
    ];

    const insertMany = db.transaction((items) => {
      for (const s of items) {
        insertStory.run(s.title_zh, s.title_en, s.summary_zh, s.summary_en, s.content_zh, s.content_en, s.author, s.location, s.published);
      }
    });
    insertMany(stories);
    console.log('[DB] 已插入 3 篇病友故事种子数据');
  }

  // 网站设置种子
  const settingsCount = db.prepare('SELECT COUNT(*) AS cnt FROM settings').get().cnt;
  if (settingsCount === 0) {
    db.prepare(
      `INSERT INTO settings (id, site_name_zh, site_name_en, site_description_zh, site_description_en, contact_email, wechat_group_qr_url) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      1,
      '白塞病联盟',
      'Behcet\'s Alliance',
      '权威知识、就医导航、温暖社区',
      'Authoritative knowledge, medical guide, warm community',
      'behcet.alliance@example.com',
      ''
    );
    console.log('[DB] 已插入网站设置种子数据');
  }
}

// 初始化
createTables();
seedData();

module.exports = db;
