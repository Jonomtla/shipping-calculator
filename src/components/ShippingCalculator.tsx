'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';

/* ─── Currency Config ─── */
const CURRENCIES: Record<string, { symbol: string; code: string }> = {
  USD: { symbol: '$', code: 'USD' },
  EUR: { symbol: '€', code: 'EUR' },
  GBP: { symbol: '£', code: 'GBP' },
  AUD: { symbol: 'A$', code: 'AUD' },
  CAD: { symbol: 'C$', code: 'CAD' },
};

/* ─── Presets ─── */
const PRESETS: Record<string, {
  label: string;
  annualOrders: number; aov: number; marginPct: number; cpa: number;
  shippingAbove: number; shippingBelow: number;
  threshold1: number; threshold2: number;
  ordersAboveT1: number; ordersAboveT2: number;
  currency: string; clientName: string;
}> = {
  steadyrack_na: {
    label: 'Steadyrack NA',
    annualOrders: 16153, aov: 268, marginPct: 60, cpa: 45,
    shippingAbove: 10, shippingBelow: 30,
    threshold1: 300, threshold2: 200,
    ordersAboveT1: 5257, ordersAboveT2: 10017,
    currency: 'USD', clientName: 'Steadyrack NA',
  },
  steadyrack_eu: {
    label: 'Steadyrack EU',
    annualOrders: 8400, aov: 245, marginPct: 55, cpa: 38,
    shippingAbove: 8, shippingBelow: 25,
    threshold1: 250, threshold2: 150,
    ordersAboveT1: 3200, ordersAboveT2: 5800,
    currency: 'EUR', clientName: 'Steadyrack EU',
  },
  blank: {
    label: 'Blank template',
    annualOrders: 10000, aov: 100, marginPct: 50, cpa: 30,
    shippingAbove: 10, shippingBelow: 20,
    threshold1: 200, threshold2: 100,
    ordersAboveT1: 4000, ordersAboveT2: 7000,
    currency: 'USD', clientName: '',
  },
};

/* ─── Order Distribution (reference) ─── */
const ORDER_BUCKETS = [
  { label: '$0–50', min: 0, max: 50, orders: 967, pct: 6.0 },
  { label: '$50–100', min: 50, max: 100, orders: 466, pct: 2.9 },
  { label: '$100–150', min: 100, max: 150, orders: 2567, pct: 15.9 },
  { label: '$150–200', min: 150, max: 200, orders: 2094, pct: 13.0 },
  { label: '$200–250', min: 200, max: 250, orders: 3281, pct: 20.3 },
  { label: '$250–300', min: 250, max: 300, orders: 1479, pct: 9.2 },
  { label: '$300–400', min: 300, max: 400, orders: 2348, pct: 14.5 },
  { label: '$400–500', min: 400, max: 500, orders: 1475, pct: 9.1 },
  { label: '$500–750', min: 500, max: 750, orders: 1114, pct: 6.9 },
  { label: '$750+', min: 750, max: Infinity, orders: 320, pct: 2.0 },
];

/* ─── Scenario Matrix Axes ─── */
const CVR_LIFTS = [1, 2, 3, 5, 7, 10, 15];
const AOV_LIFTS = [0, 10, 20, 30];

/* ─── Tooltip Component ─── */
function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setOpen(false)}
        className="w-4 h-4 rounded-full bg-[#9abbd8]/30 text-[#4e7597] text-[10px] font-bold inline-flex items-center justify-center hover:bg-[#4e7597]/20 transition-colors ml-1"
        aria-label="Help"
      >
        ?
      </button>
      {open && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#10222b] text-white text-xs rounded-lg shadow-xl animate-fade-in">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#10222b]" />
        </span>
      )}
    </span>
  );
}

