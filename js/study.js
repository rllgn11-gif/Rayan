// ================================================================
// الملف: study.js
// طبقة الدراسة والإتقان - مع ربط خادم البحث
// ================================================================

// ===== تكوين الخادم (تم التحديث برابط Render) =====
const SERVER_URL = 'https://rayan-rrbi.onrender.com'; // ✅ تم التحديث

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
// 4. البحث عن إجابة عبر الخادم (مع حل احتياطي)
// ================================================================
async function searchAnswerOnline(question) {
  try {
    // استخراج الكلمات المفتاحية
    const keywords = question
      .replace(/[؟؟!.,"']/g, '')
      .replace(/^(ما هو|ما هي|ماذا|من هو|من هي|أين|كيف|لماذا)\s*/i, '')
      .trim();
    
    if (!keywords || keywords.length < 3) {
      return { found: false, error: 'الكلمات المفتاحية قصيرة جداً' };
    }

    // ===== 1. محاولة الاتصال بالخادم =====
    try {
      const url = `${SERVER_URL}/api/search-wiki?q=${encodeURIComponent(keywords)}`;
      console.log('🔍 جاري البحث في الخادم:', url);
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000) // مهلة 10 ثوان
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
      console.log('⚠️ فشل الاتصال بالخادم، جاري استخدام الحل الاحتياطي...', e.message);
    }

    // ===== 2. حل احتياطي: الاتصال مباشرة بويكيبيديا =====
    try {
      const wikiUrl = `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keywords)}`;
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

    return { found: false, error: 'لم أجد إجابة' };
  } catch (e) {
    console.error('خطأ في البحث:', e);
    return { found: false, error: e.message };
  }
}

// ================================================================
// 5. الإجابة التلقائية على السؤال
// ================================================================
async function autoAnswerCurrentQuestion() {
  const entry = window.brain.study.workbench.find(e => e.id === currentStudySession);
  if (!entry) {
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('⚠️ لا توجد جلسة دراسة نشطة.');
    }
    return;
  }
  
  if (currentQuestionIndex >= entry.questions.length) {
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('⚠️ انتهت الأسئلة.');
    }
    return;
  }
  
  const question = entry.questions[currentQuestionIndex];
  const feedback = document.getElementById('studyFeedback');
  
  if (!feedback) return;
  
  feedback.innerHTML = '⏳ جاري البحث عن الإجابة...';
  feedback.style.color = '#3b82f6';
  
  const result = await searchAnswerOnline(question.question);
  
  if (result.found) {
    feedback.innerHTML = `✅ وجدت إجابة: "${result.answer}" (من ${result.source})`;
    feedback.style.color = '#22c55e';
    
    // تلقين الإجابة في قاعدة المعرفة
    const answerText = `${entry.title} ${result.answer}`;
    const toks = tokenize(answerText);
    const learned = learnSentence(toks);
    
    correctAnswers++;
    entry.mastery = Math.min(100, entry.mastery + 10);
    entry.studySessions++;
    entry.lastStudied = new Date().toISOString();
    saveBrain();
    
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast(`🤖 تم التعلم: ${result.answer.substring(0, 50)}...`);
    }
    
    setTimeout(() => {
      currentQuestionIndex++;
      renderStudySession();
      if (typeof UIAPI !== 'undefined' && UIAPI.refreshStats) UIAPI.refreshStats();
      renderStudyFeed();
    }, 2000);
    
  } else {
    feedback.innerHTML = `❌ لم أجد إجابة: ${result.error || 'غير معروف'}`;
    feedback.style.color = '#ef4444';
    
    // عرض زر للمساعدة اليدوية
    setTimeout(() => {
      feedback.innerHTML += `<br><button class="btn btn-sm" onclick="skipQuestion()" style="margin-top:4px;">⏭️ تخطي</button>`;
    }, 500);
  }
}

