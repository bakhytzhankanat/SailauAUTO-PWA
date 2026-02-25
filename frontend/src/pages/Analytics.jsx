import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAnalyticsSummary, getDayCloseWorkers } from '../lib/api';

function fmt(n) {
  return Number(n).toLocaleString('kk-KZ') + ' ₸';
}

function formatDayCloseDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val).slice(0, 10);
  return d.toLocaleDateString('kk-KZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PERIODS = [
  { value: 'day', label: 'Күн' },
  { value: 'week', label: 'Апта' },
  { value: 'month', label: 'Ай' },
];

const PERIOD_LABELS = { day: 'Күн', week: 'Апта', month: 'Ай' };

function getPrintReportHtml(payload) {
  const {
    period,
    date,
    start_date,
    end_date,
    m,
    opex,
    totalExpenses,
    netBeforeCharity,
    distributable,
    managerAmount,
    ownerAmount,
    mastersList,
    mastersTotal,
  } = payload;
  const periodLabel = PERIOD_LABELS[period] || period;
  const dateRange = period === 'day' ? date : `${start_date || date} — ${end_date || date}`;
  return `
  <style>
    .print-report h1 { font-size: 18px; margin-bottom: 4px; }
    .print-report .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
    .print-report section { margin-bottom: 16px; }
    .print-report .section-title { font-size: 11px; font-weight: bold; color: #30867b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .print-report table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .print-report th, .print-report td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eee; }
    .print-report .num { text-align: right; }
    .print-report .total { font-weight: bold; }
    .print-report .row-sub { font-size: 11px; color: #555; }
  </style>
  <div class="print-report">
    <h1>Есеп</h1>
    <p class="meta">${periodLabel} · ${dateRange}</p>
    <section>
      <div class="section-title">1. Кірістер</div>
      <table>
        <tr><td>Қызмет кассасы</td><td class="num">${Number(m.service_income_total || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        <tr><td>Бөлшек сатылымы (есепке кірмейді)</td><td class="num">${Number(m.part_sales_total || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        <tr class="total"><td>Негізгі есептелетін сома</td><td class="num">${Number(m.service_income_total || 0).toLocaleString('kk-KZ')} ₸</td></tr>
      </table>
    </section>
    <section>
      <div class="section-title">2. Шығындар</div>
      <table>
        <tr><td>Материал</td><td class="num">− ${Number(m.material_expense_total || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        <tr><td>Түскі ас</td><td class="num">− ${Number(opex.lunch || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        <tr><td>Транспорт</td><td class="num">− ${Number(opex.transport || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        <tr><td>Аренда</td><td class="num">− ${Number(opex.rent || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        <tr><td>Салық (KaspiPay 4%)</td><td class="num">− ${Number(m.kaspi_tax_total || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        <tr class="total"><td>Жалпы шығыс</td><td class="num">− ${Number(totalExpenses || 0).toLocaleString('kk-KZ')} ₸</td></tr>
      </table>
    </section>
    <section>
      <div class="section-title">3. Таза есеп · 4. Қайырымдылық</div>
      <table>
        <tr><td>Кіріс − Шығыс (таза есеп)</td><td class="num">${Number(netBeforeCharity || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        <tr><td>Қайырымдылық (10%)</td><td class="num">${Number(m.charity_total_rounded || 0).toLocaleString('kk-KZ')} ₸</td></tr>
      </table>
    </section>
    <section>
      <div class="section-title">5. Жалақы бөлу логикасы</div>
      <table>
        <tr><td>Бөлінетін табыс</td><td class="num">${Number(distributable || 0).toLocaleString('kk-KZ')} ₸</td></tr>
      </table>
    </section>
    <section>
      <div class="section-title">6–7. Төлем кестесі</div>
      <table>
        <tr><td>Менеджер (8%)</td><td class="num">${Number(managerAmount || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        <tr><td>Шеберлер қоры (60%)</td><td class="num">${Number(mastersTotal || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        ${(mastersList || []).map((master) => `
        <tr class="row-sub"><td>${String(master.master_name || '').replace(/</g, '&lt;')}</td><td class="num">${Number(master.amount || 0).toLocaleString('kk-KZ')} ₸</td></tr>
        `).join('')}
        <tr class="total"><td>Иегер (40%)</td><td class="num">${Number(ownerAmount || 0).toLocaleString('kk-KZ')} ₸</td></tr>
      </table>
    </section>
    <p class="meta" style="margin-top: 24px;">SailauAUTO · ${new Date().toLocaleDateString('kk-KZ')}</p>
  </div>`;
}

