// ================================================================
// الملف: ui.js (معدل - دعم إحصائيات الدراسة)
// ================================================================

function refreshStats() {
  const statWords = document.getElementById('statWords');
  const statFacts = document.getElementById('statFacts');
  const statTri = document.getElementById('statTri');
  const statKernel = document.getElementById('statKernel');
  const statInferences = document.getElementById('statInferences');
  const statGaps = document.getElementById('statGaps');
  const statErrors = document.getElementById('statErrors');
  const statStudy = document.getElementById('statStudy');
  const statMastered = document.getElementById('statMastered');
  
  if (statWords) statWords.textContent = Object.keys(window.brain.wordFreq).length;
  if (statFacts) statFacts.textContent = countFacts() + window.brain.quantities.length;
  if (statTri) statTri.textContent = Object.keys(window.brain.trigram).length;
  
  const kernelCount = Object.keys(window.brain.kernel?.facts || {}).length;
  const inferenceCount = Object.keys(window.brain.inferences?.facts || {}).length;
  const gapCount = window.brain.curiosity?.gaps?.length || 0;
  const studyCount = window.brain.study?.workbench?.length || 0;
  const masteredCount = window.brain.study?.mastered?.length || 0;
  
  if (statKernel) statKernel.textContent = kernelCount;
  if (statInferences) statInferences.textContent = inferenceCount;
  if (statGaps) statGaps.textContent = gapCount;
  if (statStudy) statStudy.textContent = studyCount;
  if (statMastered) statMastered.textContent = masteredCount;
  
  updateErrorStat();
}

function updateErrorStat() {
  const el = document.getElementById('statErrors');
  if (el) el.textContent = errorLog.length;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) {
    console.log('📢', msg);
    return;
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 3500);
}

function renderTeachFeed() {
  const container = document.getElementById('teachFeed');
  if (!container) return;
  container.innerHTML = '';
  let has = false;

  // ===== عرض الأساسيات (kernel) =====
  if (window.brain.kernel?.facts) {
    for (const subj in window.brain.kernel.facts) {
      for (const rel in window.brain.kernel.facts[subj]) {
        window.brain.kernel.facts[subj][rel].forEach(obj => {
          has = true;
          const card = document.createElement('div');
          card.className = 'card taught';
          card.style.borderRight = '4px solid #7c3aed';
          card.style.backgroundColor = '#f5f3ff';
          card.innerHTML = `
            <span class="label" style="color:#7c3aed;">🧠 أساسية</span>
            <div class="extract-row">
              <span class="pill" style="background:rgba(124,58,237,0.12);color:#7c3aed;">${subj} ← ${rel} ← ${obj}</span>
              <span style="font-size:9px;color:#6b7280;cursor:default;">🔒</span>
            </div>
          `;
          container.appendChild(card);
        });
      }
    }
  }

  // ===== عرض الكميات =====
  window.brain.quantities.forEach(q => {
    has = true;
    const card = document.createElement('div');
    card.className = 'card taught';
    const confidence = calculateConfidence(q.subj, q.rel, q.obj);
    card.innerHTML = `
      <span class="label">📊 كمية (ثقة: ${confidence}%)</span>
      <div class="extract-row">
        <span class="pill sage">${q.type === 'all' ? 'كل' : 'بعض'} ${q.subj} ← ${q.rel} ← ${q.obj}</span>
        <span class="pill del-fact" data-subj="${q.subj}" data-rel="${q.rel}" data-obj="${q.obj}" data-quantity="true">✕</span>
      </div>
    `;
    container.appendChild(card);
  });

  // ===== عرض النفي =====
  window.brain.negations.forEach(neg => {
    has = true;
    const card = document.createElement('div');
    card.className = 'card taught';
    card.style.borderRight = '4px solid #f59e0b';
    card.style.backgroundColor = '#fffbeb';
    card.innerHTML = `
      <span class="label" style="color:#b45309;">⛔ نفي</span>
      <div class="extract-row">
        <span class="pill conflict" style="border:1px solid #f59e0b; background:#fffbeb; color:#b45309;">
          ${neg.subj} ← ${neg.rel} ← ${neg.obj}
        </span>
        <span class="pill del-fact" data-subj="${neg.subj}" data-rel="${neg.rel}" data-obj="${neg.obj}" data-negation="true">✕</span>
      </div>
    `;
    container.appendChild(card);
  });

  // ===== عرض الحقائق المتعلمة =====
  for (const subj in window.brain.facts) {
    const isKernelSubj = window.brain.kernel?.facts?.[subj];
    for (const rel in window.brain.facts[subj]) {
      window.brain.facts[subj][rel].forEach(obj => {
        if (isKernelSubj && isKernelSubj[rel] && isKernelSubj[rel].includes(obj)) {
          return;
        }
        has = true;
        const card = document.createElement('div');
        card.className = 'card taught';
        const isNeg = window.brain.negations.some(n => n.subj === subj && n.rel === rel && n.obj === obj);
        const confidence = calculateConfidence(subj, rel, obj);

        let category = null;
        if (typeof window.getCategory === 'function') {
          category = window.getCategory(subj);
        }
        const categoryBadge = category ? ` <span class="badge-feature">${category}</span>` : '';

        const isInferred = window.brain.inferences?.facts?.[subj]?.[rel]?.includes(obj);
        const inferenceBadge = isInferred ? ' 🧠(مستنتج)' : '';

        card.innerHTML = `
          <span class="label">علاقة (ثقة: ${confidence}%)${categoryBadge}${inferenceBadge}</span>
          <div class="extract-row">
            <span class="pill">${subj} ← ${rel} ← ${obj}${isNeg ? ' ⛔ (منفي)' : ''}</span>
            <span class="pill del-fact" data-subj="${subj}" data-rel="${rel}" data-obj="${obj}">✕</span>
          </div>
        `;
        container.appendChild(card);
      });
    }
  }

  if (!has) container.innerHTML = '<div style="color:var(--parchment-dim);font-size:13px;padding:10px;text-align:center;">لا توجد علاقات.</div>';

  container.querySelectorAll('.del-fact').forEach(el => {
    el.addEventListener('click', () => {
      const subj = el.dataset.subj, rel = el.dataset.rel, obj = el.dataset.obj;
      const isNegation = el.dataset.negation === 'true';
      
      if (isNegation) {
        if (confirm(`حذف النفي: "${subj} ← ${rel} ← ${obj}"؟`)) {
          window.brain.negations = window.brain.negations.filter(n => !(n.subj === subj && n.rel === rel && n.obj === obj));
          saveBrain();
          refreshStats();
          renderGraph();
          renderTeachFeed();
          showToast(`🗑️ حذفت النفي: ${subj} ← ${rel} ← ${obj}`);
        }
      } else {
        if (confirm(`حذف: "${subj} ← ${rel} ← ${obj}"؟`)) deleteFact(subj, rel, obj);
      }
    });
  });
}

