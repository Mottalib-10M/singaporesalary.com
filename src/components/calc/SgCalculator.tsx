import { useEffect, useMemo, useState } from 'react';
import NumberField from '../ui/NumberField';
import SelectField from '../ui/SelectField';
import Toggle from '../ui/Toggle';
import StackedBar from '../ui/StackedBar';
import { compute, grossForTakeHome, hourlyFromMonthly, monthlyFromHourly, type Status } from '../../lib/engine/sg';
import { formatMoney, formatPercent } from '../../lib/format';
import { readParams, num, str, updateURL } from '../../lib/url-state';

export type Mode = 'salary' | 'cpf' | 'contribution' | 'employerCpf' | 'employerCost' | 'afterTax' | 'incomeTax' | 'takeHome' | 'netToGross' | 'hourly' | 'bonus';
interface Props { mode?: Mode; initialMonthly?: number; initialBonus?: number; initialHourly?: number; initialAge?: number; methodHref?: string }

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: 'SC', label: 'Citizen or PR (3rd year on)' },
  { value: 'SPR2_GG', label: 'PR, 2nd year (graduated rates)' },
  { value: 'SPR1_GG', label: 'PR, 1st year (graduated rates)' },
  { value: 'SPR2_FG', label: 'PR, 2nd year (full employer rate)' },
  { value: 'SPR1_FG', label: 'PR, 1st year (full employer rate)' },
  { value: 'FOREIGNER', label: 'Foreigner (EP, S Pass, Work Permit)' },
];