export default function Analytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const printRef = useRef(null);
  const [tab, setTab] = useState('analytics');
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (!isOwner) {
      navigate('/', { replace: true, state: { message: 'Есепке тек иесі кіре алады' } });
      return;
    }
  }, [isOwner, navigate]);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true);
    setError('');
    try {
      const [res, workersRes] = await Promise.all([
        getAnalyticsSummary(period, date),
        getDayCloseWorkers().catch(() => []),
      ]);
      setData(res);
      setWorkers(Array.isArray(workersRes) ? workersRes : []);
    } catch (e) {
      setError(e.message || 'Жүктеу сәтсіз');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isOwner, period, date]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isOwner) return null;

  const m = data?.metrics || {};
  const dailyRows = data?.daily_rows || [];
  const dayCloseList = data?.day_close_list || [];
  const wages = m.wages_breakdown || {};
  const opex = m.opex_totals || { lunch: 0, transport: 0, rent: 0 };

  // Таза есеп (кіріс - шығыс): қызмет - материал - оpex - салық
  const totalExpenses =
    Number(m.material_expense_total || 0) +
    Number(opex.lunch || 0) +
    Number(opex.transport || 0) +
    Number(opex.rent || 0) +
    Number(m.kaspi_tax_total || 0);
  const netBeforeCharity = Number(m.service_income_total || 0) - totalExpenses;
  const distributable = netBeforeCharity - Number(m.charity_total_rounded || 0);
  const managerAmount = Number(wages.manager || 0);
  const ownerAmount = Number(wages.owner || 0);
  const mastersList = wages.masters || [];
  const mastersTotal = mastersList.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const managerPct = distributable > 0 ? (managerAmount / distributable) * 100 : 0;
  const mastersPct = distributable > 0 ? (mastersTotal / distributable) * 100 : 0;
  const ownerPct = distributable > 0 ? (ownerAmount / distributable) * 100 : 0;
  const masterIdsWithShare = new Set((mastersList || []).map((x) => String(x.master_user_id)));

  const runPrintReport = useCallback(() => {
    if (!printRef.current) return;
    printRef.current.innerHTML = getPrintReportHtml({
      period,
      date,
      start_date: data?.start_date,
      end_date: data?.end_date,
      m,
      opex,
      totalExpenses,
      netBeforeCharity,
      distributable,
      managerAmount,
      ownerAmount,
      mastersList,
      mastersTotal,
    });
    window.print();
  }, [period, date, data?.start_date, data?.end_date, m, opex, totalExpenses, netBeforeCharity, distributable, managerAmount, ownerAmount, mastersList, mastersTotal]);

  return (
    <>
      <div
        ref={printRef}
        className="hidden print:block fixed inset-0 z-[9999] bg-white text-gray-900 overflow-auto p-6"
        style={{ fontFamily: 'Arial, sans-serif' }}
        aria-hidden
      />
      <div className="print:hidden flex flex-col min-h-[100dvh] bg-bg-main text-white overflow-hidden max-w-2xl mx-auto">
      <header className="px-4 py-2 flex items-center gap-3 bg-bg-main z-10 border-b border-border-color shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-card-bg transition-colors"
          aria-label="Артқа"
        >
          <span className="material-symbols-outlined text-white text-xl">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-white flex-1 text-center pr-8">Есеп</h1>
      </header>

      <div className="px-3 pt-2 shrink-0 flex flex-wrap items-center gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-card-bg border border-border-color rounded-lg px-3 py-1.5 text-white text-xs font-medium"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-card-bg border border-border-color rounded-lg px-3 py-1.5 text-white text-xs flex-1 min-w-[120px]"
        />
      </div>

      <div className="px-3 pt-2 shrink-0">
        <div className="flex p-1 bg-card-bg rounded-lg border border-border-color">
          <button
            type="button"
            onClick={() => setTab('analytics')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'analytics' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-white'}`}
          >
            Жалпы шолу
          </button>
          <button
            type="button"
            onClick={() => setTab('accounting')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'accounting' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-white'}`}
          >
            Бухгалтерия
          </button>
        </div>
      </div>

      {error && (
        <p className="px-3 pt-2 text-red-400 text-sm">{error}</p>
      )}

      {loading && (
        <p className="px-3 py-6 text-text-muted text-sm">Жүктелуде...</p>
      )}

      {!loading && data && tab === 'analytics' && (
        <main className="flex-1 px-3 py-4 overflow-y-auto space-y-4 pb-8">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card-bg border border-border-color rounded-xl p-3">
              <p className="text-text-muted text-xs">Қызмет кірісі</p>
              <p className="text-white font-semibold">{fmt(m.service_income_total)}</p>
            </div>
            <div className="bg-card-bg border border-border-color rounded-xl p-3">
              <p className="text-text-muted text-xs">Бөлшек сату</p>
              <p className="text-white font-semibold">{fmt(m.part_sales_total)}</p>
            </div>
            <div className="bg-card-bg border border-border-color rounded-xl p-3">
              <p className="text-text-muted text-xs">Материал шығыны</p>
              <p className="text-white font-semibold">{fmt(m.material_expense_total)}</p>
            </div>
            <div className="bg-card-bg border border-border-color rounded-xl p-3">
              <p className="text-text-muted text-xs">Таза кіріс</p>
              <p className="text-white font-semibold">{fmt(m.net_total)}</p>
            </div>
            <div className="bg-card-bg border border-border-color rounded-xl p-3">
              <p className="text-text-muted text-xs">Көліктер саны</p>
              <p className="text-white font-semibold">{m.cars_count}</p>
            </div>
            <div className="bg-card-bg border border-border-color rounded-xl p-3">
              <p className="text-text-muted text-xs">Клиенттер (бірегей)</p>
              <p className="text-white font-semibold">{m.unique_clients_count}</p>
            </div>
            <div className="bg-card-bg border border-border-color rounded-xl p-3">
              <p className="text-text-muted text-xs">Орташа чек</p>
              <p className="text-white font-semibold">{fmt(m.avg_check)}</p>
            </div>
            <div className="bg-card-bg border border-border-color rounded-xl p-3">
              <p className="text-text-muted text-xs">Орташа күндық кіріс</p>
              <p className="text-white font-semibold">{fmt(m.avg_daily_income)}</p>
            </div>
          </div>

          <h2 className="text-xs font-bold text-primary uppercase tracking-wider ml-1">Күндер бойынша</h2>
          <div className="bg-card-bg border border-border-color rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border-color text-text-muted uppercase font-medium">
                  <th className="px-3 py-2">Күн</th>
                  <th className="px-3 py-2 text-right">Қызмет</th>
                  <th className="px-3 py-2 text-right">Бөлшек</th>
                  <th className="px-3 py-2 text-right">Таза</th>
                  <th className="px-3 py-2">Жабылды</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row) => (
                  <tr key={row.date} className="border-b border-border-color last:border-0 hover:bg-[#2A2A2A]/50">
                    <td className="px-3 py-2.5 text-white">{row.date}</td>
                    <td className="px-3 py-2.5 text-right text-white">{fmt(row.service_income)}</td>
                    <td className="px-3 py-2.5 text-right text-white">{fmt(row.part_sales)}</td>
                    <td className="px-3 py-2.5 text-right text-white">{fmt(row.net)}</td>
                    <td className="px-3 py-2.5">{row.day_closed ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {!loading && data && tab === 'accounting' && (
        <main className="flex-1 flex flex-col px-3 py-2 overflow-y-auto space-y-3 pb-32">
          {/* 1. Кірістер */}
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider ml-1">1. Кірістер</h2>
            <div className="bg-card-bg rounded-xl border border-border-color p-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">payments</span>
                  Қызмет кассасы
                </span>
                <span className="font-bold text-white text-sm">{fmt(m.service_income_total)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] border-t border-border-color pt-2 opacity-90">
                <span className="text-text-muted flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
                  Бөлшек сатылымы (Есепке кірмейді)
                </span>
                <span className="font-medium text-white">{fmt(m.part_sales_total)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold border-t border-border-color pt-2 mt-1">
                <span className="text-white">Негізгі есептелетін сома</span>
                <span className="text-status-success">{fmt(m.service_income_total)}</span>
              </div>
            </div>
          </section>

          {/* 2. Шығындар */}
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider ml-1">2. Шығындар</h2>
            <div className="bg-card-bg rounded-xl border border-border-color p-3 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Материал</span>
                  <span className="font-medium text-red-400">- {fmt(m.material_expense_total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Түскі ас</span>
                  <span className="font-medium text-red-400">- {fmt(opex.lunch)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Транспорт</span>
                  <span className="font-medium text-red-400">- {fmt(opex.transport)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Аренда</span>
                  <span className="font-medium text-red-400">- {fmt(opex.rent)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-border-color pt-2">
                <span className="text-text-muted">Салық (KaspiPay 4%)</span>
                <span className="font-medium text-red-400">- {fmt(m.kaspi_tax_total)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold border-t border-border-color pt-2 mt-1">
                <span className="text-white">Жалпы шығыс</span>
                <span className="text-red-500">- {fmt(totalExpenses)}</span>
              </div>
            </div>
          </section>

          {/* 3. Таза есеп & 4. Қайырымдылық */}
          <section className="grid grid-cols-2 gap-2">
            <div className="bg-gradient-to-br from-card-bg to-[#252525] rounded-xl border border-primary/50 p-3 relative overflow-hidden flex flex-col justify-between min-h-[96px]">
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary" aria-hidden />
              <p className="text-[10px] text-primary font-bold uppercase mb-1">3. Таза есеп</p>
              <div>
                <p className="text-[10px] text-text-muted mb-0.5">Кіріс - Шығыс</p>
                <p className="text-lg font-bold text-white leading-tight">{fmt(netBeforeCharity)}</p>
              </div>
            </div>
            <div className="bg-card-bg rounded-xl border border-border-color p-3 flex flex-col justify-between min-h-[96px] relative overflow-hidden">
              <span className="material-symbols-outlined absolute -right-2 -bottom-2 text-primary/10 text-6xl pointer-events-none" aria-hidden>volunteer_activism</span>
              <p className="text-[10px] text-primary font-bold uppercase mb-1">4. Қайырымдылық</p>
              <div>
                <p className="text-[10px] text-text-muted mb-0.5">10% (дөңгелектеу)</p>
                <p className="text-lg font-bold text-white leading-tight">{fmt(m.charity_total_rounded)}</p>
              </div>
            </div>
          </section>

          {/* 5. Жалақы бөлу логикасы */}
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider ml-1">5. Жалақы бөлу логикасы</h2>
            <div className="bg-card-bg rounded-xl border border-border-color p-3 space-y-2">
              <div className="flex justify-between items-center text-xs pb-1">
                <span className="text-white font-medium">Бөлінетін табыс (Таза есеп - Қайырымдылық)</span>
                <span className="font-bold text-primary">{fmt(distributable)}</span>
              </div>
              <div className="w-full bg-[#2A2A2A] h-2 rounded-full overflow-hidden flex mb-1">
                <div className="bg-blue-500 h-full" style={{ width: `${managerPct}%` }} />
                <div className="bg-purple-500 h-full" style={{ width: `${mastersPct}%` }} />
                <div className="bg-yellow-500 h-full" style={{ width: `${ownerPct}%` }} />
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-[10px] text-text-muted">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Менеджер: Табыстың 8%-ы</span>
                  </div>
                  <span className="text-white">{fmt(managerAmount)}</span>
                </div>
                <div className="h-px bg-border-color w-full" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>Шеберлер: Қалдықтан 60%</span>
                  </div>
                  <span className="text-white">{fmt(mastersTotal)}</span>
                </div>
                <div className="h-px bg-border-color w-full" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span>Иегер: Қалдықтан 40%</span>
                  </div>
                  <span className="text-white">{fmt(ownerAmount)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 6. Шеберлер (үлесті бөлу) */}
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider ml-1">6. Шеберлер (Үлесті бөлу)</h2>
            <div className="bg-card-bg rounded-xl border border-border-color p-2">
              <div className="flex flex-wrap gap-2">
                {workers.length === 0 && mastersList.length > 0 ? (
                  mastersList.map((master) => (
                    <div key={master.master_user_id} className="flex items-center gap-2 p-2 bg-[#2A2A2A]/50 rounded-lg border border-border-color flex-1 min-w-[140px]">
                      <span className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-sm">check</span>
                      </span>
                      <span className="text-xs text-white">{master.master_name}</span>
                    </div>
                  ))
                ) : workers.length > 0 ? (
                  workers.map((w) => {
                    const checked = masterIdsWithShare.has(String(w.id));
                    return (
                      <div
                        key={w.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border flex-1 min-w-[140px] ${checked ? 'bg-[#2A2A2A]/50 border-border-color' : 'bg-[#2A2A2A]/30 border-border-color'}`}
                      >
                        <span className={`w-4 h-4 rounded flex items-center justify-center ${checked ? 'bg-primary/20' : 'bg-transparent border border-text-muted'}`}>
                          {checked && <span className="material-symbols-outlined text-primary text-sm">check</span>}
                        </span>
                        <span className={`text-xs ${checked ? 'text-white' : 'text-white/50'}`}>
                          {w.display_name || '—'}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-text-muted text-xs py-2">Шеберлер тізімі бос</p>
                )}
              </div>
            </div>
          </section>

          {/* 7. Төлем кестесі */}
          <section className="flex flex-col gap-2 pb-4">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider ml-1">7. Төлем кестесі</h2>
            <div className="bg-card-bg rounded-xl border border-border-color overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#252525] text-text-muted uppercase font-medium">
                  <tr>
                    <th className="px-3 py-2">Роль</th>
                    <th className="px-3 py-2 text-right">Сомасы</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  <tr className="hover:bg-[#2A2A2A]/50">
                    <td className="px-3 py-2.5 text-blue-400 font-medium">Менеджер (8%)</td>
                    <td className="px-3 py-2.5 text-right text-white">{fmt(managerAmount)}</td>
                  </tr>
                  <tr className="hover:bg-[#2A2A2A]/50">
                    <td className="px-3 py-2.5 text-purple-400 font-medium">Шеберлер қоры (60%)</td>
                    <td className="px-3 py-2.5 text-right text-white">{fmt(mastersTotal)}</td>
                  </tr>
                  {mastersList.length > 0 && mastersList.map((master) => (
                    <tr key={master.master_user_id} className="hover:bg-[#2A2A2A]/50">
                      <td className="px-3 py-2 pl-6 text-text-muted text-[11px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">person</span>
                        {master.master_name}
                      </td>
                      <td className="px-3 py-2 text-right text-white font-medium">{fmt(master.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-primary/10">
                    <td className="px-3 py-2.5 text-yellow-400 font-bold">Иегер (40%)</td>
                    <td className="px-3 py-2.5 text-right text-white font-bold">{fmt(ownerAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={runPrintReport}
              className="w-full bg-[#2A2A2A] hover:bg-[#333] border border-primary/30 text-primary font-semibold py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm mt-2"
            >
              <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
              PDF есепті шығару
            </button>
          </section>

          {/* Ауысымды жабу тізімі */}
          {dayCloseList.length > 0 && (
            <section className="flex flex-col gap-2 pb-4">
              <h2 className="text-xs font-bold text-primary uppercase tracking-wider ml-1">Ауысымды жабу тізімі</h2>
              <ul className="space-y-2">
                {dayCloseList.map((dc) => (
                  <li key={dc.id}>
                    <Link
                      to={`/day-close?date=${typeof dc.date === 'string' ? dc.date.slice(0, 10) : dc.date}`}
                      className="flex items-center justify-between gap-3 bg-card-bg border border-border-color rounded-xl px-4 py-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <span className="font-semibold text-white text-sm">{formatDayCloseDate(dc.date)}</span>
                      <div className="flex items-center gap-3 text-xs text-text-muted shrink-0">
                        <span>{fmt(dc.service_income_total)}</span>
                        <span>{fmt(dc.part_sales_total)}</span>
                        <span className="text-primary font-medium text-white">{fmt(dc.net_before_charity)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      )}
      </div>
    </>
  );
}
