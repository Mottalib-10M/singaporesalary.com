import { describe, it, expect } from 'vitest';
import { cpfMonth, allocate, residentTax, compute, sdlMonth, hourlyFromMonthly, grossForTakeHome, ratesFor, earnedIncomeRelief } from './sg';

describe('CPF 2026, table 1 (CPF Board PDF, 1 January 2026)', () => {
  it('5 000 $ à 30 ans : 37 % dont 20 % salarié', () => {
    const r = cpfMonth({ ow: 5000, age: 30, status: 'SC' });
    expect(r).toMatchObject({ total: 1850, employee: 1000, employer: 850 });
  });
  it('OW plafonné à 8 000 $ : maxima 2 960 / 1 600', () => {
    const r = cpfMonth({ ow: 12000, age: 40, status: 'SC' });
    expect(r).toMatchObject({ total: 2960, employee: 1600, employer: 1360 });
  });
  it('tranche 500–750 : 17 % TW + 0,6 (TW − 500), part salariale arrondie à l’inférieur', () => {
    const r = cpfMonth({ ow: 600, age: 30, status: 'SC' });
    expect(r.total).toBe(Math.floor(0.17 * 600 + 0.6 * 100 + 0.5)); // 102 + 60 = 162
    expect(r.employee).toBe(60);
    expect(r.rule).toBe('phase_in');
  });
  it('tranche 50–500 : employeur seul', () => {
    expect(cpfMonth({ ow: 400, age: 30, status: 'SC' })).toMatchObject({ total: 68, employee: 0, employer: 68 });
    expect(cpfMonth({ ow: 50, age: 30, status: 'SC' }).total).toBe(0);
  });
  it('âge : 55 ans reste dans « 55 & below », 56 ans passe à 34 %', () => {
    expect(cpfMonth({ ow: 4000, age: 55, status: 'SC' }).total).toBe(1480);
    expect(cpfMonth({ ow: 4000, age: 56, status: 'SC' })).toMatchObject({ total: 1360, employee: 720 });
    expect(cpfMonth({ ow: 4000, age: 71, status: 'SC' })).toMatchObject({ total: 500, employee: 200 });
  });
  it('arrondi du total au dollar le plus proche (0,50 vers le haut)', () => {
    // 3 001,50 × 37 % = 1 110,555 → 1 111 ; salarié 600,30 → 600
    expect(cpfMonth({ ow: 3001.5, age: 30, status: 'SC' })).toMatchObject({ total: 1111, employee: 600, employer: 511 });
  });
  it('SPR 1re année taux gradués : 9 % dont 5 %, maxima 720 / 400', () => {
    expect(cpfMonth({ ow: 5000, age: 30, status: 'SPR1_GG' })).toMatchObject({ total: 450, employee: 250 });
    expect(cpfMonth({ ow: 9000, age: 30, status: 'SPR1_GG' })).toMatchObject({ total: 720, employee: 400 });
  });
  it('SPR 2e année taux gradués : 24 % dont 15 % sous 55 ans', () => {
    expect(cpfMonth({ ow: 5000, age: 30, status: 'SPR2_GG' })).toMatchObject({ total: 1200, employee: 750 });
  });
  it('SPR full/graduated : table 4 et 5', () => {
    expect(cpfMonth({ ow: 5000, age: 30, status: 'SPR1_FG' })).toMatchObject({ total: 1100, employee: 250 });
    expect(cpfMonth({ ow: 5000, age: 30, status: 'SPR2_FG' })).toMatchObject({ total: 1600, employee: 750 });
  });
  it('étranger (EP, S Pass) : pas de CPF', () => {
    expect(cpfMonth({ ow: 8000, age: 30, status: 'FOREIGNER' }).total).toBe(0);
  });
  it('OW + AW même mois : somme puis arrondi', () => {
    const r = cpfMonth({ ow: 5000, aw: 10000, age: 30, status: 'SC' });
    expect(r).toMatchObject({ total: 5550, employee: 3000 });
  });
});

