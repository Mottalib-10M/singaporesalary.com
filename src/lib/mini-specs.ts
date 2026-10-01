/** Mini-simulateurs des guides (RECETTE §9.3) : un par sujet, calculés par le moteur singapourien. */
import { compute, allocate, residentTax, marginalRate, earnedIncomeRelief, overtimePay, annualLeave, encashLeave, proRated, publicHolidayPay, noticePeriod, maternityPay, sickLeave, retrenchment, reliefSaving, srsCap, cpfInterest, withdrawalAt55, dailyRate, type Status } from './engine/sg';
import P from '../data/params-2026.json';
import { grossFromMomMedian } from './tables';
import { formatMoney as $, formatPercent as pct } from './format';
import type { MiniSpec } from './mini-types';

const monthly = (def = 5000) => ({ id: 'm', label: 'Gross monthly salary', def, unit: 'S$', max: 1000000 });
const age = (def = 30) => ({ id: 'a', label: 'Your age', def, unit: 'yrs', max: 100 });
const annual = (def = 60000) => ({ id: 'y', label: 'Annual income', def, unit: 'S$', max: 20000000 });
const C = (m: number, a = 30, o: Record<string, unknown> = {}) => compute({ monthly: m, age: a, status: 'SC', ...o } as Parameters<typeof compute>[0]);
const RS = P.cpf.retirement_sums_2026;

