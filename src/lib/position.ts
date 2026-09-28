/** Places a gross monthly salary against MOM's 2025 income figures, net of employer CPF. */
import { P, cpf } from './tables';
import { formatMoney, formatPercent } from './format';
const W = P.wages;
const gross = (withCpf: number) => { let lo = 0, hi = withCpf; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (m + cpf(m).employer < withCpf) lo = m; else hi = m; } return Math.round(hi / 100) * 100; };
export const MEDIAN = gross(W.mom_median_2025); export const P20 = gross(W.mom_p20_2025);
export function position(monthly: number): string {
  const x = monthly / MEDIAN - 1;
  const rel = Math.abs(x) < 0.005 ? `in line with the median of about ${formatMoney(MEDIAN)}` : `${formatPercent(Math.abs(x), 0)} ${x > 0 ? 'above' : 'below'} the median of about ${formatMoney(MEDIAN)}`;
  const zone = monthly < P20 ? 'in the lowest-paid fifth of full-time residents' : monthly < MEDIAN ? 'between the lowest-paid fifth and the middle of full-time residents' : 'in the upper half of full-time residents';
  return `Once the employer’s CPF share is removed, MOM’s June 2025 figures put the median full-time resident salary at about ${formatMoney(MEDIAN)} a month and the 20th percentile at about ${formatMoney(P20)}. A salary of ${formatMoney(Math.round(monthly))} a month is ${rel}, which places it ${zone}. These are estimates based on the published income figures, which include employer CPF.`;
}