/* ─── Slider Input Component ─── */
function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix = '',
  suffix = '',
  hint,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
  tooltip?: string;
}) {
  return (
    <div className="group">
      <label className="flex items-center justify-between mb-2 text-sm font-medium text-[#10222b]">
        <span className="flex items-center">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </span>
        <span className="text-[#4e7597] font-semibold">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          {hint && <span className="text-[10px] text-[#565656] font-normal ml-1">({hint})</span>}
        </span>
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(value, max)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1"
        />
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          className="w-24 py-2 px-3 bg-white border-2 border-[#9abbd8]/30 rounded-xl text-sm text-[#10222b]
            focus:outline-none focus:border-[#4e7597] focus:ring-4 focus:ring-[#4e7597]/10
            hover:border-[#9abbd8] hover:bg-[#f4faff] transition-all duration-200 text-right"
        />
      </div>
    </div>
  );
}

/* ─── Verdict Badge ─── */
function VerdictBadge({ breakEvenPct }: { breakEvenPct: number }) {
  let color: string, bg: string, border: string, text: string, dot: string;
  if (breakEvenPct <= 3) {
    color = 'text-[#72ab7f]'; bg = 'bg-[#72ab7f]/10'; border = 'border-[#72ab7f]/30'; text = 'Easy — low lift needed'; dot = 'bg-[#72ab7f]';
  } else if (breakEvenPct <= 8) {
    color = 'text-[#d4a84b]'; bg = 'bg-[#d4a84b]/10'; border = 'border-[#d4a84b]/30'; text = 'Moderate — achievable with good execution'; dot = 'bg-[#d4a84b]';
  } else {
    color = 'text-[#e57373]'; bg = 'bg-[#e57373]/10'; border = 'border-[#e57373]/30'; text = 'Tough — needs significant uplift'; dot = 'bg-[#e57373]';
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bg} ${border}`}>
      <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <span className={`text-sm font-semibold ${color}`}>{text}</span>
    </div>
  );
}

/* ─── Matrix Cell Color (continuous gradient) ─── */
function getCellColor(value: number, maxAbs: number): string {
  if (maxAbs === 0) return 'bg-gray-100';
  const ratio = Math.abs(value) / maxAbs;
  if (value > 0) {
    if (ratio > 0.75) return 'bg-[#4a9460] text-white';
    if (ratio > 0.5) return 'bg-[#72ab7f] text-white';
    if (ratio > 0.3) return 'bg-[#72ab7f]/60 text-[#10222b]';
    if (ratio > 0.15) return 'bg-[#72ab7f]/35 text-[#10222b]';
    return 'bg-[#72ab7f]/15 text-[#10222b]';
  } else {
    if (ratio > 0.75) return 'bg-[#c62828] text-white';
    if (ratio > 0.5) return 'bg-[#e57373] text-white';
    if (ratio > 0.3) return 'bg-[#e57373]/60 text-[#10222b]';
    if (ratio > 0.15) return 'bg-[#e57373]/35 text-[#10222b]';
    return 'bg-[#e57373]/15 text-[#10222b]';
  }
}

/* ─── Main Calculator ─── */
export default function ShippingCalculator() {
  // Currency
  const [currency, setCurrency] = useState('USD');
  const sym = CURRENCIES[currency].symbol;

  // Formatters (currency-aware)
  const fmt = useCallback((n: number) => sym + Math.round(n).toLocaleString(), [sym]);
  const fmtMo = useCallback((annual: number) => fmt(Math.round(annual / 12)), [fmt]);

  // Client name
  const [clientName, setClientName] = useState('');

  // Business metrics
  const [annualOrders, setAnnualOrders] = useState(16153);
  const [aov, setAov] = useState(268);
  const [marginPct, setMarginPct] = useState(60);
  const [cpa, setCpa] = useState(45);
  const [shippingAbove, setShippingAbove] = useState(10);
  const [shippingBelow, setShippingBelow] = useState(30);

  // Test thresholds
  const [threshold1, setThreshold1] = useState(300);
  const [threshold2, setThreshold2] = useState(200);
  const [ordersAboveT1, setOrdersAboveT1] = useState(5257);
  const [ordersAboveT2, setOrdersAboveT2] = useState(10017);
  const [compareTwo, setCompareTwo] = useState(true);

  // UI state
  const [showWorstCase, setShowWorstCase] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [matrixVariation, setMatrixVariation] = useState<1 | 2>(2);
  const [matrixMonthly, setMatrixMonthly] = useState(false);
  const [showOrderDist, setShowOrderDist] = useState(false);
  const [showPasteData, setShowPasteData] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  // Custom order data
  const [customBuckets, setCustomBuckets] = useState<typeof ORDER_BUCKETS | null>(null);
  const activeBuckets = customBuckets || ORDER_BUCKETS;

  // Load preset
  const loadPreset = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setAnnualOrders(p.annualOrders); setAov(p.aov); setMarginPct(p.marginPct); setCpa(p.cpa);
    setShippingAbove(p.shippingAbove); setShippingBelow(p.shippingBelow);
    setThreshold1(p.threshold1); setThreshold2(p.threshold2);
    setOrdersAboveT1(p.ordersAboveT1); setOrdersAboveT2(p.ordersAboveT2);
    setCurrency(p.currency); setClientName(p.clientName);
    setShowPresets(false);
  };

  // Share URL
  const copyShareLink = () => {
    const params = new URLSearchParams({
      orders: String(annualOrders), aov: String(aov), margin: String(marginPct), cpa: String(cpa),
      sa: String(shippingAbove), sb: String(shippingBelow),
      t1: String(threshold1), t2: String(threshold2),
      o1: String(ordersAboveT1), o2: String(ordersAboveT2),
      cur: currency, compare: compareTwo ? '2' : '1',
      ...(clientName ? { client: clientName } : {}),
    });
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?${params.toString()}`
      : '';
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  // Load from URL params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (!p.has('orders')) return;
    const n = (k: string) => parseFloat(p.get(k) || '');
    if (p.has('orders')) setAnnualOrders(n('orders'));
    if (p.has('aov')) setAov(n('aov'));
    if (p.has('margin')) setMarginPct(n('margin'));
    if (p.has('cpa')) setCpa(n('cpa'));
    if (p.has('sa')) setShippingAbove(n('sa'));
    if (p.has('sb')) setShippingBelow(n('sb'));
    if (p.has('t1')) setThreshold1(n('t1'));
    if (p.has('t2')) setThreshold2(n('t2'));
    if (p.has('o1')) setOrdersAboveT1(n('o1'));
    if (p.has('o2')) setOrdersAboveT2(n('o2'));
    if (p.has('cur')) setCurrency(p.get('cur')!);
    if (p.has('compare')) setCompareTwo(p.get('compare') === '2');
    if (p.has('client')) setClientName(p.get('client')!);
  }, []);

  // Parse pasted order data
  const parsePastedData = () => {
    const values = pasteText
      .split(/[\n,\t]+/)
      .map(s => parseFloat(s.replace(/[^0-9.]/g, '')))
      .filter(n => !isNaN(n) && n > 0);

    if (values.length === 0) return;

    const totalOrders = values.length;
    const buckets = ORDER_BUCKETS.map(b => {
      const count = values.filter(v => v >= b.min && v < b.max).length;
      return { ...b, orders: count, pct: parseFloat(((count / totalOrders) * 100).toFixed(1)) };
    });

    setCustomBuckets(buckets);
    setAnnualOrders(totalOrders);
    setAov(Math.round(values.reduce((a, b) => a + b, 0) / totalOrders));

    // Auto-populate qualifying orders
    const above1 = values.filter(v => v >= threshold1).length;
    const above2 = values.filter(v => v >= threshold2).length;
    setOrdersAboveT1(above1);
    setOrdersAboveT2(above2);
    setShowPasteData(false);
    setPasteText('');
  };

  // Calculations
  const calcs = useMemo(() => {
    const margin = marginPct / 100;
    const ordersBetween = ordersAboveT2 - ordersAboveT1;

    // Contribution per incremental order
    // Margin already includes CPA
    const contribInclCPA = aov * margin;
    const contribExclCPA = aov * margin + cpa;

    // --- Variation 1 ---
    const v1ShippingLost = ordersAboveT1 * shippingAbove;
    const v1BEOrders = contribInclCPA > 0 ? v1ShippingLost / contribInclCPA : Infinity;
    const v1BEPct = annualOrders > 0 ? (v1BEOrders / annualOrders) * 100 : 0;
    const v1BEOrdersExcl = contribExclCPA > 0 ? v1ShippingLost / contribExclCPA : Infinity;
    const v1BEPctExcl = annualOrders > 0 ? (v1BEOrdersExcl / annualOrders) * 100 : 0;
    const v1TestCost = (v1ShippingLost / 12) * (1 / 3);

    // --- Variation 2 ---
    const v2ShippingLost = (ordersBetween * shippingBelow) + (ordersAboveT1 * shippingAbove);
    const v2BEOrders = contribInclCPA > 0 ? v2ShippingLost / contribInclCPA : Infinity;
    const v2BEPct = annualOrders > 0 ? (v2BEOrders / annualOrders) * 100 : 0;
    const v2BEOrdersExcl = contribExclCPA > 0 ? v2ShippingLost / contribExclCPA : Infinity;
    const v2BEPctExcl = annualOrders > 0 ? (v2BEOrdersExcl / annualOrders) * 100 : 0;
    const v2TestCost = (v2ShippingLost / 12) * (1 / 3);

    // --- Matrices ---
    const buildMatrix = (shippingLost: number, useCPA: boolean) => {
      const contrib = useCPA ? contribInclCPA : contribExclCPA;
      return AOV_LIFTS.map((aovLift) =>
        CVR_LIFTS.map((cvrLift) => {
          const addOrders = annualOrders * (cvrLift / 100);
          return (addOrders * contrib) + (aovLift * annualOrders * margin) - shippingLost;
        })
      );
    };

    const v1MatrixReal = buildMatrix(v1ShippingLost, false);
    const v1MatrixWorst = buildMatrix(v1ShippingLost, true);
    const v2MatrixReal = buildMatrix(v2ShippingLost, false);
    const v2MatrixWorst = buildMatrix(v2ShippingLost, true);

    const allVals = [...v1MatrixReal.flat(), ...v1MatrixWorst.flat(), ...v2MatrixReal.flat(), ...v2MatrixWorst.flat()];
    const maxAbs = Math.max(...allVals.map(Math.abs), 1);

    // Callout: CVR needed with $20 AOV bump for Var 2
    const aovContrib20 = 20 * annualOrders * margin;
    const remaining20 = v2ShippingLost - aovContrib20;
    const v2WithAOV20 = remaining20 <= 0 ? 0 : contribExclCPA > 0 ? (remaining20 / contribExclCPA / annualOrders) * 100 : Infinity;

    const totalTestCost = v1TestCost + (compareTwo ? v2TestCost : 0);

    return {
      v1ShippingLost, v1BEOrders, v1BEPct, v1BEOrdersExcl, v1BEPctExcl, v1TestCost,
      v2ShippingLost, v2BEOrders, v2BEPct, v2BEOrdersExcl, v2BEPctExcl, v2TestCost,
      v1MatrixReal, v1MatrixWorst, v2MatrixReal, v2MatrixWorst,
      maxAbs, v2WithAOV20, totalTestCost, contribExclCPA, contribInclCPA,
    };
  }, [annualOrders, aov, marginPct, cpa, shippingAbove, shippingBelow, ordersAboveT1, ordersAboveT2, compareTwo]);

  // Active matrix based on variation + mode
  const activeMatrix = (() => {
    if (matrixVariation === 1) return showWorstCase ? calcs.v1MatrixWorst : calcs.v1MatrixReal;
    return showWorstCase ? calcs.v2MatrixWorst : calcs.v2MatrixReal;
  })();

  const activeShippingLost = matrixVariation === 1 ? calcs.v1ShippingLost : calcs.v2ShippingLost;
  const activeThreshold = matrixVariation === 1 ? threshold1 : threshold2;

  // Percentages for threshold inputs
  const t1Pct = annualOrders > 0 ? ((ordersAboveT1 / annualOrders) * 100).toFixed(1) : '0.0';
  const t2Pct = annualOrders > 0 ? ((ordersAboveT2 / annualOrders) * 100).toFixed(1) : '0.0';

  const fmtPct = (n: number) => n.toFixed(1) + '%';

  return (
    <div className="max-w-6xl mx-auto">
      {/* ─── Header ─── */}
      <div className="text-center mb-8 animate-fade-in-up">
        {/* Top bar: currency + share + presets */}
        <div className="flex items-center justify-between mb-6">
          <div /> {/* spacer */}
          <span className="text-4xl font-black text-[#10222b] tracking-tight">IMPACT.</span>
          <div className="flex items-center gap-2">
            {/* Currency */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-3 py-2 text-sm bg-white border-2 border-[#9abbd8]/30 rounded-xl text-[#10222b] focus:outline-none focus:border-[#4e7597] cursor-pointer"
            >
              {Object.keys(CURRENCIES).map(c => (
                <option key={c} value={c}>{CURRENCIES[c].symbol} {c}</option>
              ))}
            </select>

            {/* Presets */}
            <div className="relative">
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="px-3 py-2 text-sm bg-white border-2 border-[#9abbd8]/30 rounded-xl text-[#10222b] hover:bg-[#f4faff] transition-colors"
              >
                Presets
              </button>
              {showPresets && (
                <div className="absolute right-0 top-full mt-1 bg-white border-2 border-[#9abbd8]/30 rounded-xl shadow-lg z-50 overflow-hidden min-w-[180px]">
                  {Object.entries(PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => loadPreset(key)}
                      className="w-full text-left px-4 py-2.5 text-sm text-[#10222b] hover:bg-[#f4faff] transition-colors border-b border-[#9abbd8]/10 last:border-0"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Share */}
            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#10222b] text-white rounded-xl hover:bg-[#243e42] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {linkCopied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-[#10222b] mb-3 tracking-tight">
          Free Shipping Profitability Calculator
        </h1>

        {/* Client name / subtitle */}
        <div className="flex items-center justify-center gap-2">
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Client or project name (optional)"
            className="text-center text-[#565656] text-lg bg-transparent border-b-2 border-transparent hover:border-[#9abbd8]/30 focus:border-[#4e7597] focus:outline-none transition-colors px-2 py-1 max-w-md"
          />
        </div>
        {!clientName && (
          <p className="text-[#565656] text-base mt-1">
            Model the financial impact of free shipping thresholds.
          </p>
        )}
      </div>

      {/* ─── Main Grid ─── */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* ─── Inputs Panel ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Metrics */}
          <div className="bg-white border-2 border-[#9abbd8]/20 rounded-2xl p-6 card-shadow animate-fade-in-left">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-[#4e7597]/10 rounded-lg">
                <svg className="w-5 h-5 text-[#4e7597]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[#10222b]">Business Metrics</h2>
            </div>

            {/* Your business */}
            <p className="text-xs font-semibold text-[#4e7597] uppercase tracking-wider mb-3">Your Business</p>
            <div className="space-y-4">
              <SliderInput label="Annual orders" value={annualOrders} onChange={setAnnualOrders} min={1000} max={100000} step={100} />
              <SliderInput label="Average order value" value={aov} onChange={setAov} min={50} max={500} step={1} prefix={sym} />
              <SliderInput
                label="Contribution margin %"
                value={marginPct} onChange={setMarginPct} min={30} max={80} step={1} suffix="%"
                tooltip="Percentage of revenue remaining after product costs and fulfilment. Exclude advertising spend — that's captured separately in CPA below."
              />
              <SliderInput
                label="Cost per acquisition"
                value={cpa} onChange={setCpa} min={0} max={150} step={1} prefix={sym}
                tooltip="Average advertising cost to acquire one customer. Incremental orders from free shipping don't incur this cost — they're already on your site."
              />
            </div>

            <div className="border-t border-[#9abbd8]/20 my-5" />

            {/* Current shipping setup */}
            <p className="text-xs font-semibold text-[#4e7597] uppercase tracking-wider mb-3">Current Shipping Setup</p>
            <div className="space-y-4">
              <SliderInput label="Current charge (above threshold)" value={shippingAbove} onChange={setShippingAbove} min={0} max={50} step={1} prefix={sym} />
              <SliderInput label="Current charge (below threshold)" value={shippingBelow} onChange={setShippingBelow} min={0} max={80} step={1} prefix={sym} />
            </div>
          </div>

          {/* Test Thresholds */}
          <div className="bg-white border-2 border-[#72ab7f]/20 rounded-2xl p-6 card-shadow animate-fade-in-left">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#72ab7f]/10 rounded-lg">
                  <svg className="w-5 h-5 text-[#72ab7f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-[#10222b]">Test Thresholds</h2>
              </div>

              {/* 1 vs 2 variation toggle */}
              <div className="flex items-center bg-[#f2efe6] rounded-lg p-0.5">
                <button
                  onClick={() => { setCompareTwo(false); setMatrixVariation(1); }}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${!compareTwo ? 'bg-[#4e7597] text-white shadow-md' : 'text-[#565656]'}`}
                >
                  1 variation
                </button>
                <button
                  onClick={() => setCompareTwo(true)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${compareTwo ? 'bg-[#4e7597] text-white shadow-md' : 'text-[#565656]'}`}
                >
                  2 variations
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <SliderInput label="Variation 1 — free shipping above" value={threshold1} onChange={setThreshold1} min={50} max={1000} step={10} prefix={sym} />
              <SliderInput
                label="Orders above this threshold"
                value={ordersAboveT1} onChange={setOrdersAboveT1}
                min={0} max={annualOrders} step={1}
                hint={`${t1Pct}% of orders`}
              />

              {compareTwo && (
                <>
                  <div className="border-t border-[#9abbd8]/20 my-4" />
                  <SliderInput label="Variation 2 — free shipping above" value={threshold2} onChange={setThreshold2} min={50} max={1000} step={10} prefix={sym} />
                  <SliderInput
                    label="Orders above this threshold"
                    value={ordersAboveT2} onChange={setOrdersAboveT2}
                    min={0} max={annualOrders} step={1}
                    hint={`${t2Pct}% of orders`}
                  />
                </>
              )}

              <div className="text-xs text-[#565656] bg-[#f4faff] rounded-lg p-3 border border-[#9abbd8]/20">
                <span className="font-semibold text-[#4e7597]">{t1Pct}%</span> of orders are above {fmt(threshold1)}
                {compareTwo && (
                  <>
                    &nbsp;·&nbsp;
                    <span className="font-semibold text-[#4e7597]">{t2Pct}%</span> are above {fmt(threshold2)}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Results Panel ─── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Variation 1 — slim bar */}
          <div className="bg-white border-2 border-[#9abbd8]/20 rounded-2xl p-4 card-shadow animate-fade-in-right">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 sm:min-w-0">
                <div className="p-1.5 bg-[#4e7597]/20 rounded-lg flex-shrink-0">
                  <svg className="w-4 h-4 text-[#4e7597]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                  </svg>
                </div>
                <span className="font-semibold text-[#10222b] text-sm">Variation 1: Free Shipping &gt;{fmt(threshold1)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto text-sm">
                <span>
                  <span className="text-[#565656]">Breakeven </span>
                  <span className="font-bold text-[#10222b]">{Math.round(calcs.v1BEOrders).toLocaleString()} orders</span>
                  <span className="text-[#4e7597] font-semibold"> ({fmtPct(calcs.v1BEPct)})</span>
                </span>
                <span className="text-[#565656]">·</span>
                <span>
                  <span className="text-[#565656]">Test cost </span>
                  <span className="font-bold text-[#10222b]">{fmt(calcs.v1TestCost)}</span>
                </span>
                <VerdictBadge breakEvenPct={calcs.v1BEPct} />
              </div>
            </div>
            <div className="mt-2 text-xs text-[#565656]">
              Revenue forfeited: {fmt(calcs.v1ShippingLost)}/yr ({fmtMo(calcs.v1ShippingLost)}/mo) · Breakeven if orders cost CPA: {Math.round(calcs.v1BEOrdersExcl).toLocaleString()} orders ({fmtPct(calcs.v1BEPctExcl)})
            </div>
          </div>

          {/* Variation 2 — full card (only if comparing two) */}
          {compareTwo && (
            <div className="bg-gradient-to-br from-[#243e42]/5 to-[#72ab7f]/10 border-2 border-[#72ab7f]/30 rounded-2xl p-5 card-shadow hover-lift animate-fade-in-right">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-[#72ab7f]/20 rounded-lg">
                  <svg className="w-4 h-4 text-[#72ab7f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#243e42]">Variation 2: Free Shipping &gt;{fmt(threshold2)}</h3>
              </div>

              <div className="space-y-2">
                {/* Breakeven — hero metric */}
                <div className="bg-white/60 rounded-xl p-4 border border-[#72ab7f]/20">
                  <div className="text-xs text-[#565656] mb-1">Breakeven</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-[#243e42]">{Math.round(calcs.v2BEOrders).toLocaleString()} orders</span>
                    <span className="text-lg font-bold text-[#4e7597]">{fmtPct(calcs.v2BEPct)} lift</span>
                  </div>
                </div>

                {/* Test cost */}
                <div className="flex justify-between items-center py-2 border-b border-[#72ab7f]/15">
                  <span className="text-sm font-medium text-[#565656]">Test cost (33% traffic, 1 month)</span>
                  <span className="text-lg font-bold text-[#243e42]">{fmt(calcs.v2TestCost)}</span>
                </div>

                {/* Revenue forfeited */}
                <div className="flex justify-between items-center py-2 border-b border-[#72ab7f]/15">
                  <span className="text-sm text-[#565656]">Shipping revenue forfeited</span>
                  <div className="text-right">
                    <span className="font-semibold text-[#e57373]">{fmt(calcs.v2ShippingLost)}/yr</span>
                    <span className="text-xs text-[#565656] ml-1">({fmtMo(calcs.v2ShippingLost)}/mo)</span>
                  </div>
                </div>

                {/* Secondary: if orders cost CPA */}
                <div className="flex justify-between items-center py-1.5 text-xs text-[#565656]/70">
                  <span>Breakeven (if orders cost CPA)</span>
                  <span>{Math.round(calcs.v2BEOrdersExcl).toLocaleString()} orders ({fmtPct(calcs.v2BEPctExcl)})</span>
                </div>

                <VerdictBadge breakEvenPct={calcs.v2BEPct} />
              </div>
            </div>
          )}

          {/* Test Risk Exposure — total */}
          <div className="bg-gradient-to-r from-[#f4faff] to-white border-2 border-[#9abbd8]/20 rounded-2xl p-5 card-shadow animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-[#4e7597]/10 rounded-lg">
                <svg className="w-5 h-5 text-[#4e7597]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#10222b]">Total Test Exposure</h3>
            </div>
            <div className={`grid ${compareTwo ? 'grid-cols-3' : 'grid-cols-1'} gap-3`}>
              {compareTwo && (
                <>
                  <div className="bg-white rounded-xl p-3 border border-[#9abbd8]/20">
                    <div className="text-xs text-[#565656] mb-1">Variation 1</div>
                    <div className="text-lg font-bold text-[#4e7597]">{fmt(calcs.v1TestCost)}</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-[#72ab7f]/20">
                    <div className="text-xs text-[#565656] mb-1">Variation 2</div>
                    <div className="text-lg font-bold text-[#72ab7f]">{fmt(calcs.v2TestCost)}</div>
                  </div>
                </>
              )}
              <div className={`bg-[#10222b] rounded-xl p-3 ${compareTwo ? '' : ''}`}>
                <div className="text-xs text-[#9abbd8] mb-1">Total (1 month at 33%)</div>
                <div className="text-lg font-bold text-white">{fmt(calcs.totalTestCost)}</div>
              </div>
            </div>
            <p className="text-xs text-[#565656] mt-3">
              Maximum downside if no winner found. Actual exposure is lower if order volumes don&apos;t change.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Scenario Matrix ─── */}
      <div className="mt-8 bg-white border-2 border-[#9abbd8]/20 rounded-2xl p-6 card-shadow animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#7e84e5]/10 rounded-lg">
              <svg className="w-5 h-5 text-[#7e84e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#10222b]">Scenario Matrix</h2>
              <p className="text-sm text-[#565656]">Net {matrixMonthly ? 'monthly' : 'annual'} profit impact across CVR lift + AOV lift combinations</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Variation tab */}
            {compareTwo && (
              <div className="flex items-center bg-[#f2efe6] rounded-lg p-0.5">
                <button onClick={() => { setMatrixVariation(1); setSelectedCell(null); }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${matrixVariation === 1 ? 'bg-[#4e7597] text-white shadow-md' : 'text-[#565656]'}`}>
                  Var 1 (&gt;{fmt(threshold1)})
                </button>
                <button onClick={() => { setMatrixVariation(2); setSelectedCell(null); }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${matrixVariation === 2 ? 'bg-[#4e7597] text-white shadow-md' : 'text-[#565656]'}`}>
                  Var 2 (&gt;{fmt(threshold2)})
                </button>
              </div>
            )}

            {/* Annual / Monthly */}
            <div className="flex items-center bg-[#f2efe6] rounded-lg p-0.5">
              <button onClick={() => setMatrixMonthly(false)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!matrixMonthly ? 'bg-[#4e7597] text-white shadow-md' : 'text-[#565656]'}`}>
                Annual
              </button>
              <button onClick={() => setMatrixMonthly(true)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${matrixMonthly ? 'bg-[#4e7597] text-white shadow-md' : 'text-[#565656]'}`}>
                Monthly
              </button>
            </div>

            {/* Realistic / Worst case */}
            <div className="flex items-center bg-[#f2efe6] rounded-lg p-0.5">
              <button onClick={() => { setShowWorstCase(false); setSelectedCell(null); }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!showWorstCase ? 'bg-[#4e7597] text-white shadow-md' : 'text-[#565656]'}`}>
                Realistic
              </button>
              <button onClick={() => { setShowWorstCase(true); setSelectedCell(null); }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${showWorstCase ? 'bg-[#4e7597] text-white shadow-md' : 'text-[#565656]'}`}>
                Worst case
              </button>
            </div>
          </div>
        </div>

        {/* Mode explanation */}
        <div className="mb-4 px-3 py-2 bg-[#f4faff] border border-[#9abbd8]/20 rounded-lg inline-block">
          <span className="text-xs font-semibold text-[#4e7597]">
            {showWorstCase
              ? 'Assumes every new order also costs full CPA to acquire'
              : 'Incremental orders don\'t cost ad spend — visitors are already on site'}
          </span>
        </div>

        {/* Selected cell callout */}
        {selectedCell && (() => {
          const cvrLift = CVR_LIFTS[selectedCell.col];
          const aovLift = AOV_LIFTS[selectedCell.row];
          const value = activeMatrix[selectedCell.row][selectedCell.col];
          const isProfit = value >= 0;
          const contrib = showWorstCase ? calcs.contribInclCPA : calcs.contribExclCPA;
          const additionalOrders = Math.round(annualOrders * (cvrLift / 100));
          const varLabel = `Variation ${matrixVariation}`;
          return (
            <div className={`mb-4 p-4 rounded-xl border-2 animate-fade-in ${isProfit ? 'bg-[#72ab7f]/5 border-[#72ab7f]/30' : 'bg-[#e57373]/5 border-[#e57373]/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm text-[#10222b]">
                  <p>
                    At <span className="font-bold">{cvrLift}% CVR lift</span> and <span className="font-bold">+{sym}{aovLift} AOV</span>, {varLabel} {isProfit ? 'generates' : 'loses'}{' '}
                    <span className={`font-bold text-lg ${isProfit ? 'text-[#72ab7f]' : 'text-[#e57373]'}`}>
                      {fmt(Math.abs(value))}/yr ({fmtMo(Math.abs(value))}/mo)
                    </span>
                    {' '}in net {isProfit ? 'profit' : 'loss'}.
                  </p>
                  <p className="text-xs text-[#565656] mt-1">
                    This requires {additionalOrders.toLocaleString()} additional orders (at {fmt(contrib)} contribution each) against {fmt(activeShippingLost)} shipping revenue forfeited.
                  </p>
                </div>
                <button onClick={() => setSelectedCell(null)} className="text-[#565656] hover:text-[#10222b] p-1 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-xs text-[#565656] font-semibold p-2 text-left border-b-2 border-[#9abbd8]/30 bg-[#f4faff]">
                  AOV ↓ / CVR →
                </th>
                {CVR_LIFTS.map((cvr) => (
                  <th key={cvr} className="text-xs text-[#4e7597] font-bold p-2 text-center border-b-2 border-[#9abbd8]/30 bg-[#f4faff] min-w-[85px]">
                    +{cvr}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AOV_LIFTS.map((aovLift, rowIdx) => (
                <tr key={aovLift}>
                  <td className="text-sm font-bold text-[#10222b] p-2 border-b border-[#9abbd8]/15 bg-[#f4faff]">
                    +{sym}{aovLift}
                  </td>
                  {CVR_LIFTS.map((_, colIdx) => {
                    const value = activeMatrix[rowIdx][colIdx];
                    const display = matrixMonthly ? Math.round(value / 12) : Math.round(value);
                    const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                    return (
                      <td
                        key={colIdx}
                        onClick={() => setSelectedCell(isSelected ? null : { row: rowIdx, col: colIdx })}
                        className={`text-center p-2 text-sm font-semibold border-b border-[#9abbd8]/10 cursor-pointer transition-all ${getCellColor(value, calcs.maxAbs)} ${isSelected ? 'ring-2 ring-[#10222b] ring-offset-1' : 'hover:ring-1 hover:ring-[#9abbd8]'}`}
                      >
                        {display >= 0 ? '+' : '-'}{sym}{Math.abs(display).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* How to read */}
        <div className="mt-4 p-4 bg-[#f4faff] border border-[#9abbd8]/20 rounded-xl">
          <div className="flex items-start gap-2 text-xs text-[#565656]">
            <svg className="w-4 h-4 text-[#9abbd8] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>
              Each cell shows the <strong>net {matrixMonthly ? 'monthly' : 'annual'} profit impact</strong> if you achieve that combination of CVR lift and AOV lift. <span className="text-[#72ab7f] font-semibold">Green = profitable</span>, <span className="text-[#e57373] font-semibold">red = loss</span>. Darker = larger magnitude. <strong>Click any cell</strong> for a plain English breakdown.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Key Takeaways ─── */}
      <div className="mt-6 bg-gradient-to-r from-[#10222b] to-[#243e42] rounded-2xl p-6 card-shadow-lg animate-fade-in-up">
        <h3 className="text-lg font-bold text-white mb-4">Key Takeaways</h3>
        <div className={`grid ${compareTwo ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4`}>
          <div className="bg-white/10 rounded-xl p-4 border border-white/10">
            <p className="text-sm text-[#9abbd8]">
              <span className="text-white font-semibold">Variation 1</span> pays for itself with just{' '}
              <span className="text-[#72ab7f] font-bold">{Math.round(calcs.v1BEOrders).toLocaleString()} extra orders</span> — a{' '}
              <span className="text-[#72ab7f] font-bold">{fmtPct(calcs.v1BEPct)} lift</span>.
            </p>
          </div>

          {compareTwo && (
            <div className="bg-white/10 rounded-xl p-4 border border-white/10">
              <p className="text-sm text-[#9abbd8]">
                <span className="text-white font-semibold">Variation 2</span> needs a{' '}
                <span className="text-white font-bold">{fmtPct(calcs.v2BEPct)}</span> conversion lift on its own
                {calcs.v2WithAOV20 < 0.5
                  ? <>, but if the threshold pushes AOV up by {sym}20, it&apos;s profitable at virtually any conversion improvement.</>
                  : <>, but only <span className="text-[#72ab7f] font-bold">{fmtPct(calcs.v2WithAOV20)}</span> with a {sym}20 AOV bump.</>
                }
              </p>
            </div>
          )}

          <div className="bg-white/10 rounded-xl p-4 border border-white/10">
            <p className="text-sm text-[#9abbd8]">
              <span className="text-white font-semibold">Maximum test cost: {fmt(calcs.totalTestCost)}</span> over one month.
              If neither variation wins, you&apos;ve spent {fmt(calcs.totalTestCost)} to definitively learn that shipping isn&apos;t your conversion barrier.
            </p>
          </div>

          <div className="bg-white/10 rounded-xl p-4 border border-white/10">
            <p className="text-sm text-[#9abbd8]">
              <span className="text-white font-semibold">Incremental orders don&apos;t cost CPA</span> — those visitors are already on site. The &ldquo;Realistic&rdquo; scenario is the right default.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Order Distribution ─── */}
      <div className="mt-6 bg-white border-2 border-[#9abbd8]/20 rounded-2xl card-shadow animate-fade-in-up overflow-hidden">
        <button
          onClick={() => setShowOrderDist(!showOrderDist)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-[#f4faff] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#4e7597]/10 rounded-lg">
              <svg className="w-5 h-5 text-[#4e7597]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[#10222b]">Order Distribution Reference</h3>
              <p className="text-xs text-[#565656]">
                {customBuckets ? 'Using your uploaded data' : 'Default Steadyrack distribution'}
              </p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-[#4e7597] transition-transform ${showOrderDist ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showOrderDist && (
          <div className="px-5 pb-5 animate-fade-in">
            {/* Paste data toggle */}
            <div className="mb-4">
              <button
                onClick={() => setShowPasteData(!showPasteData)}
                className="text-sm font-semibold text-[#4e7597] hover:text-[#10222b] transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {showPasteData ? 'Hide' : 'I have order data — paste it here'}
              </button>

              {showPasteData && (
                <div className="mt-3 p-4 bg-[#f4faff] border border-[#9abbd8]/20 rounded-xl animate-fade-in">
                  <p className="text-xs text-[#565656] mb-2">
                    Paste a column of order values from a Shopify export (one value per line). We&apos;ll auto-bucket them and populate your qualifying order counts.
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"268.50\n142.00\n315.99\n89.00\n..."}
                    rows={6}
                    className="w-full p-3 bg-white border-2 border-[#9abbd8]/30 rounded-xl text-sm text-[#10222b] font-mono focus:outline-none focus:border-[#4e7597] focus:ring-4 focus:ring-[#4e7597]/10 resize-none"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={parsePastedData}
                      disabled={!pasteText.trim()}
                      className="px-4 py-2 bg-[#4e7597] text-white text-sm font-semibold rounded-xl hover:bg-[#10222b] transition-colors disabled:opacity-40"
                    >
                      Process data
                    </button>
                    {customBuckets && (
                      <button
                        onClick={() => setCustomBuckets(null)}
                        className="text-xs text-[#565656] hover:text-[#e57373] transition-colors"
                      >
                        Reset to defaults
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-xs text-[#565656] font-semibold p-2 text-left border-b-2 border-[#9abbd8]/30">Bucket</th>
                  <th className="text-xs text-[#565656] font-semibold p-2 text-right border-b-2 border-[#9abbd8]/30">Orders</th>
                  <th className="text-xs text-[#565656] font-semibold p-2 text-right border-b-2 border-[#9abbd8]/30">%</th>
                  <th className="text-xs text-[#565656] font-semibold p-2 text-left border-b-2 border-[#9abbd8]/30 w-1/3"></th>
                </tr>
              </thead>
              <tbody>
                {activeBuckets.map((bucket) => {
                  const maxPct = Math.max(...activeBuckets.map(b => b.pct));
                  return (
                    <tr key={bucket.label} className="border-b border-[#9abbd8]/10">
                      <td className="text-sm text-[#10222b] p-2 font-medium">{bucket.label}</td>
                      <td className="text-sm text-[#10222b] p-2 text-right">{bucket.orders.toLocaleString()}</td>
                      <td className="text-sm text-[#4e7597] p-2 text-right font-semibold">{bucket.pct}%</td>
                      <td className="p-2">
                        <div className="w-full bg-[#f2efe6] rounded-full h-2">
                          <div className="bg-[#4e7597] h-2 rounded-full transition-all" style={{ width: `${(bucket.pct / maxPct) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      <div className="mt-8 text-center text-[#565656] text-sm">
        <p className="flex items-center justify-center gap-2">
          Powered by
          <span className="font-black text-[#10222b]">IMPACT.</span>
        </p>
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="mt-2 text-xs text-[#4e7597] hover:text-[#10222b] underline transition-colors"
        >
          Methodology
        </button>
        {showMethodology && (
          <div className="mt-3 max-w-2xl mx-auto text-left p-4 bg-[#f4faff] border border-[#9abbd8]/20 rounded-xl text-xs text-[#565656] animate-fade-in">
            <p>
              This calculator models the net profitability of offering free shipping above a threshold. The cost is the shipping revenue you stop collecting from customers. The benefit is incremental orders from improved conversion and higher AOV from threshold-chasing behaviour. Fulfilment costs are not included as they&apos;re identical across test groups — the only variable is what you charge the customer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