// ================================================================
// 6. بدء جلسة دراسة
// ================================================================
function startStudySession(studyId) {
  const entry = window.brain.study.workbench.find(e => e.id === studyId);
  if (!entry) {
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('⚠️ لم يتم العثور على النص.');
    }
    return;
  }
  
  if (entry.questions.length === 0) {
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('⚠️ لا توجد أسئلة لهذا النص.');
    }
    return;
  }
  
  currentStudySession = studyId;
  currentQuestionIndex = 0;
  correctAnswers = 0;
  totalQuestions = entry.questions.length;
  
  if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
    UIAPI.showToast(`⏳ بدء جلسة دراسة: "${entry.title}" (${totalQuestions} سؤال)`);
  }
  renderStudySession();
}

// ================================================================
// 7. عرض جلسة الدراسة
// ================================================================
function renderStudySession() {
  const entry = window.brain.study.workbench.find(e => e.id === currentStudySession);
  if (!entry) return;
  
  const container = document.getElementById('studySessionContainer');
  if (!container) return;
  
  if (currentQuestionIndex >= entry.questions.length) {
    endStudySession();
    return;
  }
  
  const question = entry.questions[currentQuestionIndex];
  const progress = `${currentQuestionIndex + 1}/${entry.questions.length}`;
  
  container.innerHTML = `
    <div style="background:var(--ink-soft);border:1px solid var(--line);border-radius:8px;padding:12px;margin-top:8px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--parchment-dim);margin-bottom:6px;">
        <span>📖 ${entry.title}</span>
        <span>📊 الإتقان: ${entry.mastery}%</span>
        <span>📝 ${progress}</span>
      </div>
      <div style="font-size:15px;margin:8px 0;padding:8px;background:rgba(0,0,0,0.2);border-radius:4px;">
        ❓ ${question.question}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input id="studyAnswerInput" type="text" placeholder="اكتب إجابتك..." style="flex:1;min-width:100px;background:var(--ink);border:1px solid var(--line);color:var(--parchment);padding:6px 10px;border-radius:4px;font-family:var(--sans);">
        <button class="btn-main" id="studySubmitBtn" style="padding:6px 14px;font-size:12px;">إجابة</button>
        <button class="btn-main" id="studyAutoBtn" style="padding:6px 14px;font-size:12px;background:#2563eb;color:#fff;">🤖 بحث</button>
        <button class="btn" id="studySkipBtn" style="padding:6px 10px;font-size:12px;">⏭️ تخطي</button>
      </div>
      <div id="studyFeedback" style="margin-top:6px;font-size:12px;color:var(--parchment-dim);"></div>
    </div>
  `;
  
  document.getElementById('studySubmitBtn').addEventListener('click', () => {
    const input = document.getElementById('studyAnswerInput');
    submitAnswer(input.value.trim());
  });
  
  document.getElementById('studyAutoBtn').addEventListener('click', () => {
    autoAnswerCurrentQuestion();
  });
  
  document.getElementById('studySkipBtn').addEventListener('click', () => {
    skipQuestion();
  });
  
  document.getElementById('studyAnswerInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('studySubmitBtn').click();
    }
  });
  
  document.getElementById('studyAnswerInput').focus();
}

