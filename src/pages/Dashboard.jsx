import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarDays,
  Coins,
  Package,
  PackageX,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Store,
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
import { PRODUCTS } from '../data/products';
import { fetchGeminiStatus } from '../lib/geminiApi';
import { buildBook, buildDigest } from '../lib/dashboardDigest';
import InsightsDock from '../components/InsightsDock';
import useHideOnScroll from '../lib/useHideOnScroll';
import MorningSummary from '../components/MorningSummary';
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
  formatWeekSpan,
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
const TROLLEY_ITEM_ORDER = ['Eggs', 'Sweet-Potatoes', 'Arrow-Roots', 'Smokie'];

// Section identity, carried over from the home screen. Chrome only — tabs and
// the page title — never a chart mark: neither hue sits in the validated
// lightness band for marks on this surface.
const TABS = [
  { key: 'shop', label: 'Shop', chrome: 'var(--color-shop)', icon: Store },
  { key: 'trolley', label: 'Trolley', chrome: 'var(--color-trolley)', icon: ShoppingCart },
];

const WASTE_DAYS = 14;

// The last load, kept so the dashboard opens onto it at once. The sheet takes
// several seconds to answer four reads — longer on a phone's connection — and
// the page used to sit on "Loading…" for all of it, every time. Now it shows
// what it had and refreshes underneath, the spinner in the header saying so.
const CACHE_KEY = 'alita-flow-dashboard-cache';

function loadCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return Array.isArray(cached?.data?.rows) ? cached : null;
  } catch {
    return null;
  }
}

function saveCached(data, syncedAt) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, syncedAt }));
  } catch {
    // Full or blocked storage only costs the next open its head start.
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [cached] = useState(loadCached);
  const [tab, setTab] = useState('shop');
  const [rangeKey, setRangeKey] = useState('30d');
  const [data, setData] = useState(() => cached?.data ?? null);
  const [status, setStatus] = useState(() => ({
    loading: !cached,
    refreshing: Boolean(cached),
    error: null,
    syncedAt: cached?.syncedAt ?? null,
  }));
  // Whether what's on screen came from the sheet on this visit rather than
  // from the cache. Insights wait for it: a read written about the cached
  // numbers would be replaced seconds later, and pay Gemini twice to do it.
  const [fresh, setFresh] = useState(false);
  // Whether the server holds a Gemini key. Nothing about the insights panel
  // renders until it says yes, so a deploy without the key looks like a
  // dashboard that simply never had one.
  const [geminiReady, setGeminiReady] = useState(false);

  // Getting here at all means the PIN was accepted this session — see
  // <PinOnly> in App.jsx. The routes behind the page check it again.
  useEffect(() => {
    let alive = true;
    fetchGeminiStatus().then((ready) => {
      if (alive) setGeminiReady(ready);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The ledger is the only hard dependency; live stock, trolley stock and the
  // spoilt report each enrich one section and are allowed to fail on their own
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
      // Whatever is already on screen stays there, stamped with when it was
      // really synced, rather than being thrown away over a failed refresh.
      setStatus((prev) => ({
        loading: false,
        refreshing: false,
        error: dashboard.reason.message,
        syncedAt: prev.syncedAt,
      }));
      return;
    }

    const next = {
      rows: normalize(dashboard.value.transactions),
      stock: dashboard.value.stock,
      shopItems: shopItems.status === 'fulfilled' ? shopItems.value : null,
      trolleyItems: trolleyItems.status === 'fulfilled' ? trolleyItems.value : null,
      waste: waste.status === 'fulfilled' ? waste.value : null,
    };
    const syncedAt = Date.now();
    setData(next);
    setFresh(true);
    setStatus({ loading: false, refreshing: false, error: null, syncedAt });
    saveCached(next, syncedAt);
  }, []);

  useEffect(() => {
    if (!isInventoryApiConfigured()) {
      setStatus({ loading: false, refreshing: false, error: 'Live sheet sync is not set up yet.', syncedAt: null });
      return;
    }
    load(cached ? 'refresh' : 'initial');
  }, [load, cached]);

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

  // Everything the app holds, rebuilt only when the dashboard refetches: the
  // price list, the stock position and the whole ledger. Questions reach well
  // past the tab and range on screen, so the answer has to be able to.
  const book = useMemo(() => {
    if (!data || !fresh || !geminiReady) return null;
    return buildBook({
      rows: data.rows,
      catalogue: PRODUCTS,
      shopItems: data.shopItems,
      trolleyItems: data.trolleyItems,
      waste: data.waste,
    });
  }, [data, fresh, geminiReady]);

  // The dock floats over the page rather than sitting in a panel, so the
  // slice it opens with is built here, for whichever tab is showing.
  const digest = useMemo(() => {
    if (!view || !data || !book) return null;
    const onScreen =
      tab === 'shop'
        ? buildDigest({
            section: 'shop',
            range,
            stats: view.shop.stats,
            previous: view.shop.previous,
            stock: buildStockView(data.shopItems, data.stock),
          })
        : buildDigest({
            section: 'trolley',
            range,
            stats: view.trolley.stats,
            previous: view.trolley.previous,
            kitchen: buildKitchenView(data.trolleyItems),
            waste: data.waste,
            today: view.trolley.today,
          });
    return { onScreen, book };
  }, [view, data, book, tab, range]);

  const activeTab = TABS.find((t) => t.key === tab);
  // One signal for everything that floats, so the bar and the dock leave and
  // return together rather than crossing each other on the way.
  const scrolledAway = useHideOnScroll();

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
        <main className={`w-full max-w-3xl ${digest ? 'pb-44' : 'pb-32'}`}>
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

          {/* Below the panels rather than in the header: it is set once and
              then forgotten, unlike the range and the tabs. */}
          <div className="mt-4">
            <MorningSummary accent={activeTab.chrome} />
          </div>
        </main>
      )}

      {data && <SectionNav tab={tab} onChange={setTab} hidden={scrolledAway} />}

      {digest && (
        <InsightsDock
          section={tab}
          cacheKey={`${tab}:${rangeKey}:${status.syncedAt ?? 0}`}
          digest={digest}
          accent={activeTab.chrome}
          hidden={scrolledAway}
        />
      )}
    </div>
  );
}

