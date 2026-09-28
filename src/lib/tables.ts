/** Exemples chiffrés des pages : toujours produits par le moteur, jamais écrits à la main (RECETTE §4, registre 2026-09-21). */
import { compute, cpfMonth, type Status } from './engine/sg';
import P from '../data/params-2026.json';
export { P };
export const ex = (monthly: number, o: { age?: number; status?: Status; bonus?: number; year?: 2026 | 2027; resident?: boolean } = {}) =>
  compute({ monthly, age: o.age ?? 30, status: o.status ?? 'SC', bonus: o.bonus ?? 0, year: o.year ?? 2026, taxResident: o.resident ?? true });
export const cpf = (ow: number, age = 30, status: Status = 'SC', year: 2026 | 2027 = 2026) => cpfMonth({ ow, age, status, year });

/** La médiane MOM inclut le CPF employeur : salaire brut correspondant (salaire + part employeur sous le plafond). */
export const grossFromMomMedian = (() => { const W = P.wages; let lo = 0, hi = W.mom_median_2025; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (m + cpf(m).employer < W.mom_median_2025) lo = m; else hi = m; } return Math.round(hi); })();
