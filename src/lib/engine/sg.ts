/**
 * Moteur Singapour : CPF (5 tables officielles 2026, changements 2027), allocation
 * OA/SA/RA/MA, impôt IRAS (YA 2027 sur les revenus 2026), SDL, conversion horaire MOM.
 * Fonctions pures, aucun réseau. Tous les paramètres viennent de params-2026.json.
 */
import P from '../../data/params-2026.json';

export type Status = 'SC' | 'SPR1_GG' | 'SPR2_GG' | 'SPR1_FG' | 'SPR2_FG' | 'FOREIGNER';
export type Band = '55_below' | '55_60' | '60_65' | '65_70' | '70_above';
export interface Rate { total: number; employee: number; employer_low: number; phase_k: number; max_total: number; max_employee: number }

const C = P.cpf;
export const OW_CEILING = C.ow_ceiling_month;
export const ANNUAL_CEILING = C.annual_salary_ceiling;

/** Tranche d'âge CPF : « 55 & below », « above 55 to 60 »… (l'âge s'entend en années révolues). */
export function ageBand(age: number): Band {
  if (age <= 55) return '55_below';
  if (age <= 60) return '55_60';
  if (age <= 65) return '60_65';
  if (age <= 70) return '65_70';
  return '70_above';
}

export function ratesFor(status: Exclude<Status, 'FOREIGNER'>, band: Band, year: 2026 | 2027 = 2026): Rate {
  const base = (C.tables as Record<string, { rates: Record<Band, Rate> }>)[status].rates[band];
  if (year === 2027 && status === 'SC' && (band === '55_60' || band === '60_65')) {
    const n = (C.changes_2027.SC as Record<string, { total: number; employee: number; employer_low: number }>)[band];
    // Le CPF Board annonce que les taux « phased-in » (500–750 $) augmentent en proportion :
    // le coefficient suit le rapport des parts salariales.
    const k = base.phase_k * (n.employee / base.employee);
    return { total: n.total, employee: n.employee, employer_low: n.employer_low, phase_k: k,
      max_total: Math.round(n.total * OW_CEILING), max_employee: Math.round(n.employee * OW_CEILING) };
  }
  return base;
}

/** Arrondi CPF du total : au dollar le plus proche (0,50 arrondi au-dessus). */
const roundNearest = (x: number) => Math.floor(x + 0.5 + 1e-9);
/** Part salariale : arrondie au dollar inférieur. */
const roundDown = (x: number) => Math.floor(x + 1e-9);
const round2 = (x: number) => Math.round(x * 100) / 100;

export interface CpfMonth { tw: number; total: number; employee: number; employer: number; band: Band; rule: 'nil' | 'employer_only' | 'phase_in' | 'full' | 'foreigner' }

/** Cotisations CPF d'un mois : OW (salaire ordinaire) et AW (salaire additionnel déjà plafonné). */
export function cpfMonth(o: { ow: number; aw?: number; age: number; status: Status; year?: 2026 | 2027 }): CpfMonth {
  const aw = Math.max(0, o.aw ?? 0); const ow = Math.max(0, o.ow);
  const tw = ow + aw; const band = ageBand(o.age);
  if (o.status === 'FOREIGNER') return { tw, total: 0, employee: 0, employer: 0, band, rule: 'foreigner' };
  const r = ratesFor(o.status, band, o.year ?? 2026);
  if (tw <= C.tw_nil_max) return { tw, total: 0, employee: 0, employer: 0, band, rule: 'nil' };
  if (tw <= C.tw_employer_only_max) {
    const total = roundNearest(r.employer_low * tw);
    return { tw, total, employee: 0, employer: total, band, rule: 'employer_only' };
  }
  if (tw <= C.tw_phase_in_max) {
    const total = roundNearest(r.employer_low * tw + r.phase_k * (tw - C.tw_employer_only_max));
    const employee = roundDown(r.phase_k * (tw - C.tw_employer_only_max));
    return { tw, total, employee, employer: total - employee, band, rule: 'phase_in' };
  }
  const owC = Math.min(ow, OW_CEILING);
  const total = roundNearest(Math.min(r.total * owC, r.max_total) + r.total * aw);
  const employee = roundDown(Math.min(r.employee * owC, r.max_employee) + r.employee * aw);
  return { tw, total, employee, employer: total - employee, band, rule: 'full' };
}

