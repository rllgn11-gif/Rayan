// ================================================================
// الملف: inference.js
// محرك الاستدلال والفضول (Inference Engine)
// ================================================================

// ===== 1. تطبيق قاعدة التسلسل =====
function applyTransitiveRule(subj, rel1, obj1, rel2, obj2) {
  const facts = window.brain.facts;
  const kernel = window.brain.kernel?.facts || {};
  const allFacts = { ...kernel, ...facts };
  
  if (!allFacts[subj] || !allFacts[subj][rel1]) return false;
  if (!allFacts[obj1] || !allFacts[obj1][rel2]) return false;
  
  if (allFacts[subj][rel1].includes(obj1) && allFacts[obj1][rel2].includes(obj2)) {
    const newRel = `${rel1} ← ${rel2}`;
    
    // تجنب إضافة نفس العلاقة مرتين
    if (allFacts[subj] && allFacts[subj][newRel] && allFacts[subj][newRel].includes(obj2)) {
      return false;
    }
    
    // إضافة الاستنتاج
    const result = addFactDeduplicated(subj, newRel, obj2, false);
    if (result.status === 'added' || result.status === 'conflict') {
      // تسجيل كمستنتج
      if (!window.brain.inferences) window.brain.inferences = { facts: {} };
      if (!window.brain.inferences.facts[subj]) window.brain.inferences.facts[subj] = {};
      if (!window.brain.inferences.facts[subj][newRel]) window.brain.inferences.facts[subj][newRel] = [];
      if (!window.brain.inferences.facts[subj][newRel].includes(obj2)) {
        window.brain.inferences.facts[subj][newRel].push(obj2);
      }
      console.log(`🧠 استنتجت: ${subj} ← ${newRel} ← ${obj2}`);
      UIAPI.showToast(`🧠 استنتجت: ${subj} ← ${newRel} ← ${obj2}`);
      return true;
    }
  }
  return false;
}

// ===== 2. استنتاج الخصائص الافتراضية =====
function inferProperties(subj) {
  const allFacts = { ...window.brain.kernel?.facts || {}, ...window.brain.facts };
  const properties = [];
  
  if (!allFacts[subj]) return properties;
  
  // إذا كان الموضوع حيواناً
  if (allFacts[subj]['نوع'] && allFacts[subj]['نوع'].includes('حيوان')) {
    const defaults = ['يموت', 'يتنفس', 'يتحرك', 'يأكل', 'يشرب', 'يتكاثر'];
    for (const prop of defaults) {
      if (!allFacts[subj] || !allFacts[subj][prop]) {
        const inferredObj = `${prop} (مفترض)`;
        const result = addFactDeduplicated(subj, prop, inferredObj, false);
        if (result.status === 'added') {
          console.log(`🧠 استنتجت: ${subj} ← ${prop} ← ${inferredObj}`);
          properties.push(prop);
        }
      }
    }
  }
  
  // إذا كان الموضوع كوكباً
  if (allFacts[subj]['نوع'] && allFacts[subj]['نوع'].includes('كوكب')) {
    const defaults = ['يدور حول نجم', 'له جاذبية', 'يدور حول محوره'];
    for (const prop of defaults) {
      if (!allFacts[subj] || !allFacts[subj][prop]) {
        const result = addFactDeduplicated(subj, prop, '(مفترض)', false);
        if (result.status === 'added') {
          console.log(`🧠 استنتجت: ${subj} ← ${prop} ← (مفترض)`);
          properties.push(prop);
        }
      }
    }
  }
  
  return properties;
}

// ===== 3. اكتشاف الفجوات المعرفية =====
function findKnowledgeGaps() {
  const gaps = [];
  const allFacts = { ...window.brain.kernel?.facts || {}, ...window.brain.facts };
  
  for (const subj in allFacts) {
    // حيوان لا نعرف ماذا يأكل
    if (allFacts[subj]['نوع']?.includes('حيوان')) {
      if (!allFacts[subj]['يأكل'] || allFacts[subj]['يأكل'].length === 0) {
        gaps.push({
          type: 'missing_fact',
          question: `ماذا يأكل ${subj}؟`,
          subject: subj,
          predicate: 'يأكل'
        });
      }
      if (!allFacts[subj]['يعيش في'] || allFacts[subj]['يعيش في'].length === 0) {
        gaps.push({
          type: 'missing_fact',
          question: `أين يعيش ${subj}؟`,
          subject: subj,
          predicate: 'يعيش في'
        });
      }
    }
    
    // كوكب لا نعرف حجمه
    if (allFacts[subj]['نوع']?.includes('كوكب')) {
      if (!allFacts[subj]['حجم'] || allFacts[subj]['حجم'].length === 0) {
        gaps.push({
          type: 'missing_fact',
          question: `ما هو حجم ${subj}؟`,
          subject: subj,
          predicate: 'حجم'
        });
      }
    }
  }
  
  // حفظ الفجوات في سجل الفضول
  if (!window.brain.curiosity) window.brain.curiosity = { gaps: [], questions: [] };
  for (const gap of gaps) {
    if (!window.brain.curiosity.gaps.some(g => g.question === gap.question)) {
      window.brain.curiosity.gaps.push(gap);
    }
  }
  
  return gaps;
}

