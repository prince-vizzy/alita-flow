import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarDays,
  Coins,
  Flame,
  PackageX,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
  WifiOff,
} from 'lucide-react';
import {
  fetchDashboardData,
  fetchLiveStock,
  fetchTrolleyStock,
  fetchTrolleyWaste,
  isInventoryApiConfigured,
} from '../lib/inventoryApi';
import { isAdminUnlocked } from '../lib/adminGate';
import StatTile from '../components/StatTile';
import HeroStat from '../components/HeroStat';
import ChartCard, { DataTable } from '../components/charts/ChartCard';
import BarChart from '../components/charts/BarChart';
import TrendChart from '../components/charts/TrendChart';
import RankedBarChart from '../components/charts/RankedBarChart';
import {
  RANGES,
  computeStats,
  computeToday,
  computeTotals,
  delta,
  formatDayLabel,
  formatRangeLabel,
  normalize,
  resolveWindow,
} from '../lib/dashboardStats';
import {
  INK,
  SALES_COLOR,
  STATUS,
  SERIES,
  SPEND_COLOR,
  formatExact,
  formatMoney,
  formatPercent,
  formatUnits,
} from '../lib/vizTheme';

// Same threshold the Apps Script stock summary uses, so the tile and the
// list below it can never disagree about what counts as "low".
const LOW_STOCK_AT = 3;

// Fixed item order for the trolley's grouped bars — an item keeps its color
// slot whatever sold on a given day, so the reader's "eggs are blue" holds
// across every range and every chart on the panel.
const TROLLEY_ITEM_ORDER = ['Eggs', 'Sweet Potatoes', 'Arrow Roots', 'Smokie'];

// Section identity, carried over from the home screen. Chrome only — tabs and
// the page title — never a chart mark: neither hue sits in the validated
// lightness band for marks on this surface.
const TABS = [
  { key: 'shop', label: 'Shop', chrome: 'var(--color-shop)' },
  { key: 'trolley', label: 'Trolley', chrome: 'var(--color-trolley)' },
];

const WASTE_DAYS = 14;