/* ------------------------------- bottom nav ------------------------------- */

// Shop and Trolley used to sit in a row under the title, at the top of a page
// that is mostly scrolling. Down here they stay in reach of a thumb however
// far down the charts you are — the same reason the insights dock floats.
//
// The bar is tinted towards the shop's green, but each
// tab keeps its own chrome when active: green for the shop, amber for the
// trolley. That pairing is the app's section identity and it holds everywhere
// else, so the container is what is green here, not the selection.
function SectionNav({ tab, onChange, hidden }) {
  return (
    <nav
      aria-label="Section"
      // Hidden from the pointer as well as the eye — a bar that has slid off
      // the screen must not still be catching taps meant for the chart under
      // it. aria-hidden goes with it so a screen reader is not offered a
      // control that is on its way out.
      aria-hidden={hidden}
      className={`glass-strong fixed z-40 bottom-4 left-1/2 -translate-x-1/2 w-[min(23rem,calc(100vw-2rem))] flex gap-1.5 rounded-[24px] p-1.5 shadow-2xl transition-[transform,opacity] duration-300 ease-out ${
        hidden ? 'translate-y-[150%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-shop) 10%, rgba(15, 26, 20, 0.82))',
        borderColor: 'color-mix(in srgb, var(--color-shop) 30%, transparent)',
      }}
    >
      {TABS.map((t) => {
        const active = tab === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            aria-pressed={active}
            tabIndex={hidden ? -1 : 0}
            className="flex-1 flex items-center justify-center gap-2 rounded-[19px] py-3 text-[15px] tracking-wide transition-colors"
            style={
              active
                ? {
                    backgroundColor: `color-mix(in srgb, ${t.chrome} 22%, transparent)`,
                    color: t.chrome,
                    border: `1px solid color-mix(in srgb, ${t.chrome} 45%, transparent)`,
                    fontWeight: 600,
                  }
                : { color: 'var(--color-ink-2)', border: '1px solid transparent', fontWeight: 500 }
            }
          >
            <Icon className="w-[17px] h-[17px]" aria-hidden="true" />
            {t.label}
          </button>
        );
      })}
    </nav>
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

      <PeriodBreakdown stats={stats} range={range} spendLabel="Purchases" />

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
  const kitchen = useMemo(() => buildKitchenView(items), [items]);
  const wasteView = useMemo(() => buildWasteView(waste, stats.window.startKey), [waste, stats.window.startKey]);
  // Four items standing side by side stays readable for a couple of weeks;
  // past that the same data reads far better as one column per day.
  const stackUnits = stats.buckets.length > 14;

  return (
    <div className="flex flex-col gap-4" style={{ opacity: dim ? 0.55 : 1, transition: 'opacity 200ms' }}>
      {/* The trolley runs a daily cycle — opening stock in the morning, closed
          at night — so today leads, whatever range is selected. */}
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
            : 'Today is not closed yet'
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
              label="Opening stock"
              icon={Package}
              value={formatUnits(kitchen.openingUnits)}
              hint={kitchen.addedUnits ? `Plus ${formatUnits(kitchen.addedUnits)} added today` : "Yesterday's closing"}
            />
            <StatTile
              label="Closing stock value"
              icon={Wallet}
              value={formatMoney(kitchen.closingValue)}
              hint="At current prices"
            />
            <StatTile
              label={kitchen.closed ? 'Closing stock' : 'On hand'}
              icon={Boxes}
              value={formatUnits(kitchen.closingUnits)}
              hint={kitchen.closed ? "Tomorrow's opening" : "Before today's close"}
            />
            <StatTile
              label="Sold through today"
              value={kitchen.sellThrough == null ? '—' : formatPercent(kitchen.sellThrough)}
              hint="Of opening stock and today's additions"
            />
          </div>

          <ChartCard title="Today's stock" subtitle="Items with a stock count; potatoes close on takings alone">
            <DataTable
              columns={[
                { key: 'name', label: 'Item' },
                { key: 'opening', label: 'Opening', align: 'right' },
                { key: 'added', label: 'Added', align: 'right' },
                { key: 'sold', label: 'Sold', align: 'right' },
                { key: 'spoilt', label: 'Spoilt', align: 'right' },
                { key: 'closing', label: 'Closing', align: 'right' },
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

      <PeriodBreakdown stats={stats} range={range} spendLabel="Expenses" />

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
        title="Spoilt stock"
        subtitle={
          wasteView
            ? `${formatUnits(wasteView.total)} units recorded as spoilt${
                range.days && range.days <= WASTE_DAYS ? ' in this range' : `, over the last ${WASTE_DAYS} days`
              }`
            : undefined
        }
        empty={
          !waste
            ? 'Spoilt report unavailable right now.'
            : wasteView.categories.length
              ? null
              : 'Nothing recorded as spoilt in this window.'
        }
        table={
          wasteView && wasteView.categories.length
            ? {
                columns: [
                  { key: 'date', label: 'Day' },
                  { key: 'items', label: 'Spoilt' },
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
            series={[{ name: 'Spoilt units', color: SPEND_COLOR, values: wasteView.values }]}
            valueFormatter={formatUnits}
            ariaLabel="Spoilt units per day"
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

// Only the items with a stock count: potatoes are booked as takings at Qty 1,
// and adding those in would make the unit figures mean nothing.
function buildKitchenView(allItems) {
  const items = (allItems ?? []).filter((item) => item.counted);
  if (!items.length) return null;

  const sum = (read) => items.reduce((total, item) => total + (Number(read(item)) || 0), 0);
  const openingUnits = sum((item) => item.openingStock);
  const addedUnits = sum((item) => item.addedToday);
  const soldUnits = sum((item) => item.soldToday);

  return {
    openingUnits,
    addedUnits,
    closingUnits: sum((item) => item.closingStock),
    closingValue: sum((item) => (Number(item.closingStock) || 0) * (Number(item.price) || 0)),
    closed: items.every((item) => item.closed),
    sellThrough: openingUnits + addedUnits > 0 ? soldUnits / (openingUnits + addedUnits) : null,
    rows: items.map((item) => ({
      key: item.id ?? item.name,
      name: item.name,
      opening: formatUnits(Number(item.openingStock) || 0),
      added: formatUnits(Number(item.addedToday) || 0),
      sold: formatUnits(Number(item.soldToday) || 0),
      spoilt: formatUnits(Number(item.spoiltToday) || 0),
      closing: formatUnits(Number(item.closingStock) || 0),
    })),
  };
}

// The spoilt report only ever covers the last WASTE_DAYS days, so a longer
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

/* ------------------------- weekly / monthly breakdown ------------------------ */

// Week by week or month by month, bucketed the way the sheet's Weekly and
// Monthly Report tabs bucket (ISO weeks Monday to Sunday numbered "Wk-36",
// calendar months), so on "All time" the two can be read side by side.
//
// Net is sales minus spend, like everywhere else on this page. The sheet's
// "Closing" column is the same figure with the sign flipped: it computes
// (Expenses + Spoilt) − Sales, so a good week shows there in brackets.
function PeriodBreakdown({ stats, range, spendLabel }) {
  const [unit, setUnit] = useState('week');
  const weekly = unit === 'week';
  const word = weekly ? 'week' : 'month';
  const keys = weekly ? stats.weekKeys : stats.monthKeys;
  const labels = weekly ? stats.weekLabels : stats.monthLabels;
  const sales = weekly ? stats.weeklySales : stats.monthlySales;
  const spend = weekly ? stats.weeklySpend : stats.monthlySpend;

  // The chart keeps quiet periods as gaps — an axis never silently collapses
  // time. The table lists only periods that traded, as the sheet's report
  // does, with the same grand total underneath.
  const traded = keys
    .map((key, i) => ({ key, i }))
    .filter(({ i }) => sales[i] || spend[i]);
  const totalSales = sales.reduce((sum, v) => sum + v, 0);
  const totalSpend = spend.reduce((sum, v) => sum + v, 0);

  return (
    <ChartCard
      title={weekly ? 'Week by week' : 'Month by month'}
      subtitle={
        range.days
          ? `The first and last ${word} only count days inside the range. On All time this matches the sheet's ${weekly ? 'Weekly' : 'Monthly'} Report.`
          : `Same ${word}s as the sheet's ${weekly ? 'Weekly' : 'Monthly'} Report tab`
      }
      actions={<UnitSwitch value={unit} onChange={setUnit} />}
      legend={[
        { name: 'Sales', color: SALES_COLOR },
        { name: spendLabel, color: SPEND_COLOR },
      ]}
      empty={stats.hasActivity ? null : 'Nothing recorded in this window.'}
      table={{
        columns: [
          { key: 'period', label: weekly ? 'Week' : 'Month' },
          ...(weekly ? [{ key: 'dates', label: 'Dates' }] : []),
          { key: 'sales', label: 'Sales', align: 'right' },
          { key: 'spend', label: spendLabel, align: 'right' },
          { key: 'net', label: 'Net', align: 'right' },
        ],
        rows: [
          ...traded.map(({ key, i }) => ({
            key,
            period: labels[i],
            dates: weekly ? formatWeekSpan(key) : undefined,
            sales: formatMoney(sales[i]),
            spend: formatMoney(spend[i]),
            net: formatMoney(sales[i] - spend[i]),
          })),
          {
            key: 'total',
            period: 'Total',
            dates: '',
            sales: formatMoney(totalSales),
            spend: formatMoney(totalSpend),
            net: formatMoney(totalSales - totalSpend),
          },
        ],
      }}
    >
      <BarChart
        categories={labels}
        series={[
          { name: 'Sales', color: SALES_COLOR, values: sales },
          { name: spendLabel, color: SPEND_COLOR, values: spend },
        ]}
        valueFormatter={formatMoney}
        ariaLabel={`Sales and ${spendLabel.toLowerCase()} per ${word}`}
      />
    </ChartCard>
  );
}

const UNITS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

function UnitSwitch({ value, onChange }) {
  return (
    <div role="group" aria-label="Group by" className="flex rounded-lg border border-white/10 p-0.5">
      {UNITS.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: active ? INK.primary : INK.muted,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
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
