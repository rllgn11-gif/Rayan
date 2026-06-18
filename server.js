const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ===== نقطة نهاية للتحقق =====
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== الصفحة الرئيسية =====
app.get('/', (req, res) => {
  res.json({
    name: '🧠 العقل الفارغ - الخادم المساعد',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      search_wiki: '/api/search-wiki?q=الكلمة',
      fetch_page: '/api/fetch-page (POST)',
      scrape: '/api/scrape (POST)',
      teach: '/api/teach (POST)'
    }
  });
});

// ================================================================
// البحث في ويكيبيديا (المسار المطلوب)
// ================================================================
app.get('/api/search-wiki', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'معامل البحث q مطلوب' });
    }

    const keywords = query
      .replace(/[؟؟!.,"']/g, '')
      .replace(/^(ما هو|ما هي|ماذا|من هو|من هي|أين|كيف|لماذا)\s*/i, '')
      .trim();

    if (!keywords || keywords.length < 2) {
      return res.json({ found: false, error: 'الكلمات المفتاحية قصيرة جداً' });
    }

    const url = `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keywords)}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'BrainBot/1.0' },
      timeout: 8000
    });

    if (response.data && response.data.extract) {
      const sentences = response.data.extract.split(/[.!?;]/).filter(s => s.trim().length > 10);
      const answer = sentences.length > 0 ? sentences[0].trim() : response.data.extract.substring(0, 300);

      return res.json({
        found: true,
        answer: answer,
        title: response.data.title || keywords,
        source: 'wikipedia'
      });
    }

    return res.json({ found: false, error: 'لم أجد نتيجة' });
  } catch (error) {
    console.error('خطأ في البحث:', error.message);
    res.status(500).json({ error: 'فشل البحث', details: error.message });
  }
});

// ================================================================
// جلب صفحة وحل CORS
// ================================================================
app.post('/api/fetch-page', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'الرابط مطلوب' });
    }

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrainBot/1.0)' },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();

    let text = '';
    $('p, h1, h2, h3, h4, h5, h6, li, div.content, article').each((i, el) => {
      const content = $(el).text().trim();
      if (content.length > 20) text += content + '\n';
    });

    if (!text.trim()) text = $('body').text().trim();
    text = text.replace(/\s+/g, ' ').trim();

    res.json({ success: true, text, length: text.length, url });
  } catch (error) {
    console.error('خطأ في جلب الصفحة:', error.message);
    res.status(500).json({ error: 'فشل جلب الصفحة', details: error.message });
  }
});

// ================================================================
// الزحف إلى صفحة
// ================================================================
app.post('/api/scrape', async (req, res) => {
  try {
    const { url, selector = 'p, h1, h2, h3, li', maxResults = 30 } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'الرابط مطلوب' });
    }

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrainBot/1.0)' },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const results = [];
    $(selector).each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 10 && results.length < maxResults) {
        results.push(text);
      }
    });

    res.json({ success: true, results, total: results.length, selector });
  } catch (error) {
    console.error('خطأ في الزحف:', error.message);
    res.status(500).json({ error: 'فشل الزحف', details: error.message });
  }
});

// ================================================================
// تلقين معلومة
// ================================================================
app.post('/api/teach', async (req, res) => {
  try {
    const { subject, relation, object, isNegated } = req.body;
    if (!subject || !relation || !object) {
      return res.status(400).json({ error: 'الموضوع والعلاقة والمفعول مطلوبة' });
    }
    res.json({
      success: true,
      fact: { subject, relation, object, isNegated: isNegated || false },
      message: 'تم تلقين المعلومة بنجاح'
    });
  } catch (error) {
    console.error('خطأ في التلقين:', error.message);
    res.status(500).json({ error: 'فشل التلقين' });
  }
});

// ===== تشغيل الخادم =====
app.listen(PORT, () => {
  console.log(`🚀 خادم العقل الفارغ يعمل على المنفذ ${PORT}`);
  console.log('📊 نقاط النهاية المتاحة:');
  console.log('   GET  /health          - التحقق من الصحة');
  console.log('   GET  /api/search-wiki - البحث في ويكيبيديا');
  console.log('   POST /api/fetch-page  - جلب صفحة وحل CORS');
  console.log('   POST /api/scrape      - زحف إلى صفحة');
  console.log('   POST /api/teach       - تلقين معلومة');
});
