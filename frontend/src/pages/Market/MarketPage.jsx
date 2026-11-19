import React, { useState, useEffect, useCallback } from 'react';
import { marketApi, forecastApi } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  formatINR,
  formatUSD,
  formatNumber,
  formatPercent,
  formatDateIST,
  parseNum,
} from '../../utils/formatters';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import StatCard from '../../components/common/StatCard';
import { Skeleton, SkeletonRow } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Globe,
  MapPin,
  Calendar,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  Layers,
  BarChart2,
} from 'lucide-react';

export function MarketPage() {
  const toast = useToast();

  // Summary state
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Market historical prices chart state
  const [marketType, setMarketType] = useState('DOMESTIC');
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [selectedMarketName, setSelectedMarketName] = useState('');
  const [pricesData, setPricesData] = useState([]);
  const [pricesLoading, setPricesLoading] = useState(false);

  // Forecast state
  const [fcMarketType, setFcMarketType] = useState('DOMESTIC');
  const [fcHorizon, setFcHorizon] = useState(7);
  const [fcForce, setFcForce] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [fcLoading, setFcLoading] = useState(false);
  const [fcGenLoading, setFcGenLoading] = useState(false);

  // 1. Fetch Market Summary
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await marketApi.getSummary();
      setSummary(res);
    } catch (err) {
      console.warn('Could not load market summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // 2. Fetch Historical Prices for the selected market type
  const fetchHistoricalPrices = useCallback(async () => {
    try {
      setPricesLoading(true);
      const res = await marketApi.getPrices({
        page: 1,
        pageSize: 100,
        marketType,
      });

      const items = res?.items || [];
      // Extract unique market names
      const marketNames = Array.from(new Set(items.map((x) => x.market_name))).filter(Boolean);
      setAvailableMarkets(marketNames);

      const targetMarket =
        selectedMarketName && marketNames.includes(selectedMarketName)
          ? selectedMarketName
          : marketNames[0] || '';

      if (targetMarket !== selectedMarketName) {
        setSelectedMarketName(targetMarket);
      }

      // Filter by market name and reverse chronological order (oldest first for line charts)
      const filtered = items
        .filter((x) => !targetMarket || x.market_name === targetMarket)
        .reverse()
        .map((p) => ({
          date: formatDateIST(p.observed_at, false),
          price: parseNum(p.price_per_mt),
          rawDate: p.observed_at,
          currency: p.currency,
          source: p.source,
          status: p.data_quality_status,
        }));

      setPricesData(filtered);
    } catch (err) {
      console.warn('Could not load prices:', err);
    } finally {
      setPricesLoading(false);
    }
  }, [marketType, selectedMarketName]);

  // 3. Fetch Forecast & Evaluation
  const fetchForecastAndEval = useCallback(async () => {
    try {
      setFcLoading(true);
      const [fcRes, evRes] = await Promise.allSettled([
        forecastApi.getLatest({ market_type: fcMarketType, horizon_days: fcHorizon }),
        forecastApi.getEvaluation({ market_type: fcMarketType, horizon_days: fcHorizon }),
      ]);

      if (fcRes.status === 'fulfilled') {
        setForecast(fcRes.value);
      } else {
        setForecast(null);
      }

      if (evRes.status === 'fulfilled') {
        setEvaluation(evRes.value);
      } else {
        setEvaluation(null);
      }
    } catch (err) {
      console.warn('Error fetching forecast:', err);
    } finally {
      setFcLoading(false);
    }
  }, [fcMarketType, fcHorizon]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchHistoricalPrices();
  }, [fetchHistoricalPrices]);

  useEffect(() => {
    fetchForecastAndEval();
  }, [fetchForecastAndEval]);

  // Generate / Refit forecast action
  const handleGenerateForecast = async () => {
    setFcGenLoading(true);
    try {
      const res = await forecastApi.generate({
        market_type: fcMarketType,
        horizon_days: fcHorizon,
        force: fcForce,
      });
      setForecast(res);
      toast.success(
        res.cached
          ? `Forecast retrieved (${res.model_name}) - Existing model up-to-date`
          : `New forecast model refitted (${res.model_name})`
      );
      // Refresh evaluation
      try {
        const ev = await forecastApi.getEvaluation({
          market_type: fcMarketType,
          horizon_days: fcHorizon,
        });
        setEvaluation(ev);
      } catch (e) {
        console.warn('Eval fetch failed:', e);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to generate forecast');
    } finally {
      setFcGenLoading(false);
    }
  };

  // Combine historical points + forecast points for the forecast chart
  const getForecastChartData = () => {
    if (!forecast || !Array.isArray(forecast.points)) return [];

    // Anchor point: current price
    const dataPoints = [];

    if (forecast.current_price && forecast.current_price_date) {
      dataPoints.push({
        date: String(forecast.current_price_date),
        actual: parseNum(forecast.current_price),
        forecast: parseNum(forecast.current_price),
        label: 'Current Anchor',
      });
    }

    forecast.points.forEach((pt) => {
      dataPoints.push({
        date: String(pt.target_date),
        forecast: parseNum(pt.predicted_price),
        label: 'Predicted',
      });
    });

    return dataPoints;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="bg-white/70 p-5 rounded-2xl border border-stone-200/80 shadow-soft backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-leaf"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-forest-700 font-mono">
              Agricultural Market Intelligence
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight mt-1">
            Market Benchmark &amp; Price Forecast
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl">
            Live domestic and international spot prices, moving averages, and backtested exponential smoothing forecasts with baseline fallbacks.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          loading={summaryLoading}
          onClick={() => {
            fetchSummary();
            fetchHistoricalPrices();
            fetchForecastAndEval();
          }}
        >
          Refresh All Prices
        </Button>
      </div>

      {/* Row 1: Market Summary KPI Cards */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-forest"></span>
          30-Day Market Summary Benchmarks
        </h3>

        {summaryLoading ? (
          <SkeletonRow cols={2} />
        ) : summary?.items?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {summary.items.map((item, idx) => {
              const isDomestic = item.market_type === 'DOMESTIC';
              return (
                <Card
                  key={idx}
                  className="shadow-soft"
                  title={`${item.market_type === 'DOMESTIC' ? 'Domestic' : 'International'} — ${item.market_name}`}
                  subtitle={`Latest quote observed: ${formatDateIST(item.latest_observed_at)}`}
                  icon={isDomestic ? MapPin : Globe}
                  badge={<Badge status={item.data_quality_status} size="sm" />}
                >
                  <div className="space-y-4">
                    {/* Price and 7d/30d shifts */}
                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-xs text-ink-muted uppercase font-semibold">
                          Latest Price / MT
                        </span>
                        <div
                          className={`font-serif text-3xl font-bold ${
                            isDomestic ? 'text-forest' : 'text-gold-dark'
                          }`}
                        >
                          {item.currency === 'USD'
                            ? formatUSD(item.latest_price_per_mt)
                            : formatINR(item.latest_price_per_mt)}{' '}
                          <span className="text-sm font-sans font-normal text-ink-muted">/ MT</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.change_7d_pct !== null && (
                          <div
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                              parseNum(item.change_7d_pct) >= 0
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-rose-50 text-rose-800'
                            }`}
                          >
                            {parseNum(item.change_7d_pct) >= 0 ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5" />
                            )}
                            7d: {formatPercent(item.change_7d_pct)}
                          </div>
                        )}
                        {item.change_30d_pct !== null && (
                          <div
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                              parseNum(item.change_30d_pct) >= 0
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-rose-50 text-rose-800'
                            }`}
                          >
                            {parseNum(item.change_30d_pct) >= 0 ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5" />
                            )}
                            30d: {formatPercent(item.change_30d_pct)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Min, Avg, Max 30d Statistics */}
                    <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-stone-100 text-xs">
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                        <span className="text-ink-muted block text-[10px] uppercase font-bold">
                          30d Min
                        </span>
                        <span className="font-serif font-bold text-ink">
                          {item.currency === 'USD'
                            ? formatUSD(item.min_30d)
                            : formatINR(item.min_30d)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                        <span className="text-ink-muted block text-[10px] uppercase font-bold">
                          30d Mean
                        </span>
                        <span className="font-serif font-bold text-ink">
                          {item.currency === 'USD'
                            ? formatUSD(item.avg_30d)
                            : formatINR(item.avg_30d)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                        <span className="text-ink-muted block text-[10px] uppercase font-bold">
                          30d Max
                        </span>
                        <span className="font-serif font-bold text-ink">
                          {item.currency === 'USD'
                            ? formatUSD(item.max_30d)
                            : formatINR(item.max_30d)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1">
                      <span>Records tracked: {item.records_30d}</span>
                      {item.flagged_records_30d > 0 && (
                        <span className="text-amber-700 font-semibold">
                          {item.flagged_records_30d} flagged moves
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-ink-muted italic py-4">No summary data available.</p>
        )}
      </div>

      {/* Row 2: Price History Line Chart */}
      <Card
        title="Historical Price Trajectory"
        subtitle="Chronological benchmark series (reversed from newest-first records)"
        icon={TrendingUp}
        action={
          <div className="flex items-center gap-3">
            {/* Market Type Selector */}
            <div className="flex rounded-xl bg-stone-100 p-1 border border-stone-200 text-xs">
              <button
                type="button"
                onClick={() => setMarketType('DOMESTIC')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  marketType === 'DOMESTIC'
                    ? 'bg-forest text-white shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Domestic (INR)
              </button>
              <button
                type="button"
                onClick={() => setMarketType('INTERNATIONAL')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  marketType === 'INTERNATIONAL'
                    ? 'bg-gold-dark text-white shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                International (USD)
              </button>
            </div>

            {/* Market Name Selector */}
            {availableMarkets.length > 1 && (
              <select
                value={selectedMarketName}
                onChange={(e) => setSelectedMarketName(e.target.value)}
                className="px-3 py-1 text-xs rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-forest"
              >
                {availableMarkets.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      >
        {pricesLoading ? (
          <div className="h-72 flex items-center justify-center">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : pricesData.length > 0 ? (
          <div className="h-80 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pricesData} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="date" stroke="#7A8C82" fontSize={11} tickMargin={8} />
                <YAxis
                  stroke="#7A8C82"
                  fontSize={11}
                  tickFormatter={(val) =>
                    marketType === 'DOMESTIC' ? `₹${val}` : `$${val}`
                  }
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(val) => [
                    marketType === 'DOMESTIC' ? formatINR(val) : formatUSD(val),
                    'Price / MT',
                  ]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={marketType === 'DOMESTIC' ? '#14432A' : '#D9A441'}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: marketType === 'DOMESTIC' ? '#14432A' : '#D9A441' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No Price Records"
            description="No price history found for this market selection. Add prices in the Data page."
          />
        )}
      </Card>

      {/* Row 3: Forecast Panel & Model Evaluation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Forecast Configuration & Chart (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <Card
            title="Price Forecast Engine"
            subtitle="Exponential Smoothing model with automatic Naive baseline validation"
            icon={Sparkles}
            action={
              <div className="flex items-center gap-2">
                <select
                  value={fcMarketType}
                  onChange={(e) => setFcMarketType(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 bg-white"
                >
                  <option value="DOMESTIC">Domestic (INR)</option>
                  <option value="INTERNATIONAL">International (USD)</option>
                </select>

                <select
                  value={fcHorizon}
                  onChange={(e) => setFcHorizon(Number(e.target.value))}
                  className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 bg-white"
                >
                  <option value={7}>7 Days Horizon</option>
                  <option value={30}>30 Days Horizon</option>
                </select>
              </div>
            }
          >
            {/* Generate & Force refit controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-forest-50/60 border border-forest-100 mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="forceRefit"
                  checked={fcForce}
                  onChange={(e) => setFcForce(e.target.checked)}
                  className="w-4 h-4 accent-forest rounded"
                />
                <label htmlFor="forceRefit" className="text-xs text-forest-900 font-medium cursor-pointer">
                  Force model refit (even if data has not changed)
                </label>
              </div>

              <Button
                variant="primary"
                size="sm"
                icon={Sparkles}
                loading={fcGenLoading}
                onClick={handleGenerateForecast}
              >
                Generate Forecast
              </Button>
            </div>

            {fcLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="h-56 w-full rounded-xl" />
              </div>
            ) : forecast ? (
              <div className="space-y-4">
                {/* Forecast Metadata Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-forest text-white font-semibold">
                    Model: {forecast.model_name.replace(/_/g, ' ')}
                  </span>
                  <Badge
                    status={forecast.quality_status}
                    label={
                      forecast.quality_status === 'BASELINE_FALLBACK'
                        ? 'Baseline used: model did not beat naive'
                        : forecast.quality_status
                    }
                    size="sm"
                  />
                  <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 font-medium">
                    Direction: {forecast.direction} ({forecast.expected_change_pct > 0 ? '+' : ''}
                    {forecast.expected_change_pct.toFixed(2)}%)
                  </span>
                </div>

                {/* Selection reason explanation */}
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-ink">
                  <span className="font-bold text-forest uppercase block text-[10px] mb-0.5">
                    Model Selection Rationale
                  </span>
                  <p className="leading-relaxed">{forecast.selection_reason}</p>
                </div>

                {/* Forecast Trajectory Chart (historical anchor + dashed line) */}
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getForecastChartData()} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis dataKey="date" stroke="#7A8C82" fontSize={11} />
                      <YAxis
                        stroke="#7A8C82"
                        fontSize={11}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) =>
                          fcMarketType === 'DOMESTIC' ? `₹${v}` : `$${v}`
                        }
                      />
                      <Tooltip
                        formatter={(v) => [
                          fcMarketType === 'DOMESTIC' ? formatINR(v) : formatUSD(v),
                          'Forecast Price',
                        ]}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '12px',
                          border: '1px solid #E5E7EB',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        name="Projected Price"
                        stroke="#D9A441"
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                        dot={{ r: 4, fill: '#D9A441' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* MANDATORY DISCLAIMER */}
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">
                    {forecast.disclaimer ||
                      'Statistical estimate based on historical prices. Not a guaranteed market price.'}
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="No Stored Forecast"
                description={`No forecast has been fitted for ${fcMarketType} with ${fcHorizon}-day horizon.`}
                actionLabel="Generate Now"
                onAction={handleGenerateForecast}
              />
            )}
          </Card>
        </div>

        {/* Model Evaluation & Backtest Metrics Card (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <Card
            title="Statistical Model Evaluation"
            subtitle="Backtest performance comparison against naive benchmark"
            icon={BarChart2}
          >
            {evaluation ? (
              <div className="space-y-4 text-xs">
                {/* Improvement Badge */}
                <div className="p-3.5 rounded-xl bg-forest-50 border border-forest-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-forest-900 block">
                      MAE Improvement vs Naive
                    </span>
                    <span className="text-[11px] text-forest-700">
                      Positive indicates model outperformed baseline
                    </span>
                  </div>
                  <div className="font-serif text-2xl font-bold text-forest">
                    {evaluation.mae_improvement_pct !== null && evaluation.mae_improvement_pct !== undefined
                      ? `${evaluation.mae_improvement_pct > 0 ? '+' : ''}${evaluation.mae_improvement_pct.toFixed(1)}%`
                      : '0.0%'}
                  </div>
                </div>

                {/* Side-by-side error metrics table */}
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-200 uppercase font-semibold text-[10px] text-ink-muted">
                      <tr>
                        <th className="px-3 py-2">Metric</th>
                        <th className="px-3 py-2">Exponential Smoothing</th>
                        <th className="px-3 py-2">Naive Baseline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      <tr>
                        <td className="px-3 py-2 font-medium">MAE (Mean Absolute Error)</td>
                        <td className="px-3 py-2 font-mono">
                          {evaluation.exponential_smoothing?.mae !== undefined
                            ? Number(evaluation.exponential_smoothing.mae).toFixed(2)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {evaluation.naive?.mae !== undefined
                            ? Number(evaluation.naive.mae).toFixed(2)
                            : '—'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium">RMSE (Root Mean Square)</td>
                        <td className="px-3 py-2 font-mono">
                          {evaluation.exponential_smoothing?.rmse !== undefined
                            ? Number(evaluation.exponential_smoothing.rmse).toFixed(2)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {evaluation.naive?.rmse !== undefined
                            ? Number(evaluation.naive.rmse).toFixed(2)
                            : '—'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium">MAPE (Percentage Error)</td>
                        <td className="px-3 py-2 font-mono">
                          {evaluation.exponential_smoothing?.mape !== undefined
                            ? `${(Number(evaluation.exponential_smoothing.mape) * 100).toFixed(2)}%`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {evaluation.naive?.mape !== undefined
                            ? `${(Number(evaluation.naive.mape) * 100).toFixed(2)}%`
                            : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 text-ink-muted text-[11px] space-y-1">
                  <div>
                    Backtest Origins: <strong>{evaluation.backtest_origins || 0} folds</strong>
                  </div>
                  <div>
                    Training window: {evaluation.training_data_start} to {evaluation.training_data_end}
                  </div>
                </div>

                {/* Last 5 Forecast Runs History */}
                {Array.isArray(evaluation.history) && evaluation.history.length > 0 && (
                  <div className="pt-3 border-t border-stone-100">
                    <span className="font-bold text-ink uppercase text-[10px] block mb-2">
                      Recent Model Runs
                    </span>
                    <div className="space-y-1.5">
                      {evaluation.history.slice(0, 5).map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-100 text-[11px]"
                        >
                          <span className="text-ink font-mono font-medium">
                            {formatDateIST(h.created_at)}
                          </span>
                          <span className="font-semibold text-forest">
                            {h.model_name.replace(/_/g, ' ')}
                          </span>
                          <Badge status={h.quality_status} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-ink-muted italic py-6 text-center">
                Generate a forecast to view statistical backtest metrics.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default MarketPage;
