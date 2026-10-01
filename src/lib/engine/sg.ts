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

/* ----- Droit du travail (Employment Act) et épargne : pages ajoutées le 2026-10-01 ----- */
const E = P.employment;
/** Taux journalier MOM : 12 × mensuel ÷ (52 × jours travaillés par semaine). */
export const dailyRate = (monthly: number, daysPerWeek = 5) => (P.hourly.months * Math.max(0, monthly)) / (P.hourly.weeks * Math.max(1, daysPerWeek));

/** Heures supplémentaires : 1,5 × le taux horaire de base, pour les salariés couverts par la partie IV. */
export function overtimePay(o: { basic: number; hours: number; workman?: boolean }) {
  const W = P.wages; const ceiling = o.workman ? W.workman_ot_ceiling : W.nonworkman_ot_ceiling;
  const covered = o.basic <= ceiling;
  const base = o.workman ? o.basic : Math.min(o.basic, W.nonworkman_ot_ceiling);
  const hourly = hourlyFromMonthly(Math.max(0, base));
  const hours = Math.min(Math.max(0, o.hours), W.ot_hours_cap);
  const rate = round2(hourly * P.hourly.ot_multiplier);
  return { covered, hourly: round2(hourly), rate, hours, pay: covered ? round2(hourly * P.hourly.ot_multiplier * hours) : 0, ceiling };
}

/** Congés annuels légaux : 7 jours la première année, un de plus par année, 14 au maximum ; prorata par mois complets. */
export function annualLeave(o: { yearOfService: number; completedMonths?: number; contractDays?: number }) {
  const A = E.annual_leave; const y = Math.max(1, Math.floor(o.yearOfService));
  const statutory = Math.min(A.max_days, A.first_year_days + y - 1);
  const entitlement = Math.max(statutory, o.contractDays ?? 0);
  const m = Math.min(12, Math.max(0, Math.floor(o.completedMonths ?? 12)));
  const raw = (m / 12) * entitlement; const frac = raw - Math.floor(raw);
  const prorated = m < A.min_service_months ? 0 : Math.floor(raw) + (frac >= 0.5 ? 1 : 0);
  return { statutory, entitlement, prorated };
}
/** Congés non pris payés au départ : taux journalier brut × jours. */
export const encashLeave = (o: { monthly: number; days: number; daysPerWeek?: number }) => { const d = dailyRate(o.monthly, o.daysPerWeek ?? 5); return { daily: round2(d), pay: round2(d * Math.max(0, o.days)) }; };
/** Mois incomplet : salaire mensuel × jours travaillés ÷ jours ouvrés du mois. */
export const proRated = (o: { monthly: number; worked: number; working: number }) => round2(Math.max(0, o.monthly) * Math.min(Math.max(0, o.worked), o.working) / Math.max(1, o.working));
/** Jour férié travaillé : un jour de salaire de base en plus du salaire mensuel. */
export const publicHolidayPay = (o: { basic: number; daysPerWeek?: number }) => round2(dailyRate(o.basic, o.daysPerWeek ?? 5));

/** Préavis légal à défaut de clause, et indemnité compensatrice au taux brut. */
export function noticePeriod(o: { serviceWeeks: number; monthly: number; daysPerWeek?: number }) {
  const row = E.notice.find((r) => r.service_weeks_below === null || o.serviceWeeks < r.service_weeks_below)!;
  const dpw = o.daysPerWeek ?? 5; const days = row.days + row.weeks * dpw;
  return { label: row.label, days: row.days, weeks: row.weeks, workingDays: days, inLieu: round2(dailyRate(o.monthly, dpw) * days) };
}

