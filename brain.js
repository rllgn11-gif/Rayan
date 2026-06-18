// ================================================================
// الملف: brain.js
// إدارة المعرفة (facts, quantities, negations) + الأساسيات + الاستدلالات + الدراسة
// ================================================================

window.brain = null;

const defaultBrain = {
  bigram: {}, trigram: {}, wordFreq: {}, totalWords: 0,
  facts: {}, negations: [], quantities: [], log: [],
  kernel: { facts: {}, rules: [] },
  inferences: { facts: {} },
  curiosity: { gaps: [], questions: [] },
  study: { workbench: [], mastered: [] }  // <-- جديد
};

function addFact(subj, rel, obj, isNeg = false) {
  subj = subj.trim(); rel = rel.trim(); obj = obj.trim();
  if (!subj || !rel || !obj) return;
  
  const isKernel = window.brain.kernel?.facts?.[subj]?.[rel]?.includes(obj);
  if (isKernel) {
    console.warn(`⚠️ "${subj} ← ${rel} ← ${obj}" هي حقيقة أساسية ولا يمكن تعديلها.`);
    return;
  }
  
  if (isNeg) {
    if (!window.brain.negations.some(n => n.subj === subj && n.rel === rel && n.obj === obj))
      window.brain.negations.push({ subj, rel, obj });
  }
  
  window.brain.facts[subj] = window.brain.facts[subj] || {};
  window.brain.facts[subj][rel] = window.brain.facts[subj][rel] || [];
  if (!window.brain.facts[subj][rel].includes(obj)) window.brain.facts[subj][rel].push(obj);
}

function addQuantity(type, subj, rel, obj) {
  if (!window.brain.quantities.some(q => q.type === type && q.subj === subj && q.rel === rel && q.obj === obj))
    window.brain.quantities.push({ type, subj, rel, obj });
}

function deleteFact(subj, rel, obj) {
  const isKernel = window.brain.kernel?.facts?.[subj]?.[rel]?.includes(obj);
  if (isKernel) {
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast(`⚠️ "${subj} ← ${rel} ← ${obj}" هي حقيقة أساسية ولا يمكن حذفها.`);
    }
    return;
  }
  
  if (window.brain.facts[subj] && window.brain.facts[subj][rel]) {
    window.brain.facts[subj][rel] = window.brain.facts[subj][rel].filter(o => o !== obj);
    if (!window.brain.facts[subj][rel].length) delete window.brain.facts[subj][rel];
    if (!Object.keys(window.brain.facts[subj]).length) delete window.brain.facts[subj];
  }
  
  window.brain.negations = window.brain.negations.filter(n => !(n.subj === subj && n.rel === rel && n.obj === obj));
  window.brain.quantities = window.brain.quantities.filter(q => !(q.subj === subj && q.rel === rel && q.obj === obj));
  
  if (window.brain.inferences?.facts?.[subj]?.[rel]) {
    window.brain.inferences.facts[subj][rel] = window.brain.inferences.facts[subj][rel].filter(o => o !== obj);
    if (!window.brain.inferences.facts[subj][rel].length) delete window.brain.inferences.facts[subj][rel];
    if (!Object.keys(window.brain.inferences.facts[subj]).length) delete window.brain.inferences.facts[subj];
  }
  
  saveBrain();
  if (typeof refreshStats === 'function') refreshStats();
  if (typeof renderGraph === 'function') renderGraph();
  if (typeof renderTeachFeed === 'function') renderTeachFeed();
  if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
    UIAPI.showToast(`🗑️ حذفت: ${subj} ← ${rel} ← ${obj}`);
  }
}

function countFacts() {
  let c = 0;
  for (const subj in window.brain.facts)
    for (const rel in window.brain.facts[subj]) c += window.brain.facts[subj][rel].length;
  return c;
}

// ===== تصدير =====
window.defaultBrain = defaultBrain;
window.addFact = addFact;
window.addQuantity = addQuantity;
window.deleteFact = deleteFact;
window.countFacts = countFacts;