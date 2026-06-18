// ================================================================
// الملف: learn_style.js
// تعلّم أسلوب المحادثة من المستخدم
// ================================================================

// سجل رسائل المستخدم (لتحليل الأسلوب)
let userMessages = [];
const MAX_STYLE_MESSAGES = 50;

// ===== تحليل أسلوب المستخدم =====
function analyzeUserStyle(messages) {
  if (!messages || messages.length === 0) {
    return {
      formality: 0.5,
      verbosity: 0.5,
      emotion: 0.5,
      topics: []
    };
  }
  
  const style = {
    formality: 0.5,
    verbosity: 0.5,
    emotion: 0.5,
    topics: []
  };
  
  let totalLength = 0;
  let formalCount = 0;
  let informalCount = 0;
  let emotionalScore = 0;
  
  const formalPatterns = [
    /^(السلام|شكراً|من فضلك|أرجو|لو سمحت|بإذن الله|جزاك الله|بارك الله)/i,
    /(هل|أليس|أما|بينما|حيث|عندما)/i
  ];
  
  const informalPatterns = [
    /^(طيب|تمام|حلو|عادي|ماشي|موافق|خلاص)/i,
    /(إي|آه|أه|أوه|آخ)/i
  ];
  
  const emotionalWords = [
    'جميل', 'رائع', 'ممتاز', 'جميل جداً', 'رائع جداً',
    'سيء', 'مزعج', 'حزين', 'سعيد', 'مبسوط', 'زعلان',
    'مذهل', 'خيالي', 'مخيب', 'محبط'
  ];
  
  messages.forEach(msg => {
    const words = msg.split(' ');
    totalLength += words.length;
    
    // الشكلية
    let isFormal = false;
    let isInformal = false;
    
    for (const pattern of formalPatterns) {
      if (pattern.test(msg)) { isFormal = true; break; }
    }
    for (const pattern of informalPatterns) {
      if (pattern.test(msg)) { isInformal = true; break; }
    }
    
    if (isFormal) formalCount++;
    if (isInformal) informalCount++;
    
    // العاطفة
    let msgLower = msg.toLowerCase();
    for (const ew of emotionalWords) {
      if (msgLower.includes(ew)) {
        emotionalScore += 0.1;
        if (!style.topics.includes(ew)) style.topics.push(ew);
      }
    }
  });
  
  style.formality = formalCount / (formalCount + informalCount + 1);
  style.verbosity = Math.min(1, totalLength / (messages.length * 15));
  style.emotion = Math.min(1, emotionalScore / (messages.length * 0.5));
  
  return style;
}

// ===== تكييف الرد حسب أسلوب المستخدم =====
function adaptResponseToStyle(baseText, style) {
  if (!style) return baseText;
  let adapted = baseText;
  
  // 1. الشكلية
  if (style.formality < 0.3) {
    // غير رسمي: اختصارات وأسلوب محادثة
    adapted = adapted
      .replace(/هل تود/g, 'تحب')
      .replace(/أرجو/g, 'من فضلك')
      .replace(/هذا هو/g, 'هذا')
      .replace(/يرجى/g, 'لو سمحت');
  } else if (style.formality > 0.7) {
    // رسمي: لغة أكثر رسمية
    adapted = adapted
      .replace(/تحب/g, 'هل تود')
      .replace(/من فضلك/g, 'أرجو')
      .replace(/هذا/g, 'هذا هو');
  }
  
  // 2. الإيجاز
  if (style.verbosity < 0.3) {
    // مختصر: احتفظ بأول 3 جمل فقط
    const lines = adapted.split('\n');
    if (lines.length > 3) {
      adapted = lines.slice(0, 3).join('\n') + '\n...';
    }
  }
  
  // 3. العاطفة
  if (style.emotion > 0.7) {
    adapted = adapted
      .replace(/📖/g, '🌟')
      .replace(/🔍/g, '✨')
      .replace(/🤔/g, '😊')
      .replace(/💡/g, '💫');
  }
  
  return adapted;
}

// ===== تسجيل رسائل المستخدم وتحليل الأسلوب =====
function recordUserMessage(msg) {
  userMessages.push(msg);
  if (userMessages.length > MAX_STYLE_MESSAGES) {
    userMessages.shift();
  }
  // حفظ الأسلوب في window.brain للاستخدام الدائم
  if (!window.brain.userStyle) {
    window.brain.userStyle = analyzeUserStyle(userMessages);
  } else {
    // تحديث الأسلوب كل 10 رسائل
    if (userMessages.length % 10 === 0) {
      window.brain.userStyle = analyzeUserStyle(userMessages);
    }
  }
}

// ===== الحصول على الأسلوب الحالي =====
function getUserStyle() {
  if (!window.brain.userStyle) {
    window.brain.userStyle = analyzeUserStyle(userMessages);
  }
  return window.brain.userStyle;
}

// ===== تصدير =====
window.analyzeUserStyle = analyzeUserStyle;
window.adaptResponseToStyle = adaptResponseToStyle;
window.recordUserMessage = recordUserMessage;
window.getUserStyle = getUserStyle;
window.userMessages = userMessages;