export default function SgCalculator({ mode = 'salary', initialMonthly = 5000, initialBonus = 0, initialHourly = 15, initialAge = 30, methodHref }: Props) {
  // Premier rendu = HTML du build ; les paramètres d'un lien partagé sont lus après l'hydratation (RECETTE §17.5).
  const sp = new URLSearchParams();
  const [monthly, setMonthly] = useState(num(sp, 'm', initialMonthly));
  const [target, setTarget] = useState(num(sp, 'net', 4000));
  const [hourly, setHourly] = useState(num(sp, 'h', initialHourly));
  const [hours, setHours] = useState(num(sp, 'hw', 44));
  const [bonus, setBonus] = useState(num(sp, 'b', initialBonus));
  const [age, setAge] = useState(num(sp, 'age', initialAge));
  const [status, setStatus] = useState<Status>(str(sp, 's', 'SC') as Status);
  const [year, setYear] = useState(str(sp, 'y', '2026'));
  const [resident, setResident] = useState(str(sp, 'r', '1'));
  const [other, setOther] = useState(num(sp, 'rel', 0));
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const u = readParams(window.location.search);
    setMonthly(num(u, 'm', initialMonthly)); setTarget(num(u, 'net', 4000)); setHourly(num(u, 'h', initialHourly)); setHours(num(u, 'hw', 44));
    setBonus(num(u, 'b', initialBonus)); setAge(num(u, 'age', initialAge)); setStatus(str(u, 's', 'SC') as Status);
    setYear(str(u, 'y', '2026')); setResident(str(u, 'r', '1')); setOther(num(u, 'rel', 0));
  }, []);
  const y = (year === '2027' ? 2027 : 2026) as 2026 | 2027;
  const foreign = status === 'FOREIGNER';
  const effMonthly = mode === 'netToGross' ? grossForTakeHome(target, { age, status, year: y }) : mode === 'hourly' ? monthlyFromHourly(hourly) * (hours / 44) : monthly;
  const r = useMemo(() => compute({ monthly: effMonthly, bonus, age, status, year: y, taxResident: foreign ? resident === '1' : true, otherReliefs: other }), [effMonthly, bonus, age, status, y, resident, other, foreign]);
  useEffect(() => { updateURL({ m: mode === 'netToGross' || mode === 'hourly' ? undefined : monthly, net: mode === 'netToGross' ? target : undefined, h: mode === 'hourly' ? hourly : undefined, hw: mode === 'hourly' && hours !== 44 ? hours : undefined, b: bonus || undefined, age, s: status === 'SC' ? undefined : status, y: year === '2026' ? undefined : year, r: resident === '1' ? undefined : resident, rel: other || undefined }); }, [monthly, target, hourly, hours, bonus, age, status, year, resident, other, mode]);

  const m = r.monthly; const A = r.annual;
  const eePct = effMonthly > 0 ? m.employee / Math.min(effMonthly, 8000) : 0;
  const main = (() => {
    switch (mode) {
      case 'cpf': case 'contribution': return { label: 'Total CPF this month', value: formatMoney(m.total), sub: `${formatMoney(m.employee)} from you · ${formatMoney(m.employer)} from your employer` };
      case 'employerCpf': return { label: 'Employer CPF per month', value: formatMoney(m.employer), sub: `on top of a ${formatMoney(effMonthly)} salary · employee share ${formatMoney(m.employee)}` };
      case 'employerCost': return { label: 'Total cost to the employer per year', value: formatMoney(A.employerCost), sub: `${formatMoney(A.employerCost / 12)} a month on average, salary, employer CPF and SDL` };
      case 'afterTax': return { label: 'Net salary after CPF and income tax, per year', value: formatMoney(A.net), sub: `${formatMoney(A.net / 12)} a month on average · tax ${formatMoney(A.tax)} for YA 2027` };
      case 'incomeTax': return { label: 'Income tax for YA 2027 (2026 income)', value: formatMoney(A.tax), sub: `effective rate ${formatPercent(A.effectiveTaxRate)} · marginal ${formatPercent(A.marginal, 1)}` };
      case 'netToGross': return { label: 'Gross monthly salary needed', value: formatMoney(effMonthly), sub: `for ${formatMoney(target)} in your bank account after employee CPF` };
      case 'hourly': return { label: 'Monthly salary equivalent', value: formatMoney(effMonthly), sub: `${formatMoney(effMonthly * 12)} a year · ${formatMoney(r.takeHomeMonthly)} take-home a month` };
      case 'bonus': return { label: 'Bonus after CPF and income tax', value: formatMoney(bonusNet(r, bonus)), sub: `CPF on the bonus ${formatMoney(r.bonusMonth.employee - m.employee)} · extra tax about ${formatMoney(bonusTax(r))}` };
      default: return { label: 'Monthly take-home pay', value: formatMoney(r.takeHomeMonthly), sub: `${formatMoney(effMonthly)} gross − ${formatMoney(m.employee)} employee CPF · set aside ${formatMoney(A.tax / 12)} a month for tax` };
    }
  })();
  const copy = async () => { try { await navigator.clipboard.writeText(`${main.label}: ${main.value}\n${window.location.href}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* presse-papiers indisponible */ } };
  const statusHelp = status.startsWith('SPR1') ? 'Graduated rates apply in the first two years of PR status' : status.startsWith('SPR2') ? 'From the 3rd year of PR status, full citizen rates apply' : foreign ? 'Foreign employees do not contribute to CPF' : undefined;

  return (
    <div data-chrome className="rechner rounded-xl border border-navy-200 bg-navy-50 p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <form className="space-y-4 lg:col-span-2" onSubmit={(e) => e.preventDefault()}>
          {mode === 'netToGross' ? (
            <NumberField id="net" label="Take-home pay you want each month" value={target} onChange={setTarget} unit="S$" max={100000} help="What reaches your bank account after employee CPF" />
          ) : mode === 'hourly' ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="h" label="Hourly rate" value={hourly} onChange={setHourly} unit="S$" max={2000} decimals={2} help="Basic rate before overtime" />
              <NumberField id="hw" label="Hours a week" value={hours} onChange={setHours} unit="h" max={80} help="44 h is the full-time week in MOM's formula" />
            </div>
          ) : (
            <NumberField id="m" label={mode === 'employerCpf' || mode === 'employerCost' ? 'Monthly salary you pay (ordinary wages)' : 'Gross monthly salary (ordinary wages)'} value={monthly} onChange={setMonthly} unit="S$" max={1000000} help="Basic pay plus fixed allowances and overtime, before CPF" />
          )}
          <NumberField id="b" label={mode === 'bonus' ? 'Bonus or 13th month (additional wages)' : 'Annual bonus, 13th month (optional)'} value={bonus} onChange={setBonus} unit="S$" max={5000000} help={bonus > 0 ? `CPF applies to ${formatMoney(r.awSubject)} of it: Additional Wage ceiling ${formatMoney(r.awCeiling)}` : 'Paid once a year; CPF applies up to the Additional Wage ceiling'} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="age" label="Your age" value={age} onChange={setAge} unit="yrs" min={14} max={100} />
            <SelectField id="y" label="Wages earned in" value={year} onChange={setYear} options={[{ value: '2026', label: '2026' }, { value: '2027', label: '2027 (new senior rates)' }]} />
          </div>
          <SelectField id="s" label="CPF status" value={status} onChange={(v) => setStatus(v as Status)} options={STATUS_OPTIONS} help={statusHelp} />
          {foreign && <Toggle id="r" label="Tax resident (183 days or more)?" options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} value={resident} onChange={setResident} />}
          <details className="rounded-lg border border-navy-200 bg-white"><summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-navy-700">More tax reliefs</summary>
            <div className="grid grid-cols-1 gap-3 px-4 pb-4 pt-1">
              <NumberField id="rel" label="Other reliefs you will claim" value={other} onChange={setOther} unit="S$" max={80000} help="Spouse, child, parent, NSman, SRS, CPF cash top-ups: all reliefs together are capped at $80,000" />
            </div></details>
          <p className="text-xs text-navy-500">Calculated in your browser · nothing is sent · free</p>
        </form>
        <div className="lg:col-span-3" aria-live="polite">
          <div className="rounded-lg border border-accent-200 bg-white p-5">
            <div className="mb-4 text-center">
              <p className="text-sm font-medium text-navy-500">{main.label}</p>
              <p className="tabular-nums mt-1 text-4xl font-bold text-navy-900 sm:text-5xl">{main.value}</p>
              <p className="tabular-nums mt-1 text-sm text-navy-500">{main.sub}</p>
            </div>
            <StackedBar ariaPrefix="Where one month of salary goes" total={effMonthly + m.employer} segments={[
              { label: 'Take-home pay', value: r.takeHomeMonthly, color: '#15803d' },
              { label: 'Your CPF', value: m.employee, color: '#0f766e' },
              { label: 'Employer CPF', value: m.employer, color: '#94a3b8' },
            ]} />
            <table className="mt-4 w-full text-sm"><tbody className="divide-y divide-navy-100">
              <Row l="Gross monthly salary" v={formatMoney(effMonthly)} />
              {foreign ? <Row l="CPF: none for foreign employees" v={formatMoney(0)} /> : <>
                <Row l={`Your CPF (${formatPercent(eePct, 1)}${effMonthly > 8000 ? ', capped at the $8,000 ceiling' : ''}${m.rule === 'phase_in' ? ', phase-in band $500–$750' : m.rule === 'employer_only' ? ', nil below $500' : ''})`} v={`− ${formatMoney(m.employee)}`} />
                <Row l="Take-home pay per month" v={formatMoney(r.takeHomeMonthly)} bold />
                <Row l="Employer CPF (paid on top)" v={formatMoney(m.employer)} />
                <Row l={`Into your accounts: OA · ${r.allocation.second} · MediSave (per year)`} v={`${formatMoney(r.allocation.oa)} · ${formatMoney(r.allocation.sa)} · ${formatMoney(r.allocation.ma)}`} />
              </>}
              <Row l={`Annual gross${bonus > 0 ? ' incl. bonus' : ''}`} v={formatMoney(A.gross)} />
              {A.taxMethod === 'resident'
                ? <Row l={`Reliefs: earned income ${formatMoney(A.reliefs.eir)}${A.reliefs.cpf ? ` + CPF ${formatMoney(A.reliefs.cpf)}` : ''}${A.reliefs.other ? ` + other ${formatMoney(A.reliefs.other)}` : ''}${A.reliefs.capped ? ' (capped at $80,000)' : ''}`} v={`− ${formatMoney(A.reliefs.total)}`} />
                : <Row l={A.taxMethod === 'nr_flat' ? 'Non-resident: 15 % flat rate applied (higher than resident rates)' : 'Non-resident: resident rates applied (higher than 15 %)'} v="" />}
              <Row l={`Income tax YA 2027 on ${formatMoney(A.chargeable)} chargeable`} v={`− ${formatMoney(A.tax)}`} />
              <Row l="Net after CPF and tax, per year" v={formatMoney(A.net)} bold accent />
              <Row l="Employer cost per year (salary + CPF + SDL)" v={formatMoney(A.employerCost)} />
              {mode === 'hourly' && <Row l="Hourly basic rate, MOM formula (12 × monthly ÷ 52 × 44)" v={formatMoney(hourlyFromMonthly(effMonthly * 44 / hours), 2)} />}
            </tbody></table>
            <p className="mt-3 text-xs text-navy-500">CPF Board rates from 1 January {y}{y === 2027 ? ' (new rates for ages 55 to 65)' : ''}; ordinary wage ceiling $8,000 a month, annual ceiling $102,000. Tax at IRAS resident rates for YA 2027, no rebate assumed. Estimates only, see the methodology.</p>
            <div className="no-print mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="rounded-lg border border-navy-300 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50">{copied ? 'Copied' : 'Copy result'}</button>
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-navy-300 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50">Print</button>
              {methodHref && <a href={methodHref} className="ml-auto self-center text-sm text-accent-700 hover:underline">How this is calculated</a>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
/** Part du bonus qui reste après CPF et impôt : différence entre l'année avec et sans bonus. */
function bonusTax(r: ReturnType<typeof compute>): number { return r.annual.tax - r.annual.taxWithoutBonus; }
function bonusNet(r: ReturnType<typeof compute>, bonus: number): number { return bonus - (r.bonusMonth.employee - r.monthly.employee) - bonusTax(r); }
function Row({ l, v, bold = false, accent = false }: { l: string; v: string; bold?: boolean; accent?: boolean }) { return <tr className={bold ? 'font-semibold' : ''}><td className={`py-2 pr-3 ${accent ? 'text-accent-700' : 'text-navy-600'}`}>{l}</td><td className={`tabular-nums whitespace-nowrap py-2 text-right ${accent ? 'text-accent-700' : 'text-navy-900'}`}>{v}</td></tr>; }
