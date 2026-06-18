// ================================================================
// الملف: query.js
// الإجابة والاستدلال مع درجة الثقة والذاكرة السياقية والمحادثة
// مع دعم تحليل المشاعر والمحلل النحوي المتقدم
// ================================================================

var contextMemory = [];
const MAX_CONTEXT = 20;
const CONTEXT_CATEGORIES = {
  QUESTION: 'سؤال',
  TEACH: 'تعليم',
  CHAT: 'محادثة',
  CORRECTION: 'تصحيح'
};

// ===== تحميل الذاكرة السياقية =====
function loadContextMemory() {
  try {
    const raw = currentStorage?.getItem('brain-context-v1');
    if (raw) {
      contextMemory = JSON.parse(raw);
      if (!Array.isArray(contextMemory)) contextMemory = [];
      if (contextMemory.length > MAX_CONTEXT) contextMemory = contextMemory.slice(-MAX_CONTEXT);
    }
  } catch (e) { console.warn('فشل تحميل السياق', e); }
}

function saveContextMemory() {
  try {
    if (currentStorage) {
      currentStorage.setItem('brain-context-v1', JSON.stringify(contextMemory));
    }
  } catch (e) { console.warn('فشل حفظ السياق', e); }
}

function addToContext(q, a, category = CONTEXT_CATEGORIES.QUESTION) {
  contextMemory.push({ 
    question: q, 
    answer: a, 
    timestamp: Date.now(),
    category: category
  });
  if (contextMemory.length > MAX_CONTEXT) contextMemory.shift();
  saveContextMemory();
}

function getContextSummary() {
  return contextMemory.map(c => c.question).join(' • ');
}

function getLastQuestion() {
  return contextMemory.length > 0 ? contextMemory[contextMemory.length - 1] : null;
}

function getContextByCategory(category) {
  return contextMemory.filter(c => c.category === category);
}

// ===== دوال توحيد الكلمات والبحث =====
function hasSubjectInFacts(word) {
  const normalized = normalizeWord(word);
  for (const key in window.brain.facts) {
    if (normalizeWord(key) === normalized) {
      return true;
    }
  }
  return false;
}

function getFactKey(word) {
  const normalized = normalizeWord(word);
  for (const key in window.brain.facts) {
    if (normalizeWord(key) === normalized) {
      return key;
    }
  }
  return null;
}

function findChain(subj, targetObj, visited = new Set(), depth = 0) {
  if (depth > 10 || visited.has(subj)) return null;
  visited.add(subj);
  const rels = window.brain.facts[subj];
  if (!rels) return null;
  for (const rel in rels) {
    for (const obj of rels[rel]) {
      if (obj === targetObj) return [{ from: subj, rel, to: obj }];
      if (window.brain.facts[obj]) {
        const chain = findChain(obj, targetObj, visited, depth + 1);
        if (chain) return [{ from: subj, rel, to: obj }, ...chain];
      }
    }
  }
  return null;
}

function findBackwardChains(targetObj, relFilter = null) {
  const results = [];
  let relsToTry = [];
  if (relFilter) {
    relsToTry.push(relFilter);
    const synonyms = getSynonyms(relFilter);
    relsToTry.push(...synonyms);
    relsToTry.push(relFilter + ' على');
    relsToTry.push(relFilter + ' من');
    relsToTry.push(relFilter + ' في');
    if (relFilter.startsWith('ي')) {
      const withoutY = relFilter.slice(1);
      relsToTry.push(withoutY);
      relsToTry.push(withoutY + ' على');
      relsToTry.push(withoutY + ' من');
    }
    const stem = getStem(relFilter);
    if (stem !== relFilter) {
      relsToTry.push(stem);
      relsToTry.push(stem + ' على');
      relsToTry.push(stem + ' من');
    }
  }

  for (const subj in window.brain.facts) {
    for (const rel in window.brain.facts[subj]) {
      if (relFilter) {
        let match = false;
        for (const tryRel of relsToTry) {
          if (rel === tryRel || rel.includes(tryRel) || tryRel.includes(rel)) {
            match = true;
            break;
          }
        }
        if (!match) continue;
      }
      for (const obj of window.brain.facts[subj][rel]) {
        if (obj === targetObj) {
          results.push({ subj, rel, obj, chain: [{ from: subj, rel, to: obj }] });
        } else if (window.brain.facts[obj]) {
          const chain = findChain(obj, targetObj);
          if (chain) results.push({ subj, rel, obj, chain: [{ from: subj, rel, to: obj }, ...chain] });
        }
      }
    }
  }
  return results;
}

