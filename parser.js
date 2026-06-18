// ================================================================
// الملف: parser.js
// محلل نحوي متقدم لاستخراج العلاقات من الجمل العربية
// ================================================================

// ===== 1. تصنيف الكلمات =====
const POS_TAGS = {
  NOUN: ['اسم', 'فاعل', 'مفعول', 'مبتدأ', 'خبر'],
  VERB: ['فعل', 'مضارع', 'ماض', 'أمر'],
  ADJ: ['صفة', 'نعت'],
  PREP: ['حرف جر'],
  CONJ: ['حرف عطف'],
  NEG: ['أداة نفي']
};

// قوائم الكلمات حسب النوع
const VERBS = new Set([
  'يأكل', 'تأكل', 'أكل', 'آكل', 'ياكل', 'لاياكل',
  'يعيش', 'تعيش', 'عاش', 'عاشت', 'يعيش', 'تعيش',
  'يفترس', 'تفترس', 'افترس', 'يفترس',
  'يتكون', 'تتكون', 'تكون', 'يتكوّن', 'تتكوّن',
  'يحتوي', 'تحتوي', 'احتوى', 'احتوت',
  'يستخدم', 'تستخدم', 'استخدم', 'استعمل',
  'يملك', 'تملك', 'ملك', 'امتلك',
  'يكون', 'تكون', 'كان', 'كانت',
  'يرى', 'ترى', 'رأى', 'شاهد',
  'يسمع', 'تسمع', 'سمع', 'أصغى',
  'يتحدث', 'تتحدث', 'تحدث', 'تكلم',
  'يمشي', 'تمشي', 'مشى', 'سار',
  'يجري', 'تجري', 'جرى', 'ركض',
  'يطير', 'تطير', 'طار', 'حلق',
  'يسبح', 'تسبح', 'سبح', 'غطس',
  'يعمل', 'تعمل', 'عمل', 'اشتغل',
  'يدرس', 'تدرس', 'درس', 'تعلم',
  'ينام', 'تنام', 'نام', 'رقَد',
  'يستيقظ', 'تستيقظ', 'استيقظ', 'صحا',
  'يذهب', 'تذهب', 'ذهب', 'انطلق',
  'يأتي', 'تأتي', 'أتى', 'جاء',
  'يزور', 'تزور', 'زار', 'قصد',
  'يسافر', 'تسافر', 'سافر', 'رحل',
  'يموت', 'تموت', 'مات', 'توفي',
  'ينمو', 'تنمو', 'نما', 'ازدهر',
  'يتنفس', 'تتنفس', 'تنفس', 'استنشق',
  'يتحرك', 'تتحرك', 'تحرك', 'انتقل',
  'ينظر', 'تنظر', 'نظر', 'أبصر',
  'يضحك', 'تضحك', 'ضحك', 'قهقه',
  'يبكي', 'تبكي', 'بكى', 'انتحب'
]);

const PREPOSITIONS = new Set(['في', 'على', 'من', 'إلى', 'عن', 'مع', 'بين', 'لدى', 'حول', 'خلال', 'بعد', 'قبل', 'تحت', 'فوق']);

const CONJUNCTIONS = new Set(['و', 'أو', 'ثم', 'لكن', 'لأن', 'حتى', 'إذا', 'عندما', 'بينما', 'بعدما', 'قبلما']);

const NEGATIONS = new Set(['لا', 'ليس', 'ليست', 'لست', 'لم', 'لن', 'ما', 'ليس']);

const QUANTIFIERS = new Set(['كل', 'جميع', 'بعض', 'أغلب', 'معظم', 'نصف', 'ثلث', 'كلّ', 'أيّ']);

const IS_VERBS = new Set(['هو', 'هي', 'هم', 'هن', 'أنت', 'أنا']);

