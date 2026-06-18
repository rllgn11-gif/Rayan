// ================================================================
// الملف: inference.js
// محرك الاستدلال والفضول - مع رسائل محسّنة
// ================================================================

// ===== عداد الاستدلالات (حد أقصى لكل جلسة) =====
let inferenceCount = 0;
const MAX_INFERENCES_PER_SESSION = 20;

// ===== 1. تطبيق قاعدة التسلسل =====
function applyTransitiveRule(subj, rel1, obj1, rel2, obj2) {
  const facts = window.brain.facts;
  const kernel = window.brain.kernel?.facts || {};
  const allFacts = { ...kernel, ...facts };
  
  if (!allFacts[subj] || !allFacts[subj][rel1]) return false;
  if (!allFacts[obj1] || !allFacts[obj1][rel2]) return false;
  
  if (allFacts[subj][rel1].includes(obj1) && allFacts[obj1][rel2].includes(obj2)) {
    const newRel = `${rel1} ← ${rel2}`;
    
    if (allFacts[subj] && allFacts[subj][newRel] && allFacts[subj][newRel].includes(obj2)) {
      return false;
    }
    
    const result = addFactDeduplicated(subj, newRel, obj2, false);
    if (result.status === 'added' || result.status === 'conflict') {
      if (!window.brain.inferences) window.brain.inferences = { facts: {} };
      if (!window.brain.inferences.facts[subj]) window.brain.inferences.facts[subj] = {};
      if (!window.brain.inferences.facts[subj][newRel]) window.brain.inferences.facts[subj][newRel] = [];
      if (!window.brain.inferences.facts[subj][newRel].includes(obj2)) {
        window.brain.inferences.facts[subj][newRel].push(obj2);
      }
      console.log(`🧠 استنتجت: ${subj} ← ${newRel} ← ${obj2}`);
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast(`🧠 استنتجت: ${subj} ← ${newRel} ← ${obj2}`);
      }
      return true;
    }
  }
  return false;
}

// ===== 2. استنتاج الخصائص =====
function inferProperties(subj) {
  const allFacts = { ...window.brain.kernel?.facts || {}, ...window.brain.facts };
  const properties = [];
  
  if (!allFacts[subj]) return properties;
  
  const existingInferences = window.brain.inferences?.facts?.[subj] || {};
  const inferredCount = Object.keys(existingInferences).length;
  if (inferredCount > 3) {
    return properties;
  }
  
  // حيوان
  if (allFacts[subj]['نوع'] && allFacts[subj]['نوع'].includes('حيوان')) {
    const defaults = ['يموت', 'يتنفس', 'يتحرك', 'يأكل', 'يشرب', 'يتكاثر'];
    for (const prop of defaults) {
      const existsInKernel = window.brain.kernel?.facts?.[subj]?.[prop]?.length > 0;
      const existsInFacts = window.brain.facts?.[subj]?.[prop]?.length > 0;
      if (existsInKernel || existsInFacts) continue;
      if (window.brain.inferences?.facts?.[subj]?.[prop]?.length > 0) continue;
      
      const inferredObj = `${prop} (مفترض)`;
      const result = addFactDeduplicated(subj, prop, inferredObj, false);
      if (result.status === 'added') {
        console.log(`🧠 استنتجت: ${subj} ← ${prop} ← ${inferredObj}`);
        properties.push(prop);
      }
    }
  }
  
  // كوكب
  if (allFacts[subj]['نوع'] && allFacts[subj]['نوع'].includes('كوكب')) {
    const defaults = ['يدور حول نجم', 'له جاذبية', 'يدور حول محوره'];
    for (const prop of defaults) {
      const existsInFacts = window.brain.facts?.[subj]?.[prop]?.length > 0;
      if (existsInFacts) continue;
      if (window.brain.inferences?.facts?.[subj]?.[prop]?.length > 0) continue;
      
      const result = addFactDeduplicated(subj, prop, '(مفترض)', false);
      if (result.status === 'added') {
        console.log(`🧠 استنتجت: ${subj} ← ${prop} ← (مفترض)`);
        properties.push(prop);
      }
    }
  }
  
  return properties;
}

// ===== 3. اكتشاف الفجوات =====
function findKnowledgeGaps() {
  const gaps = [];
  const allFacts = { ...window.brain.kernel?.facts || {}, ...window.brain.facts };
  
  for (const subj in allFacts) {
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
  
  if (!window.brain.curiosity) window.brain.curiosity = { gaps: [], questions: [] };
  for (const gap of gaps) {
    if (!window.brain.curiosity.gaps.some(g => g.question === gap.question)) {
      window.brain.curiosity.gaps.push(gap);
    }
  }
  
  return gaps;
}

// ===== 4. طرح الأسئلة =====
function askCuriosityQuestions() {
  const gaps = findKnowledgeGaps();
  if (gaps.length === 0) {
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('🧠 لا توجد فجوات معرفية حالياً!');
    }
    return;
  }
  
  const randomGap = gaps[Math.floor(Math.random() * gaps.length)];
  const answer = prompt(`🧠 فضول: ${randomGap.question}`);
  
  if (answer && answer.trim()) {
    const text = `${randomGap.subject} ${randomGap.predicate} ${answer.trim()}`;
    const toks = tokenize(text);
    learnSentence(toks);
    saveBrain();
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast(`✅ تعلمت: ${text}`);
    }
    
    if (window.brain.curiosity) {
      window.brain.curiosity.gaps = window.brain.curiosity.gaps.filter(
        g => g.question !== randomGap.question
      );
    }
    
    setTimeout(() => autoInference(), 500);
  }
}

