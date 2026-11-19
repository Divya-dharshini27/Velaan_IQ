import React, { useState, useEffect } from 'react';
import { scenariosApi } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  formatINR,
  formatUSD,
  formatMT,
  formatNumber,
  formatPercent,
  formatDateIST,
  parseNum,
} from '../../utils/formatters';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { Skeleton, SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import {
  GitBranch,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  Layers,
  CheckCircle2,
  Sliders,
  DollarSign,
  TrendingDown,
} from 'lucide-react';

const DEFAULT_OVERRIDES = {
  domestic_price_change_pct: 0,
  international_price_change_pct: 0,
  usd_inr_change_pct: 0,
  freight_change_pct: 0,
  consumption_change_pct: 0,
  inventory_change_mt: 0,
  lead_time_change_days: 0,
};

export function ScenariosPage() {
  const toast = useToast();

  const [name, setName] = useState('');
  const [overrides, setOverrides] = useState(DEFAULT_OVERRIDES);
  const [customsDutyPct, setCustomsDutyPct] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activePreset, setActivePreset] = useState(null);

  const fetchScenariosHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await scenariosApi.getScenarios(1, 10);
      setHistory(res?.items || []);
    } catch (err) {
      console.warn('Could not load scenario history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchScenariosHistory();
  }, []);

  const handleOverrideChange = (field, val) => {
    const num = Number(val);
    setOverrides((prev) => ({ ...prev, [field]: num }));
    setActivePreset(null);
  };

  const handleReset = () => {
    setOverrides(DEFAULT_OVERRIDES);
    setCustomsDutyPct('');
    setName('');
    setActivePreset(null);
  };

  const applyPreset = (presetKey) => {
    setActivePreset(presetKey);
    const updated = { ...DEFAULT_OVERRIDES };
    if (presetKey === 'rupee_weakens') {
      updated.usd_inr_change_pct = 5;
      setName('Rupee Weakens 5% Against USD');
    } else if (presetKey === 'demand_surge') {
      updated.consumption_change_pct = 30;
      setName('Soybean Demand Surge (+30%)');
    } else if (presetKey === 'extra_stock') {
      updated.inventory_change_mt = 9000;
      setName('Strategic Reserve Inflow (+9,000 MT)');
    } else if (presetKey === 'freight_spike') {
      updated.freight_change_pct = 40;
      setName('Global Freight Rate Spike (+40%)');
    }
    setOverrides(updated);
  };

  const runSimulation = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: name.trim() || undefined,
        overrides: {
          domestic_price_change_pct: overrides.domestic_price_change_pct,
          international_price_change_pct: overrides.international_price_change_pct,
          usd_inr_change_pct: overrides.usd_inr_change_pct,
          freight_change_pct: overrides.freight_change_pct,
          consumption_change_pct: overrides.consumption_change_pct,
          inventory_change_mt: overrides.inventory_change_mt,
          lead_time_change_days: overrides.lead_time_change_days,
        },
        procurement: {},
      };

      if (customsDutyPct !== '') {
        payload.procurement.customs_duty_rate = Number(customsDutyPct) / 100;
      }

      const res = await scenariosApi.simulate(payload);
      setResult(res);
      toast.success(
        res.decision_changed
          ? `Simulation completed: Decision CHANGED (${res.baseline.decision} -> ${res.simulated.decision})`
          : `Simulation completed: Decision UNCHANGED (${res.simulated.decision})`
      );
      fetchScenariosHistory();
    } catch (err) {
      toast.error(err.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-white/70 p-5 rounded-2xl border border-stone-200/80 shadow-soft backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gold"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-forest-700 font-mono">
              What-If Stress Testing
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight mt-1">
            Scenario Simulator
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl">
            Simulate price swings, foreign exchange shifts, supply chain delays, and demand surges without modifying actual records.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <Button
            variant="primary"
            size="md"
            icon={Play}
            loading={loading}
            onClick={runSimulation}
          >
            Run What-If Simulation
          </Button>
        </div>
      </div>

      {/* Mandatory Blueprint Safety Note */}
      <div className="p-3.5 rounded-xl bg-forest-900 text-stone-200 text-xs flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gold animate-ping"></span>
          <span>
            <strong className="text-white font-semibold">Sandbox Guarantee:</strong> Simulations never change real inventory, prices or procurement decisions.
          </span>
        </div>
        <span className="text-[11px] text-forest-300 font-mono hidden sm:inline">ISOLATED SIMULATOR</span>
      </div>

      {/* Preset Scenario Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-ink-muted uppercase tracking-wider flex-shrink-0">
          Quick Presets:
        </span>
        <button
          type="button"
          onClick={() => applyPreset('rupee_weakens')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex-shrink-0 ${
            activePreset === 'rupee_weakens'
              ? 'bg-forest text-white border-forest'
              : 'bg-white text-ink border-stone-200 hover:bg-stone-50'
          }`}
        >
          Rupee weakens 5%
        </button>
        <button
          type="button"
          onClick={() => applyPreset('demand_surge')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex-shrink-0 ${
            activePreset === 'demand_surge'
              ? 'bg-forest text-white border-forest'
              : 'bg-white text-ink border-stone-200 hover:bg-stone-50'
          }`}
        >
          Demand +30%
        </button>
        <button
          type="button"
          onClick={() => applyPreset('extra_stock')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex-shrink-0 ${
            activePreset === 'extra_stock'
              ? 'bg-forest text-white border-forest'
              : 'bg-white text-ink border-stone-200 hover:bg-stone-50'
          }`}
        >
          Extra 9,000 MT stock
        </button>
        <button
          type="button"
          onClick={() => applyPreset('freight_spike')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex-shrink-0 ${
            activePreset === 'freight_spike'
              ? 'bg-forest text-white border-forest'
              : 'bg-white text-ink border-stone-200 hover:bg-stone-50'
          }`}
        >
          Freight spike +40%
        </button>
      </div>

      {/* Main Grid: Controls vs Comparison Result */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sliders & Numeric Controls (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-5">
          <Card
            title="Simulation Variables"
            subtitle="Adjust sliders or type exact percentage/unit shifts"
            icon={Sliders}
            action={
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-ink-muted hover:text-forest flex items-center gap-1 font-medium transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            }
          >
            <form onSubmit={runSimulation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Scenario Label / Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rupee depreciation stress test"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                />
              </div>

              {/* Slider 1: Domestic Price */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">Domestic Mandi Price Change</span>
                  <span className="font-mono font-bold text-forest">
                    {overrides.domestic_price_change_pct > 0 ? '+' : ''}
                    {overrides.domestic_price_change_pct}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-30"
                    max="50"
                    step="1"
                    value={overrides.domestic_price_change_pct}
                    onChange={(e) => handleOverrideChange('domestic_price_change_pct', e.target.value)}
                    className="w-full accent-forest cursor-pointer"
                  />
                  <input
                    type="number"
                    min="-90"
                    max="500"
                    value={overrides.domestic_price_change_pct}
                    onChange={(e) => handleOverrideChange('domestic_price_change_pct', e.target.value)}
                    className="w-16 px-2 py-1 text-xs rounded border border-stone-300 text-right font-mono"
                  />
                </div>
              </div>

              {/* Slider 2: International Price */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">International FOB/CFR Price Change</span>
                  <span className="font-mono font-bold text-gold-dark">
                    {overrides.international_price_change_pct > 0 ? '+' : ''}
                    {overrides.international_price_change_pct}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-30"
                    max="50"
                    step="1"
                    value={overrides.international_price_change_pct}
                    onChange={(e) => handleOverrideChange('international_price_change_pct', e.target.value)}
                    className="w-full accent-gold cursor-pointer"
                  />
                  <input
                    type="number"
                    min="-90"
                    max="500"
                    value={overrides.international_price_change_pct}
                    onChange={(e) => handleOverrideChange('international_price_change_pct', e.target.value)}
                    className="w-16 px-2 py-1 text-xs rounded border border-stone-300 text-right font-mono"
                  />
                </div>
              </div>

              {/* Slider 3: USD / INR Exchange Rate */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">USD / INR Exchange Rate Shift</span>
                  <span className="font-mono font-bold text-forest">
                    {overrides.usd_inr_change_pct > 0 ? '+' : ''}
                    {overrides.usd_inr_change_pct}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-10"
                    max="15"
                    step="0.5"
                    value={overrides.usd_inr_change_pct}
                    onChange={(e) => handleOverrideChange('usd_inr_change_pct', e.target.value)}
                    className="w-full accent-forest cursor-pointer"
                  />
                  <input
                    type="number"
                    min="-50"
                    max="100"
                    step="0.1"
                    value={overrides.usd_inr_change_pct}
                    onChange={(e) => handleOverrideChange('usd_inr_change_pct', e.target.value)}
                    className="w-16 px-2 py-1 text-xs rounded border border-stone-300 text-right font-mono"
                  />
                </div>
              </div>

              {/* Slider 4: Freight Change */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">Ocean / Mandi Freight Rate Shift</span>
                  <span className="font-mono font-bold text-forest">
                    {overrides.freight_change_pct > 0 ? '+' : ''}
                    {overrides.freight_change_pct}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    step="5"
                    value={overrides.freight_change_pct}
                    onChange={(e) => handleOverrideChange('freight_change_pct', e.target.value)}
                    className="w-full accent-forest cursor-pointer"
                  />
                  <input
                    type="number"
                    min="-90"
                    max="500"
                    value={overrides.freight_change_pct}
                    onChange={(e) => handleOverrideChange('freight_change_pct', e.target.value)}
                    className="w-16 px-2 py-1 text-xs rounded border border-stone-300 text-right font-mono"
                  />
                </div>
              </div>

              {/* Slider 5: Daily Consumption Change */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">Daily Crushing / Consumption Shift</span>
                  <span className="font-mono font-bold text-forest">
                    {overrides.consumption_change_pct > 0 ? '+' : ''}
                    {overrides.consumption_change_pct}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    step="5"
                    value={overrides.consumption_change_pct}
                    onChange={(e) => handleOverrideChange('consumption_change_pct', e.target.value)}
                    className="w-full accent-forest cursor-pointer"
                  />
                  <input
                    type="number"
                    min="-90"
                    max="500"
                    value={overrides.consumption_change_pct}
                    onChange={(e) => handleOverrideChange('consumption_change_pct', e.target.value)}
                    className="w-16 px-2 py-1 text-xs rounded border border-stone-300 text-right font-mono"
                  />
                </div>
              </div>

              {/* Slider 6: Inventory Level Change MT */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">Inventory Stock Adjustment (MT)</span>
                  <span className="font-mono font-bold text-forest">
                    {overrides.inventory_change_mt > 0 ? '+' : ''}
                    {formatNumber(overrides.inventory_change_mt, 0)} MT
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-10000"
                    max="10000"
                    step="500"
                    value={overrides.inventory_change_mt}
                    onChange={(e) => handleOverrideChange('inventory_change_mt', e.target.value)}
                    className="w-full accent-forest cursor-pointer"
                  />
                  <input
                    type="number"
                    value={overrides.inventory_change_mt}
                    onChange={(e) => handleOverrideChange('inventory_change_mt', e.target.value)}
                    className="w-20 px-2 py-1 text-xs rounded border border-stone-300 text-right font-mono"
                  />
                </div>
              </div>

              {/* Slider 7: Lead Time Shift Days */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">Supplier Lead Time Shift (Days)</span>
                  <span className="font-mono font-bold text-forest">
                    {overrides.lead_time_change_days > 0 ? '+' : ''}
                    {overrides.lead_time_change_days} days
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-10"
                    max="30"
                    step="1"
                    value={overrides.lead_time_change_days}
                    onChange={(e) => handleOverrideChange('lead_time_change_days', e.target.value)}
                    className="w-full accent-forest cursor-pointer"
                  />
                  <input
                    type="number"
                    min="-60"
                    max="180"
                    value={overrides.lead_time_change_days}
                    onChange={(e) => handleOverrideChange('lead_time_change_days', e.target.value)}
                    className="w-16 px-2 py-1 text-xs rounded border border-stone-300 text-right font-mono"
                  />
                </div>
              </div>

              {/* Customs Duty Field */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Customs Duty Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 5 (Leave empty to exclude international)"
                  value={customsDutyPct}
                  onChange={(e) => setCustomsDutyPct(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                />
                <span className="text-[11px] text-ink-muted block mt-0.5">
                  No default duty is assumed. Leave empty to exclude international.
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={Play}
                loading={loading}
                className="w-full"
              >
                Run Simulation
              </Button>
            </form>
          </Card>
        </div>

        {/* Comparison Results Area (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : result ? (
            <div className="space-y-5 animate-fade-in">
              {/* Verdict Banner */}
              <div
                className={`p-5 rounded-2xl border-2 flex items-center justify-between gap-4 shadow-sm ${
                  result.decision_changed
                    ? 'bg-amber-50/80 border-amber-400 text-amber-950'
                    : 'bg-emerald-50/80 border-emerald-400 text-emerald-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 ${
                      result.decision_changed ? 'bg-amber-600' : 'bg-emerald-600'
                    }`}
                  >
                    {result.decision_changed ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      {result.decision_changed ? 'Action Changed' : 'Action Stable'}
                    </span>
                    <h3 className="font-serif text-xl font-bold tracking-tight">
                      {result.decision_changed
                        ? `Decision Changed: ${result.baseline?.decision} → ${result.simulated?.decision}`
                        : `Decision Unchanged: Remains ${result.simulated?.decision}`}
                    </h3>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <Badge
                    status={result.decision_changed ? 'WARNING' : 'VALID'}
                    label={result.decision_changed ? 'Shift Detected' : 'Resilient Plan'}
                    size="md"
                  />
                </div>
              </div>

              {/* Side-by-side Baseline vs Simulated Hero Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Baseline Box */}
                <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-soft">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                      Current Baseline
                    </span>
                    <Badge status={result.baseline?.decision} size="sm" />
                  </div>
                  <div className="mt-3 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Action:</span>
                      <span className="font-bold text-ink">{result.baseline?.decision}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Recommended Qty:</span>
                      <span className="font-bold font-mono text-forest">
                        {formatMT(result.baseline?.recommended_quantity_mt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Sourcing Route:</span>
                      <span className="font-semibold">{result.baseline?.sourcing_route || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Landed / MT:</span>
                      <span className="font-mono">
                        {formatINR(result.baseline?.expected_landed_cost_per_mt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Total Cost:</span>
                      <span className="font-bold font-mono">
                        {formatINR(result.baseline?.total_cost_inr)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Coverage:</span>
                      <span>
                        {result.baseline?.inventory?.coverage_days
                          ? `${parseNum(result.baseline.inventory.coverage_days).toFixed(1)} days`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Simulated Box */}
                <div className="p-5 rounded-2xl bg-forest-50/70 border border-forest-200 shadow-soft">
                  <div className="flex items-center justify-between pb-3 border-b border-forest-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-forest-800">
                      Simulated Outcome
                    </span>
                    <Badge status={result.simulated?.decision} size="sm" />
                  </div>
                  <div className="mt-3 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-forest-700">Action:</span>
                      <span className="font-bold text-forest-900">{result.simulated?.decision}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forest-700">Recommended Qty:</span>
                      <span className="font-bold font-mono text-forest">
                        {formatMT(result.simulated?.recommended_quantity_mt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forest-700">Sourcing Route:</span>
                      <span className="font-semibold text-forest-900">
                        {result.simulated?.sourcing_route || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forest-700">Landed / MT:</span>
                      <span className="font-mono text-forest-900">
                        {formatINR(result.simulated?.expected_landed_cost_per_mt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forest-700">Total Cost:</span>
                      <span className="font-bold font-mono text-forest-900">
                        {formatINR(result.simulated?.total_cost_inr)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forest-700">Coverage:</span>
                      <span className="text-forest-900">
                        {result.simulated?.inventory?.coverage_days
                          ? `${parseNum(result.simulated.inventory.coverage_days).toFixed(1)} days`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Changes Metric Comparison Table */}
              <Card
                title="Metrics Shift Table"
                subtitle="All key indicators highlighted where variation occurred"
                icon={Layers}
              >
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-stone-50 border-b border-stone-200 text-ink-muted uppercase font-semibold">
                      <tr>
                        <th className="px-6 py-3">Metric</th>
                        <th className="px-4 py-3">Baseline</th>
                        <th className="px-4 py-3">Simulated</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {result.changes?.map((ch, idx) => (
                        <tr
                          key={idx}
                          className={`${
                            ch.changed ? 'bg-amber-50/50 font-medium' : 'text-ink-muted'
                          } hover:bg-stone-50 transition`}
                        >
                          <td className="px-6 py-3 font-semibold text-ink capitalize">
                            {ch.metric.replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3 font-mono">{ch.baseline ?? '—'}</td>
                          <td className="px-4 py-3 font-mono font-bold text-ink">
                            {ch.simulated ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            {ch.changed ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                                Changed
                              </span>
                            ) : (
                              <span className="text-[11px] text-stone-400">Identical</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Simulation Reasoning Timeline */}
              {Array.isArray(result.simulated?.reasoning) && (
                <Card
                  title="Simulated Decision Reasoning"
                  subtitle="How the stress-tested variables affected rules execution"
                  icon={Sparkles}
                >
                  <ul className="space-y-2 text-xs sm:text-sm">
                    {result.simulated.reasoning.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-stone-50">
                        <span className="w-5 h-5 rounded-full bg-forest-100 text-forest font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-ink leading-relaxed font-medium">{r}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          ) : (
            <Card className="text-center py-16">
              <EmptyState
                icon={GitBranch}
                title="Scenario Ready to Simulate"
                description="Use the left panel sliders to set price or supply shifts, or choose a preset like 'Rupee weakens 5%', then click 'Run What-If Simulation'."
                actionLabel="Run Default Simulation"
                onAction={runSimulation}
              />
            </Card>
          )}

          {/* Scenario History Section */}
          <Card
            title="Saved Simulation Scenarios"
            subtitle="Previous stress test runs recorded in database"
            icon={Clock}
          >
            {historyLoading ? (
              <SkeletonTable rows={3} cols={4} />
            ) : history.length > 0 ? (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200 text-ink-muted uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-3">Created</th>
                      <th className="px-4 py-3">Scenario Name</th>
                      <th className="px-4 py-3">Baseline</th>
                      <th className="px-4 py-3">Simulated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50 transition">
                        <td className="px-6 py-3 text-ink-muted">
                          {formatDateIST(item.created_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-ink">
                          {item.name || `Simulation ${item.id.substring(0, 8)}`}
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={item.baseline_decision} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={item.simulated_decision} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-ink-muted italic py-4">No previous simulations recorded.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ScenariosPage;