// ================================================================
// 8. تقديم إجابة
// ================================================================
function submitAnswer(userAnswer) {
  const entry = window.brain.study.workbench.find(e => e.id === currentStudySession);
  if (!entry) return;
  
  const question = entry.questions[currentQuestionIndex];
  const feedback = document.getElementById('studyFeedback');
  
  if (!userAnswer) {
    feedback.innerHTML = '⚠️ يرجى كتابة إجابة.';
    feedback.style.color = '#f59e0b';
    return;
  }
  
  const normalizedUser = userAnswer.replace(/[،؟!\.،;]/g, '').trim().toLowerCase();
  const normalizedAnswer = question.answer.replace(/[،؟!\.،;]/g, '').trim().toLowerCase();
  
  const userWords = normalizedUser.split(' ');
  const answerWords = normalizedAnswer.split(' ');
  let matchCount = 0;
  for (const w of userWords) {
    if (answerWords.some(a => a.includes(w) || w.includes(a))) {
      matchCount++;
    }
  }
  const matchRatio = userWords.length > 0 ? matchCount / userWords.length : 0;
  
  const isCorrect = matchRatio >= 0.4 || normalizedUser.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedUser);
  
  if (isCorrect) {
    correctAnswers++;
    feedback.innerHTML = `✅ صحيح! الإجابة الصحيحة: "${question.answer}"`;
    feedback.style.color = '#22c55e';
  } else {
    feedback.innerHTML = `❌ خطأ. الإجابة الصحيحة: "${question.answer}"`;
    feedback.style.color = '#ef4444';
    if (question.hints && question.hints.length > 0) {
      feedback.innerHTML += `<br>💡 ${question.hints[0]}`;
    }
  }
  
  setTimeout(() => {
    currentQuestionIndex++;
    const progress = currentQuestionIndex / entry.questions.length;
    const newMastery = Math.round(progress * 100);
    if (newMastery > entry.mastery) {
      entry.mastery = Math.min(100, newMastery + (isCorrect ? 5 : 0));
    }
    entry.studySessions++;
    entry.lastStudied = new Date().toISOString();
    saveBrain();
    renderStudySession();
    if (typeof UIAPI !== 'undefined' && UIAPI.refreshStats) UIAPI.refreshStats();
    renderStudyFeed();
  }, 1500);
}

// ================================================================
// 9. تخطي سؤال
// ================================================================
function skipQuestion() {
  const entry = window.brain.study.workbench.find(e => e.id === currentStudySession);
  if (!entry) return;
  
  const question = entry.questions[currentQuestionIndex];
  const feedback = document.getElementById('studyFeedback');
  feedback.innerHTML = `⏭️ تخطيت السؤال. الإجابة: "${question.answer}"`;
  feedback.style.color = '#6b7280';
  
  setTimeout(() => {
    currentQuestionIndex++;
    renderStudySession();
    if (typeof UIAPI !== 'undefined' && UIAPI.refreshStats) UIAPI.refreshStats();
    renderStudyFeed();
  }, 1000);
}

// ================================================================
// 10. إنهاء جلسة الدراسة
// ================================================================
function endStudySession() {
  const entry = window.brain.study.workbench.find(e => e.id === currentStudySession);
  if (!entry) return;
  
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  entry.mastery = Math.min(100, entry.mastery + score);
  entry.studySessions++;
  entry.lastStudied = new Date().toISOString();
  
  if (entry.mastery >= 90) {
    moveToMastered(entry.id);
  }
  
  saveBrain();
  if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
    UIAPI.showToast(`📊 انتهت الجلسة! الإتقان: ${entry.mastery}% (${correctAnswers}/${totalQuestions} صحيحة)`);
  }
  currentStudySession = null;
  if (typeof UIAPI !== 'undefined' && UIAPI.refreshStats) UIAPI.refreshStats();
  renderStudyFeed();
  
  const container = document.getElementById('studySessionContainer');
  if (container) {
    container.innerHTML = `
      <div style="background:var(--ink-soft);border:1px solid var(--line);border-radius:8px;padding:12px;margin-top:8px;text-align:center;">
        <div style="font-size:18px;font-weight:bold;color:var(--gold);">${entry.mastery >= 90 ? '🎉 مُتقن!' : '📖 واصل الدراسة!'}</div>
        <div style="font-size:13px;color:var(--parchment-dim);margin:4px 0;">
          الإتقان: ${entry.mastery}% (${correctAnswers}/${totalQuestions} صحيحة)
        </div>
        <button class="btn-main" onclick="startStudySession('${entry.id}')" style="margin-top:6px;padding:4px 16px;font-size:12px;">
          ${entry.mastery >= 90 ? '📚 مراجعة' : '⏳ جلسة جديدة'}
        </button>
      </div>
    `;
  }
}

// ================================================================
// 11. نقل إلى المُتقنات
// ================================================================
function moveToMastered(studyId) {
  const index = window.brain.study.workbench.findIndex(e => e.id === studyId);
  if (index === -1) return;
  
  const entry = window.brain.study.workbench[index];
  const masteredEntry = {
    id: entry.id,
    title: entry.title,
    facts: entry.facts,
    questions: entry.questions,
    mastery: entry.mastery,
    studiedAt: new Date().toISOString()
  };
  
  window.brain.study.mastered.push(masteredEntry);
  window.brain.study.workbench.splice(index, 1);
  
  if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
    UIAPI.showToast(`🎉 تم إتقان "${entry.title}"! (تم حذف النص الخام)`);
  }
  saveBrain();
  renderStudyFeed();
}

