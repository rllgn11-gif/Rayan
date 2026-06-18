// ================================================================
// الملف: learn.js (النسخة النهائية - مع إرجاع النفي)
// ================================================================

const STOPWORDS = new Set(['في', 'من', 'الى', 'إلى', 'على', 'هو', 'هي', 'او', 'أو', 'و', 'ثم', 'لا', 'ما', 'هل',
  'كان', 'كانت', 'هذا', 'هذه', 'ذلك', 'تلك', 'مع', 'عن', 'كل', 'بعد', 'قبل', 'قد', 'لم', 'لن', 'أن', 'ان'
]);

const NEGATION_WORDS = ['لا', 'ليس', 'ليست', 'لست'];

if (!window.brain) window.brain = {};
if (!window.brain.facts) window.brain.facts = {};
if (!window.brain.negations) window.brain.negations = [];
if (!window.brain.conflicts) window.brain.conflicts = [];

function normalizeWord(word) {
  word = word.replace(/[اأإآ]/g, 'ا');
  word = word.replace(/[ؤ]/g, 'و');
  word = word.replace(/[ئ]/g, 'ي');
  word = word.replace(/ة/g, 'ه');
  word = word.replace(/[ًٌٍَُِّْ]/g, '');
  if (word === 'الكعبه المشرفه') return 'الكعبة المشرفة';
  if (word === 'الكعبه') return 'الكعبة';
  return word;
}

function tokenize(text) {
  return text.replace(/[\.,؛;!\?؟]/g, ' . ').split(/\s+/).filter(Boolean);
}

function normalize(w) {
  w = w.replace(/[\.,؛;!\?؟]/g, '').trim();
  w = normalizeWord(w);
  return w;
}

function detectNegation(tokens) {
  return tokens.some(t => NEGATION_WORDS.includes(t));
}

