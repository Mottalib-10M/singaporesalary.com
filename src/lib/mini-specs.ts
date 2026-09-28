/** Mini-simulateurs des guides (RECETTE §9.3) : un par sujet, calculés par le moteur singapourien. */
import { compute, allocate, residentTax, marginalRate, earnedIncomeRelief, type Status } from './engine/sg';
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
};

export function getSpec(kind: string, _lang?: string): MiniSpec {
  const s = SPECS[kind]; if (!s) throw new Error(`Mini-simulateur inconnu : ${kind}`); return s;
}
