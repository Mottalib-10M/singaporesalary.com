import { makeRouter, type RouteDef } from './routes-core';
export const LOCALES = ['en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Pages « par montant » : salaire mensuel, salaire annuel, taux horaire. Chacune porte un seuil propre (lib/amount-angles.ts). */
export const MONTHLY = [1800, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 10000, 12000, 15000] as const;
export const ANNUAL = [60000, 102000, 120000, 150000] as const;
export const HOURLY = [12, 20, 30] as const;

export const ROUTES: RouteDef<Locale>[] = [
  { id: 'home', paths: { en: '/en/' } },
  { id: 'cpf', paths: { en: '/en/cpf-calculator/' } },
  { id: 'contribution', paths: { en: '/en/cpf-contribution-calculator/' } },
  { id: 'employerCpf', paths: { en: '/en/employer-cpf-calculator/' } },
  { id: 'employerCost', paths: { en: '/en/employer-cost-calculator/' } },
  { id: 'afterTax', paths: { en: '/en/salary-after-tax/' } },
  { id: 'incomeTax', paths: { en: '/en/income-tax-calculator/' } },
  { id: 'takeHome', paths: { en: '/en/take-home-pay-calculator/' } },
  { id: 'netToGross', paths: { en: '/en/net-to-gross-salary/' } },
  { id: 'hourly', paths: { en: '/en/hourly-to-salary-calculator/' } },
  { id: 'bonus', paths: { en: '/en/bonus-tax-calculator/' } },
  { id: 'cpfRates', paths: { en: '/en/cpf-contribution-rates/' } },
  { id: 'allocation', paths: { en: '/en/cpf-allocation-rates/' } },
  { id: 'sprRates', paths: { en: '/en/spr-cpf-contribution-rates/' } },
  { id: 'cpf2027', paths: { en: '/en/cpf-changes-2027/' } },
  { id: 'awCeiling', paths: { en: '/en/additional-wage-ceiling/' } },
  { id: 'taxRates', paths: { en: '/en/income-tax-rates/' } },
  { id: 'residency', paths: { en: '/en/resident-vs-non-resident-tax/' } },
  { id: 'reliefs', paths: { en: '/en/tax-relief/' } },
  { id: 'selfEmployed', paths: { en: '/en/self-employed-cpf/' } },
  { id: 'employeeVsSelf', paths: { en: '/en/employee-vs-self-employed/' } },
  { id: 'minimumWage', paths: { en: '/en/minimum-wage/' } },
  { id: 'averageSalary', paths: { en: '/en/average-salary-singapore/' } },
  { id: 'payslip', paths: { en: '/en/payslip-guide/' } },
  { id: 'retirement', paths: { en: '/en/cpf-retirement-sums/' } },
  ...MONTHLY.map((a) => ({ id: `m-${a}`, paths: { en: `/en/${a}-monthly-salary-after-cpf/` } })),
  ...ANNUAL.map((a) => ({ id: `y-${a}`, paths: { en: `/en/${a}-salary-after-tax/` } })),
  ...HOURLY.map((a) => ({ id: `h-${a}`, paths: { en: `/en/${a}-per-hour-annual-salary/` } })),
  { id: 'glossary', paths: { en: '/en/glossary/' } },
  { id: 'method', paths: { en: '/en/methodology/' } },
  { id: 'widget', paths: { en: '/en/widget/' }, noindex: true },
  { id: 'about', paths: { en: '/en/about/' } },
  { id: 'contact', paths: { en: '/en/contact/' } },
  { id: 'editorial', paths: { en: '/en/editorial-policy/' } },
  { id: 'privacy', paths: { en: '/en/privacy/' }, noindex: true },
  { id: 'terms', paths: { en: '/en/terms/' }, noindex: true },
  { id: 'cookies', paths: { en: '/en/cookies/' }, noindex: true },
];
export const { NOINDEX_PATHS, route, hasRoute, altPaths } = makeRouter(LOCALES, ROUTES);