function displayAnswer(q, result) {
  const card = document.createElement('div');
  let cls = 'card answer-card';
  
  if (result.type === 'chat') {
    cls += ' chat-answer';
    card.style.borderRight = '4px solid #2563eb';
    card.style.backgroundColor = '#f0f9ff';
    card.style.color = '#0f172a';
    card.style.borderRadius = '8px';
    card.style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)';
  } else if (result.type === 'unknown') {
    cls += ' unknown';
  } else if (result.type === 'chain') {
    cls += ' chain-answer';
  } else if (result.type === 'open') {
    cls += ' open-answer';
  } else if (result.type === 'backward') {
    cls += ' backward-answer';
  }
  card.className = cls;

  let barsHtml = '';
  if (result.bars && result.bars.length) {
    barsHtml = '<div class="why-box"><span class="why-title">📊 المصدر (درجة الثقة)</span>' +
      result.bars.map(b => `
        <div class="bar-row">
          <span class="bar-label">${b.label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${b.pct}%"></div></div>
          <span class="bar-pct">${b.pct}%</span>
        </div>
      `).join('') +
      `<div style="margin-top:4px;font-size:11px;opacity:0.7;">${result.reason}</div></div>`;
  } else {
    barsHtml = `<div class="why-box"><span class="why-title">💡 السبب</span>${result.reason}</div>`;
  }

  let treeHtml = '';
  if (result.tree) treeHtml = `<div class="tree-box"><div class="why-title">🌳 شجرة الاستدلال</div>${result.tree}</div>`;

  const labelMap = { chat: '💬 محادثة', chain: '🔗 استنتاج متسلسل', open: '📖 جواب مفتوح', backward: '🔄 استدلال عكسي', unknown: '❓' };
  const label = labelMap[result.type] || '❓';

  let answerText = result.text.replace(/\n/g, '<br>');
  if (result.type === 'chat') {
    answerText = `<span style="font-size:17px;line-height:1.8;">${answerText}</span>`;
  }

  card.innerHTML = `
    <span class="label" style="${result.type === 'chat' ? 'color:#2563eb;font-weight:bold;' : ''}">${label}</span>
    <div class="answer-main">${answerText}</div>
    ${treeHtml}${barsHtml}
  `;

  const askFeed = document.getElementById('askFeed');
  if (askFeed) {
    askFeed.insertBefore(card, askFeed.firstChild);
  }
  const askInput = document.getElementById('askInput');
  if (askInput) askInput.value = '';

  if (contextMemory && contextMemory.length > 0) {
    const ctx = getContextSummary();
    const ind = document.createElement('div');
    ind.style.cssText = 'font-size:9px;color:var(--parchment-dim);margin-top:4px;opacity:0.6;text-align:left;';
    ind.textContent = `🔄 السياق: ${ctx}`;
    card.appendChild(ind);
  }
}

// ===== تصدير =====
window.refreshStats = refreshStats;
window.updateErrorStat = updateErrorStat;
window.showToast = showToast;
window.renderTeachFeed = renderTeachFeed;
window.displayAnswer = displayAnswer;
