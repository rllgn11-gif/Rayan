// ================================================================
// الملف: sentiment.js
// تحليل المشاعر وتكييف الردود
// ================================================================

// ===== 1. قاموس المشاعر =====
const SENTIMENT_LEXICON = {
  positive: [
    'جميل', 'رائع', 'ممتاز', 'جيد', 'طيب', 'لطيف', 'جميل جداً',
    'سعيد', 'مبسوط', 'فرحان', 'مرتاح', 'متحمس', 'متفائل',
    'شكراً', 'مشكور', 'بارك الله فيك', 'تسلم', 'يعطيك العافية',
    'حلو', 'عظيم', 'خيالي', 'مذهل', 'رائع جداً', 'أحب',
    'أعجبني', 'مفيد', 'قيم', 'نافع', 'ممتاز', 'ذكي',
    'مبدع', 'ملهم', 'راقي', 'أنيق', 'جميل', 'بهيج',
    'تبارك الله', 'ما شاء الله', 'الحمد لله', 'رائعة', 'ممتعة',
    'جميلة', 'طيفة', 'لطيفة', 'رائعة', 'مذهلة', 'رائعة'
  ],
  
  negative: [
    'سيء', 'مزعج', 'حزين', 'زعلان', 'متعب', 'مرهق', 'ضيق',
    'غضبان', 'منزعج', 'محبط', 'يائس', 'قلق', 'خائف',
    'خطأ', 'غلط', 'غير صحيح', 'لا', 'أبداً', 'مرفوض',
    'مقرف', 'بشع', 'مخيب', 'محبط', 'متضايق', 'كئيب',
    'سيئ', 'مضر', 'خطر', 'مؤلم', 'صعب', 'معقد',
    'غاضب', 'متوتر', 'خائف', 'مرعوب', 'مروع', 'مأساة',
    'سيئة', 'مزعجة', 'حزينة', 'متعبة', 'مرهقة'
  ],
  
  neutral: [
    'طبيعي', 'عادي', 'معتاد', 'مألوف', 'واضح', 'مفهوم',
    'جيد', 'لا بأس', 'حسناً', 'تمام', 'موافق'
  ]
};

// ===== 2. تحليل المشاعر =====
function analyzeSentiment(text) {
  if (!text || text.trim().length === 0) {
    return { sentiment: 'neutral', intensity: 'moderate', score: 0, summary: 'محايد' };
  }
  
  const words = text.split(/\s+/);
  let score = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  const detectedWords = { positive: [], negative: [], neutral: [] };
  
  for (const word of words) {
    const clean = word.replace(/[،؟!\.،;]/g, '').toLowerCase();
    
    // التحقق من الكلمات الإيجابية
    let isPositive = false;
    for (const p of SENTIMENT_LEXICON.positive) {
      if (clean.includes(p) || p.includes(clean)) {
        isPositive = true;
        break;
      }
    }
    if (isPositive) {
      score += 1;
      positiveCount++;
      detectedWords.positive.push(clean);
      continue;
    }
    
    // التحقق من الكلمات السلبية
    let isNegative = false;
    for (const n of SENTIMENT_LEXICON.negative) {
      if (clean.includes(n) || n.includes(clean)) {
        isNegative = true;
        break;
      }
    }
    if (isNegative) {
      score -= 1;
      negativeCount++;
      detectedWords.negative.push(clean);
      continue;
    }
    
    detectedWords.neutral.push(clean);
  }
  
  // حساب النسبة المئوية
  const total = words.length || 1;
  const sentimentScore = score / total;
  
  let sentiment = 'neutral';
  let intensity = 'moderate';
  let emoji = '😐';
  let sentimentLabel = 'محايدة';
  
  if (sentimentScore > 0.3) {
    sentiment = 'positive';
    emoji = '😊';
    sentimentLabel = 'إيجابية';
    intensity = sentimentScore > 0.6 ? 'strong' : 'moderate';
  } else if (sentimentScore < -0.3) {
    sentiment = 'negative';
    emoji = '😢';
    sentimentLabel = 'سلبية';
    intensity = sentimentScore < -0.6 ? 'strong' : 'moderate';
  }
  
  let intensityLabel = intensity === 'strong' ? 'قوية' : 'متوسطة';
  
  return {
    sentiment,
    intensity,
    score: sentimentScore,
    positiveCount,
    negativeCount,
    totalWords: total,
    emoji,
    detectedWords,
    summary: `المشاعر: ${sentimentLabel} ${intensityLabel} (${(sentimentScore * 100).toFixed(0)}%)`,
    label: sentimentLabel,
    intensityLabel: intensityLabel
  };
}

// ===== 3. توليد ردود حسب المشاعر =====
function getSentimentBasedResponse(sentimentResult, baseResponse) {
  if (!sentimentResult || sentimentResult.sentiment === 'neutral') {
    return baseResponse;
  }
  
  let prefix = '';
  let suffix = '';
  
  switch (sentimentResult.sentiment) {
    case 'positive':
      if (sentimentResult.intensity === 'strong') {
        prefix = '🌟 رائع! يبدو أنك سعيد جداً. ';
        suffix = ' أنا سعيد لأنك مبسوط! 😊';
      } else {
        prefix = '😊 يبدو أنك في مزاج جيد. ';
        suffix = ' سررت بذلك!';
      }
      break;
      
    case 'negative':
      if (sentimentResult.intensity === 'strong') {
        prefix = '💔 آسف أن تسمع ذلك. أتمنى أن أستطيع مساعدتك. ';
        suffix = ' تذكر أن كل شيء سيكون على ما يرام. 🌟';
      } else {
        prefix = '😟 يبدو أنك منزعج قليلاً. ';
        suffix = ' هل هناك شيء يمكنني فعله لمساعدتك؟';
      }
      break;
      
    default:
      prefix = '';
      suffix = '';
      break;
  }
  
  return prefix + baseResponse + suffix;
}

// ===== 4. دالة رئيسية لتحليل وتكييف الرد =====
function adaptResponseWithSentiment(userInput, baseResponse) {
  const sentiment = analyzeSentiment(userInput);
  const adapted = getSentimentBasedResponse(sentiment, baseResponse);
  return {
    text: adapted,
    sentiment,
    original: baseResponse
  };
}

// ===== 5. كشف المشاعر من النص بطريقة سريعة =====
function detectSentimentQuick(text) {
  const result = analyzeSentiment(text);
  return {
    emoji: result.emoji,
    label: result.label,
    score: result.score
  };
}

// ===== تصدير =====
window.SENTIMENT_LEXICON = SENTIMENT_LEXICON;
window.analyzeSentiment = analyzeSentiment;
window.getSentimentBasedResponse = getSentimentBasedResponse;
window.adaptResponseWithSentiment = adaptResponseWithSentiment;
window.detectSentimentQuick = detectSentimentQuick;