// ================================================================
// 1. ردود المحادثة المبرمجة
// ================================================================
function getChatResponse(question) {
  const q = question.trim().toLowerCase();
  
  // تحية
  if (/^(السلام عليكم|مرحبا|اهلا|هلا|صباح الخير|مساء الخير|سلام|مرحباً)/.test(q)) {
    return {
      type: 'chat',
      text: '🌿 وعليكم السلام! كيف يمكنني مساعدتك اليوم؟',
      bars: []
    };
  }
  
  // سؤال عن الحال
  if (/^(كيف حالك|كيفك|شلونك|اخبارك|كيف الحال|ازيك|ازيكم|كيف الأحوال)/.test(q)) {
    return {
      type: 'chat',
      text: '😊 أنا بخير، شكراً لسؤالك! وماذا عنك؟',
      bars: []
    };
  }
  
  // شكر
  if (/^(شكرا|شكراً|مشكور|يعطيك العافية|بارك الله فيك|تسلم|تسلمين|جزاك الله خير)/.test(q)) {
    return {
      type: 'chat',
      text: '🙏 العفو! أنا هنا لمساعدتك دائماً. هل هناك شيء آخر تريد معرفته؟',
      bars: []
    };
  }
  
  // وداع
  if (/^(مع السلامة|الى اللقاء|وداعا|باي|سلام عليكم|أراك لاحقاً)/.test(q)) {
    return {
      type: 'chat',
      text: '👋 إلى اللقاء! كان من الجميل التحدث معك. عد متى شئت!',
      bars: []
    };
  }
  
  // طلب مساعدة
  if (/^(ماذا تفعل|ماذا تعرف|من أنت|ما هي مهمتك|كيف تعمل)/.test(q)) {
    return {
      type: 'chat',
      text: '🤖 أنا مساعد ذكي، أعرف الأشياء التي علمتني إياها. يمكنك تعليمي جملًا جديدة، أو سؤالي عن أي موضوع تعرفه. ماذا تحب أن تسأل؟',
      bars: []
    };
  }
  
  // عندما لا يفهم
  if (/^(ماذا|؟|ما هذا|عذراً|أعد|وضح)/.test(q) && q.length < 10) {
    return {
      type: 'chat',
      text: '🤔 لم أفهم تماماً. هل يمكنك توضيح سؤالك أو طرحه بشكل مختلف؟',
      bars: []
    };
  }
  
  return null;
}

// ================================================================
// 2. الردود الودية باستخدام القوالب والاستكشاف
// ================================================================
function generateExploratoryQuestions(topic, facts) {
  if (!facts || facts.length === 0) return [];
  
  const questions = [];
  const category = getCategory(topic);
  
  if (category === 'حيوان') {
    if (!facts.some(f => f.includes('يعيش'))) {
      questions.push(`أين يعيش ${topic}؟`);
    }
    if (!facts.some(f => f.includes('يأكل') || f.includes('يتغذى'))) {
      questions.push(`ماذا يأكل ${topic}؟`);
    }
  }
  
  if (category === 'كوكب') {
    if (!facts.some(f => f.includes('حجم') || f.includes('قطر'))) {
      questions.push(`ما هو حجم ${topic}؟`);
    }
  }
  
  if (questions.length === 0) {
    questions.push(`هل تريد معرفة المزيد عن ${topic}؟`);
    questions.push(`هل هناك شيء آخر يثير فضولك حول ${topic}؟`);
  }
  
  return questions;
}

