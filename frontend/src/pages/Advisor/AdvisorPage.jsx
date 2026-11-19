import React, { useState, useEffect } from 'react';
import { procurementApi } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  formatINR,
  formatUSD,
  formatMT,
  formatNumber,
  formatDateIST,
  parseNum,
} from '../../utils/formatters';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { Skeleton, SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  ShieldAlert,
  Play,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Truck,
  ArrowRight,
  TrendingUp,
  FileText,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function AdvisorPage() {
  const toast = useToast();

  // Form parameters with sensible defaults
  const [params, setParams] = useState({
    planning_horizon_days: 30,
    service_level: 0.95,
    fixed_safety_stock_mt: '',
    strategic_stock_mt: 0,
    budget_inr: '',
    incoterm: 'FOB',
    customs_duty_rate: '', // entered as percentage, sent as fraction (divide by 100)
    non_recoverable_tax_rate: '',
    recoverable_tax_rate: '',
    consumption_days: 30,
    max_data_age_days: 7,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Collapsible sections state
  const [showWarnings, setShowWarnings] = useState(true);
  const [showRejected, setShowRejected] = useState(false);
  const [showTriggers, setShowTriggers] = useState(false);

  // Fetch initial recommendation and history
  const fetchDecisionsHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await procurementApi.getDecisions(1, 10);
      setHistory(res?.items || []);
    } catch (err) {
      console.warn('Could not load decision history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisionsHistory();
  }, []);

  const handleInputChange = (field, value) => {
    setParams((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setParams({
      planning_horizon_days: 30,
      service_level: 0.95,
      fixed_safety_stock_mt: '',
      strategic_stock_mt: 0,
      budget_inr: '',
      incoterm: 'FOB',
      customs_duty_rate: '',
      non_recoverable_tax_rate: '',
      recoverable_tax_rate: '',
      consumption_days: 30,
      max_data_age_days: 7,
    });
  };

  const runRecommendation = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        planning_horizon_days: Number(params.planning_horizon_days) || 30,
        service_level: Number(params.service_level) || 0.95,
        strategic_stock_mt: Number(params.strategic_stock_mt) || 0,
        consumption_days: Number(params.consumption_days) || 30,
        max_data_age_days: Number(params.max_data_age_days) || 7,
        incoterm: params.incoterm || 'FOB',
      };

      if (params.fixed_safety_stock_mt !== '') {
        payload.fixed_safety_stock_mt = Number(params.fixed_safety_stock_mt);
      }
      if (params.budget_inr !== '') {
        payload.budget_inr = Number(params.budget_inr);
      }
      // Customs duty is entered as PERCENT in UI and sent as fraction
      if (params.customs_duty_rate !== '') {
        payload.customs_duty_rate = Number(params.customs_duty_rate) / 100;
      }
      if (params.non_recoverable_tax_rate !== '') {
        payload.non_recoverable_tax_rate = Number(params.non_recoverable_tax_rate) / 100;
      }
      if (params.recoverable_tax_rate !== '') {
        payload.recoverable_tax_rate = Number(params.recoverable_tax_rate) / 100;
      }

      const res = await procurementApi.recommend(payload);
      setResult(res);
      toast.success(`Recommendation calculated: ${res.decision}`);
      fetchDecisionsHistory();
    } catch (err) {
      toast.error(err.message || 'Failed to generate recommendation');
    } finally {
      setLoading(false);
    }
  };

  // Landed cost chart data preparation
  const getCostChartData = () => {
    if (!result?.market) return [];
    const domCost = parseNum(result.market.domestic_landed_cost_per_mt, 0);
    const intCost = parseNum(result.market.international_landed_cost_per_mt, 0);

    return [
      {
        route: 'Domestic Mandi',
        cost: domCost,
        fill: '#14432A',
      },
      {
        route: 'International Port',
        cost: intCost,
        fill: '#D9A441',
      },
    ];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-white/70 p-5 rounded-2xl border border-stone-200/80 shadow-soft backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-leaf"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-forest-700 font-mono">
              Decision Support Engine
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight mt-1">
            Procurement Advisor
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl">
            Calculates WHEN to buy, HOW MUCH soybean to reorder, and WHICH sourcing route (Domestic vs International) minimizes landed cost while protecting inventory continuity.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <Button
            variant="primary"
            size="md"
            icon={Play}
            loading={loading}
            onClick={runRecommendation}
          >
            Compute Recommendation
          </Button>
        </div>
      </div>

      {/* Main Grid: Form (Left) vs Results (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-5">
          <Card
            title="Planning Parameters"
            subtitle="Configure constraints and tax assumptions"
            icon={FileText}
            action={
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-ink-muted hover:text-forest flex items-center gap-1 font-medium transition"
                title="Reset to defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            }
          >
            <form onSubmit={runRecommendation} className="space-y-5">
              {/* Group 1: Planning & Service Level */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-forest-800 border-b border-forest-100 pb-1 block">
                  1. Planning &amp; Target Service
                </span>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Planning Horizon (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={params.planning_horizon_days}
                    onChange={(e) => handleInputChange('planning_horizon_days', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    Days forward to plan soybean replenishment (default: 30)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Target Service Level (Fraction 0.50 - 0.999)
                  </label>
                  <select
                    value={params.service_level}
                    onChange={(e) => handleInputChange('service_level', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  >
                    <option value="0.90">90% (Z = 1.28) - Normal Operations</option>
                    <option value="0.95">95% (Z = 1.645) - Recommended ABT Standard</option>
                    <option value="0.98">98% (Z = 2.05) - High Protection</option>
                    <option value="0.99">99% (Z = 2.33) - Critical Stock Continuity</option>
                  </select>
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    Controls King's safety stock multiplier
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Historical Consumption Window (Days)
                  </label>
                  <input
                    type="number"
                    min="7"
                    max="365"
                    value={params.consumption_days}
                    onChange={(e) => handleInputChange('consumption_days', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    Past days used to compute daily mean &amp; stdev (7 - 365)
                  </span>
                </div>
              </div>

              {/* Group 2: Stock Buffers */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <span className="text-xs font-bold uppercase tracking-wider text-forest-800 border-b border-forest-100 pb-1 block">
                  2. Safety &amp; Strategic Stock Buffers
                </span>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Strategic Stock Buffer (MT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={params.strategic_stock_mt}
                    onChange={(e) => handleInputChange('strategic_stock_mt', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    Extra operational reserve buffer maintained on top of safety stock
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Fixed Safety Stock Override (MT, optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Leave empty for dynamic statistical formula"
                    value={params.fixed_safety_stock_mt}
                    onChange={(e) => handleInputChange('fixed_safety_stock_mt', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    If set, overrides the dynamic formula (King's formula)
                  </span>
                </div>
              </div>

              {/* Group 3: Financial & Landed Cost Assumptions */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <span className="text-xs font-bold uppercase tracking-wider text-forest-800 border-b border-forest-100 pb-1 block">
                  3. Financial &amp; Import Assumptions
                </span>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Procurement Budget Limit (INR, optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50000000"
                    value={params.budget_inr}
                    onChange={(e) => handleInputChange('budget_inr', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    Maximum expenditure cap for recommended purchase
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    International Incoterm
                  </label>
                  <select
                    value={params.incoterm}
                    onChange={(e) => handleInputChange('incoterm', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  >
                    <option value="FOB">FOB (Free on Board - Origin port)</option>
                    <option value="CFR">CFR (Cost and Freight - Destination port)</option>
                    <option value="CIF">CIF (Cost, Insurance &amp; Freight included)</option>
                  </select>
                </div>

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
                    value={params.customs_duty_rate}
                    onChange={(e) => handleInputChange('customs_duty_rate', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                  <span className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded block mt-1">
                    <strong>Notice:</strong> No default duty is assumed. Leave empty to exclude the international route.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Non-Rec. Tax (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={params.non_recoverable_tax_rate}
                      onChange={(e) => handleInputChange('non_recoverable_tax_rate', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Rec. Tax (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={params.recoverable_tax_rate}
                      onChange={(e) => handleInputChange('recoverable_tax_rate', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Max Data Staleness (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={params.max_data_age_days}
                    onChange={(e) => handleInputChange('max_data_age_days', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    Threshold for raising data freshness warnings (default: 7 days)
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={Play}
                loading={loading}
                className="w-full"
              >
                Run Recommendation
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Output Area (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-6">
          {loading ? (
            <div className="space-y-6">
              <Skeleton className="h-44 w-full rounded-2xl" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
              </div>
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : result ? (
            <div className="space-y-6 animate-fade-in">
              {/* Hero Decision Result Card */}
              <Card
                className={`border-2 ${
                  result.decision === 'BUY'
                    ? 'border-emerald-500 bg-gradient-to-br from-emerald-50/50 to-white'
                    : result.decision === 'WAIT'
                    ? 'border-amber-500 bg-gradient-to-br from-amber-50/50 to-white'
                    : 'border-slate-400 bg-gradient-to-br from-slate-50/50 to-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                      Recommendation Verdict
                    </span>
                    <div className="flex items-center gap-3 mt-1">
                      <h2 className="font-serif text-3xl font-extrabold text-ink tracking-tight">
                        {result.decision}
                      </h2>
                      <Badge status={result.decision} size="lg" />
                      {result.sourcing_route && (
                        <Badge status={result.sourcing_route} size="lg" />
                      )}
                    </div>
                  </div>

                  <div className="text-right sm:self-center">
                    <span className="text-xs text-ink-muted uppercase font-semibold">
                      Total Recommended Order
                    </span>
                    <div className="font-serif text-3xl font-bold text-forest">
                      {formatMT(result.recommended_quantity_mt, 1)}
                    </div>
                    {result.shortfall_mt && parseNum(result.shortfall_mt) > 0 && (
                      <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        Shortfall: {formatMT(result.shortfall_mt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* The 3 Core Question Answers */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
                  <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-forest-700 block">
                      1. WHEN TO PURCHASE?
                    </span>
                    <div className="font-serif text-lg font-bold text-ink mt-1">
                      {result.decision === 'BUY'
                        ? 'Place Order Immediately'
                        : result.decision === 'WAIT'
                        ? 'Hold Orders (Stock Sufficient)'
                        : 'Review Essential Inputs'}
                    </div>
                    <p className="text-xs text-ink-muted mt-1 leading-snug">
                      Coverage: {result.inventory?.coverage_days ? `${parseNum(result.inventory.coverage_days).toFixed(1)} days` : 'N/A'} (Run-out in {result.inventory?.days_until_stock_out ? `${result.inventory.days_until_stock_out}d` : '—'})
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-forest-700 block">
                      2. HOW MUCH TO PURCHASE?
                    </span>
                    <div className="font-serif text-lg font-bold text-ink mt-1">
                      {formatMT(result.recommended_quantity_mt, 1)}
                    </div>
                    <p className="text-xs text-ink-muted mt-1 leading-snug">
                      Replenishment Target: {formatMT(result.inventory?.target_position_mt, 0)}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-forest-700 block">
                      3. SOURCING ROUTE?
                    </span>
                    <div className="font-serif text-lg font-bold text-ink mt-1 flex items-center gap-2">
                      <span>{result.sourcing_route || 'Review Needed'}</span>
                    </div>
                    <p className="text-xs text-ink-muted mt-1 leading-snug">
                      Est. Landed Cost: {formatINR(result.expected_landed_cost_per_mt)} / MT
                    </p>
                  </div>
                </div>

                {/* Review banner notice if decision is REVIEW */}
                {result.decision === 'REVIEW' && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs sm:text-sm">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-slate-700" />
                      Needs review: essential data is missing or stale.
                    </p>
                    <p className="mt-1 text-slate-700">
                      Procurement cannot be automatically approved until the missing data or quotes identified in the reasoning chain are updated.
                    </p>
                  </div>
                )}
              </Card>

              {/* Reasoning Timeline */}
              <Card
                title="Reasoning Chain & Decision Triggers"
                subtitle="Step-by-step logic evaluated by the procurement rules engine"
                icon={Layers}
              >
                {Array.isArray(result.reasoning) && result.reasoning.length > 0 ? (
                  <div className="space-y-3">
                    {result.reasoning.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs sm:text-sm">
                        <div className="w-6 h-6 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 border border-forest-200">
                          {i + 1}
                        </div>
                        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex-1 text-ink leading-relaxed font-medium">
                          {r}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted italic">No reasoning notes generated.</p>
                )}
              </Card>

              {/* Allocations Table */}
              {Array.isArray(result.allocations) && result.allocations.length > 0 && (
                <Card
                  title="Supplier Allocations"
                  subtitle="Feasible order distribution across contracted suppliers"
                  icon={Truck}
                >
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-stone-50 border-b border-stone-200 text-ink-muted uppercase font-semibold">
                        <tr>
                          <th className="px-6 py-3">Supplier</th>
                          <th className="px-4 py-3">Route</th>
                          <th className="px-4 py-3">Order Qty</th>
                          <th className="px-4 py-3">Landed / MT</th>
                          <th className="px-4 py-3">Total Value</th>
                          <th className="px-4 py-3">Lead Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {result.allocations.map((alloc, idx) => (
                          <tr key={idx} className="hover:bg-stone-50/70 transition">
                            <td className="px-6 py-3.5 font-semibold text-ink">
                              {alloc.supplier_name || alloc.supplier_id}
                            </td>
                            <td className="px-4 py-3.5">
                              <Badge status={alloc.route} size="sm" />
                            </td>
                            <td className="px-4 py-3.5 font-bold font-mono text-forest">
                              {formatMT(alloc.quantity_mt)}
                            </td>
                            <td className="px-4 py-3.5 font-mono">
                              {formatINR(alloc.landed_cost_per_mt)}
                            </td>
                            <td className="px-4 py-3.5 font-bold font-mono">
                              {formatINR(alloc.total_cost_inr)}
                            </td>
                            <td className="px-4 py-3.5 text-ink-muted font-medium">
                              {alloc.lead_time_days} days
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Landed Cost Comparison Chart */}
              {result.market && (
                <Card
                  title="Landed Cost Benchmark (Per MT)"
                  subtitle="Comparison of domestic mandi vs imported landed costs"
                  icon={TrendingUp}
                  badge={
                    result.market.cheaper_route ? (
                      <Badge
                        status={result.market.cheaper_route}
                        label={`Cheaper: ${result.market.cheaper_route}`}
                        size="sm"
                      />
                    ) : null
                  }
                >
                  <div className="h-60 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getCostChartData()} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                        <XAxis
                          type="number"
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                          stroke="#7A8C82"
                          fontSize={12}
                        />
                        <YAxis
                          type="category"
                          dataKey="route"
                          stroke="#1F2A24"
                          fontSize={13}
                          fontWeight={600}
                          width={140}
                        />
                        <Tooltip
                          formatter={(v) => [formatINR(v), 'Landed Cost / MT']}
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          }}
                        />
                        <Bar dataKey="cost" radius={[0, 8, 8, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-stone-100 text-xs text-ink">
                    <div className="p-3 rounded-xl bg-forest-50/60 border border-forest-100">
                      <span className="text-ink-muted block uppercase text-[10px] font-bold">
                        Domestic Landed Cost
                      </span>
                      <span className="font-serif text-lg font-bold text-forest">
                        {formatINR(result.market.domestic_landed_cost_per_mt)} / MT
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                      <span className="text-ink-muted block uppercase text-[10px] font-bold">
                        International Landed Cost
                      </span>
                      <span className="font-serif text-lg font-bold text-gold-dark">
                        {formatINR(result.market.international_landed_cost_per_mt)} / MT
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Inventory Metrics Grid */}
              {result.inventory && (
                <Card
                  title="Inventory Buffer &amp; Reorder Metrics"
                  subtitle="King's statistical formula buffer and stock coverage calculations"
                  icon={Calendar}
                  badge={
                    <Badge status={result.inventory.inventory_status || 'HEALTHY'} size="sm" />
                  }
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block font-medium">Usable Stock</span>
                      <span className="font-serif text-base font-bold text-ink">
                        {formatMT(result.inventory.usable_on_hand_mt)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block font-medium">Coverage Days</span>
                      <span className="font-serif text-base font-bold text-ink">
                        {result.inventory.coverage_days ? `${parseNum(result.inventory.coverage_days).toFixed(1)} days` : '—'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block font-medium">Safety Stock</span>
                      <span className="font-serif text-base font-bold text-forest">
                        {formatMT(result.inventory.safety_stock_mt)}
                      </span>
                      <span className="text-[10px] text-ink-muted block">
                        ({result.inventory.safety_stock_method})
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block font-medium">Reorder Point (ROP)</span>
                      <span className="font-serif text-base font-bold text-amber-800">
                        {formatMT(result.inventory.reorder_point_mt)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block font-medium">Daily Consumption</span>
                      <span className="font-serif text-base font-bold text-ink">
                        {formatMT(result.inventory.avg_daily_consumption_mt)}/day
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block font-medium">Days Until Stock-out</span>
                      <span className="font-serif text-base font-bold text-rose-700">
                        {result.inventory.days_until_stock_out ? `${result.inventory.days_until_stock_out} days` : '—'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block font-medium">Lead Time Used</span>
                      <span className="font-serif text-base font-bold text-ink">
                        {result.inventory.lead_time_used_days || 0} days
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block font-medium">Required Replenish</span>
                      <span className="font-serif text-base font-bold text-ink">
                        {formatMT(result.inventory.required_replenishment_mt)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Collapsible Sections: Warnings, Rejected Alternatives, Triggers */}
              <div className="space-y-3">
                {/* Warnings Section */}
                {Array.isArray(result.warnings) && result.warnings.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowWarnings(!showWarnings)}
                      className="w-full px-5 py-3 flex items-center justify-between text-xs sm:text-sm font-semibold text-amber-900"
                    >
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Warnings &amp; Integrity Flags ({result.warnings.length})
                      </span>
                      {showWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showWarnings && (
                      <div className="px-5 pb-4 space-y-2 text-xs text-amber-900 border-t border-amber-100 pt-3">
                        {result.warnings.map((w, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-amber-500 font-bold">&bull;</span>
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Rejected Alternatives Section */}
                {Array.isArray(result.rejected_alternatives) && result.rejected_alternatives.length > 0 && (
                  <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={() => setShowRejected(!showRejected)}
                      className="w-full px-5 py-3 flex items-center justify-between text-xs sm:text-sm font-semibold text-ink"
                    >
                      <span className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-stone-500" />
                        Rejected Alternatives ({result.rejected_alternatives.length})
                      </span>
                      {showRejected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showRejected && (
                      <div className="px-5 pb-4 space-y-2 text-xs text-ink-muted border-t border-stone-100 pt-3">
                        {result.rejected_alternatives.map((alt, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-stone-400 font-bold">&bull;</span>
                            <span>{alt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Metadata Footer */}
              <div className="p-4 rounded-xl bg-stone-100/70 border border-stone-200 flex items-center justify-between text-xs text-ink-muted flex-wrap gap-2">
                <div>
                  Calculation Version: <span className="font-mono font-medium text-ink">{result.calculation_version}</span>
                </div>
                <div>
                  Calculated at: <span className="font-medium text-ink">{formatDateIST(result.decision_timestamp)}</span>
                </div>
                <div>
                  Data Status: <Badge status={result.data_quality_status} size="sm" />
                </div>
              </div>
            </div>
          ) : (
            <Card className="text-center py-12">
              <EmptyState
                icon={ShieldAlert}
                title="Ready to Calculate Procurement Advice"
                description="Adjust your target parameters in the left panel or click 'Compute Recommendation' to run the rule-based decision model."
                actionLabel="Compute Recommendation"
                onAction={runRecommendation}
              />
            </Card>
          )}

          {/* Decision History Table */}
          <Card
            title="Procurement Decision Audit History"
            subtitle="Previous recommendations recorded for compliance and traceability"
            icon={Clock}
          >
            {historyLoading ? (
              <SkeletonTable rows={4} cols={5} />
            ) : history.length > 0 ? (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200 text-ink-muted uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-3">Decision Date</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Recommended Qty</th>
                      <th className="px-4 py-3">Coverage</th>
                      <th className="px-4 py-3">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {history.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedHistoryItem(selectedHistoryItem?.id === item.id ? null : item)}
                        className={`cursor-pointer transition ${
                          selectedHistoryItem?.id === item.id ? 'bg-forest-50/60' : 'hover:bg-stone-50'
                        }`}
                      >
                        <td className="px-6 py-3 text-ink font-medium">
                          {formatDateIST(item.decision_date)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={item.action} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          {item.sourcing_route ? <Badge status={item.sourcing_route} size="sm" /> : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold">
                          {formatMT(item.recommended_quantity_mt)}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">
                          {item.inventory_coverage_days
                            ? `${parseNum(item.inventory_coverage_days).toFixed(1)}d`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={item.data_quality_status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-ink-muted italic py-4">No past decisions recorded yet.</p>
            )}

            {/* Selected history item reasoning expander */}
            {selectedHistoryItem && (
              <div className="mt-4 p-4 rounded-xl bg-forest-50 border border-forest-100 text-xs animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-forest-900 uppercase">
                    Audit Reasoning for Decision {selectedHistoryItem.id.substring(0, 8)}...
                  </span>
                  <button
                    onClick={() => setSelectedHistoryItem(null)}
                    className="text-forest-700 hover:text-forest-900 font-semibold"
                  >
                    Close
                  </button>
                </div>
                <ul className="space-y-1.5 list-disc list-inside text-forest-900">
                  {selectedHistoryItem.reasoning?.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AdvisorPage;