export default function Dashboard() {
  const navigate = useNavigate();
  const [unlocked] = useState(isAdminUnlocked);
  const [tab, setTab] = useState('shop');
  const [rangeKey, setRangeKey] = useState('30d');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, refreshing: false, error: null, syncedAt: null });

  useEffect(() => {
    if (!unlocked) navigate('/', { replace: true });
  }, [unlocked, navigate]);

  // The ledger is the only hard dependency; live stock, trolley stock and the
  // waste report each enrich one section and are allowed to fail on their own
  // without taking the page down with them.
  const load = useCallback(async (mode = 'initial') => {
    setStatus((prev) => ({
      ...prev,
      loading: mode === 'initial',
      refreshing: mode !== 'initial',
      error: null,
    }));

    const [dashboard, shopItems, trolleyItems, waste] = await Promise.allSettled([
      fetchDashboardData(),
      fetchLiveStock(),
      fetchTrolleyStock(),
      fetchTrolleyWaste(WASTE_DAYS),
    ]);

    if (dashboard.status === 'rejected') {
      setStatus({ loading: false, refreshing: false, error: dashboard.reason.message, syncedAt: null });
      return;
    }

    setData({
      rows: normalize(dashboard.value.transactions),
      stock: dashboard.value.stock,
      shopItems: shopItems.status === 'fulfilled' ? shopItems.value : null,
      trolleyItems: trolleyItems.status === 'fulfilled' ? trolleyItems.value : null,
      waste: waste.status === 'fulfilled' ? waste.value : null,
    });
    setStatus({ loading: false, refreshing: false, error: null, syncedAt: Date.now() });
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    if (!isInventoryApiConfigured()) {
      setStatus({ loading: false, refreshing: false, error: 'Live sheet sync is not set up yet.', syncedAt: null });
      return;
    }
    load('initial');
  }, [unlocked, load]);

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];

  const view = useMemo(() => {
    if (!data) return null;
    const build = (business, itemOrder) => {
      const rows = data.rows.filter((r) => r.business === business);
      const window = resolveWindow(range, rows);
      return {
        window,
        stats: computeStats(rows, window, { itemOrder }),
        previous: window.previous ? computeTotals(rows, window.previous) : null,
        today: computeToday(rows),
      };
    };
    return { shop: build('Hardware'), trolley: build('Trolley', TROLLEY_ITEM_ORDER) };
  }, [data, range]);

  if (!unlocked) return null;

  const activeTab = TABS.find((t) => t.key === tab);

  return (
    <div className="ground min-h-dvh text-ink flex flex-col items-center px-5 py-7 font-sans">
      <header className="w-full max-w-3xl mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-full text-ink-3 hover:text-ink transition-colors"
          aria-label="Back to sections"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-xl font-light tracking-[0.22em] uppercase">
          Dashboard<span style={{ color: activeTab.chrome }}>.</span>
        </h1>

        {data && (
          <div className="flex items-center gap-2">
            {status.syncedAt && (
              <span className="hidden sm:inline text-[10px]" style={{ color: INK.muted }}>
                Synced {new Date(status.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => load('refresh')}
              disabled={status.refreshing}
              className="p-2 rounded-full text-ink-3 hover:text-ink transition-colors disabled:opacity-50"
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${status.refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </header>

      {data && (
        <div className="glass w-full max-w-3xl mb-4 flex gap-2 rounded-[22px] p-1.5">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                className="flex-1 rounded-[18px] py-2.5 text-sm font-medium tracking-wide transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: `color-mix(in srgb, ${t.chrome} 14%, transparent)`,
                        color: t.chrome,
                        border: `1px solid color-mix(in srgb, ${t.chrome} 32%, transparent)`,
                      }
                    : { color: 'var(--color-ink-3)', border: '1px solid transparent' }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* One filter row, above everything it scopes — every tile, chart and
          table below re-renders against the same slice. */}
      {view && (
        <div className="w-full max-w-3xl mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div role="group" aria-label="Date range" className="glass flex gap-1 rounded-[18px] p-1">
            {RANGES.map((r) => {
              const active = r.key === rangeKey;
              return (
                <button
                  key={r.key}
                  onClick={() => setRangeKey(r.key)}
                  aria-pressed={active}
                  className="rounded-[14px] px-3.5 py-2 text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: active ? INK.primary : INK.muted,
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <p className="flex items-center gap-1.5 text-[11px]" style={{ color: INK.muted }}>
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
            {formatRangeLabel(view[tab].window.startKey, view[tab].window.endKey)}
          </p>
        </div>
      )}

      {status.loading && (
        <p className="text-sm" style={{ color: INK.muted }}>
          Loading…
        </p>
      )}

      {status.error && (
        <div className="glass w-full max-w-3xl flex items-center gap-2 text-xs font-medium text-[#e88b8b] rounded-[22px] px-4 py-3">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          {status.error}
        </div>
      )}

      {view && (
        <main className="w-full max-w-3xl pb-14">
          {tab === 'shop' ? (
            <ShopPanel
              stats={view.shop.stats}
              previous={view.shop.previous}
              range={range}
              stockSummary={data.stock}
              items={data.shopItems}
              dim={status.refreshing}
            />
          ) : (
            <TrolleyPanel
              stats={view.trolley.stats}
              previous={view.trolley.previous}
              today={view.trolley.today}
              range={range}
              items={data.trolleyItems}
              waste={data.waste}
              dim={status.refreshing}
            />
          )}
        </main>
      )}
    </div>
  );
}

/* ---------------------------------- shop --------------------------------- */

function ShopPanel({ stats, previous, range, stockSummary, items, dim }) {
  const compare = previous ? `vs previous ${range.days} days` : null;
  const stock = useMemo(() => buildStockView(items, stockSummary), [items, stockSummary]);
  const periodWord = stats.granularity === 'day' ? 'day' : 'month';

  return (
    <div className="flex flex-col gap-4" style={{ opacity: dim ? 0.55 : 1, transition: 'opacity 200ms' }}>
      <HeroStat
        label={`Net for the ${range.days ? `last ${range.days} days` : 'whole ledger'}`}
        value={formatMoney(stats.net)}
        tone={moneyTone(stats.net)}
        delta={previous ? delta(stats.net, previous.net) : null}
        deltaLabel={compare}
        breakdown={[
          { label: 'Sales', value: formatMoney(stats.totalSales), color: SALES_COLOR },
          { label: 'Purchases', value: formatMoney(stats.totalSpend), color: SPEND_COLOR },
        ]}
        spark={{ values: stats.seriesNet, color: SALES_COLOR, label: 'Net per period, trend only' }}
        caption={
          stats.hasActivity
            ? `${formatExact(stats.saleCount)} sales across ${stats.activeBuckets} trading ${periodWord}${stats.activeBuckets === 1 ? '' : 's'}`
            : 'No trading recorded in this window'
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Sales"
          icon={Coins}
          value={formatMoney(stats.totalSales)}
          delta={previous ? delta(stats.totalSales, previous.totalSales) : null}
          deltaLabel={compare}
        />
        <StatTile
          label="Purchases"
          icon={Receipt}
          value={formatMoney(stats.totalSpend)}
          delta={previous ? delta(stats.totalSpend, previous.totalSpend) : null}
          deltaLabel={compare}
          invertDelta
        />
        <StatTile
          label="Margin"
          icon={TrendingUp}
          value={stats.margin == null ? '—' : formatPercent(stats.margin)}
          hint="Net share of every shilling sold"
        />
        <StatTile
          label="Sales logged"
          icon={Receipt}
          value={formatExact(stats.saleCount)}
          delta={previous ? delta(stats.saleCount, previous.saleCount) : null}
          deltaLabel={compare}
        />
        <StatTile label="Avg sale value" value={formatMoney(stats.avgSale)} />
        <StatTile label="Items sold" value={formatUnits(stats.itemsSold)} hint="Units across all sales" />
        <StatTile
          label={`Best ${periodWord}`}
          value={stats.best ? formatMoney(stats.best.value) : '—'}
          hint={stats.best ? stats.best.label : 'No trading yet'}
        />
        <StatTile
          label={`Avg per trading ${periodWord}`}
          value={formatMoney(stats.avgPerActiveBucket)}
        />
      </div>

      <StockHealth stock={stock} />

      <ChartCard
        title="Money in and out"
        subtitle={`${stats.granularity === 'day' ? 'Daily' : 'Monthly'} sales against purchases`}
        legend={[
          { name: 'Sales', color: SALES_COLOR, shape: 'line' },
          { name: 'Purchases', color: SPEND_COLOR, shape: 'line' },
        ]}
        empty={stats.hasActivity ? null : 'Nothing recorded in this window.'}
        table={buildTimeTable(stats)}
      >
        <TrendChart
          categories={stats.bucketLabels}
          series={[
            { name: 'Sales', color: SALES_COLOR, values: stats.seriesSales },
            { name: 'Purchases', color: SPEND_COLOR, values: stats.seriesSpend },
          ]}
          valueFormatter={formatMoney}
          ariaLabel="Sales and purchases over time"
        />
      </ChartCard>

      {/* Only worth its space when the axis above is daily — on a monthly
          axis this card would redraw the same series it just showed. */}
      {stats.granularity === 'day' && stats.span >= 60 && stats.monthKeys.length > 1 && (
        <ChartCard
          title="Month by month"
          subtitle="Rolled up per calendar month — the first and last months only count the days inside the range"
          legend={[
            { name: 'Sales', color: SALES_COLOR },
            { name: 'Purchases', color: SPEND_COLOR },
          ]}
          table={buildMonthTable(stats)}
        >
          <BarChart
            categories={stats.monthLabels}
            series={[
              { name: 'Sales', color: SALES_COLOR, values: stats.monthlySales },
              { name: 'Purchases', color: SPEND_COLOR, values: stats.monthlySpend },
            ]}
            valueFormatter={formatMoney}
            ariaLabel="Sales and purchases per month"
          />
        </ChartCard>
      )}

      <ChartCard
        title="Top items by revenue"
        subtitle="Highest earners in this window"
        empty={stats.topByRevenue.length ? null : 'No sales in this window yet.'}
        table={buildTopItemsTable(stats)}
      >
        <RankedBarChart
          items={stats.topByRevenue.map((item) => ({
            name: item.name,
            value: item.revenue,
            note: `${formatUnits(item.qty)} units`,
          }))}
          color={SALES_COLOR}
          valueFormatter={formatMoney}
        />
      </ChartCard>

      <ChartCard
        title="Net per item"
        subtitle="Sales minus what was spent under the same name"
        empty={stats.netByItem.length ? null : 'Nothing to compare in this window yet.'}
        table={buildNetItemsTable(stats)}
      >
        <RankedBarChart
          items={stats.netByItem.map((item) => ({ name: item.name, value: item.net }))}
          valueFormatter={formatMoney}
          diverging
          caption="Right of the line earned more than it cost; left of it cost more than it earned."
        />
      </ChartCard>

      {stats.granularity === 'day' && stats.span >= 7 && (
        <ChartCard
          title="Sales by day of week"
          subtitle="Which days actually carry the week"
          empty={stats.hasActivity ? null : 'No sales in this window yet.'}
          table={{
            columns: [
              { key: 'day', label: 'Day' },
              { key: 'sales', label: 'Sales', align: 'right' },
              { key: 'days', label: 'Trading days', align: 'right' },
            ],
            rows: stats.weekday.map((d) => ({
              key: d.label,
              day: d.label,
              sales: formatMoney(d.sales),
              days: formatExact(d.activeDays),
            })),
          }}
        >
          <BarChart
            categories={stats.weekday.map((d) => d.label)}
            series={[{ name: 'Sales', color: SALES_COLOR, values: stats.weekday.map((d) => d.sales) }]}
            valueFormatter={formatMoney}
            ariaLabel="Sales by day of week"
          />
        </ChartCard>
      )}
    </div>
  );
}

function StockHealth({ stock }) {
  if (!stock) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Out of stock"
          icon={PackageX}
          value={formatExact(stock.outOfStock)}
          tone={stock.outOfStock > 0 ? 'critical' : 'good'}
          hint={stock.outOfStock > 0 ? 'Needs restocking' : 'Everything in stock'}
        />
        <StatTile
          label={`Low stock (${LOW_STOCK_AT} or fewer)`}
          icon={AlertTriangle}
          value={formatExact(stock.lowStock)}
          tone={stock.lowStock > 0 ? 'warning' : 'good'}
          hint={stock.lowStock > 0 ? 'Running down' : 'Nothing running low'}
        />
        {stock.live && <StatTile label="Units on hand" icon={Boxes} value={formatUnits(stock.unitsOnHand)} />}
        {stock.live && (
          <StatTile
            label="Stock value"
            icon={Wallet}
            value={formatMoney(stock.retailValue)}
            hint="At current selling prices"
          />
        )}
      </div>

      {stock.live && stock.attention.length > 0 && (
        <ChartCard
          title="Needs restocking"
          subtitle={`${stock.attention.length} of ${stock.tracked} shop items are out or low`}
        >
          <DataTable
            columns={[
              { key: 'name', label: 'Item' },
              { key: 'status', label: 'Status' },
              { key: 'stock', label: 'Left', align: 'right' },
              { key: 'price', label: 'Price', align: 'right' },
            ]}
            rows={stock.attention.map((item) => ({
              key: item.id ?? item.name,
              name: item.name,
              status: <StockPill out={Number(item.stock) <= 0} />,
              stock: formatUnits(Number(item.stock) || 0),
              price: Number(item.price) > 0 ? formatMoney(item.price) : '—',
            }))}
          />
        </ChartCard>
      )}
    </div>
  );
}

// Status reads as icon + word first; the color is a reinforcement, never the
// message on its own.
function StockPill({ out }) {
  const Icon = out ? PackageX : AlertTriangle;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium"
      style={{ color: out ? STATUS.critical : STATUS.warning }}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      {out ? 'Out of stock' : 'Low'}
    </span>
  );
}

/* -------------------------------- trolley -------------------------------- */

function TrolleyPanel({ stats, previous, today, range, items, waste, dim }) {
  const compare = previous ? `vs previous ${range.days} days` : null;
  const periodWord = stats.granularity === 'day' ? 'day' : 'month';
  const kitchen = useMemo(() => buildKitchenView(items, today.itemsSold), [items, today.itemsSold]);
  const wasteView = useMemo(() => buildWasteView(waste, stats.window.startKey), [waste, stats.window.startKey]);
  // Four items standing side by side stays readable for a couple of weeks;
  // past that the same data reads far better as one column per day.
  const stackUnits = stats.buckets.length > 14;

  return (
    <div className="flex flex-col gap-4" style={{ opacity: dim ? 0.55 : 1, transition: 'opacity 200ms' }}>
      {/* The trolley trades on a same-day cycle — cook in the morning, sell
          out by evening — so today leads, whatever range is selected. */}
      <HeroStat
        label="Today's net"
        value={formatMoney(today.net)}
        tone={moneyTone(today.net)}
        breakdown={[
          { label: 'Sales', value: formatMoney(today.totalSales), color: SALES_COLOR },
          { label: 'Expenses', value: formatMoney(today.totalSpend), color: SPEND_COLOR },
        ]}
        spark={{ values: stats.seriesNet, color: SALES_COLOR, label: 'Net per period, trend only' }}
        caption={
          today.saleCount
            ? `${formatExact(today.saleCount)} sales today · ${formatUnits(today.itemsSold)} units sold`
            : 'Nothing sold yet today'
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Sales in range"
          icon={Coins}
          value={formatMoney(stats.totalSales)}
          delta={previous ? delta(stats.totalSales, previous.totalSales) : null}
          deltaLabel={compare}
        />
        <StatTile
          label="Expenses in range"
          icon={Receipt}
          value={formatMoney(stats.totalSpend)}
          hint="Restocks and ingredients"
          delta={previous ? delta(stats.totalSpend, previous.totalSpend) : null}
          deltaLabel={compare}
          invertDelta
        />
        <StatTile
          label="Net in range"
          value={formatMoney(stats.net)}
          tone={moneyTone(stats.net)}
          delta={previous ? delta(stats.net, previous.net) : null}
          deltaLabel={compare}
        />
        <StatTile
          label="Margin"
          icon={TrendingUp}
          value={stats.margin == null ? '—' : formatPercent(stats.margin)}
          hint="Net share of every shilling sold"
        />
        <StatTile label="Units sold" value={formatUnits(stats.itemsSold)} />
        <StatTile label="Avg sale value" value={formatMoney(stats.avgSale)} />
        <StatTile
          label={`Best ${periodWord}`}
          value={stats.best ? formatMoney(stats.best.value) : '—'}
          hint={stats.best ? stats.best.label : 'No trading yet'}
        />
        <StatTile
          label={`Avg per trading ${periodWord}`}
          value={formatMoney(stats.avgPerActiveBucket)}
        />
      </div>

      {kitchen && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              label="Cooked and ready"
              icon={Flame}
              value={formatUnits(kitchen.cookedUnits)}
              hint="Units on the trolley now"
            />
            <StatTile
              label="Ready-to-sell value"
              icon={Wallet}
              value={formatMoney(kitchen.cookedValue)}
              hint="At current prices"
            />
            <StatTile label="Raw stock" icon={Boxes} value={formatUnits(kitchen.rawUnits)} hint="Still to be cooked" />
            <StatTile
              label="Sold through today"
              value={kitchen.sellThrough == null ? '—' : formatPercent(kitchen.sellThrough)}
              hint="Of everything cooked today"
            />
          </div>

          <ChartCard title="On the trolley now" subtitle="Cooked stock sells first; raw stock is tomorrow's supply">
            <DataTable
              columns={[
                { key: 'name', label: 'Item' },
                { key: 'cooked', label: 'Cooked', align: 'right' },
                { key: 'raw', label: 'Raw', align: 'right' },
                { key: 'price', label: 'Price', align: 'right' },
                { key: 'value', label: 'Ready value', align: 'right' },
              ]}
              rows={kitchen.rows}
            />
          </ChartCard>
        </div>
      )}

      <ChartCard
        title="Money in and out"
        subtitle={`${stats.granularity === 'day' ? 'Daily' : 'Monthly'} sales against expenses`}
        legend={[
          { name: 'Sales', color: SALES_COLOR, shape: 'line' },
          { name: 'Expenses', color: SPEND_COLOR, shape: 'line' },
        ]}
        empty={stats.hasActivity ? null : 'Nothing recorded in this window.'}
        table={buildTimeTable(stats, 'Expenses')}
      >
        <TrendChart
          categories={stats.bucketLabels}
          series={[
            { name: 'Sales', color: SALES_COLOR, values: stats.seriesSales },
            { name: 'Expenses', color: SPEND_COLOR, values: stats.seriesSpend },
          ]}
          valueFormatter={formatMoney}
          ariaLabel="Sales and expenses over time"
        />
      </ChartCard>

      <ChartCard
        title={`Units sold per ${periodWord}, by item`}
        subtitle={
          stackUnits
            ? `Each column is one ${periodWord}'s total, split by item`
            : 'What actually moves, and when'
        }
        legend={stats.qtyByItem.map((s, i) => ({ name: s.name, color: SERIES[i] }))}
        empty={stats.qtyByItem.length ? null : 'No sales in this window yet.'}
        table={buildQtyTable(stats)}
      >
        <BarChart
          categories={stats.bucketLabels}
          series={stats.qtyByItem.map((s, i) => ({ ...s, color: SERIES[i] }))}
          valueFormatter={formatUnits}
          stacked={stackUnits}
          ariaLabel="Units sold per period by item"
        />
      </ChartCard>

      <ChartCard
        title="Leftovers"
        subtitle={
          wasteView
            ? `${formatUnits(wasteView.total)} units cooked but never sold${
                range.days && range.days <= WASTE_DAYS ? ' in this range' : `, over the last ${WASTE_DAYS} days`
              }`
            : undefined
        }
        empty={
          !waste
            ? 'Leftover report unavailable right now.'
            : wasteView.categories.length
              ? null
              : 'Nothing went to waste in this window.'
        }
        table={
          wasteView && wasteView.categories.length
            ? {
                columns: [
                  { key: 'date', label: 'Day' },
                  { key: 'items', label: 'Left over' },
                  { key: 'total', label: 'Units', align: 'right' },
                ],
                rows: wasteView.rows,
              }
            : undefined
        }
      >
        {wasteView && (
          <BarChart
            categories={wasteView.categories}
            series={[{ name: 'Leftover units', color: SPEND_COLOR, values: wasteView.values }]}
            valueFormatter={formatUnits}
            ariaLabel="Leftover units per day"
          />
        )}
      </ChartCard>

      <ChartCard
        title="Top items by revenue"
        subtitle="Highest earners in this window"
        empty={stats.topByRevenue.length ? null : 'No sales in this window yet.'}
        table={buildTopItemsTable(stats)}
      >
        <RankedBarChart
          items={stats.topByRevenue.map((item) => ({
            name: item.name,
            value: item.revenue,
            note: `${formatUnits(item.qty)} units`,
          }))}
          color={SALES_COLOR}
          valueFormatter={formatMoney}
        />
      </ChartCard>

      <ChartCard
        title="Net per item"
        subtitle="Sales minus restocks and ingredient costs logged under the same name"
        empty={stats.netByItem.length ? null : 'Nothing to compare in this window yet.'}
        table={buildNetItemsTable(stats)}
      >
        <RankedBarChart
          items={stats.netByItem.map((item) => ({ name: item.name, value: item.net }))}
          valueFormatter={formatMoney}
          diverging
          caption="Ingredients bought as cash expenses sit on the left — they cost money without selling any."
        />
      </ChartCard>
    </div>
  );
}

/* --------------------------------- helpers -------------------------------- */

// Zero is neither good nor bad — a break-even day shouldn't wear the same
// green as a profitable one.
function moneyTone(value) {
  if (value > 0) return 'good';
  if (value < 0) return 'critical';
  return undefined;
}

function buildStockView(items, summary) {
  if (!items) {
    if (!summary) return null;
    // The ledger endpoint still gives the two counts even when the live item
    // list didn't load — show those and skip the detail below them.
    return { live: false, outOfStock: summary.outOfStock, lowStock: summary.lowStock };
  }

  const stockOf = (item) => Math.max(Number(item.stock) || 0, 0);
  const out = items.filter((item) => stockOf(item) <= 0);
  const low = items.filter((item) => stockOf(item) > 0 && stockOf(item) <= LOW_STOCK_AT);

  return {
    live: true,
    tracked: items.length,
    outOfStock: out.length,
    lowStock: low.length,
    unitsOnHand: items.reduce((sum, item) => sum + stockOf(item), 0),
    retailValue: items.reduce((sum, item) => sum + stockOf(item) * (Number(item.price) || 0), 0),
    attention: [...out, ...low.sort((a, b) => stockOf(a) - stockOf(b))],
  };
}

function buildKitchenView(items, soldToday) {
  if (!items || !items.length) return null;

  const cookedUnits = items.reduce((sum, item) => sum + (Number(item.cookedStock) || 0), 0);
  const rawUnits = items.reduce((sum, item) => sum + (Number(item.regularStock) || 0), 0);

  return {
    cookedUnits,
    rawUnits,
    cookedValue: items.reduce(
      (sum, item) => sum + (Number(item.cookedStock) || 0) * (Number(item.price) || 0),
      0
    ),
    // Cooked stock is what's *left* of today's cooking, so everything cooked
    // today is what sold plus what's still sitting there — no separate
    // "cooked today" figure needed.
    sellThrough: soldToday + cookedUnits > 0 ? soldToday / (soldToday + cookedUnits) : null,
    rows: items.map((item) => ({
      key: item.id ?? item.name,
      name: item.name,
      cooked: formatUnits(Number(item.cookedStock) || 0),
      raw: formatUnits(Number(item.regularStock) || 0),
      price: Number(item.price) > 0 ? formatMoney(item.price) : '—',
      value: formatMoney((Number(item.cookedStock) || 0) * (Number(item.price) || 0)),
    })),
  };
}

// The leftovers report only ever covers the last WASTE_DAYS days, so a longer
// range shows everything it has; a shorter one is trimmed to the same window
// as the rest of the panel.
function buildWasteView(waste, startKey) {
  if (!waste) return null;
  // The API returns most-recent-first; a time axis reads left to right.
  const days = waste.filter((day) => day.date >= startKey).reverse();
  return {
    categories: days.map((day) => formatDayLabel(day.date)),
    values: days.map((day) => day.total),
    total: days.reduce((sum, day) => sum + day.total, 0),
    rows: days
      .slice()
      .reverse()
      .map((day) => ({
        key: day.date,
        date: formatDayLabel(day.date),
        items: day.items.map((item) => `${item.name} ×${formatUnits(item.qty)}`).join(', '),
        total: formatUnits(day.total),
      })),
  };
}

function buildTimeTable(stats, spendLabel = 'Purchases') {
  return {
    columns: [
      { key: 'period', label: stats.granularity === 'day' ? 'Day' : 'Month' },
      { key: 'sales', label: 'Sales', align: 'right' },
      { key: 'spend', label: spendLabel, align: 'right' },
      { key: 'net', label: 'Net', align: 'right' },
    ],
    rows: stats.buckets.map((key, i) => ({
      key,
      period: stats.bucketLabels[i],
      sales: formatMoney(stats.seriesSales[i]),
      spend: formatMoney(stats.seriesSpend[i]),
      net: formatMoney(stats.seriesNet[i]),
    })),
  };
}

function buildMonthTable(stats) {
  return {
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'sales', label: 'Sales', align: 'right' },
      { key: 'spend', label: 'Purchases', align: 'right' },
      { key: 'net', label: 'Net', align: 'right' },
    ],
    rows: stats.monthKeys.map((key, i) => ({
      key,
      month: stats.monthLabels[i],
      sales: formatMoney(stats.monthlySales[i]),
      spend: formatMoney(stats.monthlySpend[i]),
      net: formatMoney(stats.monthlySales[i] - stats.monthlySpend[i]),
    })),
  };
}

function buildTopItemsTable(stats) {
  const total = stats.totalSales || 1;
  return {
    columns: [
      { key: 'name', label: 'Item' },
      { key: 'revenue', label: 'Revenue', align: 'right' },
      { key: 'units', label: 'Units', align: 'right' },
      { key: 'share', label: 'Share', align: 'right' },
    ],
    rows: stats.topByRevenue.map((item) => ({
      key: item.name,
      name: item.name,
      revenue: formatMoney(item.revenue),
      units: formatUnits(item.qty),
      share: formatPercent(item.revenue / total),
    })),
  };
}

function buildNetItemsTable(stats) {
  return {
    columns: [
      { key: 'name', label: 'Item' },
      { key: 'revenue', label: 'Sales', align: 'right' },
      { key: 'spend', label: 'Spent', align: 'right' },
      { key: 'net', label: 'Net', align: 'right' },
    ],
    rows: stats.netByItem.map((item) => ({
      key: item.name,
      name: item.name,
      revenue: formatMoney(item.revenue),
      spend: formatMoney(item.spend),
      net: formatMoney(item.net),
    })),
  };
}

function buildQtyTable(stats) {
  return {
    columns: [
      { key: 'period', label: stats.granularity === 'day' ? 'Day' : 'Month' },
      ...stats.qtyByItem.map((s) => ({ key: s.name, label: s.name, align: 'right' })),
      { key: '__total', label: 'Total', align: 'right' },
    ],
    rows: stats.buckets.map((key, i) => {
      const row = { key, period: stats.bucketLabels[i] };
      stats.qtyByItem.forEach((s) => {
        row[s.name] = formatUnits(s.values[i]);
      });
      row.__total = formatUnits(stats.seriesQty[i]);
      return row;
    }),
  };
}
