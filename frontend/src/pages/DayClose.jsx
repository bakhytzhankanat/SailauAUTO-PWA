import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSettings, getDayClose, getDayCloseWorkers, createDayClose, updateDayClose } from '../lib/api';

function fmt(n) {
  return Number(n).toLocaleString('kk-KZ') + ' ₸';
}

function formatDateForPrint(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val).slice(0, 10);
  return d.toLocaleDateString('kk-KZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getDayClosePrintHtml(payload) {
  const { date, dc, serviceTotal, partSalesTotal, materialTotal, masters } = payload;
  if (!dc) return '';
  const totalExpenses = materialTotal + Number(dc.opex_lunch || 0) + Number(dc.opex_transport || 0) + Number(dc.opex_rent || 0) + Number(dc.kaspi_tax_amount || 0);
  return `
  <style>
    .dc-print h1 { font-size: 18px; margin-bottom: 4px; }
    .dc-print .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
    .dc-print section { margin-bottom: 14px; }
    .dc-print .section-title { font-size: 11px; font-weight: bold; color: #30867b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .dc-print table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .dc-print th, .dc-print td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eee; }
    .dc-print .num { text-align: right; }
    .dc-print .total { font-weight: bold; }
  </style>
  <div class="dc-print">
    <h1>Ауысымды жабу</h1>
    <p class="meta">${formatDateForPrint(date)}</p>
    <section>
      <div class="section-title">Қайырымдылық (${dc.charity_percent}%)</div>
      <table>
        <tr><td>Есептелді</td><td class="num">${fmt(dc.charity_raw)}</td></tr>
        <tr class="total"><td>Дөңгелектелді</td><td class="num">${fmt(dc.charity_rounded)}</td></tr>
      </table>
    </section>
    <section>
      <div class="section-title">Бөлінетін табыс</div>
      <p class="total" style="font-size: 16px;">${fmt(dc.distributable_after_charity)}</p>
    </section>
    <section>
      <div class="section-title">Жалақы бөлу</div>
      <table>
        <tr><th>Рөл</th><th class="num">Үлес</th><th class="num">Сома</th></tr>
        <tr><td>Менеджер</td><td class="num">${dc.manager_percent}%</td><td class="num">${fmt(dc.manager_amount)}</td></tr>
        ${(masters || []).map((m) => `<tr><td>${String(m.master_name || '').replace(/</g, '&lt;')}</td><td class="num">—</td><td class="num">${fmt(m.amount)}</td></tr>`).join('')}
        <tr><td>Иесі (қызмет)</td><td class="num">${dc.owner_percent}%</td><td class="num">${fmt(dc.owner_service_dividend)}</td></tr>
        <tr><td>Иесі (бөлшектер)</td><td class="num">—</td><td class="num">${fmt(dc.owner_parts_dividend)}</td></tr>
      </table>
    </section>
    <section>
      <div class="section-title">Қорытынды</div>
      <table>
        <tr><td>Барлық кіріс</td><td class="num">${fmt(serviceTotal + partSalesTotal)}</td></tr>
        <tr><td style="padding-left: 16px;">Материал</td><td class="num">− ${fmt(materialTotal)}</td></tr>
        <tr><td style="padding-left: 16px;">Түскі ас</td><td class="num">− ${fmt(dc.opex_lunch)}</td></tr>
        <tr><td style="padding-left: 16px;">Транспорт</td><td class="num">− ${fmt(dc.opex_transport)}</td></tr>
        <tr><td style="padding-left: 16px;">Аренда</td><td class="num">− ${fmt(dc.opex_rent)}</td></tr>
        <tr><td style="padding-left: 16px;">Салық (KaspiPay)</td><td class="num">− ${fmt(dc.kaspi_tax_amount)}</td></tr>
        <tr><td>Барлық шығын</td><td class="num">− ${fmt(totalExpenses)}</td></tr>
        <tr><td>Қайырымдылық</td><td class="num">${fmt(dc.charity_rounded)}</td></tr>
        <tr class="total"><td>Таза табыс</td><td class="num">${fmt(dc.distributable_after_charity)}</td></tr>
      </table>
    </section>
    <p class="meta" style="margin-top: 20px;">SailauAUTO · ${new Date().toLocaleDateString('kk-KZ')}</p>
  </div>`;
}

