// ================================================================
// الملف: graph.js
// الرسم البياني التفاعلي
// ================================================================

let graphTransform = { x: 200, y: 100, scale: 1 };
let expertMode = false;
let d3Loaded = false;
try { if (typeof d3 !== 'undefined') d3Loaded = true; } catch (_) {}

function renderGraph() {
  const container = document.getElementById('brainGraph');
  const subjects = Object.keys(window.brain.facts);
  const count = subjects.length;
  if (count === 0) {
    container.innerHTML = `<svg width="100%" height="170"><text x="50%" y="50%" text-anchor="middle" fill="rgba(245,239,227,0.3)" font-size="13">لا توجد عقد</text></svg>`;
    return;
  }
  if (expertMode && d3Loaded) { renderGraphD3(subjects); return; }
  renderGraphVanilla(subjects);
}

function renderGraphVanilla(subjects) {
  const container = document.getElementById('brainGraph');
  const count = subjects.length;
  const radius = Math.min(140, 40 + count * 7);
  const nodes = subjects.map((s, i) => ({
    name: s,
    x: radius * Math.cos((i / count) * Math.PI * 2 - Math.PI/2),
    y: (radius * 0.7) * Math.sin((i / count) * Math.PI * 2 - Math.PI/2)
  }));
  let edges = '', nodeEls = '';
  nodes.forEach((n) => {
    const rels = window.brain.facts[n.name];
    if (!rels) return;
    Object.values(rels).forEach(arr => {
      arr.forEach(obj => {
        const t = nodes.find(nn => nn.name === obj);
        if (t) edges += `<line x1="${n.x}" y1="${n.y}" x2="${t.x}" y2="${t.y}" stroke="rgba(201,168,106,0.35)" stroke-width="1.5"/>`;
      });
    });
  });
  nodes.forEach(n => {
    const hasNeg = window.brain.negations.some(neg => neg.subj === n.name);
    const hasQuant = window.brain.quantities.some(q => q.subj === n.name);
    const color = hasNeg ? '#B85C4E' : (hasQuant ? '#7ab8d4' : '#C9A86A');
    const width = hasQuant ? '2.5' : '1.5';
    nodeEls += `<circle cx="${n.x}" cy="${n.y}" r="14" fill="#11151f" stroke="${color}" stroke-width="${width}"/><text x="${n.x}" y="${n.y+4}" text-anchor="middle" font-size="9" fill="#F5EFE3">${n.name.length>5 ? n.name.slice(0,5)+'…' : n.name}</text>`;
  });
  const { x, y, scale } = graphTransform;
  container.innerHTML = `<svg width="100%" height="170"><g transform="translate(${x},${y}) scale(${scale})">${edges}${nodeEls}</g></svg>`;
}

function renderGraphD3(subjects) {
  const container = document.getElementById('brainGraph');
  const width = container.clientWidth || 400, height = 170;
  container.innerHTML = '';
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const radius = Math.min(140, 40 + subjects.length * 7);
  const nodes = subjects.map((s, i) => ({ id: s, x: radius * Math.cos((i/subjects.length)*Math.PI*2 - Math.PI/2), y: (radius*0.7) * Math.sin((i/subjects.length)*Math.PI*2 - Math.PI/2) }));
  const links = [];
  nodes.forEach(n => {
    const rels = window.brain.facts[n.id];
    if (!rels) return;
    Object.values(rels).forEach(arr => {
      arr.forEach(obj => {
        const t = nodes.find(nn => nn.id === obj);
        if (t) links.push({ source: n, target: t });
      });
    });
  });
  const g = svg.append('g').attr('transform', `translate(${graphTransform.x},${graphTransform.y}) scale(${graphTransform.scale})`);
  g.selectAll('line').data(links).enter().append('line')
    .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
    .attr('stroke', 'rgba(201,168,106,0.35)').attr('stroke-width', 1.5);
  const ng = g.selectAll('g').data(nodes).enter().append('g');
  ng.append('circle').attr('cx', d => d.x).attr('cy', d => d.y).attr('r', 14)
    .attr('fill', '#11151f')
    .attr('stroke', d => window.brain.negations.some(n => n.subj === d.id) ? '#B85C4E' : window.brain.quantities.some(q => q.subj === d.id) ? '#7ab8d4' : '#C9A86A')
    .attr('stroke-width', d => window.brain.quantities.some(q => q.subj === d.id) ? '2.5' : '1.5');
  ng.append('text').attr('x', d => d.x).attr('y', d => d.y + 4).attr('text-anchor', 'middle')
    .style('fill', '#F5EFE3').style('font-size', '9px')
    .text(d => d.id.length > 5 ? d.id.slice(0,5)+'…' : d.id);
}

function setupGraphInteractions() {
  const container = document.getElementById('brainGraph');
  let drag = false, sx, sy, ox, oy;
  container.addEventListener('mousedown', e => {
    if (e.target.closest('text') || e.target.closest('circle')) return;
    drag = true; sx = e.clientX; sy = e.clientY; ox = graphTransform.x; oy = graphTransform.y;
    container.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    graphTransform.x = ox + (e.clientX - sx);
    graphTransform.y = oy + (e.clientY - sy);
    renderGraph();
  });
  window.addEventListener('mouseup', () => { if (drag) { drag = false; container.style.cursor = 'grab'; } });
  container.addEventListener('wheel', e => {
    e.preventDefault();
    graphTransform.scale = Math.min(2.5, Math.max(0.3, graphTransform.scale + (e.deltaY > 0 ? -0.08 : 0.08)));
    renderGraph();
  }, { passive: false });
  document.getElementById('zoomInBtn').addEventListener('click', () => { graphTransform.scale = Math.min(2.5, graphTransform.scale + 0.15); renderGraph(); });
  document.getElementById('zoomOutBtn').addEventListener('click', () => { graphTransform.scale = Math.max(0.3, graphTransform.scale - 0.15); renderGraph(); });
  document.getElementById('resetViewBtn').addEventListener('click', () => { graphTransform = { x: 200, y: 100, scale: 1 }; renderGraph(); });
}

window.graphTransform = graphTransform;
window.expertMode = expertMode;
window.renderGraph = renderGraph;
window.setupGraphInteractions = setupGraphInteractions;
