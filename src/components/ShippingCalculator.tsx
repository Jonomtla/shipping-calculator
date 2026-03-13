'use client';

import { useState, useMemo } from 'react';

/* ─── Formatters ─── */
const fmt = (n: number) => '$' + Math.round(n).toLocaleString();
const fmtPct = (n: number) => n.toFixed(1) + '%';
const fmtOrders = (n: number) => Math.round(n).toLocaleString();

/* ─── Order Distribution (hardcoded reference) ─── */
const ORDER_BUCKETS = [
  { label: '$0–50', orders: 967, pct: 6.0 },
  { label: '$50–100', orders: 466, pct: 2.9 },
  { label: '$100–150', orders: 2567, pct: 15.9 },
  { label: '$150–200', orders: 2094, pct: 13.0 },
  { label: '$200–250', orders: 3281, pct: 20.3 },
  { label: '$250–300', orders: 1479, pct: 9.2 },
  { label: '$300–400', orders: 2348, pct: 14.5 },
  { label: '$400–500', orders: 1475, pct: 9.1 },
  { label: '$500–750', orders: 1114, pct: 6.9 },
  { label: '$750+', orders: 320, pct: 2.0 },
];

/* ─── Scenario Matrix Axes ─── */
const CVR_LIFTS = [1, 2, 3, 5, 7, 10, 15];
const AOV_LIFTS = [0, 10, 20, 30];

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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="group">
      <label className="flex items-center justify-between mb-2 text-sm font-medium text-[#10222b]">
        <span>{label}</span>
        <span className="text-[#4e7597] font-semibold">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </span>
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
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
  let color: string, bg: string, border: string, text: string;
  if (breakEvenPct <= 5) {
    color = 'text-[#72ab7f]';
    bg = 'bg-[#72ab7f]/10';
    border = 'border-[#72ab7f]/30';
    text = 'Easy — low lift needed';
  } else if (breakEvenPct <= 10) {
    color = 'text-[#d4a84b]';
    bg = 'bg-[#d4a84b]/10';
    border = 'border-[#d4a84b]/30';
    text = 'Moderate — achievable with good execution';
  } else {
    color = 'text-[#e57373]';
    bg = 'bg-[#e57373]/10';
    border = 'border-[#e57373]/30';
    text = 'Tough — needs significant uplift';
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bg} ${border}`}>
      <div className={`w-2.5 h-2.5 rounded-full ${breakEvenPct <= 5 ? 'bg-[#72ab7f]' : breakEvenPct <= 10 ? 'bg-[#d4a84b]' : 'bg-[#e57373]'}`} />
      <span className={`text-sm font-semibold ${color}`}>{text}</span>
    </div>
  );
}

/* ─── Matrix Cell Color ─── */
function getCellColor(value: number, maxAbs: number): string {
  if (maxAbs === 0) return 'bg-gray-100';
  const intensity = Math.min(Math.abs(value) / maxAbs, 1);

  if (value > 0) {
    if (intensity > 0.7) return 'bg-[#72ab7f] text-white';
    if (intensity > 0.4) return 'bg-[#72ab7f]/60 text-[#10222b]';
    if (intensity > 0.15) return 'bg-[#72ab7f]/30 text-[#10222b]';
    return 'bg-[#72ab7f]/15 text-[#10222b]';
  } else {
    if (intensity > 0.7) return 'bg-[#e57373] text-white';
    if (intensity > 0.4) return 'bg-[#e57373]/60 text-[#10222b]';
    if (intensity > 0.15) return 'bg-[#e57373]/30 text-[#10222b]';
    return 'bg-[#e57373]/15 text-[#10222b]';
  }
}

/* ─── Main Calculator ─── */
export default function ShippingCalculator() {
  // Inputs — Business metrics
  const [annualOrders, setAnnualOrders] = useState(16153);
  const [aov, setAov] = useState(268);
  const [marginPct, setMarginPct] = useState(60);
  const [cpa, setCpa] = useState(45);
  const [flatRateShipping, setFlatRateShipping] = useState(10);
  const [standardShipping, setStandardShipping] = useState(30);

  // Inputs — Test thresholds
  const [threshold1, setThreshold1] = useState(300);
  const [threshold2, setThreshold2] = useState(200);

  // Inputs — Qualifying orders
  const [ordersAboveT1, setOrdersAboveT1] = useState(5257);
  const [ordersAboveT2, setOrdersAboveT2] = useState(10017);

  // Toggle for CPA in scenario matrix
  const [showInclCPA, setShowInclCPA] = useState(false);

  // Expandable order distribution
  const [showOrderDist, setShowOrderDist] = useState(false);

  // Calculations
  // Margin already includes CPA. For incremental orders that don't cost CPA,
  // we add CPA back to get the "excl CPA" (realistic) contribution.
  const calcs = useMemo(() => {
    const margin = marginPct / 100;

    // Orders between threshold 2 and threshold 1
    const ordersBetween = ordersAboveT2 - ordersAboveT1;

    // Contribution per incremental order
    const contribInclCPA = aov * margin; // margin already has CPA baked in
    const contribExclCPA = aov * margin + cpa; // add CPA back (these orders don't need acquisition)

    // --- Variation 1: Free Shipping above threshold 1 ---
    const v1ShippingLost = ordersAboveT1 * flatRateShipping;
    const v1BreakevenOrders = contribInclCPA > 0 ? v1ShippingLost / contribInclCPA : Infinity;
    const v1BreakevenPct = annualOrders > 0 ? (v1BreakevenOrders / annualOrders) * 100 : 0;
    const v1BreakevenOrdersExcl = contribExclCPA > 0 ? v1ShippingLost / contribExclCPA : Infinity;
    const v1BreakevenPctExcl = annualOrders > 0 ? (v1BreakevenOrdersExcl / annualOrders) * 100 : 0;
    const v1TestCost = (v1ShippingLost / 12) * (1 / 3);

    // --- Variation 2: Free Shipping above threshold 2 ---
    const v2ShippingLost = (ordersBetween * standardShipping) + (ordersAboveT1 * flatRateShipping);
    const v2BreakevenOrders = contribInclCPA > 0 ? v2ShippingLost / contribInclCPA : Infinity;
    const v2BreakevenPct = annualOrders > 0 ? (v2BreakevenOrders / annualOrders) * 100 : 0;
    const v2BreakevenOrdersExcl = contribExclCPA > 0 ? v2ShippingLost / contribExclCPA : Infinity;
    const v2BreakevenPctExcl = annualOrders > 0 ? (v2BreakevenOrdersExcl / annualOrders) * 100 : 0;
    const v2TestCost = (v2ShippingLost / 12) * (1 / 3);

    // --- Scenario Matrix for Variation 2 ---
    const buildMatrix = (useCPA: boolean) => {
      const contribPerOrder = useCPA ? contribInclCPA : contribExclCPA;
      return AOV_LIFTS.map((aovLift) =>
        CVR_LIFTS.map((cvrLift) => {
          const additionalOrders = annualOrders * (cvrLift / 100);
          const revenueFromNewOrders = additionalOrders * contribPerOrder;
          const revenueFromAOVLift = aovLift * annualOrders * margin;
          return revenueFromNewOrders + revenueFromAOVLift - v2ShippingLost;
        })
      );
    };

    const matrixExclCPA = buildMatrix(false);
    const matrixInclCPA = buildMatrix(true);

    const allValues = [...matrixExclCPA.flat(), ...matrixInclCPA.flat()];
    const maxAbs = Math.max(...allValues.map(Math.abs), 1);

    // Callout: CVR lift needed with $20 AOV bump (excl CPA / realistic)
    const v2WithAOV20 = (() => {
      const aovLift = 20;
      const aovContrib = aovLift * annualOrders * margin;
      const remaining = v2ShippingLost - aovContrib;
      if (remaining <= 0) return 0;
      return contribExclCPA > 0 ? (remaining / contribExclCPA / annualOrders) * 100 : Infinity;
    })();

    return {
      v1ShippingLost,
      v1BreakevenOrders,
      v1BreakevenPct,
      v1BreakevenOrdersExcl,
      v1BreakevenPctExcl,
      v1TestCost,
      v2ShippingLost,
      v2BreakevenOrders,
      v2BreakevenPct,
      v2BreakevenOrdersExcl,
      v2BreakevenPctExcl,
      v2TestCost,
      matrixExclCPA,
      matrixInclCPA,
      maxAbs,
      v2WithAOV20,
    };
  }, [annualOrders, aov, marginPct, cpa, flatRateShipping, standardShipping, ordersAboveT1, ordersAboveT2]);

  const activeMatrix = showInclCPA ? calcs.matrixInclCPA : calcs.matrixExclCPA;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10 animate-fade-in-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-4xl font-black text-[#10222b] tracking-tight">IMPACT.</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-[#10222b] mb-3 tracking-tight">
          Free Shipping Profitability Calculator
        </h1>
        <p className="text-[#565656] text-lg max-w-2xl mx-auto">
          Model the financial impact of free shipping thresholds.
          Adjust assumptions and instantly see breakeven points.
        </p>
      </div>

      {/* Main Grid: Inputs + Variation Cards */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Inputs Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Metrics */}
          <div className="bg-white border-2 border-[#9abbd8]/20 rounded-2xl p-6 card-shadow animate-fade-in-left">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#4e7597]/10 rounded-lg">
                <svg className="w-5 h-5 text-[#4e7597]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[#10222b]">Business Metrics</h2>
            </div>

            <div className="space-y-5">
              <SliderInput label="Annual orders" value={annualOrders} onChange={setAnnualOrders} min={1000} max={100000} step={100} />
              <SliderInput label="Average order value" value={aov} onChange={setAov} min={50} max={500} step={1} prefix="$" />
              <SliderInput label="Contribution margin %" value={marginPct} onChange={setMarginPct} min={30} max={80} step={1} suffix="%" />
              <SliderInput label="Cost per acquisition" value={cpa} onChange={setCpa} min={0} max={150} step={1} prefix="$" />

              <div className="border-t border-[#9abbd8]/20 my-4" />

              <SliderInput label="Shipping charge on high-value orders" value={flatRateShipping} onChange={setFlatRateShipping} min={0} max={50} step={1} prefix="$" />
              <SliderInput label="Standard shipping charge" value={standardShipping} onChange={setStandardShipping} min={0} max={80} step={1} prefix="$" />
            </div>
          </div>

          {/* Test Thresholds */}
          <div className="bg-white border-2 border-[#72ab7f]/20 rounded-2xl p-6 card-shadow animate-fade-in-left">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#72ab7f]/10 rounded-lg">
                <svg className="w-5 h-5 text-[#72ab7f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[#10222b]">Test Thresholds</h2>
            </div>

            <div className="space-y-5">
              <SliderInput label="Variation 1 — free shipping above" value={threshold1} onChange={setThreshold1} min={100} max={500} step={10} prefix="$" />
              <SliderInput label="Orders above this threshold" value={ordersAboveT1} onChange={setOrdersAboveT1} min={0} max={annualOrders} step={1} />

              <div className="border-t border-[#9abbd8]/20 my-4" />

              <SliderInput label="Variation 2 — free shipping above" value={threshold2} onChange={setThreshold2} min={50} max={500} step={10} prefix="$" />
              <SliderInput label="Orders above this threshold" value={ordersAboveT2} onChange={setOrdersAboveT2} min={0} max={annualOrders} step={1} />

              <div className="text-xs text-[#565656] bg-[#f4faff] rounded-lg p-3 border border-[#9abbd8]/20">
                <span className="font-semibold text-[#4e7597]">{fmtPct((ordersAboveT1 / annualOrders) * 100)}</span> of orders are above {fmt(threshold1)}
                &nbsp;·&nbsp;
                <span className="font-semibold text-[#4e7597]">{fmtPct((ordersAboveT2 / annualOrders) * 100)}</span> are above {fmt(threshold2)}
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* Variation Cards */}
          <div className="grid md:grid-cols-2 gap-4 animate-fade-in-right">
            {/* Variation 1 */}
            <div className="bg-white border-2 border-[#9abbd8]/20 rounded-2xl p-5 card-shadow hover-lift">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-[#4e7597]/20 rounded-lg">
                  <svg className="w-4 h-4 text-[#4e7597]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#10222b]">Variation 1: Free Shipping &gt;{fmt(threshold1)}</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-[#9abbd8]/15">
                  <span className="text-sm text-[#565656]">Shipping revenue forfeited</span>
                  <span className="text-lg font-bold text-[#e57373]">{fmt(calcs.v1ShippingLost)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#9abbd8]/15">
                  <span className="text-sm text-[#565656]">Breakeven</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[#10222b]">{fmtOrders(calcs.v1BreakevenOrders)} orders</span>
                    <div className="text-xs text-[#4e7597]">{fmtPct(calcs.v1BreakevenPct)} lift</div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#9abbd8]/15">
                  <span className="text-sm text-[#565656]/60">Breakeven (excl CPA)</span>
                  <div className="text-right opacity-60">
                    <span className="text-sm font-semibold text-[#565656]">{fmtOrders(calcs.v1BreakevenOrdersExcl)} orders</span>
                    <div className="text-xs text-[#565656]">{fmtPct(calcs.v1BreakevenPctExcl)} lift</div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#9abbd8]/15">
                  <span className="text-sm text-[#565656]">Test cost (33%, 1 month)</span>
                  <span className="font-semibold text-[#10222b]">{fmt(calcs.v1TestCost)}</span>
                </div>
                <VerdictBadge breakEvenPct={calcs.v1BreakevenPct} />
              </div>
            </div>

            {/* Variation 2 */}
            <div className="bg-gradient-to-br from-[#243e42]/5 to-[#72ab7f]/10 border-2 border-[#72ab7f]/30 rounded-2xl p-5 card-shadow hover-lift">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-[#72ab7f]/20 rounded-lg">
                  <svg className="w-4 h-4 text-[#72ab7f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#243e42]">Variation 2: Free Shipping &gt;{fmt(threshold2)}</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-[#72ab7f]/20">
                  <span className="text-sm text-[#565656]">Shipping revenue forfeited</span>
                  <span className="text-lg font-bold text-[#e57373]">{fmt(calcs.v2ShippingLost)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#72ab7f]/20">
                  <span className="text-sm text-[#565656]">Breakeven</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[#243e42]">{fmtOrders(calcs.v2BreakevenOrders)} orders</span>
                    <div className="text-xs text-[#4e7597]">{fmtPct(calcs.v2BreakevenPct)} lift</div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#72ab7f]/20">
                  <span className="text-sm text-[#565656]/60">Breakeven (excl CPA)</span>
                  <div className="text-right opacity-60">
                    <span className="text-sm font-semibold text-[#565656]">{fmtOrders(calcs.v2BreakevenOrdersExcl)} orders</span>
                    <div className="text-xs text-[#565656]">{fmtPct(calcs.v2BreakevenPctExcl)} lift</div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#72ab7f]/20">
                  <span className="text-sm text-[#565656]">Test cost (33%, 1 month)</span>
                  <span className="font-semibold text-[#243e42]">{fmt(calcs.v2TestCost)}</span>
                </div>
                <VerdictBadge breakEvenPct={calcs.v2BreakevenPct} />
              </div>
            </div>
          </div>

          {/* Test Cost Callout */}
          <div className="bg-gradient-to-r from-[#f4faff] to-white border-2 border-[#9abbd8]/20 rounded-2xl p-5 card-shadow animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-[#4e7597]/10 rounded-lg">
                <svg className="w-5 h-5 text-[#4e7597]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#10222b]">Test Risk Exposure</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 border border-[#9abbd8]/20">
                <div className="text-xs text-[#565656] mb-1">Variation 1 test cost (1 month)</div>
                <div className="text-2xl font-bold text-[#4e7597]">{fmt(calcs.v1TestCost)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#72ab7f]/20">
                <div className="text-xs text-[#565656] mb-1">Variation 2 test cost (1 month)</div>
                <div className="text-2xl font-bold text-[#72ab7f]">{fmt(calcs.v2TestCost)}</div>
              </div>
            </div>
            <p className="text-xs text-[#565656] mt-3">
              Based on 33% traffic allocation for one month. This is the maximum downside — actual exposure is lower if orders don&apos;t change.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Scenario Matrix (Hero Element) ─── */}
      <div className="mt-8 bg-white border-2 border-[#9abbd8]/20 rounded-2xl p-6 card-shadow animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#7e84e5]/10 rounded-lg">
              <svg className="w-5 h-5 text-[#7e84e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#10222b]">Scenario Matrix — Variation 2 (Free Shipping &gt;{fmt(threshold2)})</h2>
              <p className="text-sm text-[#565656]">Net annual profit impact across CVR lift + AOV lift combinations</p>
            </div>
          </div>

          {/* Toggle: Excl CPA / Incl CPA */}
          <div className="flex items-center bg-[#f2efe6] rounded-lg p-1">
            <button
              onClick={() => setShowInclCPA(false)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                !showInclCPA
                  ? 'bg-[#4e7597] text-white shadow-md'
                  : 'text-[#565656] hover:text-[#10222b]'
              }`}
            >
              Excl CPA
            </button>
            <button
              onClick={() => setShowInclCPA(true)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                showInclCPA
                  ? 'bg-[#4e7597] text-white shadow-md'
                  : 'text-[#565656] hover:text-[#10222b]'
              }`}
            >
              Incl CPA
            </button>
          </div>
        </div>

        {/* Mode label */}
        <div className="mb-4 px-3 py-2 bg-[#f4faff] border border-[#9abbd8]/20 rounded-lg inline-block">
          <span className="text-xs font-semibold text-[#4e7597]">
            {showInclCPA
              ? 'Worst case: if every new order also costs full CPA'
              : 'Realistic: incremental orders don\'t cost ad spend'}
          </span>
        </div>

        {/* Matrix Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-xs text-[#565656] font-semibold p-2 text-left border-b-2 border-[#9abbd8]/30">
                  AOV Lift ↓ / CVR Lift →
                </th>
                {CVR_LIFTS.map((cvr) => (
                  <th key={cvr} className="text-xs text-[#4e7597] font-bold p-2 text-center border-b-2 border-[#9abbd8]/30 min-w-[80px]">
                    +{cvr}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AOV_LIFTS.map((aovLift, rowIdx) => (
                <tr key={aovLift}>
                  <td className="text-sm font-semibold text-[#10222b] p-2 border-b border-[#9abbd8]/15">
                    +${aovLift}
                  </td>
                  {CVR_LIFTS.map((_, colIdx) => {
                    const value = activeMatrix[rowIdx][colIdx];
                    return (
                      <td
                        key={colIdx}
                        className={`text-center p-2 text-sm font-semibold border-b border-[#9abbd8]/10 rounded-lg ${getCellColor(value, calcs.maxAbs)}`}
                      >
                        {value >= 0 ? '+' : ''}{fmt(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* How to read this */}
        <div className="mt-4 p-4 bg-[#f4faff] border border-[#9abbd8]/20 rounded-xl">
          <div className="flex items-start gap-2 text-xs text-[#565656]">
            <svg className="w-4 h-4 text-[#9abbd8] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-[#10222b] mb-1">How to read this matrix</p>
              <p>Each cell shows the <strong>net annual profit impact</strong> of Variation 2 if you achieve that combination of CVR lift (columns) and AOV lift (rows). <span className="text-[#72ab7f] font-semibold">Green = profitable</span>, <span className="text-[#e57373] font-semibold">red = loss</span>. Find the combinations where the test pays for itself.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Key Callouts ─── */}
      <div className="mt-6 bg-gradient-to-r from-[#10222b] to-[#243e42] rounded-2xl p-6 card-shadow-lg animate-fade-in-up">
        <h3 className="text-lg font-bold text-white mb-4">Key Takeaways</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-4 border border-white/10">
            <p className="text-sm text-[#9abbd8]">
              <span className="text-white font-semibold">Variation 1</span> breaks even at just{' '}
              <span className="text-[#72ab7f] font-bold">{fmtOrders(calcs.v1BreakevenOrders)} additional orders</span>{' '}
              (<span className="text-[#72ab7f] font-bold">{fmtPct(calcs.v1BreakevenPct)} lift</span>)
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 border border-white/10">
            <p className="text-sm text-[#9abbd8]">
              <span className="text-white font-semibold">Variation 2</span> needs{' '}
              <span className="text-white font-bold">{fmtPct(calcs.v2BreakevenPct)}</span> CVR lift alone, but only{' '}
              <span className="text-[#72ab7f] font-bold">{fmtPct(calcs.v2WithAOV20)}</span> with a $20 AOV bump
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 border border-white/10">
            <p className="text-sm text-[#9abbd8]">
              <span className="text-white font-semibold">Test cost exposure:</span>{' '}
              <span className="text-white font-bold">{fmt(calcs.v1TestCost)}</span> (Variation 1) /{' '}
              <span className="text-white font-bold">{fmt(calcs.v2TestCost)}</span> (Variation 2) for one month
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 border border-white/10">
            <p className="text-sm text-[#9abbd8]">
              <span className="text-white font-semibold">Incremental orders from free shipping don&apos;t cost CPA</span> — those visitors are already on site
            </p>
          </div>
        </div>
      </div>

      {/* ─── Order Distribution Reference ─── */}
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
                67.5% of orders are under $300 · 38% under $200
              </p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-[#4e7597] transition-transform ${showOrderDist ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showOrderDist && (
          <div className="px-5 pb-5 animate-fade-in">
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
                {ORDER_BUCKETS.map((bucket) => (
                  <tr key={bucket.label} className="border-b border-[#9abbd8]/10">
                    <td className="text-sm text-[#10222b] p-2 font-medium">{bucket.label}</td>
                    <td className="text-sm text-[#10222b] p-2 text-right">{bucket.orders.toLocaleString()}</td>
                    <td className="text-sm text-[#4e7597] p-2 text-right font-semibold">{bucket.pct}%</td>
                    <td className="p-2">
                      <div className="w-full bg-[#f2efe6] rounded-full h-2">
                        <div
                          className="bg-[#4e7597] h-2 rounded-full transition-all"
                          style={{ width: `${(bucket.pct / 20.3) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <div className="px-3 py-1.5 bg-[#e57373]/10 border border-[#e57373]/20 rounded-lg text-[#e57373] font-semibold">
                67.5% under $300 — don&apos;t qualify for flat rate
              </div>
              <div className="px-3 py-1.5 bg-[#d4a84b]/10 border border-[#d4a84b]/20 rounded-lg text-[#d4a84b] font-semibold">
                38% under $200
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-[#565656] text-sm">
        <p className="flex items-center justify-center gap-2">
          Powered by
          <span className="font-black text-[#10222b]">IMPACT.</span>
        </p>
      </div>
    </div>
  );
}