describe('CPF 2027 (annonce CPF Board)', () => {
  it('55–60 ans : 35,5 % dont 19 % salarié', () => {
    expect(ratesFor('SC', '55_60', 2027)).toMatchObject({ total: 0.355, employee: 0.19 });
    expect(cpfMonth({ ow: 4000, age: 58, status: 'SC', year: 2027 })).toMatchObject({ total: 1420, employee: 760 });
  });
  it('60–65 ans : 26 % dont 13 %', () => {
    expect(cpfMonth({ ow: 4000, age: 62, status: 'SC', year: 2027 })).toMatchObject({ total: 1040, employee: 520 });
  });
  it('les taux gradués SPR ne changent pas', () => {
    expect(cpfMonth({ ow: 4000, age: 58, status: 'SPR2_GG', year: 2027 }).total).toBe(cpfMonth({ ow: 4000, age: 58, status: 'SPR2_GG' }).total);
  });
});

describe('Allocation (exemples du PDF CPF Board 2026)', () => {
  it('30 ans, 100 $ : OA 62,17 · SA 16,21 · MA 21,62', () => {
    expect(allocate(100, 30)).toEqual({ oa: 62.17, sa: 16.21, ma: 21.62, second: 'SA' });
  });
  it('57 ans, 100 $ : OA 35,30 · RA 33,82 · MA 30,88', () => {
    expect(allocate(100, 57)).toEqual({ oa: 35.3, sa: 33.82, ma: 30.88, second: 'RA' });
  });
});

describe('Impôt IRAS, barème des résidents dès YA 2024', () => {
  it.each([[20000, 0], [30000, 200], [40000, 550], [80000, 3350], [120000, 7950], [160000, 13950], [200000, 21150], [240000, 28750], [280000, 36550], [320000, 44550], [500000, 84150], [1000000, 199150]])('revenu imposable %i → %i', (c, t) => {
    expect(residentTax(c)).toBeCloseTo(t, 2);
  });
  it('earned income relief par âge', () => {
    expect(earnedIncomeRelief(40, 50000)).toBe(1000);
    expect(earnedIncomeRelief(57, 50000)).toBe(6000);
    expect(earnedIncomeRelief(62, 50000)).toBe(8000);
    expect(earnedIncomeRelief(62, 5000)).toBe(5000);
  });
});

describe('Année complète', () => {
  it('5 000 $/mois, 30 ans, citoyen, sans bonus', () => {
    const r = compute({ monthly: 5000, age: 30, status: 'SC' });
    expect(r.takeHomeMonthly).toBe(4000);
    expect(r.annual.cpfEmployee).toBe(12000);
    expect(r.annual.reliefs.total).toBe(13000);
    expect(r.annual.chargeable).toBe(47000);
    expect(r.annual.tax).toBeCloseTo(550 + 7000 * 0.07, 2);
  });
  it('plafond AW : 8 000 $/mois laisse 6 000 $ de bonus soumis au CPF', () => {
    const r = compute({ monthly: 8000, bonus: 16000, age: 30, status: 'SC' });
    expect(r.awCeiling).toBe(6000);
    expect(r.awSubject).toBe(6000);
    expect(r.annual.cpfEmployee).toBe(1600 * 12 + 1200);
  });
  it('non-résident : 15 % ou barème, le plus élevé', () => {
    const r = compute({ monthly: 5000, age: 30, status: 'FOREIGNER', taxResident: false });
    expect(r.annual.tax).toBe(9000);
    expect(r.annual.taxMethod).toBe('nr_flat');
  });
  it('plafond global des reliefs à 80 000 $', () => {
    const r = compute({ monthly: 20000, age: 40, status: 'SC', otherReliefs: 90000 });
    expect(r.annual.reliefs.total).toBe(80000);
    expect(r.annual.reliefs.capped).toBe(true);
  });
});

describe('SDL, horaire, réciproque', () => {
  it('SDL : minimum 2 $, 0,25 %, maximum 11,25 $', () => {
    expect(sdlMonth(700)).toBe(2);
    expect(sdlMonth(3000)).toBe(7.5);
    expect(sdlMonth(9000)).toBe(11.25);
  });
  it('taux horaire MOM : 2 288 $/mois → 12 $/h', () => {
    expect(hourlyFromMonthly(2288)).toBeCloseTo(12, 6);
  });
  it('net → brut : 4 000 $ nets à 30 ans demandent 4 999 $ bruts (part salariale arrondie à l’inférieur)', () => {
    const g = grossForTakeHome(4000, { age: 30, status: 'SC' });
    expect(Math.round(g)).toBe(4999);
  });
});
