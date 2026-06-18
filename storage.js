// ================================================================
// الملف: storage.js (معدل - دعم الدراسة)
// ================================================================

const STORAGE_KEY = 'brain-advanced-v1';
const LOG_KEY = 'brain-logs-v1';
const CONTEXT_KEY = 'brain-context-v1';
let currentStorage = null;
let storageMode = 'persistent';

var errorLog = [];
var answerLog = [];

class MemoryStorage {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
}

function getStorageForMode(mode) {
  if (mode === 'persistent' && typeof localStorage !== 'undefined') return localStorage;
  if (mode === 'session' && typeof sessionStorage !== 'undefined') return sessionStorage;
  return new MemoryStorage();
}

function initStorage() {
  const saved = sessionStorage.getItem('brain-storage-mode') || 'persistent';
  setStorageMode(saved, false);
}

function setStorageMode(mode, showToastMsg = true) {
  storageMode = mode;
  sessionStorage.setItem('brain-storage-mode', mode);
  currentStorage = getStorageForMode(mode);
  loadBrain(false);
  loadLogs();
  if (typeof loadContextMemory === 'function') loadContextMemory();
  if (showToastMsg) {
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      const labels = { persistent: 'دائم', session: 'جلسة', memory: 'مؤقت' };
      UIAPI.showToast(`📦 تخزين: ${labels[mode] || mode}`);
    }
  }
  const modeLabel = document.getElementById('modeLabel');
  if (modeLabel) {
    modeLabel.textContent = { persistent: 'دائم', session: 'جلسة', memory: 'مؤقت' }[mode] || mode;
  }
}

function saveBrain() {
  try {
    const { conflicts, ...brainToSave } = window.brain;
    currentStorage.setItem(STORAGE_KEY, JSON.stringify(brainToSave));
  } catch (e) { 
    console.error('Save failed', e); 
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('❌ فشل الحفظ');
    }
  }
}

function loadBrain(showToastMsg = true) {
  try {
    const raw = currentStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.bigram || !parsed.facts || !parsed.wordFreq) throw new Error('بنية غير صالحة');
      window.brain = Object.assign({}, window.defaultBrain, parsed);
      if (showToastMsg && typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast('✅ تم تحميل العقل');
      }
    } else {
      window.brain = JSON.parse(JSON.stringify(window.defaultBrain));
      if (showToastMsg && typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast('🧠 عقل جديد');
      }
    }
  } catch (e) {
    console.error(e);
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('❌ فشل التحميل، يستخدم عقل فارغ');
    }
    window.brain = JSON.parse(JSON.stringify(window.defaultBrain));
  }
  
  if (!window.brain.kernel) window.brain.kernel = { facts: {}, rules: [] };
  if (!window.brain.inferences) window.brain.inferences = { facts: {} };
  if (!window.brain.curiosity) window.brain.curiosity = { gaps: [], questions: [] };
  if (!window.brain.conflicts) window.brain.conflicts = [];
  if (!window.brain.study) window.brain.study = { workbench: [], mastered: [] };  // <-- جديد
  
  if (typeof refreshStats === 'function') refreshStats();
  if (typeof renderGraph === 'function') renderGraph();
  if (typeof renderTeachFeed === 'function') renderTeachFeed();
  if (typeof renderStudyFeed === 'function') renderStudyFeed();
}

function loadLogs() {
  try {
    const raw = currentStorage ? currentStorage.getItem(LOG_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      errorLog = parsed.errors || [];
      answerLog = parsed.answers || [];
    }
  } catch (e) { console.warn('فشل تحميل السجلات', e); }
}

function saveLogs() {
  try {
    if (currentStorage) {
      currentStorage.setItem(LOG_KEY, JSON.stringify({ errors: errorLog, answers: answerLog }));
    }
  } catch (e) { console.warn('فشل حفظ السجلات', e); }
}

function logError(message, details = {}) {
  errorLog.push({
    timestamp: new Date().toISOString(),
    message: message,
    details: details,
    stack: new Error().stack
  });
  if (errorLog.length > 100) errorLog.shift();
  saveLogs();
  if (typeof updateErrorStat === 'function') updateErrorStat();
}

function logAnswer(question, answer, type, bars) {
  answerLog.push({
    timestamp: new Date().toISOString(),
    question: question,
    answer: answer,
    type: type || 'unknown',
    bars: bars || []
  });
  if (answerLog.length > 500) answerLog.shift();
  saveLogs();
}

function exportLogs() {
  try {
    const data = {
      exportedAt: new Date().toISOString(),
      totalErrors: errorLog.length,
      totalAnswers: answerLog.length,
      errors: errorLog,
      answers: answerLog,
      brainStats: {
        words: Object.keys(window.brain.wordFreq).length,
        facts: countFacts(),
        kernelFacts: Object.keys(window.brain.kernel?.facts || {}).length,
        inferences: Object.keys(window.brain.inferences?.facts || {}).length,
        quantities: window.brain.quantities.length,
        negations: window.brain.negations.length,
        gaps: window.brain.curiosity?.gaps?.length || 0,
        workbench: window.brain.study?.workbench?.length || 0,
        mastered: window.brain.study?.mastered?.length || 0
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brain-logs-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('📊 تم تصدير سجل الأخطاء والإجابات');
    }
  } catch (e) {
    logError('فشل تصدير السجلات', { error: e.message });
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('❌ فشل تصدير السجلات');
    }
  }
}

// ===== تصدير =====
window.errorLog = errorLog;
window.answerLog = answerLog;
window.initStorage = initStorage;
window.setStorageMode = setStorageMode;
window.saveBrain = saveBrain;
window.loadBrain = loadBrain;
window.logError = logError;
window.logAnswer = logAnswer;
window.exportLogs = exportLogs;
window.loadLogs = loadLogs;
window.currentStorage = currentStorage;