// ===== 4. طرح الأسئلة على المستخدم =====
function askCuriosityQuestions() {
  const gaps = findKnowledgeGaps();
  if (gaps.length === 0) {
    UIAPI.showToast('🧠 لا توجد فجوات معرفية حالياً!');
    return;
  }
  
  // اختيار سؤال عشوائي
  const randomGap = gaps[Math.floor(Math.random() * gaps.length)];
  const answer = prompt(`🧠 فضول: ${randomGap.question}`);
  
  if (answer && answer.trim()) {
    const text = `${randomGap.subject} ${randomGap.predicate} ${answer.trim()}`;
    const toks = tokenize(text);
    learnSentence(toks);
    saveBrain();
    UIAPI.showToast(`✅ تعلمت: ${text}`);
    
    // إزالة الفجوة من قائمة الفضول
    if (window.brain.curiosity) {
      window.brain.curiosity.gaps = window.brain.curiosity.gaps.filter(
        g => g.question !== randomGap.question
      );
    }
    
    // تشغيل الاستدلال التلقائي بعد التعلم
    setTimeout(() => autoInference(), 500);
  }
}

// ===== 5. الاستدلال التلقائي =====
function autoInference() {
  console.log('🧠 بدء الاستدلال التلقائي...');
  let count = 0;
  
  const allFacts = { ...window.brain.kernel?.facts || {}, ...window.brain.facts };
  
  // 1. استنتاج الخصائص لكل موضوع
  for (const subj in allFacts) {
    const props = inferProperties(subj);
    count += props.length;
  }
  
  // 2. تطبيق القواعد التسلسلية
  for (const s in allFacts) {
    for (const r in allFacts[s]) {
      for (const obj of allFacts[s][r]) {
        if (allFacts[obj]) {
          for (const r2 in allFacts[obj]) {
            for (const obj2 of allFacts[obj][r2]) {
              if (applyTransitiveRule(s, r, obj, r2, obj2)) {
                count++;
              }
            }
          }
        }
      }
    }
  }
  
  // 3. اكتشاف الفجوات المعرفية
  const gaps = findKnowledgeGaps();
  if (gaps.length > 0) {
    console.log(`🧠 اكتشفت ${gaps.length} فجوة معرفية:`, gaps.map(g => g.question).join(', '));
  }
  
  if (count > 0) {
    UIAPI.showToast(`🧠 تم استنتاج ${count} معلومة جديدة!`);
  } else {
    UIAPI.showToast('🧠 لم أجد استنتاجات جديدة.');
  }
  
  // تحديث الواجهة
  UIAPI.refreshStats();
  UIAPI.renderGraph();
  UIAPI.renderTeachFeed();
  
  return count;
}

// ===== 6. تلقين الأساسيات =====
function teachKernel() {
  if (!window.KERNEL_FACTS) {
    console.warn('لا توجد أساسيات محددة');
    return;
  }
  
  let count = 0;
  for (const [subj, rel, obj] of window.KERNEL_FACTS) {
    if (!window.brain.kernel) window.brain.kernel = { facts: {}, rules: [] };
    if (!window.brain.kernel.facts[subj]) window.brain.kernel.facts[subj] = {};
    if (!window.brain.kernel.facts[subj][rel]) window.brain.kernel.facts[subj][rel] = [];
    if (!window.brain.kernel.facts[subj][rel].includes(obj)) {
      window.brain.kernel.facts[subj][rel].push(obj);
      count++;
    }
  }
  
  if (count > 0) {
    console.log(`✅ تم تلقين ${count} حقيقة أساسية`);
    UIAPI.showToast(`✅ تم تلقين ${count} حقيقة أساسية`);
  }
}

// ===== تصدير =====
window.applyTransitiveRule = applyTransitiveRule;
window.inferProperties = inferProperties;
window.findKnowledgeGaps = findKnowledgeGaps;
window.askCuriosityQuestions = askCuriosityQuestions;
window.autoInference = autoInference;
window.teachKernel = teachKernel;