function getFriendlyOpenResponse(topic, factsLines, bars) {
  if (!factsLines || factsLines.length === 0) {
    return {
      type: 'open',
      text: `🤔 لا أعرف الكثير عن "${topic}" بعد. هل تريد تعليمي شيئاً عنه؟`,
      reason: `لم أجد "${topic}" في قاعدة المعرفة.`,
      bars: []
    };
  }
  
  const allFacts = factsLines.map(l => `• ${l}`).join('\n');
  
  const exploratoryQuestions = generateExploratoryQuestions(topic, factsLines);
  let followUpText = '';
  if (exploratoryQuestions.length > 0) {
    followUpText = `\n\n💡 **أسئلة قد تهمك:**\n` + 
      exploratoryQuestions.map((q, i) => `   ${i+1}. ${q}`).join('\n');
  }
  
  let text = `📖 **${topic}**:\n${allFacts}${followUpText}`;
  
  // تكييف الرد حسب أسلوب المستخدم
  if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
    const style = getUserStyle();
    text = adaptResponseToStyle(text, style);
  }
  
  return {
    type: 'open',
    text: text,
    reason: `كل ما أعرفه عن "${topic}".`,
    bars: bars.slice(0, 5)
  };
}

// ================================================================
// 3. دالة answer الرئيسية (مع تحليل المشاعر والمحلل المتقدم)
// ================================================================
function answer(question) {
  let q = question.trim();
  let userSentiment = null;
  let sentimentEmoji = '';

  // ===== تحليل مشاعر المستخدم =====
  if (typeof analyzeSentiment === 'function') {
    userSentiment = analyzeSentiment(q);
    sentimentEmoji = userSentiment.emoji || '';
    if (userSentiment.sentiment !== 'neutral' && typeof showToast === 'function') {
      showToast(`💭 ${userSentiment.summary}`);
    }
  }

  // تسجيل رسالة المستخدم لتحليل الأسلوب
  if (typeof recordUserMessage === 'function') {
    recordUserMessage(q);
  }

  // الخطوة 1: التحقق من أنماط المحادثة
  const chatResponse = getChatResponse(q);
  if (chatResponse) {
    let text = chatResponse.text;
    // تكييف مع المشاعر
    if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
      text = getSentimentBasedResponse(userSentiment, text);
    }
    // تكييف مع الأسلوب
    if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
      const style = getUserStyle();
      text = adaptResponseToStyle(text, style);
    }
    const result = { ...chatResponse, text: text, sentiment: userSentiment };
    addToContext(q, result.text, CONTEXT_CATEGORIES.CHAT);
    return result;
  }

  // الخطوة 2: سؤال مفتوح
  let m = q.match(/^(?:أخبرني عن|حدثني عن|تكلم عن|عرفني على|ما هو|ما هي|ماهو|ماهي|من هو|من هي)\s+(.+)$/);
  if (m) {
    const topic = normalize(m[1].trim());
    const res = answerOpenQuestion(topic);
    if (res) { 
      if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
        res.text = getSentimentBasedResponse(userSentiment, res.text);
      }
      if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
        const style = getUserStyle();
        res.text = adaptResponseToStyle(res.text, style);
      }
      res.sentiment = userSentiment;
      addToContext(q, res.text, CONTEXT_CATEGORIES.QUESTION); 
      return res; 
    }
  }

  // الخطوة 3: سؤال بـ "من"
  m = q.match(/^(?:من)\s+(.+?)\??$/);
  if (m) {
    const subj = normalize(m[1].trim());
    const factKey = getFactKey(subj);
    if (factKey && window.brain.facts[factKey]) {
      const rels = window.brain.facts[factKey];
      const lines = [], bars = [];
      for (const r in rels) {
        rels[r].forEach(o => {
          const isNeg = window.brain.negations.some(n => n.subj === factKey && n.rel === r && n.obj === o);
          const confidence = calculateConfidence(factKey, r, o);
          lines.push(`${factKey} ${r} ${o}${isNeg ? ' (منفي)' : ''}`);
          bars.push({ label: `${r} ${o}`, pct: confidence });
        });
      }
      if (lines.length) {
        let text = lines.join(' • ');
        if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
          text = getSentimentBasedResponse(userSentiment, text);
        }
        if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
          const style = getUserStyle();
          text = adaptResponseToStyle(text, style);
        }
        const result = {
          type: 'fact',
          text: text,
          reason: `وجدت "${factKey}" في القاعدة.`,
          bars,
          sentiment: userSentiment
        };
        addToContext(q, result.text, CONTEXT_CATEGORIES.QUESTION);
        return result;
      }
    }
  }

  // الخطوة 4: استدلال عكسي
  m = q.match(/^(?:مالذي|ماذا)\s+(\S+)\s+(.+?)\??$/);
  if (m) {
    const rel = getStem(normalize(m[1]));
    const obj = normalize(m[2].trim());
    const results = findBackwardChains(obj, rel);
    if (results.length) {
      const subjects = [...new Set(results.map(r => r.subj))];
      const chains = results.map(r => r.chain).filter(c => c && c.length > 0);
      let text = subjects.join('، ');
      if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
        text = getSentimentBasedResponse(userSentiment, text);
      }
      if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
        const style = getUserStyle();
        text = adaptResponseToStyle(text, style);
      }
      const result = {
        type: 'backward',
        text: text || 'لا أعرف.',
        reason: chains.length ? `وجدت ${chains.length} سلسلة استدلالية عكسية:` : 'لم أجد سلسلة كاملة.',
        bars: results.map(r => {
          const confidence = calculateConfidence(r.subj, r.rel, r.obj);
          return { label: `${r.subj} → ${r.obj}`, pct: confidence };
        }),
        tree: chains.length ? chains.map(c => renderTree(c)).join('') : '',
        sentiment: userSentiment
      };
      addToContext(q, result.text, CONTEXT_CATEGORIES.QUESTION);
      return result;
    }
  }

  // الخطوة 5: السياق
  const tokens = tokenize(q).map(normalize).filter(Boolean).filter(t => t !== '.');
  let fullQ = q;

  let hasNewSubject = false;
  for (const t of tokens) {
    if (hasSubjectInFacts(t)) {
      hasNewSubject = true;
      break;
    }
  }

  if (tokens.length <= 3 && !hasNewSubject && contextMemory.length > 0) {
    const last = contextMemory[contextMemory.length - 1];
    if (last) {
      const lastWords = tokenize(last.question).map(normalize).filter(Boolean);
      const questionWords = ['اين', 'أين', 'ماذا', 'من', 'هل', 'ما', 'ماهو', 'ما هو'];
      if (questionWords.some(w => q.includes(w))) {
        for (const w of lastWords) {
          if (hasSubjectInFacts(w)) {
            const factKey = getFactKey(w);
            if (factKey) {
              fullQ = factKey + ' ' + q;
              if (typeof showToast === 'function') {
                showToast(`🔄 فهمت من السياق: "${fullQ}"`);
              }
              break;
            }
          }
        }
      }
    }
  }

  const fullTokens = tokenize(fullQ).map(normalize).filter(Boolean).filter(t => t !== '.');

  // الخطوة 6: الكميات
  if (fullQ.startsWith('هل')) {
    let qm = fullQ.match(/هل\s+(كل|جميع|بعض)\s+(.+?)\s+(\S+)\s+(.+)/);
    if (qm) {
      const type = (qm[1] === 'كل' || qm[1] === 'جميع') ? 'all' : 'some';
      const subj = normalize(qm[2]), verb = normalize(qm[3]), obj = normalize(qm[4]), stem = getStem(verb);
      const found = window.brain.quantities.find(q2 => q2.type === type && q2.subj === subj && q2.rel === stem && q2.obj === obj);
      if (found) {
        const confidence = calculateConfidence(subj, stem, obj);
        let text = `✅ نعم (${qm[1] === 'كل' || qm[1] === 'جميع' ? 'كلهم' : 'البعض'}).`;
        if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
          text = getSentimentBasedResponse(userSentiment, text);
        }
        if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
          const style = getUserStyle();
          text = adaptResponseToStyle(text, style);
        }
        const result = {
          type: 'fact',
          text: text,
          reason: `سجّلت "${qm[1]} ${subj} ${stem} ${obj}".`,
          bars: [{ label: `${qm[1]} ${subj} → ${obj}`, pct: confidence }],
          sentiment: userSentiment
        };
        addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
        return result;
      }
    }
    let m2 = fullQ.match(/هل\s+(.+?)\s+(\S+)\s+(.+)/);
    if (m2) {
      const subj = normalize(m2[1]), verb = normalize(m2[2]), obj = normalize(m2[3]), stem = getStem(verb);

      const possibleRels = [verb, stem, verb + ' على', stem + ' على', verb + ' من', stem + ' من', verb + ' في', stem + ' في'];
      let found = false, foundRel = '';

      for (const rel of possibleRels) {
        if (window.brain.facts[subj] && window.brain.facts[subj][rel] && window.brain.facts[subj][rel].includes(obj)) {
          found = true;
          foundRel = rel;
          break;
        }
      }
      if (!found) {
        const rels = window.brain.facts[subj] || {};
        for (const storedRel in rels) {
          if (storedRel.includes(stem) || storedRel.includes(verb)) {
            if (rels[storedRel].includes(obj)) {
              found = true;
              foundRel = storedRel;
              break;
            }
          }
        }
      }
      if (!found) {
        const synonyms = getSynonyms(verb);
        for (const syn of synonyms) {
          if (window.brain.facts[subj] && window.brain.facts[subj][syn] && window.brain.facts[subj][syn].includes(obj)) {
            found = true;
            foundRel = syn;
            break;
          }
        }
      }

      let isNeg = false;
      if (foundRel) {
        const negRelsToTry = [
          foundRel,
          getStem(foundRel),
          foundRel + ' على',
          getStem(foundRel) + ' على',
          foundRel + ' من',
          getStem(foundRel) + ' من',
          foundRel.replace(/ة/g, 'ه'),
          foundRel.replace(/[اأإآ]/g, 'ا')
        ];
        for (const relTry of negRelsToTry) {
          if (window.brain.negations.some(n => n.subj === subj && n.rel === relTry && n.obj === obj)) {
            isNeg = true;
            break;
          }
        }
      }

      if (found) {
        const confidence = calculateConfidence(subj, foundRel, obj);
        if (!isNeg) {
          let text = '✅ نعم.';
          if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
            text = getSentimentBasedResponse(userSentiment, text);
          }
          if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
            const style = getUserStyle();
            text = adaptResponseToStyle(text, style);
          }
          const result = {
            type: 'fact',
            text: text,
            reason: `"${subj} ${foundRel} ${obj}" محفوظة.`,
            bars: [{ label: `${subj} ${foundRel} ${obj}`, pct: confidence }],
            sentiment: userSentiment
          };
          addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
          return result;
        } else {
          let text = '❌ لا.';
          if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
            text = getSentimentBasedResponse(userSentiment, text);
          }
          if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
            const style = getUserStyle();
            text = adaptResponseToStyle(text, style);
          }
          const result = {
            type: 'fact',
            text: text,
            reason: `نفي: "${subj} لا ${foundRel} ${obj}".`,
            bars: [{ label: `نفي: ${subj} ${foundRel} ${obj}`, pct: 100 }],
            sentiment: userSentiment
          };
          addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
          return result;
        }
      }

      const chain = findChain(subj, obj);
      if (chain) {
        let text = '✅ نعم (باستنتاج).';
        if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
          text = getSentimentBasedResponse(userSentiment, text);
        }
        if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
          const style = getUserStyle();
          text = adaptResponseToStyle(text, style);
        }
        const result = {
          type: 'chain',
          text: text,
          reason: `استنتجت: ${explainChain(chain)}`,
          bars: chain.map(s => {
            const confidence = calculateConfidence(s.from, s.rel, s.to);
            return { label: `${s.from} → ${s.to}`, pct: confidence };
          }),
          tree: renderTree(chain),
          sentiment: userSentiment
        };
        addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
        return result;
      }

      let text = '❓ لا أعرف.';
      if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
        text = getSentimentBasedResponse(userSentiment, text);
      }
      if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
        const style = getUserStyle();
        text = adaptResponseToStyle(text, style);
      }
      const result = { type: 'unknown', text: text, reason: `لم أجد علاقة لـ "${subj} ${verb} ${obj}".`, bars: [], sentiment: userSentiment };
      addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
      return result;
    }
  }

  // الخطوة 7: تعريف مباشر
  m = fullQ.match(/(?:ما هو|ماذا هو|ما هي|ماذا هي|ماهو|ماهي)\s+(.+?)\??$/);
  if (m) {
    let subj = normalize(m[1].trim());
    const factKey = getFactKey(subj);
    if (factKey && window.brain.facts[factKey] && window.brain.facts[factKey]['هو']) {
      const obj = window.brain.facts[factKey]['هو'][0];
      const confidence = calculateConfidence(factKey, 'هو', obj);
      let text = `${factKey} هو ${obj}`;
      if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
        text = getSentimentBasedResponse(userSentiment, text);
      }
      if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
        const style = getUserStyle();
        text = adaptResponseToStyle(text, style);
      }
      const result = {
        type: 'fact',
        text: text,
        reason: `"${factKey}" ← هو ← "${obj}"`,
        bars: [{ label: `${factKey} هو ${obj}`, pct: confidence }],
        sentiment: userSentiment
      };
      addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
      return result;
    }
  }

  // الخطوة 8: استعلام عن موضوع
  let subjMatches = [];
  for (const t of fullTokens) {
    const factKey = getFactKey(t);
    if (factKey && window.brain.facts[factKey]) {
      subjMatches.push(factKey);
    }
  }

  if (subjMatches.length) {
    const subj = subjMatches[0];
    const rels = window.brain.facts[subj];
    const lines = [], bars = [];
    for (const r in rels) {
      rels[r].forEach(o => {
        const isNeg = window.brain.negations.some(n => n.subj === subj && n.rel === r && n.obj === o);
        const confidence = calculateConfidence(subj, r, o);
        lines.push(`${subj} ${r} ${o}${isNeg ? ' (منفي)' : ''}`);
        bars.push({ label: `${r} ${o}`, pct: confidence });
      });
    }
    if (lines.length) {
      let text = lines.join(' • ');
      if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
        text = getSentimentBasedResponse(userSentiment, text);
      }
      if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
        const style = getUserStyle();
        text = adaptResponseToStyle(text, style);
      }
      const result = {
        type: 'fact',
        text: text,
        reason: `وجدت "${subj}" في القاعدة.`,
        bars,
        sentiment: userSentiment
      };
      addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
      return result;
    }
  }

  // الخطوة 9: استدلال متسلسل
  let chainResults = [];
  for (const subj in window.brain.facts) {
    if (fullTokens.some(t => normalizeWord(t) === normalizeWord(subj))) {
      for (const rel in window.brain.facts[subj]) {
        for (const obj of window.brain.facts[subj][rel]) {
          const chain = findChain(subj, obj);
          if (chain && chain.length > 1) chainResults.push({ subj, rel, obj, chain });
        }
      }
    }
  }
  if (chainResults.length) {
    const lines = chainResults.map(c => `${c.subj} ← ${c.rel} ← ${c.obj} (استنتاج)`);
    let text = lines.join(' • ');
    if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
      text = getSentimentBasedResponse(userSentiment, text);
    }
    if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
      const style = getUserStyle();
      text = adaptResponseToStyle(text, style);
    }
    const result = {
      type: 'chain',
      text: text,
      reason: 'استنتجت عبر سلاسل منطقية.',
      bars: chainResults.map(c => {
        const confidence = calculateConfidence(c.subj, c.rel, c.obj);
        return { label: `${c.subj} → ${c.obj}`, pct: confidence };
      }),
      tree: chainResults.length ? renderTree(chainResults[0].chain) : '',
      sentiment: userSentiment
    };
    addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
    return result;
  }

  // الخطوة 10: N-gram
  const lastTwo = fullTokens.slice(-2);
  if (lastTwo.length === 2) {
    const key = lastTwo[0] + '|' + lastTwo[1];
    if (window.brain.trigram[key]) {
      const result = ngramAnswer(window.brain.trigram[key], lastTwo.join(' '), 'ثلاثية');
      if (result && userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
        result.text = getSentimentBasedResponse(userSentiment, result.text);
      }
      result.sentiment = userSentiment;
      addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
      return result;
    }
  }
  const lastOne = fullTokens[fullTokens.length - 1];
  if (lastOne && window.brain.bigram[lastOne]) {
    const result = ngramAnswer(window.brain.bigram[lastOne], lastOne, 'ثنائية');
    if (result && userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
      result.text = getSentimentBasedResponse(userSentiment, result.text);
    }
    result.sentiment = userSentiment;
    addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
    return result;
  }

  // الخطوة 11: لم يعرف
  let text = 'لا أعرف الإجابة.';
  if (userSentiment && userSentiment.sentiment !== 'neutral' && typeof getSentimentBasedResponse === 'function') {
    text = getSentimentBasedResponse(userSentiment, text);
  }
  if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
    const style = getUserStyle();
    text = adaptResponseToStyle(text, style);
  }
  const result = { type: 'unknown', text: text, reason: 'لم أجد علاقة محفوظة، ولا تكراراً إحصائياً.', bars: [], sentiment: userSentiment };
  addToContext(fullQ, result.text, CONTEXT_CATEGORIES.QUESTION);
  return result;
}

