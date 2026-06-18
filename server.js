// ================================================================
// الملف: server.js
// خادم العقل الفارغ - للزحف والبحث وحل مشكلة CORS
// يعمل على Render / Railway / Vercel
// ================================================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== تفعيل CORS للسماح للواجهة الأمامية بالتواصل =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ===== نقطة نهاية للتحقق من صحة الخادم =====
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ===== نقطة نهاية رئيسية =====
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
// 1. البحث في ويكيبيديا
// ================================================================
app.get('/api/search-wiki', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'معامل البحث q مطلوب' });
    }

    // تنظيف الكلمات المفتاحية
    const keywords = query
      .replace(/[؟؟!.,"']/g, '')
      .replace(/^(ما هو|ما هي|ماذا|من هو|من هي|أين|كيف|لماذا)\s*/i, '')
      .trim();

    if (!keywords || keywords.length < 2) {
      return res.json({ found: false, error: 'الكلمات المفتاحية قصيرة جداً' });
    }

    // 1. البحث في ويكيبيديا العربية
    const wikiUrl = `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keywords)}`;
    const response = await axios.get(wikiUrl, {
      headers: { 'User-Agent': 'BrainBot/1.0 (https://github.com/your-username/brain-empty)' },
      timeout: 8000
    });

    if (response.data && response.data.extract) {
      const sentences = response.data.extract.split(/[.!?;]/).filter(s => s.trim().length > 10);
      const answer = sentences.length > 0 ? sentences[0].trim() : response.data.extract.substring(0, 300);

      return res.json({
        found: true,
        answer: answer,
        title: response.data.title || keywords,
        source: 'wikipedia_ar',
        fullText: response.data.extract
      });
    }

    // 2. محاولة البحث في ويكيبيديا الإنجليزية
    const enUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keywords)}`;
    const enResponse = await axios.get(enUrl, {
      headers: { 'User-Agent': 'BrainBot/1.0' },
      timeout: 8000
    });

    if (enResponse.data && enResponse.data.extract) {
      const sentences = enResponse.data.extract.split(/[.!?;]/).filter(s => s.trim().length > 10);
      const answer = sentences.length > 0 ? sentences[0].trim() : enResponse.data.extract.substring(0, 300);

      return res.json({
        found: true,
        answer: `(مترجم تقريباً) ${answer}`,
        title: enResponse.data.title || keywords,
        source: 'wikipedia_en'
      });
    }

    return res.json({ found: false, error: 'لم أجد نتيجة' });
  } catch (error) {
    console.error('خطأ في البحث:', error.message);
    res.status(500).json({
      error: 'فشل البحث',
      details: error.message
    });
  }
});

// ================================================================
// 2. جلب صفحة وحل مشكلة CORS
// ================================================================
app.post('/api/fetch-page', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'الرابط مطلوب' });
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrainBot/1.0)'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // إزالة العناصر غير المرغوب فيها
    $('script, style, nav, footer, header, aside, .ad, .advertisement, .banner, .cookie').remove();

    // استخراج النص من الفقرات والعناوين
    let text = '';
    $('p, h1, h2, h3, h4, h5, h6, li, div.content, article, .post-content, .entry-content').each((i, el) => {
      const content = $(el).text().trim();
      if (content.length > 20) {
        text += content + '\n';
      }
    });

    // إذا لم نجد نصاً، نأخذ النص من body
    if (!text.trim()) {
      text = $('body').text().trim();
    }

    // تنظيف النص
    text = text.replace(/\s+/g, ' ').trim();

    res.json({
      success: true,
      text: text,
      length: text.length,
      url: url
    });

  } catch (error) {
    console.error('خطأ في جلب الصفحة:', error.message);
    res.status(500).json({
      error: 'فشل جلب الصفحة',
      details: error.message
    });
  }
});

// ================================================================
// 3. الزحف إلى صفحة (Scraping)
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

    res.json({
      success: true,
      results: results,
      total: results.length,
      selector: selector
    });

  } catch (error) {
    console.error('خطأ في الزحف:', error.message);
    res.status(500).json({
      error: 'فشل الزحف',
      details: error.message
    });
  }
});

// ================================================================
// 4. تلقين المعلومات مباشرة إلى العقل
// ================================================================
app.post('/api/teach', async (req, res) => {
  try {
    const { subject, relation, object, isNegated } = req.body;

    if (!subject || !relation || !object) {
      return res.status(400).json({ error: 'الموضوع والعلاقة والمفعول مطلوبة' });
    }

    // هنا يمكن تخزين المعلومات في قاعدة بيانات
    // حالياً نعيد النجاح فقط
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

// ================================================================
// 5. البحث المتقدم (مجمع)
// ================================================================
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'معامل البحث q مطلوب' });
    }

    const results = [];

    // 1. البحث في ويكيبيديا
    const wikiResult = await axios.get(
      `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { timeout: 5000 }
    ).catch(() => null);

    if (wikiResult && wikiResult.data && wikiResult.data.extract) {
      results.push({
        source: 'wikipedia',
        title: wikiResult.data.title || query,
        snippet: wikiResult.data.extract.substring(0, 300),
        fullText: wikiResult.data.extract
      });
    }

    // 2. بحث في Wikidata (معلومات منظمة)
    const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=ar&format=json`;
    const wikidataResult = await axios.get(wikidataUrl, { timeout: 5000 }).catch(() => null);

    if (wikidataResult && wikidataResult.data && wikidataResult.data.search) {
      for (const item of wikidataResult.data.search.slice(0, 3)) {
        results.push({
          source: 'wikidata',
          title: item.label,
          description: item.description || 'لا يوجد وصف',
          id: item.id
        });
      }
    }

    res.json({
      success: true,
      query: query,
      results: results,
      total: results.length
    });

  } catch (error) {
    console.error('خطأ في البحث المتقدم:', error.message);
    res.status(500).json({ error: 'فشل البحث المتقدم' });
  }
});

// ===== تشغيل الخادم =====
app.listen(PORT, () => {
  console.log(`🚀 خادم العقل الفارغ يعمل على المنفذ ${PORT}`);
  console.log(`📊 نقاط النهاية المتاحة:`);
  console.log(`   GET  /health          - التحقق من الصحة`);
  console.log(`   GET  /api/search-wiki - البحث في ويكيبيديا`);
  console.log(`   POST /api/fetch-page  - جلب صفحة وحل CORS`);
  console.log(`   POST /api/scrape      - زحف إلى صفحة`);
  console.log(`   POST /api/teach       - تلقين معلومة`);
  console.log(`   GET  /api/search      - بحث متقدم`);
});