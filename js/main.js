// ================================================================
// الملف: main.js (النسخة النهائية المعدلة)
// تهيئة التطبيق وربط الأحداث - مع دعم الدراسة والخادم
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
  // ===== تهيئة التخزين =====
  initStorage();

  // ===== تحميل السياق =====
  if (typeof loadContextMemory === 'function') {
    loadContextMemory();
  }

  // ===== تلقين الأساسيات =====
  if (typeof teachKernel === 'function') {
    teachKernel();
  }

  // ===== تشغيل الاستدلال التلقائي =====
  setTimeout(() => {
    if (typeof autoInference === 'function') {
      autoInference();
    }
  }, 1000);

  // ===== تهيئة الرسم البياني =====
  if (typeof setupGraphInteractions === 'function') {
    setupGraphInteractions();
  }

  // ===== عرض العلاقات والدراسة =====
  if (typeof renderTeachFeed === 'function') {
    renderTeachFeed();
  }
  if (typeof renderStudyFeed === 'function') {
    renderStudyFeed();
  }

  // ===== إخفاء الحالة الفارغة للأسئلة =====
  const askFeed = document.getElementById('askFeed');
  const askEmpty = document.getElementById('askEmpty');
  if (askFeed && askFeed.children.length > 0 && askEmpty) {
    askEmpty.style.display = 'none';
  }

  // ===== رسالة الترحيب =====
  if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
    UIAPI.showToast('🚀 العقل الذكي جاهز! (مع أساسيات واستدلال ودراسة)');
  }

  // ================================================================
  // 1. زر التلقين
  // ================================================================
  document.getElementById('teachBtn').addEventListener('click', async () => {
    const raw = document.getElementById('teachInput').value.trim();
    if (!raw) {
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast('⚠️ اكتب نصاً.');
      }
      return;
    }
    try {
      const sentences = raw.split(/[\.!؟\?]/).map(s => s.trim()).filter(Boolean);
      let allFacts = [];
      
      const negBefore = window.brain.negations.length;
      const factsBefore = Object.keys(window.brain.facts).length;
      
      for (const s of sentences) {
        const toks = tokenize(s);
        const facts = learnSentence(toks);
        allFacts = allFacts.concat(facts);
      }

      const negAfter = window.brain.negations.length;
      const factsAfter = Object.keys(window.brain.facts).length;

      // إنشاء بطاقة التلقين
      const card = document.createElement('div');
      card.className = 'card taught';
      let html = '';

      if (allFacts.length > 0) {
        html = '<div class="extract-row">' + allFacts.map(f => {
          let label = `${f.subj} ← ${f.rel} ← ${f.obj}`;
          if (f.neg) label += ' ⛔ (نفي)';
          if (f.quantity) label += ` (${f.quantity === 'all' ? 'كل' : 'بعض'})`;
          if (f.cause) label += ` (سبب: ${f.cause})`;
          
          let extraClass = 'sage';
          let extraStyle = '';
          if (f._result && f._result.status === 'conflict') {
            extraClass = 'conflict';
            extraStyle = 'border:1px solid #f59e0b; background:#fffbeb; color:#b45309;';
          } else if (f._result && f._result.status === 'duplicate') {
            extraClass = 'duplicate';
            extraStyle = 'opacity:0.6;';
          }
          return `<span class="pill ${extraClass}" style="${extraStyle}">${label}</span>`;
        }).join('') + '</div>';

        const added = allFacts.filter(f => f._result && f._result.status === 'added');
        const conflicts = allFacts.filter(f => f._result && f._result.status === 'conflict');
        const duplicates = allFacts.filter(f => f._result && f._result.status === 'duplicate');
        
        if (conflicts.length) {
          html += `<div style="margin-top:6px;font-size:12px;color:#b45309;background:#fffbeb;padding:4px 8px;border-radius:4px;border-right:3px solid #f59e0b;">
            ⚠️ تم تصحيح ${conflicts.length} معلومة متناقضة (انظر التفاصيل أدناه).
          </div>`;
        }
        if (duplicates.length) {
          html += `<div style="margin-top:4px;font-size:11px;color:#6b7280;">ℹ️ ${duplicates.length} معلومة مكررة.</div>`;
        }

        if (conflicts.length) {
          if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
            UIAPI.showToast('⚠️ تم تصحيح معلومة متناقضة.');
          }
        } else if (added.length) {
          if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
            UIAPI.showToast(`✅ تم تلقين ${added.length} معلومة جديدة.`);
          }
        } else if (duplicates.length && !added.length && !conflicts.length) {
          if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
            UIAPI.showToast('ℹ️ كل المعلومات موجودة مسبقاً.');
          }
        }

        // بطاقات التناقض التفصيلية
        for (const f of conflicts) {
          const detailCard = document.createElement('div');
          detailCard.className = 'card taught';
          detailCard.style.borderRight = '4px solid #f59e0b';
          detailCard.style.backgroundColor = '#fffbeb';
          const info = f._result.conflictInfo;
          detailCard.innerHTML = `
            <span class="label" style="color:#b45309;">⚠️ تم تصحيح معلومة متناقضة</span>
            <div style="margin-top:4px;font-weight:bold;">${f.subj} ← ${f.rel} ← ${f.obj}</div>
            <div style="display:flex;gap:16px;font-size:12px;color:#555;margin-top:4px;">
              <span>🔄 القديم: ${info.oldIsNegated ? 'نفي' : 'حقيقة'}</span>
              <span>🆕 الجديد: ${info.newIsNegated ? 'نفي' : 'حقيقة'}</span>
              <span>🕒 ${new Date(info.timestamp).toLocaleTimeString()}</span>
            </div>
            <div style="font-size:11px;color:#b45309;margin-top:4px;">${f._result.displayMessage}</div>
          `;
          document.getElementById('teachFeed').insertBefore(detailCard, document.getElementById('teachFeed').firstChild);
        }

      } else {
        html = '<div class="extract-row" style="opacity:.6;">لم تُستخرج علاقة صريحة</div>';
        
        if (negAfter > negBefore) {
          const newNeg = window.brain.negations[window.brain.negations.length - 1];
          html += `
            <div style="margin-top:8px;padding:12px;background:#fffbeb;border-right:4px solid #f59e0b;border-radius:4px;">
              <div style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:bold;color:#b45309;">
                <span>⛔</span> تم تلقين نفي:
              </div>
              <div style="font-size:16px;margin-top:6px;color:#1f2937;background:white;padding:8px 12px;border-radius:4px;border:1px solid #e5e7eb;">
                <strong>${newNeg.subj}</strong> ← <strong>${newNeg.rel}</strong> ← <strong>${newNeg.obj}</strong>
              </div>
              <div style="font-size:11px;color:#6b7280;margin-top:6px;">
                📌 تم تخزينه في سجل النفي (negations).
              </div>
            </div>
          `;
          if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
            UIAPI.showToast('✅ تم تلقين نفي جديد.');
          }
          
        } else if (factsAfter > factsBefore) {
          html += `<div style="margin-top:4px;font-size:12px;color:#22c55e;">✅ تم إضافة علاقة إلى قاعدة المعرفة.</div>`;
          if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
            UIAPI.showToast('✅ تم تلقين علاقة جديدة.');
          }
        } else {
          if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
            UIAPI.showToast('⚠️ لم أستخرج أي علاقة من هذا النص، ولم تُضف أي معلومة جديدة.');
          }
        }
      }

      card.innerHTML = `<span class="label">📖 تم التلقين</span>${raw}${html}`;
      document.getElementById('teachFeed').insertBefore(card, document.getElementById('teachFeed').firstChild);
      document.getElementById('teachInput').value = '';
      
      if (typeof refreshStats === 'function') refreshStats();
      if (typeof renderGraph === 'function') renderGraph();
      if (typeof renderTeachFeed === 'function') renderTeachFeed();
      
      await saveBrain();
      
      // تشغيل الاستدلال بعد التلقين
      setTimeout(() => {
        if (typeof autoInference === 'function') {
          autoInference();
        }
      }, 500);
      
    } catch (e) {
      logError('خطأ في التلقين', { text: raw, error: e.message });
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast('❌ خطأ أثناء التلقين (تم تسجيله)');
      }
      console.error(e);
    }
  });

  // ================================================================
  // 2. زر السؤال
  // ================================================================
  document.getElementById('askBtn').addEventListener('click', async () => {
    const q = document.getElementById('askInput').value.trim();
    if (!q) {
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast('⚠️ اكتب سؤالاً.');
      }
      return;
    }
    
    const askEmpty = document.getElementById('askEmpty');
    if (askEmpty) askEmpty.style.display = 'none';
    
    // تأخير طبيعي
    const delay = 300 + Math.random() * 200;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const result = answer(q);
      logAnswer(q, result.text, result.type, result.bars);
      if (typeof displayAnswer === 'function') {
        displayAnswer(q, result);
      }
      
      // عرض تحليل المشاعر
      if (result.sentiment && result.sentiment.sentiment !== 'neutral') {
        const card = document.querySelector('.answer-card:first-child');
        if (card) {
          const sentimentDiv = document.createElement('div');
          sentimentDiv.style.cssText = `
            font-size: 11px;
            color: #6b7280;
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.06);
            display: flex;
            align-items: center;
            gap: 6px;
          `;
          sentimentDiv.innerHTML = `
            <span>${result.sentiment.emoji}</span>
            <span>${result.sentiment.summary}</span>
          `;
          card.appendChild(sentimentDiv);
        }
      }
    } catch (e) {
      logError('خطأ في الإجابة', { question: q, error: e.message });
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast('❌ حدث خطأ (تم تسجيله)');
      }
      console.error(e);
    }
  });

  // ===== اختصار Enter في حقل السؤال =====
  document.getElementById('askInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('askBtn').click();
    }
  });

  // ===== اختصار Ctrl+Enter في حقل التلقين =====
  document.getElementById('teachInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      document.getElementById('teachBtn').click();
    }
  });

  // ================================================================
  // 3. زر تصحيح الإجابات
  // ================================================================
  const correctionBtn = document.getElementById('correctionBtn');
  if (correctionBtn) {
    correctionBtn.addEventListener('click', async () => {
      const lastAnswer = document.querySelector('.answer-card:first-child');
      if (!lastAnswer) {
        if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
          UIAPI.showToast('⚠️ لا توجد إجابة سابقة لتصحيحها.');
        }
        return;
      }
      
      const questionEl = lastAnswer.querySelector('.label');
      const question = questionEl?.textContent?.replace(/^.{1,2}\s/, '') || '';
      const answerEl = lastAnswer.querySelector('.answer-main');
      const userCorrection = prompt('📝 كيف تريد تصحيح الإجابة؟', answerEl?.textContent || '');
      
      if (!userCorrection) return;
      
      let parsed = null;
      if (typeof parseSentenceAdvanced === 'function') {
        const results = parseSentenceAdvanced(userCorrection);
        if (results && results.length > 0) {
          parsed = results[0];
        }
      }
      
      if (!parsed && typeof advancedParse === 'function') {
        parsed = advancedParse(userCorrection);
      }
      
      if (parsed) {
        const hasNeg = /لا|ليس/.test(userCorrection);
        const rel = parsed.verb || parsed.predicate || 'هو';
        const obj = parsed.obj || parsed.predicate || parsed.location || '';
        const result = addFactDeduplicated(parsed.subject, rel, obj, hasNeg);
        
        if (result.status === 'conflict') {
          if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
            UIAPI.showToast('✅ تم تصحيح المعلومة بناءً على ملاحظتك!');
          }
        } else if (result.status === 'added') {
          if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
            UIAPI.showToast('✅ تم إضافة المعلومة الجديدة!');
          }
        }
        
        if (typeof addToContext === 'function') {
          addToContext(question, userCorrection, CONTEXT_CATEGORIES?.CORRECTION || 'تصحيح');
        }
        
        if (typeof refreshStats === 'function') refreshStats();
        if (typeof renderGraph === 'function') renderGraph();
        if (typeof renderTeachFeed === 'function') renderTeachFeed();
        
        await saveBrain();
        
        setTimeout(() => {
          if (typeof autoInference === 'function') {
            autoInference();
          }
        }, 500);
        
      } else {
        if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
          UIAPI.showToast('⚠️ لم أستطع فهم التصحيح. حاول كتابة جملة واضحة.');
        }
      }
    });
  }

  // ================================================================
  // 4. زر الفضول
  // ================================================================
  const curiosityBtn = document.getElementById('curiosityBtn');
  if (curiosityBtn) {
    curiosityBtn.addEventListener('click', () => {
      if (typeof askCuriosityQuestions === 'function') {
        askCuriosityQuestions();
      } else {
        if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
          UIAPI.showToast('⚠️ وحدة الفضول غير متوفرة.');
        }
      }
    });
  }

  // ================================================================
  // 5. زر الاستدلال التلقائي
  // ================================================================
  const inferenceBtn = document.getElementById('inferenceBtn');
  if (inferenceBtn) {
    inferenceBtn.addEventListener('click', () => {
      if (typeof autoInference === 'function') {
        autoInference();
      } else {
        if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
          UIAPI.showToast('⚠️ وحدة الاستدلال غير متوفرة.');
        }
      }
    });
  }

  // ================================================================
  // 6. زر التعلم من الإنترنت
  // ================================================================
  const webLearnBtn = document.getElementById('webLearnBtn');
  if (webLearnBtn) {
    webLearnBtn.addEventListener('click', async () => {
      const query = prompt('📚 ماذا تريد أن تتعلم؟ (موضوع، طقس مدينة، أو أخبار)');
      if (!query) return;
      
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast(`⏳ جاري التعلم عن "${query}"...`);
      }
      
      try {
        const result = await learnFromWeb(query);
        if (result) {
          if (typeof refreshStats === 'function') refreshStats();
          if (typeof renderGraph === 'function') renderGraph();
          if (typeof renderTeachFeed === 'function') renderTeachFeed();
          
          setTimeout(() => {
            if (typeof autoInference === 'function') {
              autoInference();
            }
          }, 500);
        }
      } catch (e) {
        console.error('خطأ في التعلم من الإنترنت:', e);
        if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
          UIAPI.showToast('❌ فشل التعلم من الإنترنت.');
        }
      }
    });
  }

  // ================================================================
  // 7. زر تحميل النص للدراسة (جديد)
  // ================================================================
  const loadStudyBtn = document.getElementById('loadStudyBtn');
  if (loadStudyBtn) {
    loadStudyBtn.addEventListener('click', () => {
      if (typeof loadTextFromInput === 'function') {
        loadTextFromInput();
      } else {
        if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
          UIAPI.showToast('❌ لم يتم تحميل وحدة الدراسة.');
        }
      }
    });
  }

  // ===== اختصار Ctrl+Enter في حقل الدراسة =====
  const studyTextInput = document.getElementById('studyTextInput');
  if (studyTextInput) {
    studyTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        const loadBtn = document.getElementById('loadStudyBtn');
        if (loadBtn) loadBtn.click();
      }
    });
  }

  // ================================================================
  // 8. زر الإضافة اليدوية
  // ================================================================
  document.getElementById('manualAddBtn').addEventListener('click', () => {
    const subj = document.getElementById('manualSubj').value.trim();
    const rel = document.getElementById('manualRel').value.trim();
    const obj = document.getElementById('manualObj').value.trim();
    const qt = document.getElementById('manualQuant').value;
    
    if (!subj || !rel || !obj) {
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast('⚠️ املأ الحقول.');
      }
      return;
    }
    
    const stem = getStem(rel);
    const result = addFactDeduplicated(subj, stem, obj, false);
    
    if (result.status === 'added' || result.status === 'conflict') {
      if (qt) addQuantity(qt, subj, stem, obj);
      if (typeof refreshStats === 'function') refreshStats();
      if (typeof renderGraph === 'function') renderGraph();
      if (typeof renderTeachFeed === 'function') renderTeachFeed();
      saveBrain();
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast(`➕ أضفت: ${subj} ← ${stem} ← ${obj}`);
      }
    } else {
      if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
        UIAPI.showToast(`❌ ${result.displayMessage}`);
      }
    }
    
    document.getElementById('manualSubj').value = '';
    document.getElementById('manualRel').value = '';
    document.getElementById('manualObj').value = '';
    document.getElementById('manualQuant').value = '';
  });

  // ================================================================
  // 9. زر تبديل وضع التخزين
  // ================================================================
  document.getElementById('modeToggleBtn').addEventListener('click', () => {
    const modes = ['persistent', 'session', 'memory'];
    let idx = modes.indexOf(storageMode);
    idx = (idx + 1) % modes.length;
    setStorageMode(modes[idx], true);
  });

  // ================================================================
  // 10. زر تصدير العقل
  // ================================================================
  document.getElementById('exportBtn').addEventListener('click', () => {
    const data = { ...window.brain, context: contextMemory };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brain-advanced-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('📥 تم تصدير العقل المتقدم');
    }
  });

  // ================================================================
  // 11. زر تصدير السجلات
  // ================================================================
  document.getElementById('exportLogsBtn').addEventListener('click', () => {
    if (typeof exportLogs === 'function') {
      exportLogs();
    }
  });

  // ================================================================
  // 12. زر استيراد ملف
  // ================================================================
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.facts || typeof parsed.facts !== 'object') {
          throw new Error('الملف يجب أن يحتوي على facts.');
        }

        const defaultFields = {
          bigram: {}, trigram: {}, wordFreq: {}, totalWords: 0,
          negations: [], quantities: [], log: []
        };
        const merged = Object.assign({}, defaultFields, parsed);

        // دمج bigram
        for (const w in merged.bigram) {
          if (!window.brain.bigram[w]) window.brain.bigram[w] = {};
          for (const next in merged.bigram[w]) {
            window.brain.bigram[w][next] = (window.brain.bigram[w][next] || 0) + merged.bigram[w][next];
          }
        }
        
        // دمج trigram
        for (const key in merged.trigram) {
          if (!window.brain.trigram[key]) window.brain.trigram[key] = {};
          for (const next in merged.trigram[key]) {
            window.brain.trigram[key][next] = (window.brain.trigram[key][next] || 0) + merged.trigram[key][next];
          }
        }
        
        // دمج wordFreq
        for (const w in merged.wordFreq) {
          window.brain.wordFreq[w] = (window.brain.wordFreq[w] || 0) + merged.wordFreq[w];
        }
        
        // دمج facts
        for (const subj in merged.facts) {
          if (!window.brain.facts[subj]) window.brain.facts[subj] = {};
          for (const rel in merged.facts[subj]) {
            if (!window.brain.facts[subj][rel]) window.brain.facts[subj][rel] = [];
            for (const obj of merged.facts[subj][rel]) {
              if (!window.brain.facts[subj][rel].includes(obj)) {
                window.brain.facts[subj][rel].push(obj);
              }
            }
          }
        }
        
        // دمج negations
        for (const neg of merged.negations || []) {
          if (!window.brain.negations.some(n => n.subj === neg.subj && n.rel === neg.rel && n.obj === neg.obj)) {
            window.brain.negations.push(neg);
          }
        }
        
        // دمج quantities
        for (const q of merged.quantities || []) {
          if (!window.brain.quantities.some(q2 => q2.type === q.type && q2.subj === q.subj && q2.rel === q.rel && q2.obj === q.obj)) {
            window.brain.quantities.push(q);
          }
        }
        
        // دمج kernel, inferences, curiosity, study
        if (parsed.kernel) window.brain.kernel = parsed.kernel;
        if (parsed.inferences) window.brain.inferences = parsed.inferences;
        if (parsed.curiosity) window.brain.curiosity = parsed.curiosity;
        if (parsed.study) window.brain.study = parsed.study;
        
        window.brain.totalWords = Object.values(window.brain.wordFreq).reduce((a, b) => a + b, 0);
        
        if (parsed.context) {
          for (const ctx of parsed.context) {
            if (!contextMemory.some(c => c.question === ctx.question && c.answer === ctx.answer)) {
              contextMemory.push(ctx);
            }
          }
          if (contextMemory.length > 7) contextMemory = contextMemory.slice(-7);
        }
        
        if (typeof refreshStats === 'function') refreshStats();
        if (typeof renderGraph === 'function') renderGraph();
        if (typeof renderTeachFeed === 'function') renderTeachFeed();
        if (typeof renderStudyFeed === 'function') renderStudyFeed();
        
        await saveBrain();
        
        if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
          UIAPI.showToast('✅ تم الدمج بنجاح');
        }
      } catch (err) {
        logError('فشل الاستيراد', { error: err.message });
        if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
          UIAPI.showToast(`❌ فشل الدمج: ${err.message}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ================================================================
  // 13. زر التصفير (المحسّن)
  // ================================================================
  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm('⚠️ سيتم مسح كل شيء. متأكد؟')) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LOG_KEY);
      localStorage.removeItem(CONTEXT_KEY);
      localStorage.removeItem('brain-storage-mode');
      
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(LOG_KEY);
      sessionStorage.removeItem(CONTEXT_KEY);
      sessionStorage.removeItem('brain-storage-mode');
      
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (key.includes('brain') || key.includes('log') || key.includes('context')) {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('فشل مسح التخزين:', e);
    }

    window.brain = JSON.parse(JSON.stringify(window.defaultBrain));
    window.brain.conflicts = [];
    
    if (typeof contextMemory !== 'undefined') {
      contextMemory = [];
    }
    errorLog = [];
    answerLog = [];
    saveLogs();
    
    document.getElementById('teachFeed').innerHTML = '';
    document.getElementById('askFeed').innerHTML = '';
    const askEmpty = document.getElementById('askEmpty');
    if (askEmpty) askEmpty.style.display = 'flex';
    
    if (typeof graphTransform !== 'undefined') {
      graphTransform = { x: 200, y: 100, scale: 1 };
    }
    
    if (typeof refreshStats === 'function') refreshStats();
    if (typeof renderGraph === 'function') renderGraph();
    if (typeof renderTeachFeed === 'function') renderTeachFeed();
    if (typeof renderStudyFeed === 'function') renderStudyFeed();
    
    if (typeof teachKernel === 'function') teachKernel();
    
    await saveBrain();
    loadBrain(false);
    
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast('🧹 تم التصفير بنجاح. سيتم إعادة تحميل الصفحة خلال ثانيتين...');
    }
    
    setTimeout(() => {
      location.reload();
    }, 2000);
  });

  // ================================================================
  // 14. زر وضع الخبير
  // ================================================================
  document.getElementById('expertToggle').addEventListener('click', function() {
    window.expertMode = !window.expertMode;
    this.classList.toggle('active', window.expertMode);
    if (typeof UIAPI !== 'undefined' && UIAPI.showToast) {
      UIAPI.showToast(window.expertMode ? '🧠 خبير مفعّل' : '🧠 خبير غير مفعّل');
    }
    if (typeof renderGraph === 'function') {
      renderGraph();
    }
  });

  // ================================================================
  // 15. تأكيد تحميل الدراسة
  // ================================================================
  console.log('✅ main.js loaded successfully');
  console.log('📚 Study module available:', typeof loadTextFromInput === 'function');
  console.log('🌐 Server URL:', typeof SERVER_URL !== 'undefined' ? SERVER_URL : 'not set');
});
