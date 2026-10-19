import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBooking, getInventoryItems, completeBooking, getWorkers } from '../lib/api';
import DoorSidePicker from '../components/DoorSidePicker';
import { PageHeader, Loading, ErrorNote, CheckRow } from '../components/ui';
import { clockTime, money } from '../lib/dates';

const PAYMENT_TYPES = [
  { value: 'cash', label: 'Қолма-қол', icon: 'payments' },
  { value: 'kaspipay', label: 'Kaspi', icon: 'qr_code_2', accent: true },
  { value: 'mixed', label: 'Аралас', icon: 'account_balance' },
];

export default function PaymentEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [servicePaymentAmount, setServicePaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [materialExpense, setMaterialExpense] = useState('');
  const [partSales, setPartSales] = useState([]);
  const [warrantyServiceIds, setWarrantyServiceIds] = useState([]);
  const [addPartItemId, setAddPartItemId] = useState('');
  const [addPartQty, setAddPartQty] = useState(1);
  const [addPartUnitPrice, setAddPartUnitPrice] = useState('');
  const [addPartPriceError, setAddPartPriceError] = useState('');
  const [workers, setWorkers] = useState([]);
  const [selectedMasterIds, setSelectedMasterIds] = useState([]);
  const [doorSides, setDoorSides] = useState({});

  useEffect(() => {
    getWorkers().then(setWorkers).catch(() => setWorkers([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getBooking(id), getInventoryItems()])
      .then(([bookingData, itemsData]) => {
        if (!cancelled) {
          setBooking(bookingData);
          setItems(Array.isArray(itemsData) ? itemsData : []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Жүктеу сәтсіз');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const toggleWarranty = (serviceCatalogId) => {
    setWarrantyServiceIds((prev) =>
      prev.includes(serviceCatalogId)
        ? prev.filter((x) => x !== serviceCatalogId)
        : [...prev, serviceCatalogId]
    );
  };

  const getSelectedItem = () => (addPartItemId ? items.find((i) => i.id === addPartItemId) : null);
  const selectedItem = getSelectedItem();
  const minP = selectedItem ? Number(selectedItem.sale_price_min) : 0;
  const maxP = selectedItem ? Number(selectedItem.sale_price_max) : 0;
  const isFixedPrice = minP === maxP && selectedItem;

  const addPartSale = () => {
    setAddPartPriceError('');
    if (!addPartItemId || addPartQty < 1) return;
    const item = items.find((i) => i.id === addPartItemId);
    if (!item) return;
    const qtyToAdd = Math.max(1, parseInt(addPartQty, 10) || 1);
    const min = Number(item.sale_price_min);
    const max = Number(item.sale_price_max);
    let unitPrice;
    if (min === max) {
      unitPrice = min;
    } else {
      const raw = addPartUnitPrice === '' ? NaN : Number(addPartUnitPrice);
      if (!Number.isFinite(raw) || raw < min || raw > max) {
        setAddPartPriceError(`Баға ${min.toLocaleString()}–${max.toLocaleString()} аралығында болуы керек`);
        return;
      }
      unitPrice = raw;
    }
    setPartSales((prev) => {
      const existing = prev.find((p) => p.inventory_item_id === addPartItemId);
      if (!existing) {
        return [...prev, { inventory_item_id: addPartItemId, quantity: qtyToAdd, unit_price: unitPrice, name: item.name }];
      }
      return prev.map((p) =>
        p.inventory_item_id === addPartItemId
          ? { ...p, quantity: (Number(p.quantity) || 0) + qtyToAdd, unit_price: unitPrice, name: item.name }
          : p
      );
    });
    setAddPartItemId('');
    setAddPartQty(1);
    setAddPartUnitPrice('');
  };

  const removePartSale = (inventoryItemId) => {
    setPartSales((prev) => prev.filter((p) => p.inventory_item_id !== inventoryItemId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const amount = servicePaymentAmount ? Number(servicePaymentAmount) : 0;
      const material = materialExpense ? Number(materialExpense) : 0;
      const updated = await completeBooking(id, {
        service_payment_amount: amount,
        payment_type: paymentType,
        material_expense: material,
        part_sales: partSales.map((p) => ({ inventory_item_id: p.inventory_item_id, quantity: p.quantity, unit_price: p.unit_price })),
        warranty_service_ids: warrantyServiceIds,
        master_user_ids: selectedMasterIds.length > 0 ? selectedMasterIds : undefined,
        service_doors: Object.entries(doorSides)
          .filter(([, side]) => side)
          .map(([bookingServiceId, side]) => ({ booking_service_id: bookingServiceId, door_side: side })),
      });
      navigate(`/booking/${id}/done`, { replace: true, state: { booking: updated } });
    } catch (err) {
      setError(err.message || 'Сақтау сәтсіз');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !booking) {
    return (
      <>
        <PageHeader title="Төлем енгізу" />
        <Loading />
      </>
    );
  }
  if (booking.status !== 'in_progress') {
    navigate(`/booking/${id}`, { replace: true });
    return null;
  }

  const partsTotal = partSales.reduce((sum, p) => sum + Number(p.unit_price) * Number(p.quantity), 0);
  const total = (Number(servicePaymentAmount) || 0) + partsTotal;

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Төлем енгізу" subtitle={`${booking.vehicle_name} · басталды ${clockTime(booking.started_at)}`} />
      <form id="payment-form" onSubmit={handleSubmit} className="flex-1 px-4 pt-4 pb-48 space-y-4">
        <ErrorNote>{error}</ErrorNote>

        <section className="card p-4 space-y-4">
          <div>
            <label className="section-label block mb-2" htmlFor="pay-amount">Қызмет үшін төлем</label>
            <div className="relative">
              <input
                id="pay-amount"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={servicePaymentAmount}
                onChange={(e) => setServicePaymentAmount(e.target.value)}
                className="field !py-4 !text-2xl font-semibold tabular-nums pr-12"
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-xl">₸</span>
            </div>
          </div>
          <div>
            <span className="section-label block mb-2">Төлем түрі</span>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_TYPES.map((pt) => {
                const on = paymentType === pt.value;
                return (
                  <label
                    key={pt.value}
                    className={`cursor-pointer rounded-xl py-3 flex flex-col items-center gap-1.5 border transition-colors ${
                      on ? (pt.accent ? 'border-danger bg-danger/10 text-danger' : 'border-primary bg-primary/10 text-primary') : 'border-border-color bg-raised/40 text-text-muted'
                    }`}
                  >
                    <input type="radio" name="payment_type" value={pt.value} checked={on} onChange={() => setPaymentType(pt.value)} className="sr-only" />
                    <span className={`material-symbols-outlined ${on ? 'icon-fill' : ''}`}>{pt.icon}</span>
                    <span className={`text-sm font-semibold ${on ? '' : 'text-ink'}`}>{pt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label className="section-label block mb-2" htmlFor="pay-material">Материал шығыны <span className="font-normal text-faint">(қосымша)</span></label>
            <div className="relative">
              <input
                id="pay-material"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={materialExpense}
                onChange={(e) => setMaterialExpense(e.target.value)}
                className="field tabular-nums pr-10"
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">₸</span>
            </div>
            <p className="text-faint text-xs mt-1.5">Жұмыс барысында қолданылған шығын материалдарының құны.</p>
          </div>
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="section-label">Сатылған бөлшектер</h2>
          {partSales.length > 0 && (
            <ul className="divide-y divide-border-color/70 -mx-1">
              {partSales.map((p) => (
                <li key={p.inventory_item_id} className="flex items-center gap-3 px-1 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-ink text-sm font-medium truncate">{p.name}</div>
                    <div className="text-text-muted text-xs tabular-nums">{money(p.unit_price)} × {p.quantity}</div>
                  </div>
                  <span className="text-ink text-sm font-semibold tabular-nums">{money(p.unit_price * p.quantity)}</span>
                  <button type="button" onClick={() => removePartSale(p.inventory_item_id)} className="icon-btn w-8 h-8 hover:!text-danger" aria-label="Жою">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <select
            value={addPartItemId}
            onChange={(e) => {
              setAddPartItemId(e.target.value);
              setAddPartUnitPrice('');
              setAddPartPriceError('');
            }}
            className="field !py-2.5 text-sm"
          >
            <option value="">Бөлшек таңдаңыз</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.name}{i.quantity != null ? ` (қалд. ${i.quantity})` : ''}</option>
            ))}
          </select>
          {items.length === 0 && !loading && (
            <p className="text-text-muted text-xs">Қоймада бөлшектер жоқ. Алдымен Қойма бөлімінен бөлшек қосыңыз.</p>
          )}
          {selectedItem && (
            <div className="rounded-xl bg-raised/50 p-3 space-y-2.5">
              <p className="text-text-muted text-xs">
                Баға: <span className="text-ink tabular-nums">{minP === maxP ? money(minP) : `${minP.toLocaleString('ru-RU')}–${maxP.toLocaleString('ru-RU')} ₸`}</span>
              </p>
              {!isFixedPrice && (
                <>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={minP}
                    max={maxP}
                    step="1"
                    value={addPartUnitPrice}
                    onChange={(e) => {
                      setAddPartUnitPrice(e.target.value);
                      setAddPartPriceError('');
                    }}
                    placeholder={`${minP.toLocaleString('ru-RU')}–${maxP.toLocaleString('ru-RU')}`}
                    className="field !py-2.5 text-sm"
                  />
                  {addPartPriceError && <p className="text-danger text-xs">{addPartPriceError}</p>}
                </>
              )}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-border-color bg-card-bg">
                  <button type="button" onClick={() => setAddPartQty(Math.max(1, addPartQty - 1))} className="w-10 h-10 text-ink text-lg" aria-label="Азайту">−</button>
                  <span className="w-8 text-center text-ink font-semibold tabular-nums">{addPartQty}</span>
                  <button type="button" onClick={() => setAddPartQty(addPartQty + 1)} className="w-10 h-10 text-ink text-lg" aria-label="Көбейту">+</button>
                </div>
                <span className="text-text-muted text-sm">дана</span>
                <button type="button" onClick={addPartSale} className="ml-auto btn bg-primary/15 text-primary px-4 py-2.5 text-sm">
                  <span className="material-symbols-outlined text-lg">add</span>
                  Қосу
                </button>
              </div>
            </div>
          )}
        </section>

        {booking.services?.length > 0 && (
          <section className="card p-4">
            <h2 className="section-label mb-1">Кепілдік (3 ай)</h2>
            <p className="text-faint text-xs mb-3">Кепілдік берілетін қызметтерді белгілеңіз.</p>
            <div className="space-y-2">
              {booking.services.map((s) => (
                <CheckRow
                  key={s.service_catalog_id}
                  checked={warrantyServiceIds.includes(s.service_catalog_id)}
                  onChange={() => toggleWarranty(s.service_catalog_id)}
                  label={s.service_name}
                  icon="verified_user"
                />
              ))}
            </div>
          </section>
        )}

        {booking.services?.some((s) => s.id) && (
          <section className="card p-4">
            <h2 className="section-label mb-1">Есік <span className="font-normal text-faint">(қажет болса)</span></h2>
            <p className="text-faint text-xs mb-3">Бір жағын таңдасаңыз — 1 есік, екеуін де таңдасаңыз — екі есік.</p>
            <div className="space-y-3">
              {booking.services.filter((s) => s.id).map((s) => (
                <div key={s.id} className="space-y-2">
                  <div className="text-ink text-sm">{s.service_name}</div>
                  <DoorSidePicker
                    value={doorSides[s.id] ?? null}
                    onChange={(side) => setDoorSides((prev) => ({ ...prev, [s.id]: side }))}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card p-4">
          <h2 className="section-label mb-3">Қай шебер(лер) жұмыс жасады?</h2>
          <div className="flex flex-wrap gap-2">
            {workers.map((w) => {
              const on = selectedMasterIds.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedMasterIds((prev) => (prev.includes(w.id) ? prev.filter((x) => x !== w.id) : [...prev, w.id]))}
                  className={`chip ${on ? 'chip-on' : ''}`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${on ? 'text-primary icon-fill' : ''}`}>{on ? 'check_circle' : 'engineering'}</span>
                  {w.display_name || w.phone}
                </button>
              );
            })}
            {workers.length === 0 && <p className="text-text-muted text-xs">Шеберлер тізімі бос</p>}
          </div>
        </section>
      </form>

      <div className="fixed left-0 right-0 bottom-[76px] z-20 px-4 pt-3 pb-3 bg-gradient-to-t from-bg-main via-bg-main/95 to-bg-main/0">
        <div className="flex items-center justify-between text-sm mb-2 px-1">
          <span className="text-text-muted">Барлығы{partsTotal > 0 ? ' (бөлшектермен)' : ''}</span>
          <span className="text-ink font-bold text-lg tabular-nums">{money(total)}</span>
        </div>
        <button
          type="submit"
          form="payment-form"
          disabled={submitting || (servicePaymentAmount !== '' && Number(servicePaymentAmount) < 0)}
          className="btn-primary w-full text-base"
        >
          <span className="material-symbols-outlined">task_alt</span>
          {submitting ? 'Сақталуда...' : 'Аяқтау'}
        </button>
      </div>
    </div>
  );
}