// ================================================================
// answerOpenQuestion (معدلة بالقالب الودي)
// ================================================================
function answerOpenQuestion(topic) {
  const factKey = getFactKey(topic);
  if (!factKey) {
    return {
      type: 'open',
      text: `🤔 لا أعرف الكثير عن "${topic}" بعد. هل تريد تعليمي شيئاً عنه؟`,
      reason: `لم أجد "${topic}" في قاعدة المعرفة.`,
      bars: []
    };
  }
  
  const rels = window.brain.facts[factKey];
  if (!rels) return null;
  
  const lines = [];
  const bars = [];
  for (const r in rels) {
    rels[r].forEach(o => {
      const isNeg = window.brain.negations.some(n => n.subj === factKey && n.rel === r && n.obj === o);
      const confidence = calculateConfidence(factKey, r, o);
      lines.push(`${r} ← ${o}${isNeg ? ' (منفي)' : ''}`);
      bars.push({ label: `${r} → ${o}`, pct: confidence });
    });
  }
  
  const qs = window.brain.quantities.filter(q => q.subj === factKey);
  qs.forEach(q => {
    const confidence = calculateConfidence(q.subj, q.rel, q.obj);
    lines.push(`${q.type === 'all' ? 'كل' : 'بعض'} ${q.subj} ${q.rel} ${q.obj}`);
    bars.push({ label: `${q.type} ${q.rel} → ${q.obj}`, pct: confidence });
  });
  
  if (lines.length) {
    return getFriendlyOpenResponse(factKey, lines, bars);
  }
  return null;
}