export type AllocBand = '35_below' | '35_45' | '45_50' | '50_55' | '55_60' | '60_65' | '65_70' | '70_above';
export function allocBand(age: number): AllocBand {
  if (age <= 35) return '35_below';
  if (age <= 45) return '35_45';
  if (age <= 50) return '45_50';
  if (age <= 55) return '50_55';
  if (age <= 60) return '55_60';
  if (age <= 65) return '60_65';
  if (age <= 70) return '65_70';
  return '70_above';
}
export interface Allocation { oa: number; sa: number; ma: number; second: 'SA' | 'RA' }
/** Répartition d'une cotisation : MediSave d'abord, puis SA (ou RA dès 55 ans), le reste à l'OA. */
export function allocate(total: number, age: number): Allocation {
  const a = (C.allocation as Record<AllocBand, { oa: number; sa: number; ma: number; second: string }>)[allocBand(age)];
  const ma = round2(total * a.ma); const sa = round2(total * a.sa);
  return { oa: round2(total - ma - sa), sa, ma, second: a.second as 'SA' | 'RA' };
}

/** Impôt au barème des résidents (YA 2024 et suivants). */
export function residentTax(chargeable: number): number {
  let tax = 0, prev = 0;
  for (const b of P.tax.resident_brackets) {
    const top = b.upto ?? Infinity;
    if (chargeable > prev) tax += (Math.min(chargeable, top) - prev) * b.rate;
    prev = top; if (chargeable <= top) break;
  }
  return round2(tax);
}
export function marginalRate(chargeable: number): number {
  for (const b of P.tax.resident_brackets) if (chargeable <= (b.upto ?? Infinity)) return b.rate;
  return 0;
}
export function earnedIncomeRelief(age: number, earned: number): number {
  const row = P.tax.earned_income_relief.find((r) => age < r.age_below)!;
  return Math.min(row.amount, Math.max(0, earned));
}

/** SDL mensuel payé par l'employeur (0,25 % des 4 500 premiers dollars, min 2 $, max 11,25 $). */
export function sdlMonth(tw: number): number {
  if (tw <= 0) return 0;
  if (tw <= P.sdl.min_threshold) return P.sdl.min;
  return Math.min(P.sdl.max, round2(P.sdl.rate * Math.min(tw, P.sdl.wage_cap)));
}

/** Taux horaire de base MOM : 12 × mensuel ÷ (52 × 44). */
export const hourlyFromMonthly = (m: number) => (P.hourly.months * m) / (P.hourly.weeks * P.hourly.hours_per_week);
export const monthlyFromHourly = (h: number) => (h * P.hourly.weeks * P.hourly.hours_per_week) / P.hourly.months;

export interface Input {
  monthly: number;            // salaire mensuel ordinaire (OW)
  bonus?: number;             // salaire additionnel annuel (AW : bonus, 13e mois), versé en décembre
  age: number;
  status: Status;
  year?: 2026 | 2027;
  taxResident?: boolean;      // résident fiscal (183 jours), vrai par défaut pour SC/SPR
  otherReliefs?: number;      // autres reliefs déclarés (enfant, conjoint, SRS…)
}
export interface Result {
  monthly: CpfMonth; bonusMonth: CpfMonth; awSubject: number; awCeiling: number;
  takeHomeMonthly: number;
  annual: { gross: number; cpfEmployee: number; cpfEmployer: number; cpfTotal: number; sdl: number; employerCost: number;
    reliefs: { eir: number; cpf: number; other: number; total: number; capped: boolean }; chargeable: number; tax: number; taxWithoutBonus: number; taxMethod: 'resident' | 'nr_flat' | 'nr_progressive';
    net: number; effectiveTaxRate: number; marginal: number };
  allocation: Allocation;
}

