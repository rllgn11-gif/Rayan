// ================================================================
// الملف: study.js
// طبقة الدراسة والإتقان - مع مسارين للبحث
// ================================================================

const SERVER_URL = 'https://rayan-rrbi.onrender.com';

// ===== تهيئة بيانات الدراسة =====
if (!window.brain.study) {
  window.brain.study = {
    workbench: [],
    mastered: []
  };
}

let currentStudySession = null;
let currentQuestionIndex = 0;
let correctAnswers = 0;
let totalQuestions = 0;

// ================================================================
// 1. تحميل نص للدراسة
// ================================================================
function loadTextForStudy(title, rawText) {
  if (!title || !rawText) {
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('⚠️ يرجى إدخال عنوان ونص للدراسة.');
    }
    return;
  }

  const id = 'study_' + Date.now();
  const facts = extractFactsFromText(rawText);
  const questions = generateQuestionsFromFacts(facts);

  const entry = {
    id: id,
    title: title,
    rawText: rawText,
    facts: facts,
    questions: questions,
    mastery: 0,
    studySessions: 0,
    lastStudied: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  window.brain.study.workbench.push(entry);
  saveBrain();
  if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
    UIAPI.showToast(`📚 تم تحميل "${title}" للدراسة (${facts.length} حقيقة، ${questions.length} سؤال).`);
  }
  if (typeof UIAPI !== 'undefined' && UIAPI.refreshStats) UIAPI.refreshStats();
  renderStudyFeed();
  return entry;
}

// ================================================================
// 2. استخراج الحقائق من النص
// ================================================================
function extractFactsFromText(text) {
  const facts = [];
  const sentences = text.split(/[.!?،؛\n\r]+/).filter(s => s.trim().length > 10);
  
  for (const sentence of sentences) {
    let parsed = null;
    if (typeof parseSentenceAdvanced === 'function') {
      const results = parseSentenceAdvanced(sentence);
      if (results && results.length > 0) parsed = results[0];
    }
    if (!parsed && typeof advancedParse === 'function') {
      parsed = advancedParse(sentence);
    }
    
    if (parsed) {
      const subj = parsed.subject || 'موضوع';
      const rel = parsed.verb || parsed.predicate || 'هو';
      const obj = parsed.obj || parsed.predicate || parsed.location || 'معلومة';
      
      const exists = facts.some(f => f.subj === subj && f.rel === rel && f.obj === obj);
      if (!exists && subj !== 'موضوع' && obj !== 'معلومة') {
        facts.push({ subj, rel, obj });
      }
    }
  }
  
  if (facts.length === 0) {
    for (const sentence of sentences.slice(0, 10)) {
      const trimmed = sentence.trim();
      if (trimmed.length > 15) {
        facts.push({ subj: 'النص', rel: 'يذكر', obj: trimmed });
      }
    }
  }
  
  return facts;
}

// ================================================================
// 3. توليد أسئلة من الحقائق
// ================================================================
function generateQuestionsFromFacts(facts) {
  const questions = [];
  for (const fact of facts) {
    questions.push({
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'fill',
      question: `ما هو "${fact.rel}" لـ "${fact.subj}"؟`,
      answer: fact.obj,
      fact: fact,
      hints: [`الإجابة هي "${fact.obj}"`]
    });
    
    questions.push({
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'fill',
      question: `ما هو "${fact.obj}"؟ (في سياق "${fact.subj}")`,
      answer: fact.rel,
      fact: fact,
      hints: [`العلاقة هي "${fact.rel}"`]
    });
  }
  return questions;
}

// ================================================================
// 4. البحث عن إجابة عبر الخادم
// ================================================================
async function searchAnswerOnline(question) {
  try {
    const keywords = question
      .replace(/[؟؟!.,"']/g, '')
      .replace(/^(ما هو|ما هي|ماذا|من هو|من هي|أين|كيف|لماذا)\s*/i, '')
      .trim();
    
    if (!keywords || keywords.length < 3) {
      return { found: false, error: 'الكلمات المفتاحية قصيرة جداً' };
    }

    // ===== المسارات التي سيحاولها =====
    const paths = [
      `/api/search?q=${encodeURIComponent(keywords)}`,      // المسار البديل (الأول)
      `/api/search-wiki?q=${encodeURIComponent(keywords)}`, // المسار الأصلي
      `/search-wiki?q=${encodeURIComponent(keywords)}`
    ];

    // ===== محاولة الاتصال بالخادم =====
    for (const path of paths) {
      try {
        const url = `${SERVER_URL}${path}`;
        console.log(`🔍 محاولة المسار: ${url}`);
        
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.found) {
            return { 
              found: true, 
              answer: data.answer, 
              source: data.source || 'server',
              title: data.title || keywords
            };
          }
        }
      } catch (e) {
        console.log(`⚠️ فشل المسار ${path}:`, e.message);
      }
    }

    // ===== حل احتياطي: ويكيبيديا مباشرة =====
    try {
      const wikiUrl = `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keywords)}`;
      console.log(`🔍 حل احتياطي: ${wikiUrl}`);
      
      const wikiResponse = await fetch(wikiUrl, {
        signal: AbortSignal.timeout(8000)
      });
      
      if (wikiResponse.ok) {
        const wikiData = await wikiResponse.json();
        if (wikiData && wikiData.extract) {
          const sentences = wikiData.extract.split(/[.!?;]/).filter(s => s.trim().length > 10);
          const answer = sentences.length > 0 ? sentences[0].trim() : wikiData.extract.substring(0, 200);
          return { 
            found: true, 
            answer: answer, 
            source: 'wikipedia_direct',
            title: wikiData.title || keywords
          };
        }
      }
    } catch (e) {
      console.log('⚠️ فشل الاتصال بويكيبيديا مباشرة:', e.message);
    }

    return { found: false, error: 'لم أجد إجابة بعد المحاولات المتعددة' };
  } catch (e) {
    console.error('خطأ في البحث:', e);
    return { found: false, error: e.message };
  }
}

// ================================================================
// 5. الإجابة التلقائية على السؤال (بدون تغيير)
// ================================================================
// ... (باقي الدوال كما هي من النسخة السابقة)
// ================================================================

// ===== تصدير الدوال =====
window.loadTextForStudy = loadTextForStudy;
window.extractFactsFromText = extractFactsFromText;
window.generateQuestionsFromFacts = generateQuestionsFromFacts;
window.startStudySession = startStudySession;
window.renderStudySession = renderStudySession;
window.submitAnswer = submitAnswer;
window.skipQuestion = skipQuestion;
window.endStudySession = endStudySession;
window.moveToMastered = moveToMastered;
window.renderStudyFeed = renderStudyFeed;
window.removeStudyText = removeStudyText;
window.loadTextFromInput = loadTextFromInput;
window.searchAnswerOnline = searchAnswerOnline;
window.autoAnswerCurrentQuestion = autoAnswerCurrentQuestion;
window.SERVER_URL = SERVER_URL;

console.log('✅ study.js loaded successfully');
console.log(`🌐 Server URL: ${SERVER_URL}`);