const SPECS: Record<string, MiniSpec> = {
  aw: { title: 'CPF on your bonus', cta: 'Bonus tax calculator', inputs: [monthly(), { id: 'b', label: 'Bonus this year', def: 10000, unit: 'S$', max: 5000000 }], run: ({ m, b }) => {
    const r = C(m, 30, { bonus: b }); const onBonus = r.bonusMonth.employee - r.monthly.employee;
    return { head: ['Your CPF on the bonus', $(onBonus)], rows: [['Bonus subject to CPF', $(r.awSubject)], ['Additional Wage ceiling left', $(r.awCeiling)], ['Employer CPF on the bonus', $(r.bonusMonth.employer - r.monthly.employer)]] };
  } },
  average: { title: 'Compare your salary with the median', cta: 'Take-home pay calculator', inputs: [monthly(Math.round(grossFromMomMedian / 100) * 100)], run: ({ m }) => {
    const r = C(m); const d = m / grossFromMomMedian - 1;
    return { head: ['Take-home pay per month', $(r.takeHomeMonthly)], rows: [['Against the median (MOM, without employer CPF)', `${d >= 0 ? '+' : '−'}${pct(Math.abs(d), 0)}`], ['Your CPF per month', $(r.monthly.employee)], ['Income tax per year', $(r.annual.tax)]] };
  } },
  alloc: { title: 'Where your CPF goes each month', cta: 'CPF calculator', inputs: [monthly(), age(35)], run: ({ m, a }) => {
    const r = C(m, a); const al = allocate(r.monthly.total, a);
    return { head: ['Total CPF per month', $(r.monthly.total)], rows: [['Ordinary Account', $(al.oa)], [al.second === 'RA' ? 'Retirement Account' : 'Special Account', $(al.sa)], ['MediSave', $(al.ma)]] };
  } },
  cpf2027: { title: 'Your CPF in 2026 and 2027', cta: 'CPF contribution calculator', inputs: [monthly(), age(58)], run: ({ m, a }) => {
    const x = C(m, a); const y = C(m, a, { year: 2027 });
    return { head: ['Change in your CPF per month', `${y.monthly.employee >= x.monthly.employee ? '+' : '−'}${$(Math.abs(y.monthly.employee - x.monthly.employee))}`], rows: [['Your CPF in 2026', $(x.monthly.employee)], ['Your CPF in 2027', $(y.monthly.employee)], ['Employer CPF in 2027', $(y.monthly.employer)]] };
  } },
  cpf: { title: 'Your CPF contribution', cta: 'CPF calculator', inputs: [monthly(), age()], run: ({ m, a }) => {
    const r = C(m, a); return { head: ['Your CPF per month', $(r.monthly.employee)], rows: [['Employer CPF', $(r.monthly.employer)], ['Total CPF', $(r.monthly.total)], ['Take-home pay', $(r.takeHomeMonthly)]] };
  } },
  retirement: { title: 'How far your CPF goes towards the FRS', cta: 'CPF calculator', inputs: [monthly(), age(40)], run: ({ m, a }) => {
    const r = C(m, a); const year = r.annual.cpfTotal;
    return { head: ['Years of contributions to equal the FRS', year ? (RS.frs / year).toFixed(1) : '–'], rows: [['CPF paid in per year, all accounts', $(year)], ['Basic Retirement Sum 2026', $(RS.brs)], ['Full Retirement Sum 2026', $(RS.frs)]], note: 'Before interest, and counting all accounts, not only the retirement savings.' };
  } },
  employeeVsSelf: { title: 'Tax on the same income as employee or self-employed', cta: 'Salary after tax calculator', inputs: [annual(72000)], run: ({ y }) => {
    const e = C(y / 12); const selfTax = residentTax(Math.max(0, y - earnedIncomeRelief(30, y)));
    return { head: ['Employee take-home per year', $(e.annual.net)], rows: [['Employee CPF (employer adds more)', $(e.annual.cpfEmployee)], ['Employee income tax', $(e.annual.tax)], ['Self-employed income tax, before MediSave', $(selfTax)]] };
  } },
  tax: { title: 'Tax on your chargeable income', cta: 'Income tax calculator', inputs: [{ id: 'c', label: 'Chargeable income, after reliefs', def: 60000, unit: 'S$', max: 20000000 }], run: ({ c }) => {
    const t = residentTax(c); return { head: ['Resident income tax, YA 2027', $(t)], rows: [['Marginal rate', pct(marginalRate(c), 1)], ['Average rate', pct(c ? t / c : 0, 2)], ['Per month', $(t / 12)]] };
  } },
  minwage: { title: 'Take-home pay at a given salary', cta: 'Take-home pay calculator', inputs: [monthly(P.wages.lqs_monthly)], run: ({ m }) => {
    const r = C(m); const d = m - P.wages.lqs_monthly;
    return { head: ['Take-home per month', $(r.takeHomeMonthly)], rows: [['Against the $1,800 LQS', `${d >= 0 ? '+' : '−'}${$(Math.abs(d))}`], ['Your CPF', $(r.monthly.employee)], ['Employer CPF', $(r.monthly.employer)]] };
  } },
  payslip: { title: 'Check the deductions on your payslip', cta: 'Take-home pay calculator', inputs: [monthly(), age()], run: ({ m, a }) => {
    const r = C(m, a); return { head: ['Net pay on the payslip', $(r.takeHomeMonthly)], rows: [['Gross salary', $(m)], ['Employee CPF deducted', $(r.monthly.employee)], ['Employer CPF (not deducted)', $(r.monthly.employer)]] };
  } },
  nonres: { title: 'Resident or non-resident: your tax', cta: 'Income tax calculator', inputs: [annual(80000)], run: ({ y }) => {
    const res = C(y / 12, 30, { status: 'FOREIGNER' }).annual.tax; const nr = C(y / 12, 30, { status: 'FOREIGNER', taxResident: false }).annual.tax;
    return { head: ['Tax as a non-resident', $(nr)], rows: [['Tax as a resident', $(res)], ['Non-resident rate', `${pct(P.tax.non_resident_employment_flat, 0)} or resident, the higher`], ['Difference', $(nr - res)]] };
  } },
  selfEmp: { title: 'Income tax on your net trade income', cta: 'Income tax calculator', inputs: [annual(60000), age(40)], run: ({ y, a }) => {
    const eir = earnedIncomeRelief(a, y); const t = residentTax(Math.max(0, y - eir));
    return { head: ['Income tax, YA 2027', $(t)], rows: [['Earned income relief', $(eir)], ['Chargeable income', $(Math.max(0, y - eir))], ['Average rate', pct(y ? t / y : 0, 2)]], note: 'MediSave contributions for the self-employed come on top, see the table below.' };
  } },
  spr: { title: 'CPF for Singapore Permanent Residents', cta: 'CPF calculator', inputs: [monthly(), { id: 's', label: 'Status', def: 1, options: [{ value: '1', label: 'SPR, 1st year (graduated)' }, { value: '2', label: 'SPR, 2nd year (graduated)' }, { value: '0', label: 'SPR 3rd year on or citizen' }] }], run: ({ m, s }) => {
    const st: Status = s === 1 ? 'SPR1_GG' : s === 2 ? 'SPR2_GG' : 'SC'; const r = compute({ monthly: m, age: 30, status: st });
    return { head: ['Your CPF per month', $(r.monthly.employee)], rows: [['Employer CPF', $(r.monthly.employer)], ['Take-home pay', $(r.takeHomeMonthly)], ['Full rates would be', $(C(m).monthly.employee)]] };
  } },
  relief: { title: 'How much a tax relief saves you', cta: 'Income tax calculator', inputs: [annual(90000), { id: 'r', label: 'Extra relief you claim', def: 8000, unit: 'S$', max: 80000 }], run: ({ y, r }) => {
    const a = C(y / 12).annual; const b = C(y / 12, 30, { otherReliefs: r }).annual;
    return { head: ['Tax saved by the relief', $(a.tax - b.tax)], rows: [['Tax without it', $(a.tax)], ['Tax with it', $(b.tax)], ['Relief cap for all reliefs', $(P.tax.relief_cap)]] };
  } },
  overtime: { title: 'Your overtime pay', cta: 'Hourly rate calculator', inputs: [{ id: 'b', label: 'Monthly basic salary', def: 2600, unit: 'S$', max: 1000000 }, { id: 'h', label: 'Overtime hours this month', def: 20, unit: 'h', max: 300, decimals: 1 }, { id: 'w', label: 'Type of work', def: 0, options: [{ value: '0', label: 'Non-workman (office, service)' }, { value: '1', label: 'Workman (manual labour)' }] }], run: ({ b, h, w }) => {
    const o = overtimePay({ basic: b, hours: h, workman: w === 1 }); return { head: ['Overtime pay for the month', o.covered ? $(o.pay, 2) : 'Not covered'], rows: [['Hourly basic rate', $(o.hourly, 2)], ['Overtime rate, 1.5 times', $(o.rate, 2)], ['Salary ceiling for coverage', $(o.ceiling)]], note: o.covered ? (h > P.wages.ot_hours_cap ? `Overtime is limited to ${P.wages.ot_hours_cap} hours a month.` : undefined) : 'Above the ceiling, overtime pay depends on your contract.' };
  } },
  annualLeave: { title: 'Your annual leave entitlement', cta: 'Leave encashment calculator', inputs: [{ id: 'y', label: 'Year of service', def: 3, unit: 'yr', max: 50 }, { id: 'm', label: 'Completed months this year', def: 12, unit: 'mo', max: 12 }], run: ({ y, m }) => {
    const a = annualLeave({ yearOfService: y, completedMonths: m }); return { head: ['Leave earned so far this year', `${a.prorated} days`], rows: [['Full-year statutory entitlement', `${a.statutory} days`], ['Legal maximum', `${P.employment.annual_leave.max_days} days from the 8th year`], ['Minimum service to qualify', `${P.employment.annual_leave.min_service_months} months`]] };
  } },
  encash: { title: 'Pay for your unused leave', cta: 'Take-home pay calculator', inputs: [monthly(4500), { id: 'n', label: 'Unused leave days', def: 6, unit: 'days', max: 60, decimals: 1 }, { id: 'd', label: 'Working days a week', def: 5, options: [{ value: '5', label: '5 days' }, { value: '5.5', label: '5.5 days' }, { value: '6', label: '6 days' }] }], run: ({ m, n, d }) => {
    const e = encashLeave({ monthly: m, days: n, daysPerWeek: d }); return { head: ['Leave encashment before CPF', $(e.pay, 2)], rows: [['Gross rate of pay per day', $(e.daily, 2)], ['Employee CPF on it, age 55 or below', $(compute({ monthly: m, bonus: e.pay, age: 30, status: 'SC' }).bonusMonth.employee - compute({ monthly: m, age: 30, status: 'SC' }).monthly.employee)], ['Formula', '12 × monthly ÷ (52 × days a week)']] };
  } },
  prorata: { title: 'Salary for an incomplete month', cta: 'Take-home pay calculator', inputs: [monthly(4000), { id: 'w', label: 'Days actually worked', def: 12, unit: 'days', max: 31, decimals: 1 }, { id: 't', label: 'Working days in that month', def: 22, unit: 'days', max: 31 }], run: ({ m, w, t }) => {
    const g = proRated({ monthly: m, worked: w, working: t }); const c = compute({ monthly: g, age: 30, status: 'SC' });
    return { head: ['Gross pay for the month', $(g, 2)], rows: [['Employee CPF (citizen, 55 or below)', $(c.monthly.employee)], ['Take-home pay', $(c.takeHomeMonthly)], ['Share of the month worked', pct(t > 0 ? Math.min(w, t) / t : 0, 0)]] };
  } },
  pubhol: { title: 'Pay for working on a public holiday', cta: 'Overtime pay calculator', inputs: [{ id: 'b', label: 'Monthly basic salary', def: 3000, unit: 'S$', max: 1000000 }, { id: 'd', label: 'Working days a week', def: 5, options: [{ value: '5', label: '5 days' }, { value: '5.5', label: '5.5 days' }, { value: '6', label: '6 days' }] }], run: ({ b, d }) => {
    const x = publicHolidayPay({ basic: b, daysPerWeek: d }); return { head: ['Extra pay for the day', $(x, 2)], rows: [['On top of your monthly salary', $(b)], ['Paid public holidays a year', String(P.employment.public_holidays)], ['Formula', '12 × basic ÷ (52 × days a week)']] };
  } },
  notice: { title: 'Notice period and pay in lieu', cta: 'Leave encashment calculator', inputs: [{ id: 's', label: 'Length of service', def: 150, options: [{ value: '10', label: 'Less than 26 weeks' }, { value: '60', label: '26 weeks to under 2 years' }, { value: '150', label: '2 to under 5 years' }, { value: '300', label: '5 years or more' }] }, monthly(4500)], run: ({ s, m }) => {
    const n = noticePeriod({ serviceWeeks: s, monthly: m }); return { head: ['Statutory notice', n.weeks ? `${n.weeks} week${n.weeks > 1 ? 's' : ''}` : '1 day'], rows: [['Salary in lieu of that notice', $(n.inLieu, 2)], ['Working days covered, 5-day week', String(n.workingDays)], ['Applies when', 'The contract sets no notice']] };
  } },
  maternity: { title: 'Your maternity leave pay', cta: 'Take-home pay calculator', inputs: [monthly(5000), { id: 'c', label: 'Your situation', def: 1, options: [{ value: '1', label: 'Citizen child, 1st or 2nd' }, { value: '2', label: 'Citizen child, 3rd or later' }, { value: '0', label: 'Child not a Singapore citizen' }] }], run: ({ m, c }) => {
    const x = maternityPay({ monthly: m, citizenChild: c !== 0, thirdChildOrMore: c === 2 }); return { head: [`Pay over ${x.paidWeeks} paid weeks`, $(x.total)], rows: [['Per week', $(x.weekly, 2)], ['Paid by the employer', $(x.employerPaid)], ['Reimbursed by the Government', $(x.governmentPaid)]], note: x.capped ? 'Government-paid weeks are capped at S$2,500 a week; your employer may top up.' : undefined };
  } },
  sick: { title: 'Your paid sick leave', cta: 'Take-home pay calculator', inputs: [{ id: 's', label: 'Months of service', def: 6, unit: 'mo', max: 600 }, monthly(4000)], run: ({ s, m }) => {
    const x = sickLeave(s); return { head: ['Paid outpatient sick leave', `${x.outpatient} days`], rows: [['Paid hospitalisation leave, outpatient days included', `${x.hospitalisation} days`], ['Pay per sick day, 5-day week', $(dailyRate(m), 2)], ['Full entitlement after', '6 months']] };
  } },
  retrench: { title: 'Your retrenchment benefit range', cta: 'Notice period calculator', inputs: [monthly(5000), { id: 'y', label: 'Years of service', def: 6, unit: 'yrs', max: 50, decimals: 1 }], run: ({ m, y }) => {
    const r = retrenchment({ monthly: m, years: y }); return { head: ['At one month per year of service', $(r.high)], rows: [['At two weeks per year of service', $(r.low)], ['Income tax and CPF on it', 'None'], ['Eligible under the norm', r.eligible ? 'Yes, 2 years or more' : 'No, under 2 years']] };
  } },
  srs: { title: 'Tax saved by an SRS contribution', cta: 'Income tax calculator', inputs: [annual(120000), { id: 'c', label: 'SRS contribution this year', def: P.srs.cap_citizen_pr, unit: 'S$', max: P.srs.cap_foreigner }, { id: 'f', label: 'You are', def: 0, options: [{ value: '0', label: 'Citizen or PR' }, { value: '1', label: 'Foreigner' }] }], run: ({ y, c, f }) => {
    const cap = srsCap(f === 1); const x = reliefSaving({ annualIncome: y, age: 35, relief: Math.min(c, cap), status: f === 1 ? 'FOREIGNER' : 'SC' });
    return { head: ['Income tax saved', $(x.saving)], rows: [['Contribution counted', $(Math.min(c, cap))], ['Your yearly SRS cap', $(cap)], ['Tax before and after', `${$(x.before)} → ${$(x.after)}`]] };
  } },
  interest: { title: 'Interest on your CPF balances', cta: 'CPF calculator', inputs: [{ id: 'o', label: 'Ordinary Account', def: 60000, unit: 'S$', max: 5000000 }, { id: 's', label: 'Special, MediSave and Retirement Accounts', def: 50000, unit: 'S$', max: 5000000 }, age(35)], run: ({ o, s, a }) => {
    const i = cpfInterest({ oa: o, sma: s, age: a }); return { head: ['Interest for one year', $(i.total)], rows: [['Base interest', $(i.base)], ['Extra interest', $(i.extra)], ['Average rate on your balances', pct(i.rate, 2)]] };
  } },
  topup: { title: 'Tax saved by a CPF cash top-up', cta: 'Income tax calculator', inputs: [annual(100000), { id: 't', label: 'Top-up to your own account', def: P.topup.self_cap, unit: 'S$', max: 500000 }, { id: 'g', label: 'Top-up to family members', def: 0, unit: 'S$', max: 500000 }], run: ({ y, t, g }) => {
    const rel = Math.min(t, P.topup.self_cap) + Math.min(g, P.topup.family_cap); const x = reliefSaving({ annualIncome: y, age: 35, relief: rel });
    return { head: ['Income tax saved', $(x.saving)], rows: [['Relief counted', $(rel)], ['Maximum relief a year', $(P.topup.self_cap + P.topup.family_cap)], ['Your marginal tax rate', pct(x.marginal, 1)]] };
  } },
  withdraw55: { title: 'What you can withdraw at 55', cta: 'CPF retirement sums', inputs: [{ id: 'o', label: 'Ordinary Account at 55', def: 150000, unit: 'S$', max: 5000000 }, { id: 's', label: 'Special Account at 55', def: 120000, unit: 'S$', max: 5000000 }], run: ({ o, s }) => {
    const w = withdrawalAt55({ oa: o, sa: s }); return { head: ['Withdrawable in cash', $(w.withdrawable)], rows: [['Set aside in your Retirement Account', $(w.ra)], ['Full Retirement Sum 2026', $(RS.frs)], ['FRS met', w.metFrs ? 'Yes' : 'No']] };
  } },
};

export function getSpec(kind: string, _lang?: string): MiniSpec {
  const s = SPECS[kind]; if (!s) throw new Error(`Mini-simulateur inconnu : ${kind}`); return s;
}