/**
 * Année complète : 12 mois de salaire ordinaire, le bonus versé en décembre comme AW.
 * Le plafond AW = 102 000 $ − total des OW soumis au CPF dans l'année ; la part du bonus
 * au-delà n'est pas soumise au CPF (mais reste imposable).
 */
export function compute(i: Input): Result {
  const year = i.year ?? 2026; const bonus = Math.max(0, i.bonus ?? 0);
  const monthly = cpfMonth({ ow: i.monthly, age: i.age, status: i.status, year });
  const owSubjectYear = Math.min(i.monthly, OW_CEILING) * 12;
  const awCeiling = Math.max(0, ANNUAL_CEILING - owSubjectYear);
  const awSubject = Math.min(bonus, awCeiling);
  const bonusMonth = cpfMonth({ ow: i.monthly, aw: awSubject, age: i.age, status: i.status, year });
  const cpfEmployee = monthly.employee * 11 + bonusMonth.employee;
  const cpfEmployer = monthly.employer * 11 + bonusMonth.employer;
  const gross = i.monthly * 12 + bonus;
  const sdl = round2(sdlMonth(i.monthly) * 11 + sdlMonth(i.monthly + bonus));
  const resident = i.taxResident ?? true;
  let tax = 0, chargeable = gross, taxMethod: Result['annual']['taxMethod'] = 'resident';
  const eir = resident ? earnedIncomeRelief(i.age, gross) : 0;
  const cpfRelief = resident && i.status !== 'FOREIGNER' ? cpfEmployee : 0;
  const other = resident ? Math.max(0, i.otherReliefs ?? 0) : 0;
  const rawReliefs = eir + cpfRelief + other;
  const totalReliefs = Math.min(P.tax.relief_cap, rawReliefs);
  if (resident) {
    chargeable = Math.max(0, gross - totalReliefs);
    tax = residentTax(chargeable);
    tax = round2(tax - Math.min(tax * P.tax.rebate.rate, P.tax.rebate.cap));
  } else {
    const flat = round2(gross * P.tax.non_resident_employment_flat);
    const prog = residentTax(gross);
    tax = Math.max(flat, prog); taxMethod = flat >= prog ? 'nr_flat' : 'nr_progressive';
  }
  const net = round2(gross - cpfEmployee - tax);
  const taxWithoutBonus = bonus > 0 ? compute({ ...i, bonus: 0 }).annual.tax : tax;
  return {
    monthly, bonusMonth, awSubject, awCeiling,
    takeHomeMonthly: round2(i.monthly - monthly.employee),
    annual: { gross, cpfEmployee, cpfEmployer, cpfTotal: cpfEmployee + cpfEmployer, sdl, employerCost: round2(gross + cpfEmployer + sdl),
      reliefs: { eir, cpf: cpfRelief, other, total: totalReliefs, capped: rawReliefs > P.tax.relief_cap }, chargeable, tax, taxWithoutBonus, taxMethod,
      net, effectiveTaxRate: gross > 0 ? tax / gross : 0, marginal: resident ? marginalRate(chargeable) : P.tax.non_resident_employment_flat },
    allocation: allocate(monthly.total * 11 + bonusMonth.total, i.age),
  };
}

/** Salaire brut mensuel nécessaire pour un salaire net mensuel (après CPF salarié) donné. */
export function grossForTakeHome(target: number, o: { age: number; status: Status; year?: 2026 | 2027 }): number {
  if (target <= 0) return 0;
  let lo = target, hi = target * 2 + 2000;
  for (let n = 0; n < 80; n++) {
    const mid = (lo + hi) / 2;
    const th = mid - cpfMonth({ ow: mid, age: o.age, status: o.status, year: o.year }).employee;
    if (th < target) lo = mid; else hi = mid;
  }
  return Math.round(hi * 100) / 100;
}
