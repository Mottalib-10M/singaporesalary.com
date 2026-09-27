/** Exemples chiffrés des pages : toujours produits par le moteur, jamais écrits à la main (RECETTE §4, registre 2026-09-21). */
import { compute, cpfMonth, type Status } from './engine/sg';
import P from '../data/params-2026.json';
export { P };
export const ex = (monthly: number, o: { age?: number; status?: Status; bonus?: number; year?: 2026 | 2027; resident?: boolean } = {}) =>
  compute({ monthly, age: o.age ?? 30, status: o.status ?? 'SC', bonus: o.bonus ?? 0, year: o.year ?? 2026, taxResident: o.resident ?? true });
export const cpf = (ow: number, age = 30, status: Status = 'SC', year: 2026 | 2027 = 2026) => cpfMonth({ ow, age, status, year });
