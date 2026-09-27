import { route, MONTHLY, ANNUAL, HOURLY, type Locale } from './routes';
export interface NavLink { href: string; label: string } export interface NavCategory { label: string; links: NavLink[] }
const L: Record<string, string> = {
  home: 'Salary calculator', cpf: 'CPF calculator', contribution: 'CPF contribution calculator', employerCpf: 'Employer CPF calculator',
  employerCost: 'Employer cost calculator', afterTax: 'Salary after tax', incomeTax: 'Income tax calculator', takeHome: 'Take-home pay calculator',
  netToGross: 'Net to gross salary', hourly: 'Hourly to salary', bonus: 'Bonus tax calculator',
  cpfRates: 'CPF contribution rates 2026', allocation: 'CPF allocation rates', sprRates: 'SPR graduated CPF rates', cpf2027: 'CPF changes in 2027',
  awCeiling: 'Additional Wage ceiling', taxRates: 'Income tax rates', residency: 'Resident vs non-resident tax', reliefs: 'Tax reliefs',
  selfEmployed: 'Self-employed CPF (MediSave)', employeeVsSelf: 'Employee vs self-employed', minimumWage: 'Minimum wage and LQS',
  averageSalary: 'Average and median salary', payslip: 'How to read a payslip', retirement: 'CPF retirement sums',
  glossary: 'Glossary', method: 'Methodology and sources', widget: 'Embed the calculator', about: 'About', contact: 'Contact',
  editorial: 'Editorial policy', privacy: 'Privacy', terms: 'Terms of use', cookies: 'Cookies',
};
export const label = (id: string, _l?: Locale) => L[id] ?? id;
const link = (id: string, lang: Locale): NavLink => ({ href: route(id, lang), label: label(id) });
const sgd = (n: number) => `$${n.toLocaleString('en-SG')}`;
export const monthlyLabel = (a: number) => `${sgd(a)} a month`;
export const annualLabel = (a: number) => `${sgd(a)} a year`;
export const hourlyLabel = (a: number) => `${sgd(a)} an hour`;
export function navCategories(lang: Locale): NavCategory[] {
  return [
    { label: 'Calculators', links: ['home', 'cpf', 'contribution', 'employerCpf', 'employerCost', 'afterTax', 'incomeTax', 'takeHome', 'netToGross', 'hourly', 'bonus'].map((i) => link(i, lang)) },
    { label: 'CPF', links: ['cpfRates', 'sprRates', 'allocation', 'awCeiling', 'cpf2027', 'retirement', 'selfEmployed'].map((i) => link(i, lang)) },
    { label: 'Tax and pay', links: ['taxRates', 'reliefs', 'residency', 'employeeVsSelf', 'minimumWage', 'averageSalary', 'payslip'].map((i) => link(i, lang)) },
    { label: 'By salary', links: [...MONTHLY.map((a) => ({ href: route(`m-${a}`, lang), label: monthlyLabel(a) })), ...ANNUAL.map((a) => ({ href: route(`y-${a}`, lang), label: annualLabel(a) })), ...HOURLY.map((a) => ({ href: route(`h-${a}`, lang), label: hourlyLabel(a) }))] },
  ];
}
export const navDirect = (lang: Locale): NavLink[] => [link('method', lang)];
export const footerColumns = (lang: Locale): NavCategory[] => [...navCategories(lang).slice(0, 3), { label: 'The site', links: ['about', 'contact', 'editorial', 'method', 'glossary', 'widget', 'privacy', 'terms', 'cookies'].map((i) => link(i, lang)) }];
export const popularLinks = (lang: Locale): NavLink[] => [...MONTHLY.map((a) => ({ href: route(`m-${a}`, lang), label: monthlyLabel(a) })), ...ANNUAL.map((a) => ({ href: route(`y-${a}`, lang), label: annualLabel(a) })), ...HOURLY.map((a) => ({ href: route(`h-${a}`, lang), label: hourlyLabel(a) }))];