function ngramAnswer(nextsObj, basis, kind) {
  const entries = Object.entries(nextsObj).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  let bars = entries.slice(0, 4).map(([w, c]) => {
    const confidence = Math.round((c / total) * 100);
    return { label: w, pct: Math.min(100, confidence) };
  });
  const top = entries[0];
  let text = top[0];
  if (typeof adaptResponseToStyle === 'function' && typeof getUserStyle === 'function') {
    const style = getUserStyle();
    text = adaptResponseToStyle(text, style);
  }
  return {
    type: 'ngram',
    text: text,
    reason: `إحصاء (${kind}): بعد "${basis}" ظهرت "${top[0]}" في ${bars[0].pct}% من الحالات.`,
    bars
  };
}

function explainChain(chain) { return chain.map(s => `"${s.from}" ← ${s.rel} ← "${s.to}"`).join(' → '); }

function renderTree(chain) {
  return chain.map((s, i) =>
    `<div class="tree-step"><span class="tree-node">${s.from}</span> <span class="tree-arrow">${s.rel}</span> <span class="tree-node">${s.to}</span>${i < chain.length-1 ? ' ↓' : ''}</div>`
  ).join('');
}

// ===== تحميل السياق عند بدء التشغيل =====
loadContextMemory();

// ===== تصدير =====
window.contextMemory = contextMemory;
window.addToContext = addToContext;
window.getContextSummary = getContextSummary;
window.findChain = findChain;
window.findBackwardChains = findBackwardChains;
window.answer = answer;
window.answerOpenQuestion = answerOpenQuestion;
window.ngramAnswer = ngramAnswer;
window.explainChain = explainChain;
window.renderTree = renderTree;
window.loadContextMemory = loadContextMemory;
window.saveContextMemory = saveContextMemory;
window.hasSubjectInFacts = hasSubjectInFacts;
window.getFactKey = getFactKey;
window.getChatResponse = getChatResponse;
window.getFriendlyOpenResponse = getFriendlyOpenResponse;
window.generateExploratoryQuestions = generateExploratoryQuestions;
window.CONTEXT_CATEGORIES = CONTEXT_CATEGORIES;
window.MAX_CONTEXT = MAX_CONTEXT;
