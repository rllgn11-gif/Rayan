// ================================================================
// الملف: api.js
// واجهات الطبقات (Facade) - فصل المسؤوليات
// ================================================================

// ===== واجهة طبقة المعرفة (Knowledge) =====
const KnowledgeAPI = {
    // إدارة الحقائق
    addFact: (subj, rel, obj, isNeg) => addFactDeduplicated(subj, rel, obj, isNeg),
    deleteFact: (subj, rel, obj) => deleteFact(subj, rel, obj),
    getFacts: () => window.brain.facts,
    getNegations: () => window.brain.negations,
    getConflicts: () => window.brain.conflicts,
    
    // الأساسيات (kernel)
    getKernelFacts: () => window.brain.kernel?.facts || {},
    addKernelFact: (subj, rel, obj) => {
        if (!window.brain.kernel) window.brain.kernel = { facts: {}, rules: [] };
        if (!window.brain.kernel.facts[subj]) window.brain.kernel.facts[subj] = {};
        if (!window.brain.kernel.facts[subj][rel]) window.brain.kernel.facts[subj][rel] = [];
        if (!window.brain.kernel.facts[subj][rel].includes(obj)) {
            window.brain.kernel.facts[subj][rel].push(obj);
        }
    },
    
    // الاستدلالات
    getInferences: () => window.brain.inferences?.facts || {},
    addInference: (subj, rel, obj) => {
        if (!window.brain.inferences) window.brain.inferences = { facts: {} };
        if (!window.brain.inferences.facts[subj]) window.brain.inferences.facts[subj] = {};
        if (!window.brain.inferences.facts[subj][rel]) window.brain.inferences.facts[subj][rel] = [];
        if (!window.brain.inferences.facts[subj][rel].includes(obj)) {
            window.brain.inferences.facts[subj][rel].push(obj);
        }
    },
    
    // الفجوات (الفضول)
    getGaps: () => window.brain.curiosity?.gaps || [],
    addGap: (gap) => {
        if (!window.brain.curiosity) window.brain.curiosity = { gaps: [], questions: [] };
        if (!window.brain.curiosity.gaps.some(g => g.question === gap.question)) {
            window.brain.curiosity.gaps.push(gap);
        }
    },
    
    // إحصائيات
    getStats: () => ({
        words: Object.keys(window.brain.wordFreq).length,
        facts: countFacts(),
        kernelFacts: Object.keys(window.brain.kernel?.facts || {}).length,
        inferences: Object.keys(window.brain.inferences?.facts || {}).length,
        quantities: window.brain.quantities.length,
        negations: window.brain.negations.length,
        gaps: window.brain.curiosity?.gaps?.length || 0
    }),
    
    // حفظ وتحميل
    save: () => saveBrain(),
    load: () => loadBrain(),
    reset: () => {
        window.brain = JSON.parse(JSON.stringify(window.defaultBrain));
        window.brain.conflicts = [];
        window.brain.kernel = { facts: {}, rules: [] };
        window.brain.inferences = { facts: {} };
        window.brain.curiosity = { gaps: [], questions: [] };
    }
};

// ===== واجهة طبقة معالجة اللغة (NLP) =====
const NLPAPI = {
    parseSentence: (text) => {
        if (typeof parseSentenceAdvanced === 'function') return parseSentenceAdvanced(text);
        return advancedParse(text);
    },
    tokenize: (text) => tokenize(text),
    normalize: (word) => normalize(word),
    learn: (tokens) => learnSentence(tokens),
    answer: (question) => answer(question),
    extractRelations: (text, hasNeg) => extractRelations(text, hasNeg),
    detectNegation: (tokens) => detectNegation(tokens)
};

// ===== واجهة طبقة العرض (UI) =====
const UIAPI = {
    showToast: (msg) => {
        if (typeof showToast === 'function') showToast(msg);
        else console.log('📢', msg);
    },
    refreshStats: () => {
        if (typeof refreshStats === 'function') refreshStats();
    },
    renderGraph: () => {
        if (typeof renderGraph === 'function') renderGraph();
    },
    renderTeachFeed: () => {
        if (typeof renderTeachFeed === 'function') renderTeachFeed();
    },
    displayAnswer: (q, result) => {
        if (typeof displayAnswer === 'function') displayAnswer(q, result);
    }
};

// ===== واجهة طبقة الاستدلال (Inference) =====
const InferenceAPI = {
    autoInference: () => {
        if (typeof autoInference === 'function') return autoInference();
        console.warn('Inference not loaded');
    },
    askCuriosity: () => {
        if (typeof askCuriosityQuestions === 'function') return askCuriosityQuestions();
        console.warn('Inference not loaded');
    },
    findGaps: () => {
        if (typeof findKnowledgeGaps === 'function') return findKnowledgeGaps();
        return [];
    },
    inferProperties: (subj) => {
        if (typeof inferProperties === 'function') return inferProperties(subj);
        return [];
    },
    applyTransitiveRule: (subj, rel1, obj1, rel2, obj2) => {
        if (typeof applyTransitiveRule === 'function') {
            return applyTransitiveRule(subj, rel1, obj1, rel2, obj2);
        }
        return false;
    }
};

// ===== واجهة طبقة التعلم من الإنترنت (Web) =====
const WebAPI = {
    learnFromWeb: (query) => {
        if (typeof learnFromWeb === 'function') return learnFromWeb(query);
        console.warn('Web Learner not loaded');
        return Promise.resolve(false);
    },
    learnFromWikipedia: (topic) => {
        if (typeof learnFromWikipedia === 'function') return learnFromWikipedia(topic);
        return Promise.resolve(false);
    },
    learnWeather: (city) => {
        if (typeof learnWeather === 'function') return learnWeather(city);
        return Promise.resolve(false);
    },
    learnNews: () => {
        if (typeof learnNews === 'function') return learnNews();
        return Promise.resolve(false);
    }
};

// ===== واجهة شاملة (API) =====
const API = {
    ...KnowledgeAPI,
    ...NLPAPI,
    ...UIAPI,
    ...InferenceAPI,
    ...WebAPI
};

// ===== تصدير =====
window.API = API;
window.KnowledgeAPI = KnowledgeAPI;
window.NLPAPI = NLPAPI;
window.UIAPI = UIAPI;
window.InferenceAPI = InferenceAPI;
window.WebAPI = WebAPI;