/** Congé maternité payé : 16 semaines (enfant citoyen) ; l'État rembourse 2 500 $ par semaine au plus. */
export function maternityPay(o: { monthly: number; citizenChild?: boolean; thirdChildOrMore?: boolean }) {
  const M = E.maternity; const weeks = (o.citizenChild ?? true) ? M.weeks_citizen_child : M.weeks_other;
  const weekly = (P.hourly.months * Math.max(0, o.monthly)) / P.hourly.weeks;
  const govWeeks = (o.citizenChild ?? true) ? (o.thirdChildOrMore ? weeks : weeks - M.employer_weeks) : 0;
  const employerWeeks = (o.citizenChild ?? true) ? weeks - govWeeks : M.employer_weeks;
  const paidWeeks = (o.citizenChild ?? true) ? weeks : M.employer_weeks;
  const governmentPaid = round2(Math.min(weekly, M.cap_per_week) * govWeeks);
  return { weeks, paidWeeks, weekly: round2(weekly), governmentPaid, employerPaid: round2(weekly * employerWeeks), total: round2(weekly * employerWeeks + governmentPaid), capped: weekly > M.cap_per_week };
}

/** Congé maladie payé selon les mois de service : rien avant 3 mois, plein droit à 6 mois. */
export function sickLeave(serviceMonths: number) {
  const m = Math.floor(serviceMonths); const rows = E.sick_leave.prorate;
  if (m < rows[0].months) return { outpatient: 0, hospitalisation: 0 };
  const row = [...rows].reverse().find((r) => m >= r.months)!;
  return { outpatient: row.outpatient, hospitalisation: row.hospitalisation };
}

/** Indemnité de licenciement économique : usage de 2 semaines à 1 mois de salaire par année de service. */
export function retrenchment(o: { monthly: number; years: number }) {
  const R = E.retrenchment; const y = Math.max(0, o.years);
  const week = (P.hourly.months * Math.max(0, o.monthly)) / P.hourly.weeks;
  return { eligible: y >= R.min_years, low: round2(week * R.weeks_per_year_low * y), high: round2(o.monthly * R.months_per_year_high * y) };
}

/** Économie d'impôt d'une déduction (SRS, versement volontaire CPF) pour un résident salarié. */
export function reliefSaving(o: { annualIncome: number; age: number; relief: number; status?: Status }) {
  const base = { monthly: Math.max(0, o.annualIncome) / 12, age: o.age, status: o.status ?? 'SC' as Status };
  const a = compute(base).annual; const b = compute({ ...base, otherReliefs: Math.max(0, o.relief) }).annual;
  return { before: a.tax, after: b.tax, saving: round2(a.tax - b.tax), marginal: a.marginal, usable: round2(b.reliefs.total - a.reliefs.total) };
}
export const srsCap = (foreigner: boolean) => (foreigner ? P.srs.cap_foreigner : P.srs.cap_citizen_pr);

/** Intérêts CPF d'une année : taux de base par compte, plus l'intérêt supplémentaire sur les premiers 60 000 $. */
export function cpfInterest(o: { oa: number; sma: number; age: number }) {
  const I = P.cpf_interest; const oa = Math.max(0, o.oa); const sma = Math.max(0, o.sma);
  const base = round2(oa * I.oa + sma * I.sma);
  const eligible = Math.min(I.extra_first, Math.min(oa, I.extra_oa_cap) + sma);
  const extra = o.age >= P.cpf_withdrawal.age
    ? round2(Math.min(eligible, I.extra55_first) * I.extra55_rate + Math.max(0, eligible - I.extra55_first) * I.extra_rate)
    : round2(eligible * I.extra_rate);
  return { base, extra, total: round2(base + extra), rate: oa + sma > 0 ? (base + extra) / (oa + sma) : 0 };
}

/** À 55 ans : le Retirement Account reçoit jusqu'au Full Retirement Sum ; le reste, et au moins 5 000 $, est retirable. */
export function withdrawalAt55(o: { oa: number; sa: number }) {
  const total = Math.max(0, o.oa) + Math.max(0, o.sa); const frs = P.cpf.retirement_sums_2026.frs;
  const ra = Math.min(total, frs);
  const withdrawable = round2(Math.max(Math.min(P.cpf_withdrawal.unconditional, total), total - frs));
  return { total, ra: round2(Math.min(ra, total - Math.min(withdrawable, total))), withdrawable, metFrs: total >= frs };
}
