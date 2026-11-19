import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  formatINR,
  formatUSD,
  formatMT,
  formatNumber,
  formatDateIST,
  formatRelativeTime,
  parseNum,
} from '../../utils/formatters';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import StatCard from '../../components/common/StatCard';
import { Skeleton, SkeletonRow } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import {
  Boxes,
  Calendar,
  Truck,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Info,
  DollarSign,
  Globe,
  MapPin,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
} from 'lucide-react';

export function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await dashboardApi.getDashboard();
      setData(res);
      if (isRefresh) {
        toast.success('Dashboard refreshed with latest intelligence.');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to load dashboard data');
      toast.error(err.message || 'Cannot load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <SkeletonRow cols={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-2 rounded-2xl" />
          <Skeleton className="h-64 col-span-1 rounded-2xl" />
        </div>
        <SkeletonRow cols={3} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Dashboard Unavailable"
        description={error}
        actionLabel="Retry Connection"
        onAction={() => fetchDashboard()}
      />
    );
  }

  const {
    generated_at,
    inventory,
    incoming_orders,
    latest_decision,
    prices,
    usd_inr,
    forecast,
    alerts = [],
  } = data || {};

  // Inventory storage calculation
  const availableStock = parseNum(inventory?.available_stock_mt, 0);
  const capacity = parseNum(inventory?.storage_capacity_mt, 1);
  const reservedStock = parseNum(inventory?.reserved_stock_mt, 0);
  const netStock = parseNum(inventory?.net_available_stock_mt, availableStock - reservedStock);
  const freeStorage = parseNum(inventory?.free_storage_mt, capacity - availableStock);
  const storageUsedPct = capacity > 0 ? Math.min(100, Math.round((availableStock / capacity) * 100)) : 0;

  // Forecast trend direction icon
  const getForecastIcon = (dir) => {
    const d = (dir || '').toUpperCase();
    if (d === 'UP') return <TrendingUp className="w-5 h-5 text-emerald-600" />;
    if (d === 'DOWN') return <TrendingDown className="w-5 h-5 text-rose-600" />;
    return <Minus className="w-5 h-5 text-amber-600" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title & Intelligence Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 p-4 sm:p-5 rounded-2xl border border-stone-200/80 shadow-soft backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-leaf"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-forest-700 font-mono">
              Soybean Procurement Intelligence
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight mt-1">
            Executive Command Centre
          </h1>
          <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
            <span>Generated: {formatDateIST(generated_at)}</span>
            <span>&bull;</span>
            <span>Data state: {inventory?.age_days ? `${inventory.age_days}d old` : 'Live'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => fetchDashboard(true)}
            title="Refresh latest data"
          >
            Refresh Data
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate('/advisor')}
          >
            Run Advisor
          </Button>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI 1: Net Available Stock */}
        <StatCard
          title="Net Available Stock"
          value={formatMT(netStock, 1)}
          subtitle={
            inventory?.reserved_stock_mt && parseNum(inventory.reserved_stock_mt) > 0
              ? `${formatMT(inventory.reserved_stock_mt, 0)} reserved`
              : 'Physical usable stock'
          }
          icon={Boxes}
          highlightColor="forest"
          badge={inventory ? `${storageUsedPct}% of cap` : null}
          badgeStatus={storageUsedPct > 90 ? 'WATCH' : 'HEALTHY'}
        />

        {/* KPI 2: Inventory Coverage Days */}
        <StatCard
          title="Inventory Coverage"
          value={
            latest_decision?.coverage_days !== null && latest_decision?.coverage_days !== undefined
              ? `${parseNum(latest_decision.coverage_days).toFixed(1)} Days`
              : '—'
          }
          subtitle="Buffer against lead time"
          icon={Calendar}
          highlightColor="leaf"
          badge={
            latest_decision?.coverage_days
              ? parseNum(latest_decision.coverage_days) < 15
                ? 'REORDER_REQUIRED'
                : 'HEALTHY'
              : null
          }
          badgeStatus={
            latest_decision?.coverage_days
              ? parseNum(latest_decision.coverage_days) < 15
                ? 'REORDER_REQUIRED'
                : 'HEALTHY'
              : 'DATA_INSUFFICIENT'
          }
        />

        {/* KPI 3: Incoming Purchase Orders */}
        <StatCard
          title="Open Incoming Orders"
          value={formatMT(incoming_orders?.incoming_mt, 0)}
          subtitle={
            incoming_orders?.next_arrival
              ? `Next ETA: ${formatDateIST(incoming_orders.next_arrival, false)}`
              : incoming_orders?.open_orders > 0
              ? `${incoming_orders.open_orders} purchase orders open`
              : 'No pending deliveries'
          }
          icon={Truck}
          highlightColor="gold"
          badge={`${incoming_orders?.open_orders || 0} Open POs`}
        />

        {/* KPI 4: Latest Decision Action */}
        <StatCard
          title="Current Recommendation"
          value={latest_decision?.action || 'NO RUN'}
          subtitle={
            latest_decision?.sourcing_route
              ? `${latest_decision.sourcing_route} route • ${formatMT(latest_decision.recommended_quantity_mt, 0)}`
              : 'Execute Advisor for guidance'
          }
          icon={ShieldCheck}
          highlightColor={
            latest_decision?.action === 'BUY'
              ? 'leaf'
              : latest_decision?.action === 'WAIT'
              ? 'gold'
              : 'slate'
          }
          badgeStatus={latest_decision?.action || 'DATA_INSUFFICIENT'}
        />
      </div>

      {/* Row 2: Hero Latest Decision Card & Storage Capacity Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Latest Decision Deep Dive */}
        <Card
          className="lg:col-span-2 shadow-soft hover:shadow-card transition-all"
          title="Procurement Recommendation Deep-Dive"
          subtitle="Rule-based decision support logic based on stock run-out, safety margins, and landed costs"
          icon={ShieldCheck}
          badge={
            latest_decision ? (
              <Badge status={latest_decision.action} size="lg" />
            ) : (
              <Badge status="DATA_INSUFFICIENT" label="No Decision Recorded" size="md" />
            )
          }
          action={
            <Button
              variant="primary"
              size="sm"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/advisor')}
            >
              Get New Recommendation
            </Button>
          }
        >
          {latest_decision ? (
            <div className="space-y-5">
              {/* Three Question Answers Summary Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-forest-50/70 border border-forest-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">
                    1. When to Buy?
                  </span>
                  <div className="font-serif text-lg font-bold text-forest mt-0.5">
                    {latest_decision.action === 'BUY'
                      ? 'Immediate Action Required'
                      : latest_decision.action === 'WAIT'
                      ? 'Hold Orders (Sufficient Stock)'
                      : 'Review Required'}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">
                    2. Recommended Quantity
                  </span>
                  <div className="font-serif text-lg font-bold text-forest mt-0.5">
                    {formatMT(latest_decision.recommended_quantity_mt, 1)}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">
                    3. Recommended Route
                  </span>
                  <div className="font-serif text-lg font-bold text-forest mt-0.5 flex items-center gap-1.5">
                    {latest_decision.sourcing_route ? (
                      <Badge status={latest_decision.sourcing_route} size="sm" />
                    ) : (
                      <span>Unspecified</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Reasoning Chain Timeline */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-forest"></span>
                  Decision Logic &amp; Reasoning Chain
                </h4>

                {Array.isArray(latest_decision.reasoning) && latest_decision.reasoning.length > 0 ? (
                  <ul className="space-y-2.5 pl-2">
                    {latest_decision.reasoning.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-ink leading-relaxed">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-forest-100 text-forest font-bold text-[11px] flex items-center justify-center border border-forest-200 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="bg-stone-50/80 p-2 rounded-lg border border-stone-100 flex-1">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-muted italic">No reasoning notes recorded.</p>
                )}
              </div>

              {/* Decision Metadata Footer */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-ink-muted flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span>
                    Decided: <strong>{formatDateIST(latest_decision.decision_date)}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Data quality:{' '}
                    <Badge status={latest_decision.data_quality_status} size="sm" dot={false} />
                  </span>
                </div>
                <Link
                  to="/advisor"
                  className="font-medium text-forest hover:text-leaf flex items-center gap-1 text-xs"
                >
                  Adjust planning parameters <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <EmptyState
                icon={ShieldCheck}
                title="No Recommendation Generated Yet"
                description="Run the rule-based Procurement Advisor to compute reorder levels, landed cost comparisons, and optimal procurement allocations."
                actionLabel="Open Procurement Advisor"
                onAction={() => navigate('/advisor')}
              />
            </div>
          )}
        </Card>

        {/* Right 1 Col: Storage Capacity Gauge & Physical Stock Breakdown */}
        <Card
          className="shadow-soft"
          title="Warehouse Silo Capacity"
          subtitle="Soybean physical stock vs silo limits"
          icon={Boxes}
          badge={
            inventory ? (
              <Badge status={storageUsedPct > 85 ? 'WATCH' : 'HEALTHY'} size="sm" />
            ) : null
          }
        >
          {inventory ? (
            <div className="space-y-5">
              {/* Capacity Progress Gauge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">Utilization: {storageUsedPct}%</span>
                  <span className="text-ink-muted">
                    {formatMT(availableStock, 0)} / {formatMT(capacity, 0)}
                  </span>
                </div>

                {/* Styled progress bar */}
                <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden p-0.5 border border-stone-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      storageUsedPct > 90
                        ? 'bg-rose-500'
                        : storageUsedPct > 75
                        ? 'bg-amber-500'
                        : 'bg-forest'
                    }`}
                    style={{ width: `${storageUsedPct}%` }}
                  />
                </div>
              </div>

              {/* Metric Breakdown Rows */}
              <div className="divide-y divide-stone-100 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-ink-muted">Physical On-Hand:</span>
                  <span className="font-semibold font-mono">{formatMT(availableStock)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-ink-muted">Reserved for Crushing/Sales:</span>
                  <span className="font-semibold font-mono text-amber-700">
                    {formatMT(reservedStock)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between bg-forest-50/50 px-2 rounded-lg">
                  <span className="font-medium text-forest-900">Net Usable Position:</span>
                  <span className="font-bold font-mono text-forest-800">{formatMT(netStock)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-ink-muted">Free Silo Storage Remaining:</span>
                  <span className="font-semibold font-mono text-emerald-700">
                    {formatMT(freeStorage)}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-ink-muted border-t border-stone-100 flex items-center justify-between">
                <span>Updated: {formatRelativeTime(inventory.as_of)}</span>
                <Link to="/data" className="text-forest hover:underline font-medium">
                  Update stock
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Boxes}
              title="No Inventory Record"
              description="Record your latest physical inventory in the Data page."
              actionLabel="Add Inventory Record"
              onAction={() => navigate('/data')}
            />
          )}
        </Card>
      </div>

      {/* Row 3: Market Prices, Currency & Price Forecast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Domestic Market Price Card */}
        <Card
          className="shadow-soft"
          title="Domestic Market"
          subtitle={prices?.DOMESTIC?.market_name || 'Domestic Mandi'}
          icon={MapPin}
          badge={
            prices?.DOMESTIC ? (
              <Badge status={prices.DOMESTIC.data_quality_status || 'VALID'} size="sm" />
            ) : null
          }
        >
          {prices?.DOMESTIC ? (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-ink-muted uppercase font-semibold">
                  Mandi Benchmark
                </div>
                <div className="font-serif text-2xl font-bold text-ink mt-0.5">
                  {formatINR(prices.DOMESTIC.price_per_mt)} / MT
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 text-xs space-y-1 text-ink-muted">
                <div className="flex justify-between">
                  <span>Source:</span>
                  <span className="font-medium text-ink">{prices.DOMESTIC.source}</span>
                </div>
                <div className="flex justify-between">
                  <span>Observed:</span>
                  <span>{formatDateIST(prices.DOMESTIC.observed_at, false)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Record Age:</span>
                  <span>{prices.DOMESTIC.age_days ? `${prices.DOMESTIC.age_days}d ago` : 'Recent'}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted italic py-4">No domestic price recorded.</p>
          )}
        </Card>

        {/* International Market Price Card */}
        <Card
          className="shadow-soft"
          title="International Market"
          subtitle={prices?.INTERNATIONAL?.market_name || 'Global Port'}
          icon={Globe}
          badge={
            prices?.INTERNATIONAL ? (
              <Badge status={prices.INTERNATIONAL.data_quality_status || 'VALID'} size="sm" />
            ) : null
          }
        >
          {prices?.INTERNATIONAL ? (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-ink-muted uppercase font-semibold">
                  FOB / CFR Benchmark
                </div>
                <div className="font-serif text-2xl font-bold text-gold-dark mt-0.5">
                  {formatUSD(prices.INTERNATIONAL.price_per_mt)} / MT
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 text-xs space-y-1 text-ink-muted">
                <div className="flex justify-between">
                  <span>Source:</span>
                  <span className="font-medium text-ink">{prices.INTERNATIONAL.source}</span>
                </div>
                <div className="flex justify-between">
                  <span>Observed:</span>
                  <span>{formatDateIST(prices.INTERNATIONAL.observed_at, false)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Record Age:</span>
                  <span>
                    {prices.INTERNATIONAL.age_days ? `${prices.INTERNATIONAL.age_days}d ago` : 'Recent'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted italic py-4">No international price recorded.</p>
          )}
        </Card>

        {/* Foreign Exchange USD / INR Card */}
        <Card
          className="shadow-soft"
          title="USD / INR Exchange"
          subtitle="Currency conversion rate"
          icon={DollarSign}
          badge={
            usd_inr?.source === 'SIMULATED_DATA' ? (
              <Badge status="WARNING" label="Simulated FX" size="sm" />
            ) : (
              <Badge status="VALID" label="Stored Rate" size="sm" />
            )
          }
        >
          {usd_inr ? (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-ink-muted uppercase font-semibold">
                  Reference Rate
                </div>
                <div className="font-serif text-2xl font-bold text-ink mt-0.5">
                  ₹ {parseNum(usd_inr.rate).toFixed(2)}
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 text-xs space-y-1 text-ink-muted">
                <div className="flex justify-between">
                  <span>Source:</span>
                  <span className="font-medium text-ink">{usd_inr.source}</span>
                </div>
                <div className="flex justify-between">
                  <span>Observed:</span>
                  <span>{formatDateIST(usd_inr.observed_at, false)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Record Age:</span>
                  <span>{usd_inr.age_days ? `${usd_inr.age_days}d ago` : 'Recent'}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted italic py-4">No exchange rate recorded.</p>
          )}
        </Card>

        {/* 7-Day Price Forecast Card */}
        <Card
          className="shadow-soft"
          title="7-Day Price Forecast"
          subtitle={forecast?.model_name?.replace('_', ' ') || 'Statistical Model'}
          icon={Sparkles}
          badge={
            forecast?.quality_status ? (
              <Badge status={forecast.quality_status} size="sm" />
            ) : null
          }
        >
          {forecast ? (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-ink-muted uppercase font-semibold flex items-center justify-between">
                  <span>Predicted Price</span>
                  <span className="flex items-center gap-1 font-semibold text-ink text-xs">
                    {getForecastIcon(forecast.direction)}
                    {forecast.direction}
                  </span>
                </div>
                <div className="font-serif text-2xl font-bold text-forest mt-0.5">
                  {formatINR(forecast.predicted_price)}
                </div>
              </div>

              <p className="text-[11px] text-stone-500 leading-snug bg-stone-50 p-2 rounded-lg border border-stone-200/80">
                {forecast.note || 'Statistical estimate based on historical prices. Not a guaranteed market price.'}
              </p>

              <div className="pt-2 border-t border-stone-100 text-[11px] text-ink-muted flex items-center justify-between">
                <span>Trained to: {forecast.training_data_end}</span>
                <Link to="/market" className="text-forest hover:underline font-medium">
                  View model
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-ink-muted mb-3">No forecast run stored yet.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/market')}
              >
                Generate Forecast
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Row 4: Alerts & Data Integrity Panel */}
      {alerts && alerts.length > 0 && (
        <Card
          className="border-amber-200 bg-amber-50/40 shadow-soft"
          title="Data Integrity & Operational Alerts"
          subtitle="System warnings regarding data staleness or simulation flags"
          icon={AlertTriangle}
          badge={<Badge status="WATCH" label={`${alerts.length} Warnings`} size="sm" />}
        >
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-white border border-amber-200/80 text-xs sm:text-sm text-amber-950 shadow-sm"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span className="flex-1 font-medium">{alert}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default DashboardPage;