function textFilter(text) {
  if (!text || text.split(' ').length < 3) return null;
  if (/[#@$%^&*()_+={}\[\]]/.test(text)) return null;
  if (/^\d/.test(text)) return null;
  const weakWords = ['شيء', 'أمر', 'موضوع', 'كلمة', 'نفس', 'بعض'];
  if (weakWords.some(w => text.includes(w))) return null;
  const startWords = ['في', 'على', 'من', 'إلى', 'عن', 'مع'];
  if (startWords.some(w => text.trim().startsWith(w + ' '))) return null;
  return text.trim();
}

function removeNegationWords(text) {
  let cleaned = text;
  for (const neg of NEGATION_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\s*${neg}\\s+`, 'g'), ' ');
  }
  return cleaned.trim();
}

function relationFilter(subj, rel, obj) {
  if (/^[A-Za-z]$/.test(subj) || /^[A-Za-z]$/.test(obj)) return false;
  if (/\d/.test(subj) || /\d/.test(obj)) return false;
  const weakWords = ['شيء', 'أمر', 'موضوع', 'كلمة'];
  if (weakWords.some(w => subj.includes(w) || obj.includes(w))) return false;
  return true;
}

function wordFilter(word) {
  if (word.length < 2) return false;
  if (/\d/.test(word)) return false;
  const startWords = ['في', 'على', 'من', 'إلى', 'عن', 'مع'];
  if (startWords.includes(word)) return false;
  return true;
}

function advancedParse(text) {
  let m = text.match(/^(.+?)\s+(الذي|التي|الذين|اللواتي)\s+(.+)$/);
  if (m) {
    const subject = m[1].trim();
    const description = m[3].trim();
    const verb = extractVerb(description) || 'له';
    const obj = extractObject(description) || description;
    return { type: 'relative', subject, verb, obj };
  }

  const words = text.split(' ');
  const verb = extractVerb(text);
  if (verb && words.length >= 3) {
    const verbIndex = words.indexOf(verb);
    const subject = words.slice(0, verbIndex).join(' ');
    const obj = words.slice(verbIndex + 1).join(' ');
    return { type: 'simple', subject, verb, obj };
  }

  m = text.match(/^(.+?)\s+(?:هو|هي)\s+(.+)$/);
  if (m) {
    return { type: 'nominal', subject: m[1].trim(), predicate: m[2].trim() };
  }

  m = text.match(/^(.+?)\s+(في|على)\s+(.+)$/);
  if (m) {
    const subj = m[1].trim();
    const prep = m[2].trim();
    const loc = m[3].trim();
    const rel = prep === 'في' ? 'موجود في' : 'موجود على';
    return { type: 'location', subject: subj, location: loc, rel: rel };
  }

  return null;
}

function extractVerb(phrase) {
  let cleanPhrase = phrase;
  for (const neg of NEGATION_WORDS) {
    cleanPhrase = cleanPhrase.replace(new RegExp(`^${neg}\\s+`, 'i'), '');
  }
  const words = cleanPhrase.split(' ');
  for (const w of words) {
    if (/^[يت]/.test(w) || /[ى]$/.test(w)) {
      return w;
    }
  }
  return null;
}

function extractObject(phrase) {
  let cleanPhrase = phrase;
  for (const neg of NEGATION_WORDS) {
    cleanPhrase = cleanPhrase.replace(new RegExp(`^${neg}\\s+`, 'i'), '');
  }
  const parts = cleanPhrase.split(' ');
  if (parts.length >= 3) {
    return parts.slice(2).join(' ');
  }
  return null;
}

// ================================================================
// addFactDeduplicated (كما هي)
// ================================================================
function addFactDeduplicated(subj, rel, obj, isNegated) {
  if (!subj || !rel || !obj) {
    return {
      status: 'error',
      displayMessage: '❌ المدخلات غير صالحة (subj, rel, obj مطلوبة).'
    };
  }

  if (isNegated) {
    const exists = window.brain.negations.some(n => n.subj === subj && n.rel === rel && n.obj === obj);
    if (exists) {
      return {
        status: 'duplicate',
        fact: { subj, rel, obj, isNegated },
        displayMessage: 'ℹ️ هذه المعلومة موجودة مسبقاً بنفس الصيغة (نفي).'
      };
    }

    const factExists = window.brain.facts[subj]?.[rel]?.includes(obj);
    if (factExists) {
      const timestamp = new Date().toISOString();
      window.brain.conflicts.push({
        subj, rel, obj,
        oldIsNegated: false,
        newIsNegated: true,
        timestamp
      });
      if (window.brain.conflicts.length > 30) window.brain.conflicts.shift();

      const arr = window.brain.facts[subj][rel];
      const index = arr.indexOf(obj);
      arr.splice(index, 1);
      if (arr.length === 0) {
        delete window.brain.facts[subj][rel];
        if (Object.keys(window.brain.facts[subj]).length === 0) {
          delete window.brain.facts[subj];
        }
      }

      window.brain.negations.push({ subj, rel, obj });

      return {
        status: 'conflict',
        fact: { subj, rel, obj, isNegated },
        conflictInfo: { oldIsNegated: false, newIsNegated: true, timestamp },
        displayMessage: `⚠️ تم تصحيح المعلومة: "${obj}" كانت مثبتة كـ حقيقة، أصبحت نفياً.`
      };
    }

    window.brain.negations.push({ subj, rel, obj });

    const category = getCategory(subj);
    if (category && !window.brain.facts[subj]?.['نوع']) {
      addFactDeduplicated(subj, 'نوع', category, false);
    }

    return {
      status: 'added',
      fact: { subj, rel, obj, isNegated },
      displayMessage: '✅ تم تلقين النفي الجديد بنجاح.'
    };
  }

  if (!window.brain.facts[subj]) window.brain.facts[subj] = {};
  if (!window.brain.facts[subj][rel]) window.brain.facts[subj][rel] = [];
  const targetArray = window.brain.facts[subj][rel];

  if (targetArray.includes(obj)) {
    return {
      status: 'duplicate',
      fact: { subj, rel, obj, isNegated },
      displayMessage: 'ℹ️ هذه المعلومة موجودة مسبقاً بنفس الصيغة (حقيقة).'
    };
  }

  const negIndex = window.brain.negations.findIndex(n => n.subj === subj && n.rel === rel && n.obj === obj);
  if (negIndex !== -1) {
    const timestamp = new Date().toISOString();
    window.brain.conflicts.push({
      subj, rel, obj,
      oldIsNegated: true,
      newIsNegated: false,
      timestamp
    });
    if (window.brain.conflicts.length > 30) window.brain.conflicts.shift();

    window.brain.negations.splice(negIndex, 1);
    targetArray.push(obj);

    const category = getCategory(subj);
    if (category && !window.brain.facts[subj]?.['نوع']) {
      addFactDeduplicated(subj, 'نوع', category, false);
    }

    return {
      status: 'conflict',
      fact: { subj, rel, obj, isNegated },
      conflictInfo: { oldIsNegated: true, newIsNegated: false, timestamp },
      displayMessage: `⚠️ تم تصحيح المعلومة: "${obj}" كانت مثبتة كـ نفي، أصبحت حقيقة.`
    };
  }

  targetArray.push(obj);

  const category = getCategory(subj);
  if (category && !window.brain.facts[subj]?.['نوع']) {
    addFactDeduplicated(subj, 'نوع', category, false);
  }

  return {
    status: 'added',
    fact: { subj, rel, obj, isNegated },
    displayMessage: '✅ تم تلقين الحقيقة الجديدة بنجاح.'
  };
}

// ================================================================
// extractRelations (معدلة لضمان إرجاع العلاقة حتى عند النفي)
// ================================================================
function extractRelations(text, hasNeg) {
  const facts = [];
  
  const cleanText = removeNegationWords(text);
  const cleanWords = cleanText.split(' ').filter(Boolean);
  let matched = false;
  const stem = window.getStem || getStem;

  const parsed = advancedParse(cleanText);
  if (parsed) {
    matched = true;
    if (parsed.type === 'relative') {
      const rel = stem(parsed.verb) || 'له';
      const result = addFactDeduplicated(parsed.subject, rel, parsed.obj, hasNeg);
      facts.push({ subj: parsed.subject, rel: rel, obj: parsed.obj, neg: hasNeg, _result: result });
    } else if (parsed.type === 'simple') {
      const rel = stem(parsed.verb);
      const result = addFactDeduplicated(parsed.subject, rel, parsed.obj, hasNeg);
      facts.push({ subj: parsed.subject, rel: rel, obj: parsed.obj, neg: hasNeg, _result: result });
    } else if (parsed.type === 'nominal') {
      const result = addFactDeduplicated(parsed.subject, 'هو', parsed.predicate, hasNeg);
      facts.push({ subj: parsed.subject, rel: 'هو', obj: parsed.predicate, neg: hasNeg, _result: result });
    } else if (parsed.type === 'location') {
      const rel = parsed.rel || 'في';
      const result = addFactDeduplicated(parsed.subject, rel, parsed.location, hasNeg);
      facts.push({ subj: parsed.subject, rel: rel, obj: parsed.location, neg: hasNeg, _result: result });
    }
  }

  // 1. الكميات
  let m = cleanText.match(/^(كل|جميع|بعض)\s+(.+?)\s+(\S+)(?:\s+(.+))?$/);
  if (m && !matched) {
    matched = true;
    const type = (m[1] === 'كل' || m[1] === 'جميع') ? 'all' : 'some';
    const subj = m[2].trim(), rel = stem(m[3].trim()), obj = m[4] ? m[4].trim() : '(غير محدد)';
    addQuantity(type, subj, rel, obj);
    const result = addFactDeduplicated(subj, rel, obj, hasNeg);
    facts.push({ subj, rel, obj, neg: hasNeg, quantity: type, _result: result });
  }

  // 2. السبب
  m = cleanText.match(/^(.+?)\s+(\S+)\s+(.+?)\s+لأن\s+(.+)$/);
  if (m && !matched) {
    matched = true;
    const subj = m[1].trim(), rel = stem(m[2].trim()), obj = m[3].trim(), cause = m[4].trim();
    addFactDeduplicated(subj, rel + ' بسبب', cause, hasNeg);
    const result = addFactDeduplicated(subj, rel, obj, hasNeg);
    facts.push({ subj, rel, obj, neg: hasNeg, cause, _result: result });
  }

  // 3. هو/هي
  m = cleanText.match(/^(.+?)\s+(?:هو|هي)\s+(.+)$/);
  if (m && !matched) {
    matched = true;
    const s = m[1].trim(), o = m[2].trim();
    const result = addFactDeduplicated(s, 'هو', o, hasNeg);
    facts.push({ subj: s, rel: 'هو', obj: o, neg: hasNeg, _result: result });
  }

  // 4. يتكون من
  m = cleanText.match(/^(.+?)\s+(?:يتكون|يتكوّن|تتكون|تتكوّن|تكون|تكوّن|أصبح|صار)\s+من\s+(.+)$/);
  if (m && !matched) {
    matched = true;
    const subj = m[1].trim();
    const parts = m[2].split(/[،\sو\s]+/).filter(Boolean);
    parts.forEach(obj => {
      const result = addFactDeduplicated(subj, 'يتكون من', obj, hasNeg);
      facts.push({ subj, rel: 'يتكون من', obj, neg: hasNeg, _result: result });
    });
  }

  // 5. يحتوي على
  m = cleanText.match(/^(.+?)\s+(?:يحتوي|تحتوي|احتوى|احتوت|احتوي|تاحتوي|حتوي)\s+على\s+(.+)$/);
  if (m && !matched) {
    matched = true;
    const subj = m[1].trim(), obj = m[2].trim();
    const result1 = addFactDeduplicated(subj, 'يحتوي على', obj, hasNeg);
    facts.push({ subj, rel: 'يحتوي على', obj, neg: hasNeg, _result: result1 });
    const result2 = addFactDeduplicated(obj, 'يحتوي عليه', subj, hasNeg);
    facts.push({ subj: obj, rel: 'يحتوي عليه', obj: subj, neg: hasNeg, _result: result2 });
  }

  // 6. يستخدم
  m = cleanText.match(/^(.+?)\s+(?:يستخدم|تستخدم|استخدم|استعمل|يستعمل|تستعمل)\s+(.+)$/);
  if (m && !matched) {
    matched = true;
    const s = m[1].trim(), o = m[2].trim();
    const result = addFactDeduplicated(s, 'يستخدم', o, hasNeg);
    facts.push({ subj: s, rel: 'يستخدم', obj: o, neg: hasNeg, _result: result });
  }

  // 7. يعيش في
  m = cleanText.match(/^(.+?)\s+(?:يعيش|تعيش|عاش|عاشت|عيش)\s+في\s+(.+)$/);
  if (m && !matched) {
    matched = true;
    const s = m[1].trim(), o = m[2].trim();
    const result = addFactDeduplicated(s, 'يعيش في', o, hasNeg);
    facts.push({ subj: s, rel: 'يعيش في', obj: o, neg: hasNeg, _result: result });
  }

  // 8. لديه
  m = cleanText.match(/^(.+?)\s+(?:لديه|لديها|لدى)\s+(.+)$/);
  if (m && !matched) {
    matched = true;
    const s = m[1].trim(), o = m[2].trim();
    const result = addFactDeduplicated(s, 'لديه', o, hasNeg);
    facts.push({ subj: s, rel: 'لديه', obj: o, neg: hasNeg, _result: result });
  }

  // 9. أي فعل ثلاثي (fallback)
  if (!matched) {
    const verbMatch = cleanText.match(/^(.+?)\s+([^\s]+)\s+(.+)$/);
    if (verbMatch) {
      const subj = verbMatch[1].trim(), verb = verbMatch[2].trim(), obj = verbMatch[3].trim();
      if (!STOPWORDS.has(verb) && !['هو', 'هي', 'في', 'على', 'من', 'إلى', 'عن', 'مع', 'بين', 'لدى'].includes(verb)) {
        const verbStem = stem(verb);
        const result = addFactDeduplicated(subj, verb, obj, hasNeg);
        facts.push({ subj, rel: verb, obj, neg: hasNeg, _result: result });
        if (verbStem !== verb) {
          const result2 = addFactDeduplicated(subj, verbStem, obj, hasNeg);
          facts.push({ subj, rel: verbStem, obj, neg: hasNeg, _result: result2 });
        }
      }
    }
  }

  // 10. صفة (كلمتان فقط)
  if (cleanWords.length === 2 && !STOPWORDS.has(cleanWords[1]) && !matched) {
    const [subj, prop] = cleanWords;
    const result = addFactDeduplicated(subj, 'خاصية', prop, hasNeg);
    facts.push({ subj, rel: 'خاصية', obj: prop, neg: hasNeg, _result: result });
  }

  return facts;
}

// ================================================================
// learnSentence
// ================================================================
function learnSentence(tokens) {
  const facts = [];
  const clean = tokens.map(normalize).filter(Boolean);
  for (let i = 0; i < clean.length; i++) {
    const w = clean[i];
    if (w === '.' || !wordFilter(w)) continue;
    window.brain.wordFreq[w] = (window.brain.wordFreq[w] || 0) + 1;
    window.brain.totalWords++;
    if (i + 1 < clean.length && clean[i + 1] !== '.') {
      const next = clean[i + 1];
      window.brain.bigram[w] = window.brain.bigram[w] || {};
      window.brain.bigram[w][next] = (window.brain.bigram[w][next] || 0) + 1;
    }
    if (i + 2 < clean.length && clean[i + 1] !== '.' && clean[i + 2] !== '.') {
      const key = w + '|' + clean[i + 1];
      const next2 = clean[i + 2];
      window.brain.trigram[key] = window.brain.trigram[key] || {};
      window.brain.trigram[key][next2] = (window.brain.trigram[key][next2] || 0) + 1;
    }
  }
  const text = clean.filter(t => t !== '.').join(' ');
  const filteredText = textFilter(text);
  if (!filteredText) return facts;
  const hasNeg = detectNegation(clean);
  const extracted = extractRelations(filteredText, hasNeg);
  facts.push(...extracted);
  return facts;
}

// ===== تصدير =====
window.tokenize = tokenize;
window.normalize = normalize;
window.normalizeWord = normalizeWord;
window.detectNegation = detectNegation;
window.learnSentence = learnSentence;
window.STOPWORDS = STOPWORDS;
window.addFactDeduplicated = addFactDeduplicated;
window.textFilter = textFilter;
window.wordFilter = wordFilter;
window.relationFilter = relationFilter;
window.removeNegationWords = removeNegationWords;
window.NEGATION_WORDS = NEGATION_WORDS;
window.advancedParse = advancedParse;
window.extractVerb = extractVerb;
window.extractObject = extractObject;