// ===== 5. الاستدلال التلقائي =====
function autoInference() {
  console.log('🧠 بدء الاستدلال التلقائي...');
  let count = 0;
  
  if (inferenceCount >= MAX_INFERENCES_PER_SESSION) {
    console.log(`⏹️ تم الوصول إلى الحد الأقصى للاستدلالات (${MAX_INFERENCES_PER_SESSION})`);
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast(`⏹️ تم الوصول إلى الحد الأقصى للاستدلالات (${MAX_INFERENCES_PER_SESSION})`);
    }
    return count;
  }
  
  const allFacts = { ...window.brain.kernel?.facts || {}, ...window.brain.facts };
  
  for (const subj in allFacts) {
    if (inferenceCount >= MAX_INFERENCES_PER_SESSION) break;
    const props = inferProperties(subj);
    count += props.length;
    inferenceCount += props.length;
  }
  
  if (inferenceCount < MAX_INFERENCES_PER_SESSION) {
    for (const s in allFacts) {
      if (inferenceCount >= MAX_INFERENCES_PER_SESSION) break;
      for (const r in allFacts[s]) {
        if (inferenceCount >= MAX_INFERENCES_PER_SESSION) break;
        for (const obj of allFacts[s][r]) {
          if (inferenceCount >= MAX_INFERENCES_PER_SESSION) break;
          if (allFacts[obj]) {
            for (const r2 in allFacts[obj]) {
              if (inferenceCount >= MAX_INFERENCES_PER_SESSION) break;
              for (const obj2 of allFacts[obj][r2]) {
                if (inferenceCount >= MAX_INFERENCES_PER_SESSION) break;
                if (applyTransitiveRule(s, r, obj, r2, obj2)) {
                  count++;
                  inferenceCount++;
                }
              }
            }
          }
        }
      }
    }
  }
  
  const gaps = findKnowledgeGaps();
  if (gaps.length > 0) {
    console.log(`🧠 اكتشفت ${gaps.length} فجوة معرفية:`, gaps.map(g => g.question).join(', '));
  }
  
  // ===== رسالة محسّنة =====
  if (count > 0) {
    const message = `🧠 تم استنتاج ${count} معلومة جديدة (${inferenceCount}/${MAX_INFERENCES_PER_SESSION})`;
    console.log(message);
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast(message);
    }
  } else {
    // تحقق من عدد الحقائق
    const totalFacts = Object.keys(window.brain.facts).length + Object.keys(window.brain.kernel?.facts || {}).length;
    if (totalFacts < 3) {
      const msg = '📚 لا توجد معلومات كافية للاستدلال. علّم العقل بعض الحقائق أولاً (مثل: "الأسد حيوان").';
      console.log(msg);
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast(msg);
      }
    } else {
      const msg = '🧠 لم أجد استنتاجات جديدة. كل القواعد موجودة بالفعل.';
      console.log(msg);
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast(msg);
      }
    }
  }
  
  if (typeof UIAPI !== 'undefined') {
    UIAPI.refreshStats();
    UIAPI.renderGraph();
    UIAPI.renderTeachFeed();
  }
  
  return count;
}

// ===== 6. تلقين الأساسيات =====
function teachKernel() {
  if (!window.KERNEL_FACTS) {
    console.warn('⚠️ لا توجد أساسيات محددة (window.KERNEL_FACTS غير موجود)');
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
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast(`✅ تم تلقين ${count} حقيقة أساسية`);
    }
  }
}

// ===== 7. إعادة تعيين عداد الاستدلالات =====
function resetInferenceCounter() {
  inferenceCount = 0;
  console.log('🔄 تم إعادة تعيين عداد الاستدلالات');
}

// ===== تصدير =====
window.applyTransitiveRule = applyTransitiveRule;
window.inferProperties = inferProperties;
window.findKnowledgeGaps = findKnowledgeGaps;
window.askCuriosityQuestions = askCuriosityQuestions;
window.autoInference = autoInference;
window.teachKernel = teachKernel;
window.resetInferenceCounter = resetInferenceCounter;
window.inferenceCount = inferenceCount;
window.MAX_INFERENCES_PER_SESSION = MAX_INFERENCES_PER_SESSION;

console.log('✅ inference.js loaded successfully');
console.log(`🧠 Max inferences per session: ${MAX_INFERENCES_PER_SESSION}`);
