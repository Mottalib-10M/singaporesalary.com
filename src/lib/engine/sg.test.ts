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

import { overtimePay, annualLeave, encashLeave, proRated, publicHolidayPay, noticePeriod, maternityPay, sickLeave, retrenchment, reliefSaving, cpfInterest, withdrawalAt55, dailyRate } from './sg';
describe('Pages ajoutées le 2026-10-01 (MOM, IRAS, CPF)', () => {
  it('heures sup. : non-ouvrier à 2 600 $ → 13,60 $ de l’heure, 20,45 $ majoré (exemple MOM)', () => { const o = overtimePay({ basic: 2600, hours: 2 }); expect(o.hourly).toBe(13.64); expect(o.covered).toBe(true); expect(o.pay).toBeCloseTo(40.91, 1); });
  it('heures sup. : non-ouvrier à 3 000 $ non couvert, ouvrier à 4 000 $ couvert, plafond 72 h', () => { expect(overtimePay({ basic: 3000, hours: 10 }).covered).toBe(false); const w = overtimePay({ basic: 4000, hours: 100, workman: true }); expect(w.covered).toBe(true); expect(w.hours).toBe(72); });
  it('congés : 7 jours la 1re année, 14 à partir de la 8e ; 4 mois sur 10 jours → 3 (exemple MOM)', () => { expect(annualLeave({ yearOfService: 1 }).statutory).toBe(7); expect(annualLeave({ yearOfService: 8 }).statutory).toBe(14); expect(annualLeave({ yearOfService: 20 }).statutory).toBe(14); expect(annualLeave({ yearOfService: 4, completedMonths: 4 }).prorated).toBe(3); expect(annualLeave({ yearOfService: 1, completedMonths: 7, contractDays: 12 }).prorated).toBe(7); });
  it('taux journalier : 5 000 $ sur 5 jours → 230,77 $ ; 10 jours non pris → 2 307,69 $', () => { expect(dailyRate(5000)).toBeCloseTo(230.77, 2); expect(encashLeave({ monthly: 5000, days: 10 }).pay).toBe(2307.69); });
  it('mois incomplet : 3 000 $ × 15 ÷ 22', () => expect(proRated({ monthly: 3000, worked: 15, working: 22 })).toBe(2045.45));
  it('jour férié travaillé : un jour de base en plus', () => expect(publicHolidayPay({ basic: 2600 })).toBe(120));
  it('préavis légal par ancienneté', () => { expect(noticePeriod({ serviceWeeks: 10, monthly: 4000 }).days).toBe(1); expect(noticePeriod({ serviceWeeks: 60, monthly: 4000 }).weeks).toBe(1); expect(noticePeriod({ serviceWeeks: 150, monthly: 4000 }).weeks).toBe(2); expect(noticePeriod({ serviceWeeks: 300, monthly: 4000 }).weeks).toBe(4); expect(noticePeriod({ serviceWeeks: 300, monthly: 5200 }).inLieu).toBe(4800); });
  it('maternité : 16 semaines, part de l’État plafonnée à 2 500 $ par semaine', () => { const m = maternityPay({ monthly: 5200 }); expect(m.weekly).toBe(1200); expect(m.total).toBe(19200); const h = maternityPay({ monthly: 13000 }); expect(h.governmentPaid).toBe(20000); expect(h.capped).toBe(true); expect(maternityPay({ monthly: 13000, thirdChildOrMore: true }).governmentPaid).toBe(40000); expect(maternityPay({ monthly: 5200, citizenChild: false }).paidWeeks).toBe(8); });
  it('maladie : 5/15 à 3 mois, 14/60 à 6 mois', () => { expect(sickLeave(2).outpatient).toBe(0); expect(sickLeave(3)).toEqual({ outpatient: 5, hospitalisation: 15 }); expect(sickLeave(5).outpatient).toBe(11); expect(sickLeave(24).hospitalisation).toBe(60); });
  it('licenciement économique : 2 semaines à 1 mois par année, à partir de 2 ans', () => { const r = retrenchment({ monthly: 5200, years: 5 }); expect(r.low).toBe(12000); expect(r.high).toBe(26000); expect(retrenchment({ monthly: 5200, years: 1 }).eligible).toBe(false); });
  it('SRS : 15 300 $ déduits à 120 000 $ de revenu font baisser l’impôt', () => { const s = reliefSaving({ annualIncome: 120000, age: 35, relief: 15300 }); expect(s.saving).toBeGreaterThan(1000); expect(s.saving).toBeLessThan(15300 * 0.15); });
  it('intérêts CPF : 20 000 OA + 40 000 SMA avant 55 ans → 2 100 de base + 600 d’extra', () => { const i = cpfInterest({ oa: 20000, sma: 40000, age: 40 }); expect(i.base).toBe(2100); expect(i.extra).toBe(600); expect(cpfInterest({ oa: 50000, sma: 0, age: 40 }).extra).toBe(200); expect(cpfInterest({ oa: 20000, sma: 40000, age: 60 }).extra).toBe(900); });
  it('retrait à 55 ans : au moins 5 000 $, sinon l’excédent au-delà du FRS', () => { expect(withdrawalAt55({ oa: 60000, sa: 40000 }).withdrawable).toBe(5000); expect(withdrawalAt55({ oa: 200000, sa: 100000 }).withdrawable).toBe(79600); expect(withdrawalAt55({ oa: 2000, sa: 1000 }).withdrawable).toBe(3000); });
});
