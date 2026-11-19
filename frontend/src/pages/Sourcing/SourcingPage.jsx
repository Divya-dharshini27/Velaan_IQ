import React, { useState } from 'react';
import { sourcingApi } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  formatINR,
  formatUSD,
  formatNumber,
  formatPercent,
  parseNum,
} from '../../utils/formatters';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import {
  Scale,
  Play,
  RotateCcw,
  AlertTriangle,
  Info,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  MapPin,
  Globe,
  Sliders,
} from 'lucide-react';

const INCOTERM_EXPLANATIONS = {
  FOB: 'Free on Board — Quote includes loading at origin port. Buyer pays ocean freight, marine insurance, customs duty, port handling, and inland transport.',
  CFR: 'Cost and Freight — Quote includes ocean freight to Indian destination port. Buyer pays marine insurance, customs duty, port handling, and inland transport.',
  CIF: 'Cost, Insurance & Freight — Quote includes ocean freight and insurance. Buyer pays customs duty, port handling, and inland transport.',
};

export function SourcingPage() {
  const toast = useToast();

  // Domestic Quote Form
  const [domestic, setDomestic] = useState({
    price: '46000',
    unit: 'MT',
    freight_per_mt: '850',
    handling_per_mt: '150',
    other_per_mt: '0',
    quality_adjustment_per_mt: '0',
  });

  // International Quote Form
  const [international, setInternational] = useState({
    price: '520',
    unit: 'MT',
    incoterm: 'FOB',
    exchange_rate: '', // leave empty to use latest stored rate
    customs_duty_rate: '5', // entered as percent in UI, sent as fraction
    freight_per_mt: '2200',
    insurance_per_mt: '300',
    port_handling_per_mt: '450',
    inland_transport_per_mt: '900',
    other_per_mt: '0',
    non_recoverable_tax_rate: '0',
    recoverable_tax_rate: '0',
    quality_adjustment_per_mt: '0',
  });

  const [tolerancePct, setTolerancePct] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleDomesticChange = (field, val) => {
    setDomestic((prev) => ({ ...prev, [field]: val }));
  };

  const handleInternationalChange = (field, val) => {
    setInternational((prev) => ({ ...prev, [field]: val }));
  };

  const handleReset = () => {
    setDomestic({
      price: '',
      unit: 'MT',
      freight_per_mt: '',
      handling_per_mt: '',
      other_per_mt: '0',
      quality_adjustment_per_mt: '0',
    });
    setInternational({
      price: '',
      unit: 'MT',
      incoterm: 'FOB',
      exchange_rate: '',
      customs_duty_rate: '',
      freight_per_mt: '',
      insurance_per_mt: '',
      port_handling_per_mt: '',
      inland_transport_per_mt: '',
      other_per_mt: '0',
      non_recoverable_tax_rate: '0',
      recoverable_tax_rate: '0',
      quality_adjustment_per_mt: '0',
    });
    setResult(null);
  };

  const runCompare = async (e) => {
    if (e) e.preventDefault();

    if (!domestic.price || Number(domestic.price) <= 0) {
      toast.error('Please enter a valid domestic price.');
      return;
    }
    if (!international.price || Number(international.price) <= 0) {
      toast.error('Please enter a valid international price.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        domestic: {
          price: Number(domestic.price),
          unit: domestic.unit,
          freight_per_mt: domestic.freight_per_mt !== '' ? Number(domestic.freight_per_mt) : null,
          handling_per_mt: domestic.handling_per_mt !== '' ? Number(domestic.handling_per_mt) : null,
          other_per_mt: Number(domestic.other_per_mt) || 0,
          quality_adjustment_per_mt: Number(domestic.quality_adjustment_per_mt) || 0,
        },
        international: {
          price: Number(international.price),
          unit: international.unit,
          incoterm: international.incoterm,
          exchange_rate: international.exchange_rate !== '' ? Number(international.exchange_rate) : null,
          customs_duty_rate:
            international.customs_duty_rate !== ''
              ? Number(international.customs_duty_rate) / 100
              : null,
          freight_per_mt:
            international.freight_per_mt !== '' ? Number(international.freight_per_mt) : null,
          insurance_per_mt:
            international.insurance_per_mt !== '' ? Number(international.insurance_per_mt) : null,
          port_handling_per_mt:
            international.port_handling_per_mt !== '' ? Number(international.port_handling_per_mt) : null,
          inland_transport_per_mt:
            international.inland_transport_per_mt !== ''
              ? Number(international.inland_transport_per_mt)
              : null,
          other_per_mt: Number(international.other_per_mt) || 0,
          non_recoverable_tax_rate:
            international.non_recoverable_tax_rate !== ''
              ? Number(international.non_recoverable_tax_rate) / 100
              : 0,
          recoverable_tax_rate:
            international.recoverable_tax_rate !== ''
              ? Number(international.recoverable_tax_rate) / 100
              : 0,
          quality_adjustment_per_mt: Number(international.quality_adjustment_per_mt) || 0,
        },
        tolerance_pct: Number(tolerancePct) || 1,
      };

      const res = await sourcingApi.compare(payload);
      setResult(res);
      toast.success(
        res.cheaper_route
          ? `Landed cost comparison computed: ${res.cheaper_route} is cheaper.`
          : 'Landed cost calculation completed.'
      );
    } catch (err) {
      toast.error(err.message || 'Comparison failed');
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
            <span className="w-2.5 h-2.5 rounded-full bg-leaf"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-forest-700 font-mono">
              Landed Cost Optimization
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight mt-1">
            Sourcing Route Compare
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl">
            Compare domestic mandi quotes against imported global cargo landed costs incorporating customs duty, ocean freight, port handling, and inland transport.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <Button
            variant="primary"
            size="md"
            icon={Play}
            loading={loading}
            onClick={runCompare}
          >
            Compute Landed Cost
          </Button>
        </div>
      </div>

      {/* Mandatory Blueprint Feasibility Warning */}
      <div className="p-3.5 rounded-xl bg-forest-900 text-stone-200 text-xs flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-gold flex-shrink-0" />
          <span>
            <strong className="text-white font-semibold">Procurement Principle:</strong> Cheapest cost is not automatically feasible: capacity, lead time and quality are checked by the Advisor.
          </span>
        </div>
      </div>

      {/* Two-Column Calculator Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Domestic Quote (INR) */}
        <Card
          title="Domestic Mandi Sourcing Quote"
          subtitle="Direct procurement from domestic APMC mandis / aggregators"
          icon={MapPin}
          headerClassName="bg-forest-50/50"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Mandi Price (INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 46000"
                  value={domestic.price}
                  onChange={(e) => handleDomesticChange('price', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Unit</label>
                <select
                  value={domestic.unit}
                  onChange={(e) => handleDomesticChange('unit', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                >
                  <option value="MT">MT (Metric Tonne)</option>
                  <option value="QUINTAL">Quintal (100 kg)</option>
                  <option value="KG">Kilogram (kg)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Freight / MT (INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 850"
                  value={domestic.freight_per_mt}
                  onChange={(e) => handleDomesticChange('freight_per_mt', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Mandi Handling / MT (INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  value={domestic.handling_per_mt}
                  onChange={(e) => handleDomesticChange('handling_per_mt', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Other Charges / MT (INR)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={domestic.other_per_mt}
                  onChange={(e) => handleDomesticChange('other_per_mt', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Quality Premium/Penalty / MT
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={domestic.quality_adjustment_per_mt}
                  onChange={(e) => handleDomesticChange('quality_adjustment_per_mt', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Column 2: International Quote (USD) */}
        <Card
          title="International Import Quote"
          subtitle="Imported soybean cargo arriving at Indian port (CIF / CFR / FOB)"
          icon={Globe}
          headerClassName="bg-amber-50/50"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-ink mb-1">
                  Global Price (USD)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 520"
                  value={international.price}
                  onChange={(e) => handleInternationalChange('price', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-gold bg-white font-mono"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-semibold text-ink mb-1">Unit</label>
                <select
                  value={international.unit}
                  onChange={(e) => handleInternationalChange('unit', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-gold bg-white"
                >
                  <option value="MT">MT</option>
                  <option value="QUINTAL">Quintal</option>
                  <option value="KG">KG</option>
                </select>
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-semibold text-ink mb-1">Incoterm</label>
                <select
                  value={international.incoterm}
                  onChange={(e) => handleInternationalChange('incoterm', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-gold bg-white font-semibold"
                >
                  <option value="FOB">FOB</option>
                  <option value="CFR">CFR</option>
                  <option value="CIF">CIF</option>
                </select>
              </div>
            </div>

            {/* Incoterm Explanation Box */}
            <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-snug">
              <strong>{international.incoterm}:</strong> {INCOTERM_EXPLANATIONS[international.incoterm]}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  USD / INR Exchange Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Leave empty for latest"
                  value={international.exchange_rate}
                  onChange={(e) => handleInternationalChange('exchange_rate', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-gold bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Customs Duty Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 5"
                  value={international.customs_duty_rate}
                  onChange={(e) => handleInternationalChange('customs_duty_rate', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-gold bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Ocean Freight / MT (INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2200"
                  value={international.freight_per_mt}
                  onChange={(e) => handleInternationalChange('freight_per_mt', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-gold bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Marine Insurance / MT (INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 300"
                  value={international.insurance_per_mt}
                  onChange={(e) => handleInternationalChange('insurance_per_mt', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-gold bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Port Handling / MT (INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 450"
                  value={international.port_handling_per_mt}
                  onChange={(e) => handleInternationalChange('port_handling_per_mt', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-gold bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Inland Transport / MT (INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 900"
                  value={international.inland_transport_per_mt}
                  onChange={(e) =>
                    handleInternationalChange('inland_transport_per_mt', e.target.value)
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-gold bg-white font-mono"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tolerance & Action Bar */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-soft flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-ink uppercase tracking-wider">
            Tolerance Gap (%):
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={tolerancePct}
            onChange={(e) => setTolerancePct(e.target.value)}
            className="w-20 px-3 py-1.5 text-xs rounded-xl border border-stone-300 font-mono text-center"
          />
          <span className="text-[11px] text-ink-muted">
            Price gaps under {tolerancePct}% are flagged as too close to call
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleReset}>
            Reset Form
          </Button>
          <Button variant="primary" size="md" icon={Play} loading={loading} onClick={runCompare}>
            Run Sourcing Comparison
          </Button>
        </div>
      </div>

      {/* Comparison Results Area */}
      {result ? (
        <div className="space-y-6 animate-fade-in">
          {/* Verdict Banner */}
          <div
            className={`p-6 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
              result.cheaper_route === 'DOMESTIC'
                ? 'bg-forest-50/80 border-forest-500'
                : 'bg-amber-50/80 border-gold'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 ${
                  result.cheaper_route === 'DOMESTIC' ? 'bg-forest' : 'bg-gold-dark'
                }`}
              >
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
                  Landed Cost Decision
                </span>
                <h3 className="font-serif text-2xl font-extrabold text-ink tracking-tight mt-0.5">
                  Cheaper Route: {result.cheaper_route || 'Indeterminate'}
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Difference:{' '}
                  <strong>{formatINR(result.absolute_difference_per_mt)} / MT</strong> (
                  {result.pct_difference_vs_domestic !== null
                    ? `${parseNum(result.pct_difference_vs_domestic).toFixed(2)}% vs Domestic`
                    : '—'}
                  )
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {result.difference_below_tolerance && (
                <Badge
                  status="WARNING"
                  label="Gap below tolerance (Too close to call)"
                  size="md"
                />
              )}
              {result.cheaper_route && (
                <Badge status={result.cheaper_route} size="lg" />
              )}
            </div>
          </div>

          {/* Breakdown Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Domestic Cost Breakdown */}
            <Card
              title="Domestic Landed Cost Breakdown"
              subtitle="All domestic farmgate/mandi landed components"
              icon={MapPin}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-baseline pb-3 border-b border-stone-200">
                  <span className="text-xs text-ink-muted uppercase font-semibold">Total Landed / MT</span>
                  <span className="font-serif text-2xl font-bold text-forest">
                    {formatINR(result.domestic?.total_per_mt)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {result.domestic?.components &&
                    Object.entries(result.domestic.components).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-stone-100">
                        <span className="text-ink capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="font-mono font-semibold">{formatINR(v)}</span>
                      </div>
                    ))}
                </div>

                {result.domestic?.notes?.length > 0 && (
                  <div className="pt-2 text-[11px] text-ink-muted italic">
                    {result.domestic.notes.join(' • ')}
                  </div>
                )}
              </div>
            </Card>

            {/* International Cost Breakdown */}
            <Card
              title="International Landed Cost Breakdown"
              subtitle="CIF assessable values, duty and port clearance"
              icon={Globe}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-baseline pb-3 border-b border-stone-200">
                  <span className="text-xs text-ink-muted uppercase font-semibold">Total Landed / MT</span>
                  <span className="font-serif text-2xl font-bold text-gold-dark">
                    {formatINR(result.international?.total_per_mt)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {result.international?.components &&
                    Object.entries(result.international.components).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-stone-100">
                        <span className="text-ink capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="font-mono font-semibold">{formatINR(v)}</span>
                      </div>
                    ))}
                </div>

                <div className="pt-2 border-t border-stone-100 text-[11px] text-ink-muted space-y-1">
                  {result.international?.exchange_rate_used && (
                    <div>
                      FX Rate Used:{' '}
                      <strong>₹ {parseNum(result.international.exchange_rate_used).toFixed(2)}</strong>{' '}
                      ({result.international.exchange_rate_source || 'Stored'})
                    </div>
                  )}
                  {result.international?.assessable_value_per_mt && (
                    <div>
                      Assessable Value (CIF):{' '}
                      <strong>{formatINR(result.international.assessable_value_per_mt)}</strong>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Warnings and Missing Inputs */}
          {((result.warnings && result.warnings.length > 0) ||
            (result.missing_inputs && result.missing_inputs.length > 0)) && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
              <span className="font-bold uppercase text-[10px] text-amber-900 block">
                Attention &amp; Warnings
              </span>
              {result.warnings?.map((w, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
              {result.missing_inputs?.map((m, idx) => (
                <div key={idx} className="flex items-start gap-2 text-stone-700">
                  <Info className="w-4 h-4 text-stone-500 flex-shrink-0 mt-0.5" />
                  <span>Missing input: {m}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card className="text-center py-12">
          <EmptyState
            icon={Scale}
            title="Ready to Calculate Sourcing Landed Costs"
            description="Enter domestic and international quotes above and click 'Compute Landed Cost' to inspect cost components and identify the optimal sourcing channel."
            actionLabel="Compute Landed Cost"
            onAction={runCompare}
          />
        </Card>
      )}
    </div>
  );
}

export default SourcingPage;
