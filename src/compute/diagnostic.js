import { computeTemperature } from './temperature.js';
import { computeDebt } from './debt.js';
import { computeStandTallLedger } from './stand-tall.js';
import { computeFragmentationIndex } from './fragmentation.js';
import { computeCarrierLoad } from './carrier-load.js';

export function computeDiagnostic(shows, threads, characters) {
  const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
  const totalSegs = sorted.reduce((s, sh) => s + sh.segments.length, 0);

  const standTall = computeStandTallLedger(sorted);
  const fragmentation = computeFragmentationIndex(threads, characters, sorted);
  const carrierLoad = computeCarrierLoad(characters, threads, sorted);

  const threadRows = threads.map(t => {
    const temp = computeTemperature(t, sorted);
    const debt = computeDebt(t, sorted);
    return { id: t.id, name: t.name, type: t.type, temp, ...debt };
  });
  threadRows.sort((a, b) => b.debt_score - a.debt_score);

  const debtThreshold = sorted.length * 0.75;
  const peakDebt = Math.max(0, ...threadRows.map(r => r.debt_score));

  const hot = threadRows.filter(r => r.temp === 'hot').length;
  const warm = threadRows.filter(r => r.temp === 'warm').length;
  const dormant = threadRows.filter(r => r.temp === 'dormant').length;

  const alerts = buildAlerts(standTall, fragmentation, carrierLoad, threadRows, debtThreshold);

  return {
    corpus: {
      shows: sorted.length,
      segments: totalSegs,
      dateRange: sorted.length ? `${sorted[0].date} → ${sorted[sorted.length - 1].date}` : '',
    },
    standTall,
    fragmentation,
    carrierLoad,
    threads: threadRows,
    temperature: { hot, warm, dormant },
    peakDebt,
    debtThreshold,
    alerts,
  };
}

function buildAlerts(standTall, fragmentation, carrierLoad, threadRows, debtThreshold) {
  const alerts = [];

  if (standTall.graded >= 5 && standTall.graded_heel_share > 0.55) {
    alerts.push({
      type: 'heel-dominance',
      severity: 'warn',
      message: `Heel-side dominant: ${standTall.heel}/${standTall.graded} graded stand-talls heel-coded (${(standTall.graded_heel_share * 100).toFixed(0)}%)`,
    });
  }

  if (fragmentation.fragmentation_index >= 3) {
    alerts.push({
      type: 'face-fragmentation',
      severity: 'info',
      message: `Babyface federation: ${fragmentation.fragmentation_index} disjoint face-thread components — faces don't share carriers`,
    });
  }

  if (carrierLoad.overloaded.length) {
    for (const c of carrierLoad.overloaded) {
      alerts.push({
        type: 'carrier-overload',
        severity: 'warn',
        message: `${c.name} overloaded: ${c.active_threads} active threads (${c.threads.join(', ')})`,
      });
    }
  }

  const debtors = threadRows.filter(r => r.debt_score > debtThreshold && !r.closed);
  if (debtors.length) {
    for (const d of debtors) {
      alerts.push({
        type: 'high-debt',
        severity: 'warn',
        message: `${d.name} — debt ${d.debt_score.toFixed(1)} (${d.shows_since_advance} shows silent, ${d.payoff_weight}× weight)`,
      });
    }
  }

  const dormantHighPayoff = threadRows.filter(r =>
    r.temp === 'dormant' && !r.closed && r.payoff_weight >= 1.5
  );
  if (dormantHighPayoff.length) {
    alerts.push({
      type: 'dormant-payoff',
      severity: 'info',
      message: `${dormantHighPayoff.length} dormant thread(s) with promised payoff: ${dormantHighPayoff.map(d => d.name).join(', ')}`,
    });
  }

  return alerts;
}