// ===== 2. تحليل الجملة إلى مكونات =====
function tokenizeAdvanced(text) {
  const tokens = text.match(/[^\s]+/g) || [];
  return tokens.map(t => {
    const clean = t.replace(/[،؟!\.،;]/g, '');
    let type = 'UNKNOWN';
    if (VERBS.has(clean)) type = 'VERB';
    else if (PREPOSITIONS.has(clean)) type = 'PREP';
    else if (CONJUNCTIONS.has(clean)) type = 'CONJ';
    else if (NEGATIONS.has(clean)) type = 'NEG';
    else if (QUANTIFIERS.has(clean)) type = 'QUANT';
    else if (IS_VERBS.has(clean)) type = 'IS_VERB';
    else type = 'NOUN';
    return { raw: t, clean, type };
  });
}

// ===== 3. استخراج العلاقات الأساسية =====
function extractRelationsAdvanced(tokens) {
  const relations = [];
  const hasNeg = tokens.some(t => t.type === 'NEG');
  
  // 1. البحث عن الفعل
  let verbIndex = -1;
  let subject = null, object = null;
  let isVerb = false;
  
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'VERB') {
      verbIndex = i;
      break;
    }
    if (tokens[i].type === 'IS_VERB') {
      isVerb = true;
      verbIndex = i;
      break;
    }
  }
  
  // جملة اسمية (مبتدأ + خبر)
  if (verbIndex === -1) {
    if (tokens.length >= 2) {
      const subject = tokens[0].clean;
      const predicate = tokens.slice(1).map(t => t.clean).join(' ');
      relations.push({
        subject,
        predicate: 'هو',
        object: predicate,
        isNegated: hasNeg,
        type: 'nominal'
      });
    }
    return relations;
  }
  
  // 2. تحديد الفاعل (قبل الفعل)
  if (verbIndex > 0) {
    const before = tokens.slice(0, verbIndex);
    // تجنب الكلمات المساعدة
    const filtered = before.filter(t => t.type !== 'NEG' && t.type !== 'CONJ');
    if (filtered.length > 0) {
      subject = filtered.map(t => t.clean).join(' ');
    }
  }
  
  // 3. تحديد المفعول (بعد الفعل)
  if (verbIndex < tokens.length - 1) {
    const after = tokens.slice(verbIndex + 1);
    const objTokens = [];
    for (const t of after) {
      if (t.type === 'CONJ') break;
      if (t.type === 'PREP' && t.clean === 'في') continue;
      objTokens.push(t.clean);
    }
    object = objTokens.join(' ');
  }
  
  // 4. إذا كان الفعل هو الفعل الكينوني (هو/هي)
  if (isVerb && verbIndex < tokens.length - 1) {
    subject = tokens.slice(0, verbIndex).map(t => t.clean).join(' ') || 'موضوع';
    object = tokens.slice(verbIndex + 1).map(t => t.clean).join(' ');
    relations.push({
      subject: subject.trim(),
      predicate: tokens[verbIndex].clean,
      object: object.trim(),
      isNegated: hasNeg,
      type: 'verbal'
    });
    return relations;
  }
  
  if (subject && object) {
    relations.push({
      subject: subject.trim(),
      predicate: tokens[verbIndex].clean,
      object: object.trim(),
      isNegated: hasNeg,
      type: 'verbal'
    });
  } else if (subject && !object) {
    // فعل لازم (لا يحتاج مفعول)
    relations.push({
      subject: subject.trim(),
      predicate: tokens[verbIndex].clean,
      object: '(غير محدد)',
      isNegated: hasNeg,
      type: 'verbal'
    });
  }
  
  return relations;
}

// ===== 4. استخراج العلاقات من الجمل المركبة =====
function extractFromComplexSentence(sentence) {
  const relations = [];
  const parts = sentence.split(/(\s+و\s+|\s+ثم\s+|\s+لكن\s+|\s+لأن\s+|\s+إذا\s+|\s+عندما\s+)/);
  
  let currentPart = '';
  for (const part of parts) {
    if (part.match(/\s+و\s+|\s+ثم\s+|\s+لكن\s+|\s+لأن\s+|\s+إذا\s+|\s+عندما\s+/)) {
      continue;
    }
    if (part.trim()) {
      const tokens = tokenizeAdvanced(part.trim());
      const rels = extractRelationsAdvanced(tokens);
      relations.push(...rels);
    }
  }
  
  return relations;
}

