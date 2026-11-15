import { PALETTE } from './theme.js';

export function renderLedger(container, diagnostic, { workerUrl } = {}) {
  container.innerHTML = '';

  const wrap = el('div', 'ledger');

  wrap.appendChild(renderHeadline(diagnostic));
  wrap.appendChild(renderAlerts(diagnostic.alerts));
  wrap.appendChild(renderNarrative(diagnostic, workerUrl));
  wrap.appendChild(renderThreadTable(diagnostic));

  container.appendChild(wrap);
}

function renderHeadline(d) {
  const row = el('div', 'ledger-headline');
  const metrics = [
    { value: `${(d.standTall.graded_heel_share * 100).toFixed(0)}%`, label: 'Heel share', sub: `${d.standTall.heel}/${d.standTall.graded} graded` },
    { value: `${(d.standTall.graded_babyface_share * 100).toFixed(0)}%`, label: 'Face share', sub: `${d.standTall.babyface}/${d.standTall.graded} graded` },
    { value: String(d.fragmentation.fragmentation_index), label: 'Face frag', sub: `${d.fragmentation.active_face_threads} face threads` },
    { value: d.peakDebt.toFixed(1), label: 'Peak debt', sub: `threshold ${d.debtThreshold.toFixed(1)}` },
    { value: String(d.carrierLoad.overloaded.length), label: 'Overloaded', sub: `>${d.carrierLoad.threshold} threads` },
  ];
  for (const m of metrics) {
    const box = el('div', 'ledger-metric');
    box.appendChild(elText('div', m.value, 'ledger-metric-value'));
    box.appendChild(elText('div', m.label, 'ledger-metric-label'));
    box.appendChild(elText('div', m.sub, 'ledger-metric-sub'));
    row.appendChild(box);
  }
  return row;
}

function renderAlerts(alerts) {
  const section = el('div', 'ledger-alerts');
  if (!alerts.length) {
    section.appendChild(elText('div', 'No alerts.', 'ledger-alert ledger-alert-ok'));
    return section;
  }
  for (const a of alerts) {
    const item = el('div', `ledger-alert ledger-alert-${a.severity}`);
    const icon = a.severity === 'warn' ? '▲' : '●';
    item.appendChild(elText('span', icon, 'ledger-alert-icon'));
    item.appendChild(elText('span', a.message, 'ledger-alert-text'));
    item.appendChild(elText('span', a.type, 'ledger-alert-tag'));
    section.appendChild(item);
  }
  return section;
}

function renderNarrative(diagnostic, workerUrl) {
  const section = el('div', 'ledger-narrative');
  const header = el('div', 'ledger-narrative-header');
  header.appendChild(elText('span', 'Narrative', 'ledger-section-title'));

  if (workerUrl) {
    const btn = el('button', 'ledger-narrate-btn');
    btn.textContent = 'Generate';
    btn.addEventListener('click', () => fetchNarrative(btn, section, diagnostic, workerUrl));
    header.appendChild(btn);
  }

  section.appendChild(header);

  const body = el('div', 'ledger-narrative-body');
  body.id = 'narrative-body';
  body.textContent = buildFallbackNarrative(diagnostic);
  section.appendChild(body);

  return section;
}

function buildFallbackNarrative(d) {
  const parts = [];

  const heelPct = (d.standTall.graded_heel_share * 100).toFixed(0);
  const facePct = (d.standTall.graded_babyface_share * 100).toFixed(0);
  parts.push(`Across ${d.corpus.shows} shows (${d.corpus.dateRange}), ${heelPct}% of graded stand-talls read heel against ${facePct}% face.`);

  if (d.fragmentation.fragmentation_index >= 3) {
    parts.push(`The babyface side is fragmented into ${d.fragmentation.fragmentation_index} disjoint components — a federation of isolated threads, not a consolidated faction.`);
  }

  if (d.carrierLoad.overloaded.length) {
    const names = d.carrierLoad.overloaded.map(c => c.name).join(', ');
    parts.push(`Carrier overload on ${names}.`);
  }

  const debtors = d.threads.filter(t => t.debt_score > d.debtThreshold && !t.closed);
  if (debtors.length) {
    parts.push(`${debtors.length} thread(s) accumulating debt above ${d.debtThreshold.toFixed(1)}.`);
  }

  return parts.join(' ');
}

async function fetchNarrative(btn, section, diagnostic, workerUrl) {
  btn.disabled = true;
  btn.textContent = 'Generating…';
  const body = document.getElementById('narrative-body');

  try {
    const payload = {
      corpus: diagnostic.corpus,
      standTall: diagnostic.standTall,
      fragmentation: diagnostic.fragmentation,
      temperature: diagnostic.temperature,
      peakDebt: diagnostic.peakDebt,
      debtThreshold: diagnostic.debtThreshold,
      alerts: diagnostic.alerts,
      overloaded: diagnostic.carrierLoad.overloaded.map(c => ({ name: c.name, threads: c.active_threads })),
      topDebt: diagnostic.threads.filter(t => !t.closed).slice(0, 8).map(t => ({
        name: t.name, debt: t.debt_score, temp: t.temp, shows_silent: t.shows_since_advance,
      })),
    };

    const resp = await fetch(`${workerUrl}/narrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    body.textContent = data.narrative || 'No narrative returned.';
    body.classList.add('ledger-narrative-ai');
    btn.textContent = 'Regenerate';
  } catch (err) {
    body.textContent = buildFallbackNarrative(diagnostic) + ` [narrate failed: ${err.message}]`;
    btn.textContent = 'Retry';
  }
  btn.disabled = false;
}

function renderThreadTable(diagnostic) {
  const section = el('div', 'ledger-threads');
  section.appendChild(elText('div', 'Thread Debt', 'ledger-section-title'));

  const table = el('table', 'ledger-thread-table');
  const thead = el('thead');
  const hr = el('tr');
  for (const h of ['Thread', 'Type', 'Temp', 'Debt', 'Silent', 'Status']) {
    hr.appendChild(elText('th', h));
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el('tbody');
  const rows = diagnostic.threads.filter(t => !t.closed);
  for (const t of rows) {
    const tr = el('tr');
    if (t.debt_score > diagnostic.debtThreshold) tr.classList.add('ledger-row-alert');

    tr.appendChild(elText('td', t.name, 'ledger-thread-name'));
    tr.appendChild(elText('td', t.type));

    const tempTd = elText('td', t.temp);
    tempTd.style.color = PALETTE[t.temp] || PALETTE.ink;
    tr.appendChild(tempTd);

    tr.appendChild(elText('td', t.debt_score.toFixed(1)));
    tr.appendChild(elText('td', `${t.shows_since_advance} shows`));
    tr.appendChild(elText('td', t.never_advanced ? 'never' : ''));

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  section.appendChild(table);

  return section;
}

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function elText(tag, text, className) {
  const e = el(tag, className);
  e.textContent = text;
  return e;
}