export default function DayClose() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const printRef = useRef(null);

  const [snapshot, setSnapshot] = useState(null);
  const [masters, setMasters] = useState([]);
  const [derived, setDerived] = useState(null);
  const [dayClosesForDate, setDayClosesForDate] = useState([]);
  const [selectedShiftIndex, setSelectedShiftIndex] = useState(0);
  const [showNewShiftForm, setShowNewShiftForm] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [kaspiAmount, setKaspiAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [opexLunch, setOpexLunch] = useState('');
  const [opexTransport, setOpexTransport] = useState('');
  const [opexRent, setOpexRent] = useState('');
  const [presentMasterIds, setPresentMasterIds] = useState([]);
  const [manualMasterDistribution, setManualMasterDistribution] = useState(false);
  const [masterPercents, setMasterPercents] = useState({});

  const [editMode, setEditMode] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [manualServiceIncome, setManualServiceIncome] = useState('');
  const [manualPartSales, setManualPartSales] = useState('');
  const [manualMaterialExpense, setManualMaterialExpense] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const shiftToFetch = showNewShiftForm ? -1 : selectedShiftIndex;
      const [dcRes, workersRes, settingsRes] = await Promise.all([
        getDayClose(date, shiftToFetch),
        getDayCloseWorkers(),
        getSettings(),
      ]);
      setDayClosesForDate(dcRes.day_closes_for_date || []);
      setSnapshot(dcRes.day_close);
      setMasters(dcRes.masters || []);
      setDerived(dcRes.derived || { service_income_total: 0, material_expense_total: 0, part_sales_total: 0 });
      setWorkers(Array.isArray(workersRes) ? workersRes : []);
      setSettings(settingsRes || {});
      if (dcRes.day_close) {
        setKaspiAmount(String(dcRes.day_close.kaspi_amount));
        setCashAmount(String(dcRes.day_close.cash_amount));
        setOpexLunch(String(dcRes.day_close.opex_lunch));
        setOpexTransport(String(dcRes.day_close.opex_transport));
        setOpexRent(String(dcRes.day_close.opex_rent));
        setPresentMasterIds((dcRes.masters || []).map((m) => m.master_user_id));
        const percents = {};
        (dcRes.masters || []).forEach((m) => { if (m.percent != null) percents[m.master_user_id] = m.percent; });
        setMasterPercents(percents);
        setManualMasterDistribution((dcRes.masters || []).some((m) => m.percent != null));
      } else {
        setKaspiAmount('');
        setCashAmount('');
        setOpexLunch('');
        setOpexTransport('');
        setOpexRent('');
        setPresentMasterIds([]);
        setMasterPercents({});
      }
    } catch (e) {
      setError(e.message || 'Жүктеу сәтсіз');
    } finally {
      setLoading(false);
    }
  }, [date, selectedShiftIndex, showNewShiftForm]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleMaster = (id) => {
    setPresentMasterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (!presentMasterIds.includes(id)) setMasterPercents((p) => ({ ...p, [id]: 0 }));
  };

  const setMasterPercent = (id, value) => {
    const v = value === '' ? '' : Math.max(0, Math.min(100, Number(value)));
    setMasterPercents((prev) => ({ ...prev, [id]: v }));
  };

  const masterPercentsSum = presentMasterIds.reduce((acc, id) => acc + (Number(masterPercents[id]) || 0), 0);

  const canCreate = user?.role === 'owner' || user?.is_senior_worker === true;
  const isOwner = user?.role === 'owner';
  const canEdit = isOwner && snapshot;
  const showForm = showNewShiftForm || !snapshot || editMode;
  const isExtraShift = showNewShiftForm && dayClosesForDate.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const kaspi = kaspiAmount === '' ? 0 : Number(kaspiAmount);
    const effServiceIncome = isExtraShift ? (Number(manualServiceIncome) || 0) : (derived?.service_income_total ?? 0);
    const effPartSales = isExtraShift ? (Number(manualPartSales) || 0) : (derived?.part_sales_total ?? 0);
    const incomeTotal = effServiceIncome + effPartSales;
    if (kaspi > incomeTotal && !isExtraShift) {
      setError('KaspiPay сомасы қызмет пен бөлшек кірісінен аспауы керек');
      setSubmitting(false);
      return;
    }
    try {
      const body = {
        date: date,
        kaspi_amount: kaspi,
        cash_amount: cashAmount === '' ? undefined : Number(cashAmount),
        opex_lunch: Number(opexLunch),
        opex_transport: Number(opexTransport),
        opex_rent: Number(opexRent),
        present_master_user_ids: presentMasterIds,
        manual_master_distribution: manualMasterDistribution,
      };
      if (isExtraShift) {
        body.manual_service_income = effServiceIncome;
        body.manual_part_sales = effPartSales;
        body.manual_material_expense = Number(manualMaterialExpense) || 0;
      }
      if (manualMasterDistribution && presentMasterIds.length > 0) {
        if (Math.abs(masterPercentsSum - 100) > 0.01) {
          setError('Мастерлер үлесінің қосындысы 100% болуы керек');
          setSubmitting(false);
          return;
        }
        body.master_percents = presentMasterIds.map((id) => ({
          master_user_id: id,
          percent: Number(masterPercents[id]) || 0,
        }));
      }
      if (editMode && snapshot) {
        await updateDayClose(snapshot.id, { ...body, edit_reason: editReason });
      } else {
        await createDayClose(body);
      }
      setSuccess(true);
      setEditMode(false);
      setShowNewShiftForm(false);
      setSelectedShiftIndex(dayClosesForDate.length);
      load();
    } catch (e) {
      setError(e.message || 'Сақтау сәтсіз');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-text-muted">Жүктелуде...</p>
      </div>
    );
  }

  const dc = snapshot;
  const isViewingExtraShift = dc && dc.shift_index > 0;
  const isCreatingExtraShift = isExtraShift && showNewShiftForm;

  let serviceTotal, materialTotal, partSalesTotal;
  if (isCreatingExtraShift) {
    serviceTotal = Number(manualServiceIncome) || 0;
    partSalesTotal = Number(manualPartSales) || 0;
    materialTotal = Number(manualMaterialExpense) || 0;
  } else if (isViewingExtraShift) {
    serviceTotal = dc.service_income_total ?? 0;
    partSalesTotal = dc.part_sales_total ?? 0;
    materialTotal = dc.material_expense_total ?? 0;
  } else {
    serviceTotal = derived?.service_income_total ?? 0;
    partSalesTotal = derived?.part_sales_total ?? 0;
    materialTotal = derived?.material_expense_total ?? 0;
  }

  const netService = serviceTotal - materialTotal;
  const kaspiTaxPercent = settings?.kaspi_tax_percent ?? 4;
  const charityPercent = settings?.charity_percent ?? 10;

  const runPrintReport = () => {
    if (!printRef.current || !snapshot) return;
    printRef.current.innerHTML = getDayClosePrintHtml({
      date,
      dc: snapshot,
      serviceTotal,
      partSalesTotal,
      materialTotal,
      masters,
    });
    window.print();
  };

  return (
    <>
      <div
        ref={printRef}
        className="hidden print:block fixed inset-0 z-[9999] bg-white text-gray-900 overflow-auto p-6"
        style={{ fontFamily: 'Arial, sans-serif' }}
        aria-hidden
      />
      <div className="print:hidden flex flex-col min-h-full">
      <header className="px-4 pt-4 pb-4 bg-bg-main border-b border-border-color sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-card-bg border border-border-color flex items-center justify-center">
            <span className="material-symbols-outlined text-text-muted">arrow_back</span>
          </button>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ауысымды жабу</h1>
        </div>
        <button type="button" className="w-10 h-10 rounded-full bg-card-bg border border-border-color flex items-center justify-center">
          <span className="material-symbols-outlined text-text-muted">history</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}

        {dayClosesForDate.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Сменалар</h2>
            <div className="flex flex-wrap gap-2">
              {dayClosesForDate.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setShowNewShiftForm(false); setSelectedShiftIndex(s.shift_index); load(); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    !showNewShiftForm && snapshot?.shift_index === s.shift_index
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card-bg border-border-color text-white hover:border-primary'
                  }`}
                >
                  {(() => { const d = new Date(date + 'T00:00:00'); const day = d.getDate(); const months = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК']; return `${day}${months[d.getMonth()]}(${s.shift_index + 1})`; })()}
                </button>
              ))}
              {canCreate && (
                <button
                  type="button"
                  onClick={() => { setShowNewShiftForm(true); setSnapshot(null); setSelectedShiftIndex(dayClosesForDate.length); setManualServiceIncome(''); setManualPartSales(''); setManualMaterialExpense(''); load(); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-border-color text-text-muted hover:border-primary hover:text-primary ${
                    showNewShiftForm ? 'border-primary text-primary' : ''
                  }`}
                >
                  + Жаңа смена
                </button>
              )}
            </div>
          </section>
        )}

        {isExtraShift && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-yellow-400 text-xl">info</span>
              <div>
                <div className="font-semibold text-yellow-400 text-sm">Қосымша смена</div>
                <div className="text-yellow-400/80 text-xs mt-1">
                  Бұл смена бірінші сменаға тәуелсіз. Кірістер мен шығындарды қолмен енгізіңіз.
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
            Кірістер {isExtraShift ? '(қолмен)' : ''}
          </h2>
          {isExtraShift ? (
            <div className="bg-card-bg rounded-xl border border-border-color p-4 space-y-4">
              <div>
                <label className="text-xs text-text-muted block mb-1">Қызмет кірісі</label>
                <div className="flex items-center bg-bg-main rounded-lg border border-border-color px-3 py-2.5">
                  <input type="number" min="0" value={manualServiceIncome} onChange={(e) => setManualServiceIncome(e.target.value)} className="w-full bg-transparent p-0 border-none focus:ring-0 text-white font-medium text-right" placeholder="0" />
                  <span className="text-text-muted ml-2">₸</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Бөлшек сатылымы</label>
                <div className="flex items-center bg-bg-main rounded-lg border border-border-color px-3 py-2.5">
                  <input type="number" min="0" value={manualPartSales} onChange={(e) => setManualPartSales(e.target.value)} className="w-full bg-transparent p-0 border-none focus:ring-0 text-white font-medium text-right" placeholder="0" />
                  <span className="text-text-muted ml-2">₸</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Материал шығыны</label>
                <div className="flex items-center bg-bg-main rounded-lg border border-border-color px-3 py-2.5">
                  <input type="number" min="0" value={manualMaterialExpense} onChange={(e) => setManualMaterialExpense(e.target.value)} className="w-full bg-transparent p-0 border-none focus:ring-0 text-white font-medium text-right" placeholder="0" />
                  <span className="text-text-muted ml-2">₸</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card-bg rounded-xl border border-border-color p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-border-color">
                <span className="text-text-muted text-sm">Қызмет кассасы</span>
                <span className="font-bold text-lg">{fmt(serviceTotal)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border-color">
                <span className="text-text-muted text-sm">Бөлшек сатылымы</span>
                <span className="font-bold text-lg">{fmt(partSalesTotal)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-text-muted text-sm">Материал шығыны</span>
                <span className="font-bold text-lg text-red-400">- {fmt(materialTotal)}</span>
              </div>
            </div>
          )}
        </section>

        {!canCreate && !snapshot && (
          <p className="text-text-muted text-sm">Ауысымды жабуға тек иесі немесе аға шебер рұқсат етеді.</p>
        )}

        {showForm && canCreate && (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">payments</span>
                Төлем түрі
              </h2>
              <div className="bg-card-bg rounded-xl border border-border-color p-4 space-y-4">
                <div>
                  <label className="text-xs text-text-muted block mb-2">KaspiPay *</label>
                  <div className="flex items-center bg-bg-main rounded-lg border border-border-color px-3 py-2.5">
                    <input
                      type="number"
                      min="0"
                      value={kaspiAmount}
                      onChange={(e) => setKaspiAmount(e.target.value)}
                      className="w-full bg-transparent p-0 border-none focus:ring-0 text-white font-medium text-right"
                      placeholder="Сома"
                    />
                    <span className="text-text-muted ml-2">₸</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-2">Қолма-қол (бос қалдырсаңыз — автоматты)</label>
                  <div className="flex items-center bg-bg-main rounded-lg border border-border-color px-3 py-2.5">
                    <input
                      type="number"
                      min="0"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full bg-transparent p-0 border-none focus:ring-0 text-white font-medium text-right"
                      placeholder="Автоматты есептеледі"
                    />
                    <span className="text-text-muted ml-2">₸</span>
                  </div>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-xs text-text-muted">Салық ({kaspiTaxPercent}% кіріс бойынша)</span>
                  <span className="text-sm font-bold text-red-400">
                    - {fmt((serviceTotal + partSalesTotal) * (kaspiTaxPercent / 100))}
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">receipt_long</span>
                Операциялық шығын
              </h2>
              <div className="bg-card-bg rounded-xl border border-border-color p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-white w-1/3">Түскі ас</span>
                  <div className="flex-1 flex items-center bg-bg-main rounded-lg border border-border-color px-3 py-2">
                    <input type="number" min="0" value={opexLunch} onChange={(e) => setOpexLunch(e.target.value)} placeholder="Сома" className="w-full bg-transparent p-0 border-none focus:ring-0 text-white text-right font-medium" />
                    <span className="text-text-muted ml-2">₸</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-white w-1/3">Транспорт</span>
                  <div className="flex-1 flex items-center bg-bg-main rounded-lg border border-border-color px-3 py-2">
                    <input type="number" min="0" value={opexTransport} onChange={(e) => setOpexTransport(e.target.value)} placeholder="Сома" className="w-full bg-transparent p-0 border-none focus:ring-0 text-white text-right font-medium" />
                    <span className="text-text-muted ml-2">₸</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-white w-1/3">Аренда</span>
                  <div className="flex-1 flex items-center bg-bg-main rounded-lg border border-border-color px-3 py-2">
                    <input type="number" min="0" value={opexRent} onChange={(e) => setOpexRent(e.target.value)} placeholder="Сома" className="w-full bg-transparent p-0 border-none focus:ring-0 text-white text-right font-medium" />
                    <span className="text-text-muted ml-2">₸</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">groups</span>
                  Ауысымда кім болды
                </h2>
                {isOwner && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualMasterDistribution}
                      onChange={(e) => setManualMasterDistribution(e.target.checked)}
                      className="rounded border-border-color text-primary"
                    />
                    <span className="text-xs text-text-muted">Қолмен %</span>
                  </label>
                )}
              </div>
              <div className="bg-card-bg rounded-xl border border-border-color p-4 space-y-3">
                {workers.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-border-color flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
                        {(w.display_name || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm text-white truncate">{w.display_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {manualMasterDistribution && presentMasterIds.includes(w.id) && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={masterPercents[w.id] ?? ''}
                            onChange={(e) => setMasterPercent(w.id, e.target.value)}
                            className="w-16 bg-bg-main border border-border-color rounded-lg px-2 py-1.5 text-white text-sm text-right"
                          />
                          <span className="text-text-muted text-xs">%</span>
                        </div>
                      )}
                      <label className="relative inline-block w-12 h-7 rounded-full cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={presentMasterIds.includes(w.id)}
                          onChange={() => toggleMaster(w.id)}
                          className="sr-only peer"
                        />
                        <span className={`block w-12 h-7 rounded-full transition-colors peer-checked:bg-primary bg-border-color`} />
                        <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform pointer-events-none block peer-checked:translate-x-5" />
                      </label>
                    </div>
                  </div>
                ))}
                {manualMasterDistribution && presentMasterIds.length > 0 && (
                  <div className="pt-2 border-t border-border-color flex justify-between text-sm">
                    <span className="text-text-muted">Қосынды</span>
                    <span className={Math.abs(masterPercentsSum - 100) < 0.01 ? 'text-status-completed font-medium' : 'text-red-400 font-medium'}>
                      {masterPercentsSum.toFixed(1)}% {Math.abs(masterPercentsSum - 100) < 0.01 ? '' : '(100% болуы керек)'}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {editMode && (
              <section className="space-y-2">
                <label className="text-sm font-medium text-text-muted">Түзету себебі *</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full bg-card-bg border border-border-color rounded-lg px-3 py-2 text-white"
                  placeholder="Мысалы: Касса түзету"
                />
              </section>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                (editMode && !editReason.trim()) ||
                (manualMasterDistribution && presentMasterIds.length > 0 && Math.abs(masterPercentsSum - 100) > 0.01)
              }
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl disabled:opacity-50"
            >
              {submitting ? 'Сақталуда...' : editMode ? 'Өзгерістерді сақтау' : 'Ауысымды жабу'}
            </button>
          </>
        )}

        {snapshot && !editMode && (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">volunteer_activism</span>
                Қайырымдылық ({dc.charity_percent}%)
              </h2>
              <div className="bg-card-bg rounded-xl border border-border-color p-4 flex justify-between items-center">
                <div>
                  <span className="text-xs text-text-muted block">Есептелді</span>
                  <span className="text-sm text-white font-medium line-through decoration-red-400">{fmt(dc.charity_raw)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-text-muted block">Дөңгелектелді</span>
                  <span className="text-xl font-bold text-primary">{fmt(dc.charity_rounded)}</span>
                </div>
              </div>
            </section>

            <section className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl border border-primary/30 p-4 flex justify-between items-center">
              <span className="text-sm font-bold text-primary uppercase tracking-wide">Бөлінетін табыс</span>
              <span className="text-2xl font-bold text-white">{fmt(dc.distributable_after_charity)}</span>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">pie_chart</span>
                Жалақы бөлу
              </h2>
              <div className="bg-card-bg rounded-xl border border-border-color overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-border-color text-text-muted font-medium">
                    <tr>
                      <th className="px-4 py-2">Рөл</th>
                      <th className="px-4 py-2 text-right">Үлес</th>
                      <th className="px-4 py-2 text-right">Сома</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    <tr>
                      <td className="px-4 py-3 font-medium">Менеджер</td>
                      <td className="px-4 py-3 text-right text-text-muted">{dc.manager_percent}%</td>
                      <td className="px-4 py-3 text-right font-bold">{fmt(dc.manager_amount)}</td>
                    </tr>
                    {masters.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-3 font-medium">{m.master_name}</td>
                        <td className="px-4 py-3 text-right text-text-muted">—</td>
                        <td className="px-4 py-3 text-right font-bold">{fmt(m.amount)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-4 py-3 font-medium text-primary">Иесі (қызмет)</td>
                      <td className="px-4 py-3 text-right text-text-muted">{dc.owner_percent}%</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{fmt(dc.owner_service_dividend)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-primary">Иесі (бөлшектер)</td>
                      <td className="px-4 py-3 text-right text-text-muted">—</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{fmt(dc.owner_parts_dividend)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">summarize</span>
                Қорытынды
              </h2>
              <div className="bg-card-bg rounded-xl border border-border-color p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Барлық кіріс</span>
                  <span className="font-medium text-white">{fmt(serviceTotal + partSalesTotal)}</span>
                </div>
                <div className="pt-1 space-y-1">
                  <div className="flex justify-between text-text-muted">
                    <span className="pl-2">Материал</span>
                    <span className="text-red-400">− {fmt(materialTotal)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span className="pl-2">Түскі ас</span>
                    <span className="text-red-400">− {fmt(dc.opex_lunch)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span className="pl-2">Транспорт</span>
                    <span className="text-red-400">− {fmt(dc.opex_transport)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span className="pl-2">Аренда</span>
                    <span className="text-red-400">− {fmt(dc.opex_rent)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span className="pl-2">Салық (KaspiPay)</span>
                    <span className="text-red-400">− {fmt(dc.kaspi_tax_amount)}</span>
                  </div>
                </div>
                <div className="flex justify-between border-t border-border-color pt-2">
                  <span className="text-text-muted">Барлық шығын</span>
                  <span className="font-medium text-red-400">− {fmt(materialTotal + Number(dc.opex_lunch) + Number(dc.opex_transport) + Number(dc.opex_rent) + Number(dc.kaspi_tax_amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Қайырымдылық</span>
                  <span className="font-medium text-white">{fmt(dc.charity_rounded)}</span>
                </div>
                <div className="border-t border-border-color my-2 pt-2 flex justify-between text-base">
                  <span className="font-bold text-white">Таза табыс</span>
                  <span className="font-bold text-primary">{fmt(dc.distributable_after_charity)}</span>
                </div>
              </div>
            </section>

            {canEdit && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="flex-1 py-3 border border-primary text-primary font-bold rounded-xl"
                >
                  Түзету
                </button>
                <button
                  type="button"
                  onClick={runPrintReport}
                  className="flex-1 py-3 bg-card-bg border border-border-color text-white font-bold rounded-xl hover:bg-border-color hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                  PDF
                </button>
              </div>
            )}
          </>
        )}

        {success && !showForm && (
          <div className="p-3 rounded-xl bg-status-completed/10 border border-status-completed/30 text-status-completed text-sm">
            Ауысым сәтті жабылды.
          </div>
        )}
      </main>
      </div>
    </>
  );
}
