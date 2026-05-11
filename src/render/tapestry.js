import { PALETTE, TAPESTRY as T } from './theme.js';
import { computeTemperature } from '../compute/temperature.js';
import { computeDebt } from '../compute/debt.js';

export function renderTapestry(container, { shows, threads, characters, mode = 'threads' }) {
  const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return;

  const charMap = new Map(characters.map(c => [c.id, c]));

  container.innerHTML = '';

  if (mode === 'characters') {
    renderCharacterMode(container, sorted, threads, characters, charMap);
  } else {
    renderThreadMode(container, sorted, threads, characters, charMap);
  }
}

function renderThreadMode(container, sorted, threads, characters, charMap) {
  const threadIndex = buildThreadIndex(sorted, threads);
  const activeThreads = threads.filter(t => threadIndex.has(t.id));
  activeThreads.sort((a, b) => {
    const ai = threadIndex.get(a.id);
    const bi = threadIndex.get(b.id);
    return ai.firstShow - bi.firstShow || a.name.localeCompare(b.name);
  });

  const cols = sorted.length;
  const rows = activeThreads.length;

  const width = T.marginLeft + cols * (T.colWidth + T.colPad) + T.marginRight;
  const height = T.marginTop + rows * (T.rowHeight + T.rowPad) + T.marginBottom;

  const svg = d3.create('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .style('font-family', "'EB Garamond', Georgia, serif");

  svg.append('defs');
  const tooltip = d3.select(container).append('div')
    .attr('class', 'skein-tooltip')
    .style('display', 'none');

  drawColumnHeaders(svg, sorted);
  drawRowLabels(svg, activeThreads, threadIndex, sorted);
  drawGrid(svg, rows, cols, width);
  drawThreadLines(svg, activeThreads, threadIndex, sorted);
  drawCarrierDots(svg, activeThreads, threadIndex, sorted, charMap, tooltip);

  container.appendChild(svg.node());
}

function renderCharacterMode(container, sorted, threads, characters, charMap) {
  const charIndex = buildCharIndex(sorted);
  const activeChars = characters.filter(c => charIndex.has(c.id));
  activeChars.sort((a, b) => {
    const ai = charIndex.get(a.id);
    const bi = charIndex.get(b.id);
    return bi.segCount - ai.segCount || a.name.localeCompare(b.name);
  });

  const threadMap = new Map(threads.map(t => [t.id, t]));
  const cols = sorted.length;
  const rows = activeChars.length;

  const width = T.marginLeft + cols * (T.colWidth + T.colPad) + T.marginRight;
  const height = T.marginTop + rows * (T.rowHeight + T.rowPad) + T.marginBottom;

  const svg = d3.create('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .style('font-family', "'EB Garamond', Georgia, serif");

  svg.append('defs');
  const tooltip = d3.select(container).append('div')
    .attr('class', 'skein-tooltip')
    .style('display', 'none');

  drawColumnHeaders(svg, sorted);
  drawCharRowLabels(svg, activeChars, charIndex);
  drawGrid(svg, rows, cols, width);
  drawCharLines(svg, activeChars, charIndex, sorted);
  drawCharDots(svg, activeChars, charIndex, sorted, threadMap, tooltip);

  container.appendChild(svg.node());
}

function buildThreadIndex(sorted, threads) {
  const index = new Map();
  for (let si = 0; si < sorted.length; si++) {
    const show = sorted[si];
    for (const seg of show.segments) {
      const allThreadIds = [
        ...(seg.threads_advanced || []),
        ...(seg.threads_opened || []),
        ...(seg.threads_closed || []),
        ...(seg.threads_transformed || []),
      ];
      for (const tid of allThreadIds) {
        if (!index.has(tid)) {
          index.set(tid, { firstShow: si, lastShow: si, showSet: new Set([si]), closedAt: null, transformedAt: null });
        }
        const entry = index.get(tid);
        entry.lastShow = Math.max(entry.lastShow, si);
        entry.showSet.add(si);
        if ((seg.threads_closed || []).includes(tid)) entry.closedAt = si;
        if ((seg.threads_transformed || []).includes(tid)) entry.transformedAt = si;
      }
    }
  }
  return index;
}

function colX(colIdx) {
  return T.marginLeft + colIdx * (T.colWidth + T.colPad) + T.colWidth / 2;
}

function rowY(rowIdx) {
  return T.marginTop + rowIdx * (T.rowHeight + T.rowPad) + T.rowHeight / 2;
}

function drawColumnHeaders(svg, sorted) {
  const g = svg.append('g').attr('class', 'col-headers');
  sorted.forEach((show, i) => {
    const x = colX(i);
    const label = show.show
      ? `${show.show} ${show.date.slice(5)}`
      : show.id;
    g.append('text')
      .attr('x', x)
      .attr('y', T.marginTop - 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', PALETTE.ink)
      .attr('font-style', 'italic')
      .text(label);
    g.append('line')
      .attr('x1', x).attr('x2', x)
      .attr('y1', T.marginTop - 4)
      .attr('y2', T.marginTop + 6)
      .attr('stroke', PALETTE.accent)
      .attr('stroke-width', 1.5);
  });
}

function drawRowLabels(svg, activeThreads, threadIndex, sorted) {
  const g = svg.append('g').attr('class', 'row-labels');
  activeThreads.forEach((thread, ri) => {
    const temp = computeTemperature(thread, sorted);
    const info = threadIndex.get(thread.id);
    const color = info.closedAt !== null ? PALETTE.closed : PALETTE[temp];

    g.append('text')
      .attr('x', T.marginLeft - 12)
      .attr('y', rowY(ri) + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('fill', color)
      .text(truncate(thread.name, 26));
  });
}

function drawGrid(svg, rows, cols, width) {
  const g = svg.append('g').attr('class', 'grid');
  for (let ri = 0; ri < rows; ri++) {
    const y = rowY(ri);
    g.append('line')
      .attr('x1', T.marginLeft - 8).attr('x2', width - T.marginRight)
      .attr('y1', y).attr('y2', y)
      .attr('stroke', PALETTE.gridLine)
      .attr('stroke-width', 0.5);
  }
}

function drawThreadLines(svg, activeThreads, threadIndex, sorted) {
  const g = svg.append('g').attr('class', 'thread-lines');

  activeThreads.forEach((thread, ri) => {
    const info = threadIndex.get(thread.id);
    const temp = computeTemperature(thread, sorted);
    const y = rowY(ri);
    const isClosed = info.closedAt !== null;

    const x1 = colX(info.firstShow);
    const x2 = colX(info.lastShow);

    if (info.transformedAt !== null && info.transformedAt > info.firstShow) {
      const xTransform = colX(info.transformedAt);
      g.append('line')
        .attr('x1', x1).attr('x2', xTransform)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', PALETTE[temp])
        .attr('stroke-width', T.lineWidth)
        .attr('stroke-opacity', 0.85);
      g.append('line')
        .attr('x1', xTransform).attr('x2', x2)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', PALETTE.split)
        .attr('stroke-width', T.lineWidth)
        .attr('stroke-dasharray', '6,3')
        .attr('stroke-opacity', 0.85);
    } else {
      const color = isClosed ? PALETTE.closed : PALETTE[temp];
      g.append('line')
        .attr('x1', x1).attr('x2', x2)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', color)
        .attr('stroke-width', T.lineWidth)
        .attr('stroke-opacity', isClosed ? 0.5 : 0.85);
    }

    if (isClosed) {
      const xEnd = colX(info.closedAt);
      g.append('line')
        .attr('x1', xEnd).attr('x2', xEnd)
        .attr('y1', y - T.closedTickSize / 2)
        .attr('y2', y + T.closedTickSize / 2)
        .attr('stroke', PALETTE.closed)
        .attr('stroke-width', 2);
    }
  });
}

function drawCarrierDots(svg, activeThreads, threadIndex, sorted, charMap, tooltip) {
  const g = svg.append('g').attr('class', 'carrier-dots');

  activeThreads.forEach((thread, ri) => {
    const y = rowY(ri);

    for (let si = 0; si < sorted.length; si++) {
      const show = sorted[si];
      for (const seg of show.segments) {
        const advanced = (seg.threads_advanced || []).includes(thread.id);
        const opened = (seg.threads_opened || []).includes(thread.id);
        const closed = (seg.threads_closed || []).includes(thread.id);
        const transformed = (seg.threads_transformed || []).includes(thread.id);
        if (!advanced && !opened && !closed && !transformed) continue;

        const x = colX(si);
        const standColor = seg.stand_tall === 'babyface' ? PALETTE.face
          : seg.stand_tall === 'heel' ? PALETTE.heel
          : seg.stand_tall === 'split' ? PALETTE.split
          : PALETTE.ink;

        const dot = g.append('circle')
          .attr('cx', x).attr('cy', y)
          .attr('r', T.dotRadius)
          .attr('fill', standColor)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer');

        const carrierNames = (seg.carriers || [])
          .map(cid => charMap.get(cid)?.name || cid)
          .join(', ');
        const actions = [];
        if (opened) actions.push('opened');
        if (advanced) actions.push('advanced');
        if (transformed) actions.push('transformed');
        if (closed) actions.push('closed');

        dot.on('mouseenter', (event) => {
          tooltip
            .style('display', 'block')
            .html(`
              <strong>${thread.name}</strong><br>
              <span style="color:${PALETTE.accent}">${show.show || show.id} ${show.date}</span><br>
              ${actions.join(', ')} · ${seg.position}<br>
              <em>${carrierNames}</em>
              ${seg.outcome ? `<br><span style="font-size:11px;color:#666">${truncate(seg.outcome, 100)}</span>` : ''}
            `)
            .style('left', (event.pageX + 12) + 'px')
            .style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseleave', () => tooltip.style('display', 'none'));
      }
    }
  });
}

function buildCharIndex(sorted) {
  const index = new Map();
  for (let si = 0; si < sorted.length; si++) {
    const show = sorted[si];
    for (const seg of show.segments) {
      for (const cid of (seg.carriers || [])) {
        if (!index.has(cid)) {
          index.set(cid, { firstShow: si, lastShow: si, showSet: new Set(), segCount: 0 });
        }
        const entry = index.get(cid);
        entry.lastShow = Math.max(entry.lastShow, si);
        entry.showSet.add(si);
        entry.segCount++;
      }
    }
  }
  return index;
}

function drawCharRowLabels(svg, activeChars, charIndex) {
  const g = svg.append('g').attr('class', 'row-labels');
  activeChars.forEach((char, ri) => {
    const info = charIndex.get(char.id);
    const color = char.alignment === 'babyface' ? PALETTE.face
      : char.alignment === 'heel' ? PALETTE.heel
      : PALETTE.ink;

    g.append('text')
      .attr('x', T.marginLeft - 12)
      .attr('y', rowY(ri) + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('fill', color)
      .text(truncate(char.name, 26));
  });
}

function drawCharLines(svg, activeChars, charIndex, sorted) {
  const g = svg.append('g').attr('class', 'char-lines');
  activeChars.forEach((char, ri) => {
    const info = charIndex.get(char.id);
    const y = rowY(ri);
    const color = char.alignment === 'babyface' ? PALETTE.face
      : char.alignment === 'heel' ? PALETTE.heel
      : PALETTE.ink;

    g.append('line')
      .attr('x1', colX(info.firstShow))
      .attr('x2', colX(info.lastShow))
      .attr('y1', y).attr('y2', y)
      .attr('stroke', color)
      .attr('stroke-width', T.lineWidth)
      .attr('stroke-opacity', 0.6);
  });
}

function drawCharDots(svg, activeChars, charIndex, sorted, threadMap, tooltip) {
  const g = svg.append('g').attr('class', 'char-dots');

  activeChars.forEach((char, ri) => {
    const y = rowY(ri);

    for (let si = 0; si < sorted.length; si++) {
      const show = sorted[si];
      for (const seg of show.segments) {
        if (!(seg.carriers || []).includes(char.id)) continue;

        const x = colX(si);
        const standColor = seg.stand_tall === 'babyface' ? PALETTE.face
          : seg.stand_tall === 'heel' ? PALETTE.heel
          : seg.stand_tall === 'split' ? PALETTE.split
          : PALETTE.ink;

        const dot = g.append('circle')
          .attr('cx', x).attr('cy', y)
          .attr('r', T.dotRadius)
          .attr('fill', standColor)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer');

        const threadNames = [
          ...(seg.threads_advanced || []),
          ...(seg.threads_opened || []),
          ...(seg.threads_closed || []),
          ...(seg.threads_transformed || []),
        ].map(tid => threadMap.get(tid)?.name || tid);

        const otherCarriers = (seg.carriers || [])
          .filter(cid => cid !== char.id)
          .map(cid => {
            const c = charIndex.get(cid);
            return cid;
          });

        dot.on('mouseenter', (event) => {
          tooltip
            .style('display', 'block')
            .html(`
              <strong>${char.name}</strong><br>
              <span style="color:${PALETTE.accent}">${show.show || show.id} ${show.date}</span><br>
              ${seg.type} · ${seg.position} · ${seg.stand_tall}<br>
              ${threadNames.length ? `<em>Threads: ${threadNames.join(', ')}</em><br>` : ''}
              ${seg.outcome ? `<span style="font-size:11px;color:#666">${truncate(seg.outcome, 100)}</span>` : ''}
            `)
            .style('left', (event.pageX + 12) + 'px')
            .style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseleave', () => tooltip.style('display', 'none'));
      }
    }
  });
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
