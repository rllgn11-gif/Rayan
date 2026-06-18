// ================================================================
// الملف: web_learner.js
// التعلم من الإنترنت عبر واجهات برمجة التطبيقات
// ================================================================

// ===== 1. جلب المعلومات من ويكيبيديا =====
async function learnFromWikipedia(topic) {
    try {
        const url = `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.extract) {
            const text = data.extract;
            const sentences = text.split(/[\.!؟\?]/).filter(s => s.trim().length > 20);
            for (const sentence of sentences.slice(0, 5)) {
                const toks = tokenize(sentence);
                learnSentence(toks);
            }
            await saveBrain();
            UIAPI.showToast(`✅ تعلمت عن "${topic}" من ويكيبيديا`);
            return true;
        }
        return false;
    } catch (e) {
        console.error('خطأ في التعلم من ويكيبيديا:', e);
        UIAPI.showToast(`❌ فشل التعلم عن "${topic}"`);
        return false;
    }
}

// ===== 2. جلب معلومات الطقس =====
async function learnWeather(city) {
    try {
        // ملاحظة: تحتاج إلى مفتاح API من OpenWeatherMap
        const apiKey = 'YOUR_API_KEY'; // استبدل بمفتاحك
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ar`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.main) {
            const temp = data.main.temp;
            const desc = data.weather[0].description;
            const text = `طقس ${city} الآن: ${desc}، درجة الحرارة ${temp} درجة مئوية.`;
            const toks = tokenize(text);
            learnSentence(toks);
            await saveBrain();
            UIAPI.showToast(`🌤️ تعلمت طقس "${city}"`);
            return true;
        }
        return false;
    } catch (e) {
        console.error('خطأ في تعلم الطقس:', e);
        return false;
    }
}

// ===== 3. جلب أخبار عاجلة =====
async function learnNews() {
    try {
        const apiKey = 'YOUR_API_KEY'; // استبدل بمفتاحك من NewsAPI
        const url = `https://newsapi.org/v2/top-headlines?country=sa&apiKey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.articles) {
            const articles = data.articles.slice(0, 3);
            for (const article of articles) {
                const title = article.title;
                const description = article.description || '';
                const text = `${title}. ${description}`;
                const toks = tokenize(text);
                learnSentence(toks);
            }
            await saveBrain();
            UIAPI.showToast(`📰 تعلمت آخر الأخبار`);
            return true;
        }
        return false;
    } catch (e) {
        console.error('خطأ في تعلم الأخبار:', e);
        return false;
    }
}

// ===== 4. الدالة الرئيسية =====
async function learnFromWeb(query) {
    if (query.includes('طقس') || query.includes('الطقس')) {
        const city = query.replace(/طقس|الطقس|في|مدينة/g, '').trim() || 'مكة';
        return await learnWeather(city);
    }
    
    if (query.includes('أخبار') || query.includes('آخر الأخبار')) {
        return await learnNews();
    }
    
    const topic = query.trim();
    if (topic.length > 2) {
        return await learnFromWikipedia(topic);
    }
    
    UIAPI.showToast('⚠️ لم أفهم ما تريد تعلمه');
    return false;
}

// ===== تصدير =====
window.learnFromWeb = learnFromWeb;
window.learnFromWikipedia = learnFromWikipedia;
window.learnWeather = learnWeather;
window.learnNews = learnNews;
