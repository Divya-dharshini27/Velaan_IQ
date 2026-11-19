import React, { useState, useEffect, useCallback } from 'react';
import {
  inventoryApi,
  consumptionApi,
  suppliersApi,
  purchaseOrdersApi,
  exchangeRatesApi,
  marketApi,
} from '../../api/client';
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
import { Skeleton, SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import {
  Database,
  Boxes,
  Activity,
  Truck,
  FileSpreadsheet,
  DollarSign,
  Plus,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export function DataPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('inventory'); // inventory, consumption, suppliers, purchase_orders, fx, market

  // --- 1. INVENTORY STATE ---
  const [inventory, setInventory] = useState(null);
  const [invLoading, setInvLoading] = useState(false);
  const [invForm, setInvForm] = useState({
    available_stock_mt: '',
    reserved_stock_mt: '0',
    storage_capacity_mt: '15000',
  });
  const [invSubmitting, setInvSubmitting] = useState(false);

  // --- 2. CONSUMPTION STATE ---
  const [consumptionSummary, setConsumptionSummary] = useState(null);
  const [consumptionLoading, setConsumptionLoading] = useState(false);
  const [consumptionForm, setConsumptionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    consumption_mt: '',
  });
  const [consumptionSubmitting, setConsumptionSubmitting] = useState(false);

  // --- 3. SUPPLIERS STATE ---
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    supplier_name: '',
    sourcing_type: 'DOMESTIC',
    lead_time_days: 10,
    capacity_mt: '',
    minimum_order_mt: '',
    active: true,
  });
  const [supplierSubmitting, setSupplierSubmitting] = useState(false);

  // --- 4. PURCHASE ORDERS STATE ---
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderForm, setOrderForm] = useState({
    supplier_id: '',
    quantity_mt: '',
    expected_arrival: '',
    status: 'CONFIRMED',
  });
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // --- 5. EXCHANGE RATES STATE ---
  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [rateForm, setRateForm] = useState({
    base_currency: 'USD',
    quote_currency: 'INR',
    rate: '',
    observed_at: new Date().toISOString().slice(0, 16),
    source: 'RBI_REFERENCE',
  });
  const [rateSubmitting, setRateSubmitting] = useState(false);

  // --- 6. MARKET PRICES STATE ---
  const [pricesPage, setPricesPage] = useState({ items: [], total: 0, page: 1, page_size: 15 });
  const [pricesLoading, setPricesLoading] = useState(false);
  const [priceForm, setPriceForm] = useState({
    market_type: 'DOMESTIC',
    market_name: '',
    price: '',
    currency: 'INR',
    unit: 'MT',
    observed_at: new Date().toISOString().slice(0, 16),
    source: 'AGMARKNET',
    quality_grade: 'FAQ',
  });
  const [priceSubmitting, setPriceSubmitting] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  // ============================================
  // LOADERS
  // ============================================
  const fetchInventory = useCallback(async () => {
    setInvLoading(true);
    try {
      const res = await inventoryApi.getLatest();
      setInventory(res);
      setInvForm({
        available_stock_mt: String(res.available_stock_mt || ''),
        reserved_stock_mt: String(res.reserved_stock_mt || '0'),
        storage_capacity_mt: String(res.storage_capacity_mt || '15000'),
      });
    } catch (err) {
      console.warn('Inventory fetch error:', err);
    } finally {
      setInvLoading(false);
    }
  }, []);

  const fetchConsumption = useCallback(async () => {
    setConsumptionLoading(true);
    try {
      const res = await consumptionApi.getSummary(30);
      setConsumptionSummary(res);
    } catch (err) {
      console.warn('Consumption fetch error:', err);
    } finally {
      setConsumptionLoading(false);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const res = await suppliersApi.getSuppliers({ page: 1, pageSize: 50 });
      setSuppliers(res?.items || []);
    } catch (err) {
      console.warn('Suppliers fetch error:', err);
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await purchaseOrdersApi.getOrders({ page: 1, pageSize: 50 });
      setOrders(res?.items || []);
    } catch (err) {
      console.warn('Orders fetch error:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const res = await exchangeRatesApi.getRates(1, 25);
      setRates(res?.items || []);
    } catch (err) {
      console.warn('Rates fetch error:', err);
    } finally {
      setRatesLoading(false);
    }
  }, []);

  const fetchPrices = useCallback(async (page = 1) => {
    setPricesLoading(true);
    try {
      const res = await marketApi.getPrices({ page, pageSize: 15 });
      setPricesPage(res);
    } catch (err) {
      console.warn('Prices fetch error:', err);
    } finally {
      setPricesLoading(false);
    }
  }, []);

  // Fetch data on active tab switch
  useEffect(() => {
    if (activeTab === 'inventory') fetchInventory();
    else if (activeTab === 'consumption') fetchConsumption();
    else if (activeTab === 'suppliers') fetchSuppliers();
    else if (activeTab === 'purchase_orders') {
      fetchOrders();
      fetchSuppliers(); // needed for dropdown
    } else if (activeTab === 'fx') fetchRates();
    else if (activeTab === 'market') fetchPrices(1);
  }, [activeTab, fetchInventory, fetchConsumption, fetchSuppliers, fetchOrders, fetchRates, fetchPrices]);

  // ============================================
  // FORM SUBMISSION HANDLERS
  // ============================================
  const handleInventorySubmit = async (e) => {
    e.preventDefault();
    setInvSubmitting(true);
    try {
      await inventoryApi.create({
        commodity: 'SOYBEAN',
        available_stock_mt: Number(invForm.available_stock_mt),
        reserved_stock_mt: Number(invForm.reserved_stock_mt) || 0,
        storage_capacity_mt: Number(invForm.storage_capacity_mt),
      });
      toast.success('Inventory snapshot updated successfully.');
      fetchInventory();
    } catch (err) {
      toast.error(err.message || 'Failed to update inventory');
    } finally {
      setInvSubmitting(false);
    }
  };

  const handleConsumptionSubmit = async (e) => {
    e.preventDefault();
    setConsumptionSubmitting(true);
    try {
      await consumptionApi.create({
        date: new Date(consumptionForm.date).toISOString(),
        consumption_mt: Number(consumptionForm.consumption_mt),
        source: 'MANUAL_ENTRY',
      });
      toast.success('Daily consumption entry saved.');
      setConsumptionForm((prev) => ({ ...prev, consumption_mt: '' }));
      fetchConsumption();
    } catch (err) {
      toast.error(err.message || 'Failed to record consumption');
    } finally {
      setConsumptionSubmitting(false);
    }
  };

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    setSupplierSubmitting(true);
    try {
      await suppliersApi.create({
        supplier_name: supplierForm.supplier_name.trim(),
        sourcing_type: supplierForm.sourcing_type,
        lead_time_days: Number(supplierForm.lead_time_days),
        capacity_mt: Number(supplierForm.capacity_mt),
        minimum_order_mt: Number(supplierForm.minimum_order_mt),
        active: supplierForm.active,
      });
      toast.success('Supplier added successfully.');
      setSupplierForm({
        supplier_name: '',
        sourcing_type: 'DOMESTIC',
        lead_time_days: 10,
        capacity_mt: '',
        minimum_order_mt: '',
        active: true,
      });
      fetchSuppliers();
    } catch (err) {
      toast.error(err.message || 'Failed to add supplier');
    } finally {
      setSupplierSubmitting(false);
    }
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    if (!orderForm.supplier_id) {
      toast.error('Please select a supplier');
      return;
    }
    setOrderSubmitting(true);
    try {
      await purchaseOrdersApi.create({
        supplier_id: orderForm.supplier_id,
        quantity_mt: Number(orderForm.quantity_mt),
        expected_arrival: new Date(orderForm.expected_arrival).toISOString(),
        status: orderForm.status,
      });
      toast.success('Purchase order created successfully.');
      setOrderForm({
        supplier_id: '',
        quantity_mt: '',
        expected_arrival: '',
        status: 'CONFIRMED',
      });
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to create purchase order');
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleRateSubmit = async (e) => {
    e.preventDefault();
    setRateSubmitting(true);
    try {
      await exchangeRatesApi.create({
        base_currency: rateForm.base_currency,
        quote_currency: rateForm.quote_currency,
        rate: Number(rateForm.rate),
        observed_at: new Date(rateForm.observed_at).toISOString(),
        source: rateForm.source,
      });
      toast.success('Exchange rate saved.');
      setRateForm((prev) => ({ ...prev, rate: '' }));
      fetchRates();
    } catch (err) {
      toast.error(err.message || 'Failed to record rate');
    } finally {
      setRateSubmitting(false);
    }
  };

  const handlePriceSubmit = async (e) => {
    e.preventDefault();
    setPriceSubmitting(true);
    try {
      await marketApi.createPrice({
        commodity: 'SOYBEAN',
        market_type: priceForm.market_type,
        market_name: priceForm.market_name.trim(),
        price: Number(priceForm.price),
        currency: priceForm.currency,
        unit: priceForm.unit,
        observed_at: new Date(priceForm.observed_at).toISOString(),
        source: priceForm.source.trim(),
        quality_grade: priceForm.quality_grade || null,
      });
      toast.success('Price record added successfully.');
      setPriceForm((prev) => ({ ...prev, price: '', market_name: '' }));
      fetchPrices(pricesPage.page);
    } catch (err) {
      toast.error(err.message || 'Failed to add price record');
    } finally {
      setPriceSubmitting(false);
    }
  };

  // Upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);
    try {
      const res = await marketApi.uploadPrices(file);
      setUploadResult(res);
      toast.success(
        `File processed: ${res.inserted} inserted, ${res.duplicates} duplicates, ${res.rejected} rejected`
      );
      fetchPrices(1);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Download Sample CSV
  const downloadSampleCsv = () => {
    const headers =
      'market_type,market_name,price,currency,unit,observed_at,source,commodity,quality_grade\n';
    const sampleRows =
      'DOMESTIC,Indore Mandi,45500,INR,MT,2026-11-18T10:00:00Z,AGMARKNET,SOYBEAN,FAQ\n' +
      'INTERNATIONAL,Santos Port Brazil,515,USD,MT,2026-11-18T12:00:00Z,REUTERS,SOYBEAN,EXPORT_GRADE\n';
    const blob = new Blob([headers + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'velaan_iq_sample_market_prices.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="bg-white/70 p-5 rounded-2xl border border-stone-200/80 shadow-soft backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-leaf"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-forest-700 font-mono">
              Enterprise Master Data
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight mt-1">
            Data Management Console
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl">
            Maintain physical warehouse stock, daily crushing consumption, contracted suppliers, open purchase orders, exchange rates, and market price series.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-200">
        {[
          { id: 'inventory', label: 'Inventory Snapshot', icon: Boxes },
          { id: 'consumption', label: 'Consumption', icon: Activity },
          { id: 'suppliers', label: 'Suppliers', icon: Truck },
          { id: 'purchase_orders', label: 'Purchase Orders', icon: Calendar },
          { id: 'fx', label: 'Exchange Rates', icon: DollarSign },
          { id: 'market', label: 'Market Prices & Upload', icon: FileSpreadsheet },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex-shrink-0 ${
                isActive
                  ? 'bg-forest text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink hover:bg-stone-100 bg-white/70 border border-stone-200/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: INVENTORY SNAPSHOT */}
      {/* ======================================================== */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Current Snapshot (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card
              title="Current Physical Inventory Snapshot"
              subtitle="Latest active warehouse silo balance"
              icon={Boxes}
              badge={
                inventory ? (
                  <Badge
                    status={
                      parseNum(inventory.available_stock_mt) < 2000
                        ? 'REORDER_REQUIRED'
                        : 'HEALTHY'
                    }
                    size="sm"
                  />
                ) : null
              }
            >
              {invLoading ? (
                <Skeleton className="h-44 w-full rounded-xl" />
              ) : inventory ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-forest-50/70 border border-forest-100">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">
                        Available Physical Stock
                      </span>
                      <span className="font-serif text-xl font-bold text-forest">
                        {formatMT(inventory.available_stock_mt)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">
                        Reserved Stock
                      </span>
                      <span className="font-serif text-xl font-bold text-amber-800">
                        {formatMT(inventory.reserved_stock_mt)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">
                        Net Usable Stock
                      </span>
                      <span className="font-serif text-xl font-bold text-emerald-800">
                        {formatMT(inventory.net_available_stock_mt)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">
                        Storage Capacity
                      </span>
                      <span className="font-serif text-xl font-bold text-ink">
                        {formatMT(inventory.storage_capacity_mt)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">
                        Free Silo Space
                      </span>
                      <span className="font-serif text-xl font-bold text-ink">
                        {formatMT(inventory.free_storage_mt)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">
                        Snapshot As Of
                      </span>
                      <span className="text-xs font-semibold text-ink">
                        {formatDateIST(inventory.as_of)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 text-[11px] text-ink-muted flex items-center justify-between border-t border-stone-100">
                    <span>Source: {inventory.source || 'MANUAL_ENTRY'}</span>
                    <span>Updated: {formatRelativeTime(inventory.as_of)}</span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Boxes}
                  title="No Inventory Record"
                  description="Submit the form on the right to post your warehouse stock snapshot."
                />
              )}
            </Card>
          </div>

          {/* Update Inventory Form (5 cols) */}
          <div className="lg:col-span-5">
            <Card
              title="Record New Inventory Snapshot"
              subtitle="Each entry logs an auditable dated physical count"
              icon={Plus}
            >
              <form onSubmit={handleInventorySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Available Stock On-Hand (MT) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 5000"
                    value={invForm.available_stock_mt}
                    onChange={(e) =>
                      setInvForm({ ...invForm, available_stock_mt: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Reserved Stock (MT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={invForm.reserved_stock_mt}
                    onChange={(e) =>
                      setInvForm({ ...invForm, reserved_stock_mt: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                  />
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    Stock committed to crushing batches or scheduled dispatches
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Total Warehouse Silo Capacity (MT) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="15000"
                    value={invForm.storage_capacity_mt}
                    onChange={(e) =>
                      setInvForm({ ...invForm, storage_capacity_mt: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={CheckCircle2}
                  loading={invSubmitting}
                  className="w-full"
                >
                  Save Inventory Snapshot
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CONSUMPTION */}
      {/* ======================================================== */}
      {activeTab === 'consumption' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Summary (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card
              title="Soybean Crushing Consumption (30-Day Window)"
              subtitle="Daily consumption rate used by King's safety stock formula"
              icon={Activity}
              badge={
                consumptionSummary ? (
                  <Badge status={consumptionSummary.data_quality_status} size="sm" />
                ) : null
              }
            >
              {consumptionLoading ? (
                <Skeleton className="h-44 w-full rounded-xl" />
              ) : consumptionSummary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-forest-50/70 border border-forest-100">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">
                        Average Daily Consumption
                      </span>
                      <span className="font-serif text-xl font-bold text-forest">
                        {consumptionSummary.average_daily_consumption_mt
                          ? `${formatMT(consumptionSummary.average_daily_consumption_mt)}/day`
                          : '—'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">
                        Total 30d Consumption
                      </span>
                      <span className="font-serif text-xl font-bold text-ink">
                        {formatMT(consumptionSummary.total_consumption_mt)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">
                        Recorded Days
                      </span>
                      <span className="font-serif text-xl font-bold text-ink">
                        {consumptionSummary.recorded_days} / {consumptionSummary.days_requested} days
                      </span>
                    </div>
                  </div>

                  {consumptionSummary.missing_days > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>
                        <strong>Note:</strong> {consumptionSummary.missing_days} days are missing data in the requested period. Missing days are not treated as zero.
                      </span>
                    </div>
                  )}

                  <div className="pt-2 text-[11px] text-ink-muted border-t border-stone-100 flex justify-between">
                    <span>
                      Window: {formatDateIST(consumptionSummary.period_start, false)} &mdash;{' '}
                      {formatDateIST(consumptionSummary.period_end, false)}
                    </span>
                    <span>Status: {consumptionSummary.data_quality_status}</span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No Consumption Records"
                  description="Record daily crushing consumption using the form on the right."
                />
              )}
            </Card>
          </div>

          {/* Add Daily Consumption Form (5 cols) */}
          <div className="lg:col-span-5">
            <Card
              title="Add Daily Crushing Consumption"
              subtitle="Record daily usage for King's formula"
              icon={Plus}
            >
              <form onSubmit={handleConsumptionSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={consumptionForm.date}
                    onChange={(e) =>
                      setConsumptionForm({ ...consumptionForm, date: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Soybean Crushed / Consumed (MT) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    placeholder="e.g. 150"
                    value={consumptionForm.consumption_mt}
                    onChange={(e) =>
                      setConsumptionForm({ ...consumptionForm, consumption_mt: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={CheckCircle2}
                  loading={consumptionSubmitting}
                  className="w-full"
                >
                  Save Consumption Day
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: SUPPLIERS */}
      {/* ======================================================== */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Suppliers Table (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card
              title="Contracted Suppliers"
              subtitle="Domestic aggregators and international trade houses"
              icon={Truck}
            >
              {suppliersLoading ? (
                <SkeletonTable rows={4} cols={5} />
              ) : suppliers.length > 0 ? (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-stone-50 border-b border-stone-200 text-ink-muted uppercase font-semibold">
                      <tr>
                        <th className="px-6 py-3">Supplier Name</th>
                        <th className="px-4 py-3">Route</th>
                        <th className="px-4 py-3">Lead Time</th>
                        <th className="px-4 py-3">Capacity</th>
                        <th className="px-4 py-3">MOQ</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {suppliers.map((s) => (
                        <tr key={s.id} className="hover:bg-stone-50 transition">
                          <td className="px-6 py-3.5 font-semibold text-ink">{s.supplier_name}</td>
                          <td className="px-4 py-3.5">
                            <Badge status={s.sourcing_type} size="sm" />
                          </td>
                          <td className="px-4 py-3.5 font-medium">{s.lead_time_days} days</td>
                          <td className="px-4 py-3.5 font-mono">{formatMT(s.capacity_mt)}</td>
                          <td className="px-4 py-3.5 font-mono">{formatMT(s.minimum_order_mt)}</td>
                          <td className="px-4 py-3.5">
                            <Badge
                              status={s.active ? 'HEALTHY' : 'DATA_INSUFFICIENT'}
                              label={s.active ? 'Active' : 'Inactive'}
                              size="sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Truck}
                  title="No Suppliers Configured"
                  description="Add your first supplier using the form on the right."
                />
              )}
            </Card>
          </div>

          {/* Add Supplier Form (5 cols) */}
          <div className="lg:col-span-5">
            <Card
              title="Add New Supplier"
              subtitle="Register a new domestic or global supplier"
              icon={Plus}
            >
              <form onSubmit={handleSupplierSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Malwa Agro Traders"
                    value={supplierForm.supplier_name}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, supplier_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Sourcing Type *
                    </label>
                    <select
                      value={supplierForm.sourcing_type}
                      onChange={(e) =>
                        setSupplierForm({ ...supplierForm, sourcing_type: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                    >
                      <option value="DOMESTIC">Domestic Mandi</option>
                      <option value="INTERNATIONAL">International Import</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Lead Time (Days) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="365"
                      value={supplierForm.lead_time_days}
                      onChange={(e) =>
                        setSupplierForm({ ...supplierForm, lead_time_days: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Max Capacity (MT) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 5000"
                      value={supplierForm.capacity_mt}
                      onChange={(e) =>
                        setSupplierForm({ ...supplierForm, capacity_mt: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Min Order Qty (MT) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 100"
                      value={supplierForm.minimum_order_mt}
                      onChange={(e) =>
                        setSupplierForm({ ...supplierForm, minimum_order_mt: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="supplierActive"
                    checked={supplierForm.active}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, active: e.target.checked })
                    }
                    className="w-4 h-4 accent-forest rounded"
                  />
                  <label htmlFor="supplierActive" className="text-xs text-ink font-medium cursor-pointer">
                    Supplier is active for allocations
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={CheckCircle2}
                  loading={supplierSubmitting}
                  className="w-full"
                >
                  Save Supplier
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PURCHASE ORDERS */}
      {/* ======================================================== */}
      {activeTab === 'purchase_orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Purchase Orders Table (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card
              title="Open &amp; Historical Purchase Orders"
              subtitle="Incoming deliveries factored into inventory position"
              icon={Calendar}
            >
              {ordersLoading ? (
                <SkeletonTable rows={4} cols={5} />
              ) : orders.length > 0 ? (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-stone-50 border-b border-stone-200 text-ink-muted uppercase font-semibold">
                      <tr>
                        <th className="px-6 py-3">Supplier</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Expected Arrival</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-stone-50 transition">
                          <td className="px-6 py-3.5 font-semibold text-ink">
                            {o.supplier_name || o.supplier_id}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-forest">
                            {formatMT(o.quantity_mt)}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-ink-muted">
                            {formatDateIST(o.expected_arrival, false)}
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge status={o.status} size="sm" />
                          </td>
                          <td className="px-4 py-3.5 font-mono text-ink-muted">
                            {formatMT(o.received_quantity_mt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No Purchase Orders"
                  description="Create your first incoming purchase order using the form on the right."
                />
              )}
            </Card>
          </div>

          {/* Create Purchase Order Form (5 cols) */}
          <div className="lg:col-span-5">
            <Card
              title="Create Purchase Order"
              subtitle="Log incoming shipment to update open order pipeline"
              icon={Plus}
            >
              <form onSubmit={handleOrderSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Contracted Supplier *
                  </label>
                  <select
                    required
                    value={orderForm.supplier_id}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, supplier_id: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  >
                    <option value="">Select a supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name} ({s.sourcing_type} - MOQ: {s.minimum_order_mt} MT)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Order Quantity (MT) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 1000"
                    value={orderForm.quantity_mt}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, quantity_mt: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Expected Arrival Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={orderForm.expected_arrival}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, expected_arrival: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Order Status
                  </label>
                  <select
                    value={orderForm.status}
                    onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  >
                    <option value="CONFIRMED">CONFIRMED (Order acknowledged)</option>
                    <option value="IN_TRANSIT">IN_TRANSIT (Dispatched / on route)</option>
                    <option value="RECEIVED">RECEIVED (Delivered to silo)</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={CheckCircle2}
                  loading={orderSubmitting}
                  className="w-full"
                >
                  Create Purchase Order
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: EXCHANGE RATES */}
      {/* ======================================================== */}
      {activeTab === 'fx' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* FX Rates Table (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card
              title="USD / INR Exchange Rate History"
              subtitle="Reference rates used for CIF landed cost translations"
              icon={DollarSign}
            >
              {ratesLoading ? (
                <SkeletonTable rows={4} cols={5} />
              ) : rates.length > 0 ? (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-stone-50 border-b border-stone-200 text-ink-muted uppercase font-semibold">
                      <tr>
                        <th className="px-6 py-3">Currency Pair</th>
                        <th className="px-4 py-3">Exchange Rate</th>
                        <th className="px-4 py-3">Observed Date</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Quality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {rates.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50 transition">
                          <td className="px-6 py-3.5 font-bold font-mono text-ink">
                            {r.base_currency} / {r.quote_currency}
                          </td>
                          <td className="px-4 py-3.5 font-serif text-base font-bold text-forest">
                            ₹ {parseNum(r.rate).toFixed(4)}
                          </td>
                          <td className="px-4 py-3.5 text-ink-muted">
                            {formatDateIST(r.observed_at)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-ink-muted">
                            {r.source}
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge status={r.data_quality_status} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={DollarSign}
                  title="No Exchange Rates Recorded"
                  description="Record a USD/INR exchange rate using the form on the right."
                />
              )}
            </Card>
          </div>

          {/* Add Exchange Rate Form (5 cols) */}
          <div className="lg:col-span-5">
            <Card
              title="Record Exchange Rate"
              subtitle="Add a new dated FX benchmark"
              icon={Plus}
            >
              <form onSubmit={handleRateSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Base Currency
                    </label>
                    <select
                      value={rateForm.base_currency}
                      onChange={(e) =>
                        setRateForm({ ...rateForm, base_currency: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white"
                    >
                      <option value="USD">USD</option>
                      <option value="INR">INR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Quote Currency
                    </label>
                    <select
                      value={rateForm.quote_currency}
                      onChange={(e) =>
                        setRateForm({ ...rateForm, quote_currency: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Exchange Rate (e.g. 85.65) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    min="1"
                    placeholder="85.65"
                    value={rateForm.rate}
                    onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Observed At (Date &amp; Time) *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={rateForm.observed_at}
                    onChange={(e) =>
                      setRateForm({ ...rateForm, observed_at: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Source Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RBI_REFERENCE, REUTERS"
                    value={rateForm.source}
                    onChange={(e) => setRateForm({ ...rateForm, source: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest bg-white font-mono text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={CheckCircle2}
                  loading={rateSubmitting}
                  className="w-full"
                >
                  Save Exchange Rate
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: MARKET PRICES & CSV / XLSX UPLOAD */}
      {/* ======================================================== */}
      {activeTab === 'market' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Upload Section & Sample CSV Card */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Drag & Drop File Upload (8 cols) */}
            <div className="md:col-span-8">
              <Card
                title="Batch Import Market Prices (CSV / XLSX)"
                subtitle="Upload bulk quotes from domestic mandis or global trade desks (max 5 MB / 2000 rows)"
                icon={Upload}
                action={
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    className="text-xs text-forest hover:text-leaf font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Sample CSV
                  </button>
                }
              >
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-stone-300 hover:border-forest rounded-2xl p-6 text-center transition bg-stone-50/50">
                    <input
                      type="file"
                      id="priceUploadInput"
                      accept=".csv, .xlsx"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    <label
                      htmlFor="priceUploadInput"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                    >
                      <div className="w-12 h-12 rounded-xl bg-forest-50 border border-forest-100 flex items-center justify-center text-forest">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-semibold text-ink">
                        {uploading ? 'Processing & validating file...' : 'Click to select CSV or XLSX spreadsheet'}
                      </span>
                      <span className="text-xs text-ink-muted">
                        Required columns: market_type, market_name, price, currency, unit, observed_at, source
                      </span>
                    </label>
                  </div>

                  {/* Upload Result Feedback */}
                  {uploadResult && (
                    <div className="p-4 rounded-xl bg-forest-50 border border-forest-200 text-xs text-ink space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between font-bold text-forest-900 border-b border-forest-200 pb-2">
                        <span>Upload Summary: {uploadResult.filename}</span>
                        <span>Total Rows: {uploadResult.total_rows}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                        <div className="p-2 bg-white rounded-lg border border-forest-100">
                          <span className="text-[10px] text-ink-muted block uppercase">Inserted</span>
                          <span className="font-bold text-emerald-700 text-base">
                            {uploadResult.inserted}
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-forest-100">
                          <span className="text-[10px] text-ink-muted block uppercase">Duplicates</span>
                          <span className="font-bold text-stone-600 text-base">
                            {uploadResult.duplicates}
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-forest-100">
                          <span className="text-[10px] text-ink-muted block uppercase">Flagged &gt;20%</span>
                          <span className="font-bold text-amber-700 text-base">
                            {uploadResult.flagged_unusual}
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-forest-100">
                          <span className="text-[10px] text-ink-muted block uppercase">Rejected</span>
                          <span className="font-bold text-rose-700 text-base">
                            {uploadResult.rejected}
                          </span>
                        </div>
                      </div>

                      {uploadResult.errors?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-forest-100 text-rose-800 text-[11px] max-h-32 overflow-y-auto space-y-1">
                          <span className="font-bold block">Validation Errors:</span>
                          {uploadResult.errors.map((err, i) => (
                            <div key={i}>
                              Row {err.row}: {err.error}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Manual Single Add Form (4 cols) */}
            <div className="md:col-span-4">
              <Card
                title="Manual Price Entry"
                subtitle="Add an individual spot quote"
                icon={Plus}
              >
                <form onSubmit={handlePriceSubmit} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold mb-1">Market Type *</label>
                      <select
                        value={priceForm.market_type}
                        onChange={(e) =>
                          setPriceForm({
                            ...priceForm,
                            market_type: e.target.value,
                            currency: e.target.value === 'DOMESTIC' ? 'INR' : 'USD',
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                      >
                        <option value="DOMESTIC">DOMESTIC</option>
                        <option value="INTERNATIONAL">INTERNATIONAL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">Unit *</label>
                      <select
                        value={priceForm.unit}
                        onChange={(e) => setPriceForm({ ...priceForm, unit: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                      >
                        <option value="MT">MT</option>
                        <option value="QUINTAL">QUINTAL</option>
                        <option value="KG">KG</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Market Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Indore Mandi"
                      value={priceForm.market_name}
                      onChange={(e) =>
                        setPriceForm({ ...priceForm, market_name: e.target.value })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold mb-1">Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0.01"
                        placeholder="e.g. 46000"
                        value={priceForm.price}
                        onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Currency *</label>
                      <select
                        value={priceForm.currency}
                        onChange={(e) =>
                          setPriceForm({ ...priceForm, currency: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                      >
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Observed At *</label>
                    <input
                      type="datetime-local"
                      required
                      value={priceForm.observed_at}
                      onChange={(e) =>
                        setPriceForm({ ...priceForm, observed_at: e.target.value })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold mb-1">Source *</label>
                      <input
                        type="text"
                        required
                        placeholder="AGMARKNET"
                        value={priceForm.source}
                        onChange={(e) => setPriceForm({ ...priceForm, source: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Quality Grade</label>
                      <input
                        type="text"
                        placeholder="FAQ"
                        value={priceForm.quality_grade}
                        onChange={(e) =>
                          setPriceForm({ ...priceForm, quality_grade: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={priceSubmitting}
                    className="w-full mt-1"
                  >
                    Add Price Record
                  </Button>
                </form>
              </Card>
            </div>
          </div>

          {/* Paginated Market Prices Table */}
          <Card
            title="Recorded Market Price Series"
            subtitle={`Total records in database: ${pricesPage.total}`}
            icon={TrendingUp}
          >
            {pricesLoading ? (
              <SkeletonTable rows={5} cols={6} />
            ) : pricesPage.items.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-stone-50 border-b border-stone-200 text-ink-muted uppercase font-semibold">
                      <tr>
                        <th className="px-6 py-3">Market</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Quoted Price</th>
                        <th className="px-4 py-3">Price / MT</th>
                        <th className="px-4 py-3">Observed Date</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Quality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {pricesPage.items.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50 transition">
                          <td className="px-6 py-3 font-semibold text-ink">{p.market_name}</td>
                          <td className="px-4 py-3">
                            <Badge status={p.market_type} size="sm" />
                          </td>
                          <td className="px-4 py-3 font-mono font-medium">
                            {p.currency === 'USD' ? '$' : '₹'}{' '}
                            {formatNumber(p.price)} / {p.unit}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-forest">
                            {p.currency === 'USD'
                              ? formatUSD(p.price_per_mt)
                              : formatINR(p.price_per_mt)}
                          </td>
                          <td className="px-4 py-3 text-ink-muted">
                            {formatDateIST(p.observed_at)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                            {p.source}
                          </td>
                          <td className="px-4 py-3">
                            <Badge status={p.data_quality_status} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-stone-200 text-xs text-ink-muted">
                  <span>
                    Page {pricesPage.page} of{' '}
                    {Math.ceil(pricesPage.total / pricesPage.page_size) || 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={ChevronLeft}
                      disabled={pricesPage.page <= 1}
                      onClick={() => fetchPrices(pricesPage.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={ChevronRight}
                      iconPosition="right"
                      disabled={
                        pricesPage.page >= Math.ceil(pricesPage.total / pricesPage.page_size)
                      }
                      onClick={() => fetchPrices(pricesPage.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No Market Prices Recorded"
                description="Upload a CSV/XLSX or use the manual price entry form above to populate the market price database."
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default DataPage;