// ===== 5. استخراج العلاقات الضمنية =====
function extractImplicitRelations(sentence) {
  const relations = [];
  
  // 1. صفة + موصوف (مثل: "السماء زرقاء")
  const words = sentence.split(' ');
  if (words.length === 2 && !VERBS.has(words[1]) && !NEGATIONS.has(words[0])) {
    relations.push({
      subject: words[0],
      predicate: 'خاصية',
      object: words[1],
      isNegated: false,
      type: 'implicit'
    });
  }
  
  // 2. هو/هي (مثل: "الأسد هو ملك الغابة")
  const isPattern = /^(.+?)\s+(?:هو|هي|هم)\s+(.+)$/;
  const isMatch = sentence.match(isPattern);
  if (isMatch) {
    relations.push({
      subject: isMatch[1].trim(),
      predicate: 'هو',
      object: isMatch[2].trim(),
      isNegated: false,
      type: 'implicit'
    });
  }
  
  // 3. الاسم الموصول (الذي/التي/الذين)
  const relativePattern = /^(.+?)\s+(الذي|التي|الذين)\s+(.+)$/;
  const relMatch = sentence.match(relativePattern);
  if (relMatch) {
    const subject = relMatch[1].trim();
    const rest = relMatch[3].trim();
    const tokens = tokenizeAdvanced(rest);
    const rels = extractRelationsAdvanced(tokens);
    rels.forEach(r => {
      r.subject = subject;
      relations.push(r);
    });
  }
  
  return relations;
}

// ===== 6. استخراج العلاقات مع الكميات =====
function extractQuantifiedRelations(sentence) {
  const relations = [];
  const quantPattern = /^(كل|جميع|بعض|أغلب|معظم)\s+(.+?)\s+(\S+)\s+(.+)$/;
  const match = sentence.match(quantPattern);
  if (match) {
    const type = match[1] === 'كل' || match[1] === 'جميع' ? 'all' : 'some';
    const subject = match[2].trim();
    const rel = match[3].trim();
    const object = match[4].trim();
    relations.push({
      subject,
      predicate: rel,
      object,
      quantity: type,
      isNegated: false,
      type: 'quantified'
    });
  }
  return relations;
}

// ===== 7. الدالة الرئيسية للتحليل =====
function parseSentenceAdvanced(text) {
  const relations = [];
  
  // 1. تنظيف النص
  let clean = text.replace(/[،؟!\.،;]/g, '').trim();
  
  // 2. محاولة استخراج الكميات
  const quantRels = extractQuantifiedRelations(clean);
  if (quantRels.length > 0) {
    relations.push(...quantRels);
  }
  
  // 3. محاولة استخراج العلاقات الضمنية
  const implicit = extractImplicitRelations(clean);
  if (implicit.length > 0) {
    relations.push(...implicit);
    // إذا وجدنا علاقات ضمنية كافية، نرجعها
    if (implicit.length >= 1) {
      return relations;
    }
  }
  
  // 4. محاولة استخراج العلاقات من الجمل المركبة
  const complexRels = extractFromComplexSentence(clean);
  if (complexRels.length > 0) {
    relations.push(...complexRels);
  }
  
  // 5. إذا لم نجد شيئاً، جرب التحليل الأساسي
  if (relations.length === 0) {
    const tokens = tokenizeAdvanced(clean);
    const basicRels = extractRelationsAdvanced(tokens);
    relations.push(...basicRels);
  }
  
  return relations;
}

// ===== تصدير =====
window.tokenizeAdvanced = tokenizeAdvanced;
window.extractRelationsAdvanced = extractRelationsAdvanced;
window.extractFromComplexSentence = extractFromComplexSentence;
window.extractImplicitRelations = extractImplicitRelations;
window.extractQuantifiedRelations = extractQuantifiedRelations;
window.parseSentenceAdvanced = parseSentenceAdvanced;
window.VERBS = VERBS;
window.NEGATIONS = NEGATIONS;
window.QUANTIFIERS = QUANTIFIERS;