// ================================================================
// 12. عرض حالة الدراسة
// ================================================================
function renderStudyFeed() {
  const container = document.getElementById('studyFeed');
  if (!container) return;
  
  let html = '';
  const workbench = window.brain.study?.workbench || [];
  const mastered = window.brain.study?.mastered || [];
  
  if (workbench.length === 0 && mastered.length === 0) {
    container.innerHTML = '<div style="color:var(--parchment-dim);font-size:13px;padding:10px;text-align:center;">📚 لا توجد نصوص للدراسة.</div>';
    return;
  }
  
  if (workbench.length > 0) {
    html += `<div style="font-size:12px;color:var(--gold);margin:8px 0 4px;font-weight:bold;">📖 قيد الدراسة (${workbench.length})</div>`;
    for (const entry of workbench) {
      html += `
        <div class="card taught" style="border-right:3px solid #3b82f6;margin-bottom:4px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:bold;">${entry.title}</span>
            <span style="font-size:11px;color:var(--parchment-dim);">إتقان: ${entry.mastery}% | جلسات: ${entry.studySessions}</span>
          </div>
          <div style="font-size:11px;color:var(--parchment-dim);margin-top:2px;">
            حقائق: ${entry.facts.length} | أسئلة: ${entry.questions.length}
          </div>
          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-sm" onclick="startStudySession('${entry.id}')">⏳ دراسة</button>
            <button class="btn btn-sm danger" onclick="removeStudyText('${entry.id}')">🗑️ حذف</button>
          </div>
        </div>
      `;
    }
  }
  
  if (mastered.length > 0) {
    html += `<div style="font-size:12px;color:#22c55e;margin:8px 0 4px;font-weight:bold;">🎉 مُتقن (${mastered.length})</div>`;
    for (const entry of mastered) {
      html += `
        <div class="card taught" style="border-right:3px solid #22c55e;background:rgba(34,197,94,0.05);margin-bottom:4px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:bold;">${entry.title}</span>
            <span style="font-size:11px;color:#22c55e;">✅ إتقان: ${entry.mastery}%</span>
          </div>
          <div style="font-size:11px;color:var(--parchment-dim);margin-top:2px;">
            حقائق: ${entry.facts.length} | أسئلة: ${entry.questions.length} | أُتقن في: ${new Date(entry.studiedAt).toLocaleDateString()}
          </div>
        </div>
      `;
    }
  }
  
  container.innerHTML = html;
}

// ================================================================
// 13. حذف نص من الدراسة
// ================================================================
function removeStudyText(studyId) {
  if (!confirm('⚠️ هل أنت متأكد من حذف هذا النص من الدراسة؟')) return;
  
  const index = window.brain.study.workbench.findIndex(e => e.id === studyId);
  if (index !== -1) {
    window.brain.study.workbench.splice(index, 1);
    saveBrain();
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) UIAPI.showToast('🗑️ تم حذف النص.');
    renderStudyFeed();
    if (typeof UIAPI !== 'undefined' && UIAPI.refreshStats) UIAPI.refreshStats();
  }
}

// ================================================================
// 14. تحميل النص من المدخل
// ================================================================
function loadTextFromInput() {
  const titleInput = document.getElementById('studyTitleInput');
  const textInput = document.getElementById('studyTextInput');
  
  const title = titleInput.value.trim() || 'نص غير معنون';
  const text = textInput.value.trim();
  
  if (!text) {
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('⚠️ يرجى لصق النص للدراسة.');
    }
    return;
  }
  
  loadTextForStudy(title, text);
  titleInput.value = '';
  textInput.value = '';
}

// ================================================================
// 15. تصدير الدوال إلى النطاق العام
// ================================================================
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
