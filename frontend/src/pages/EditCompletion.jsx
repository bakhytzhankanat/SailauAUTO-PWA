import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBooking, getInventoryItems, getServiceCategoriesWithServices, updateBookingCompletion } from '../lib/api';
import DoorSidePicker from '../components/DoorSidePicker';

import { tx, txData } from '../i18n/index.js';

const PAYMENT_TYPES = [
  { value: 'cash', label: tx("Қолма-қол"), icon: 'payments' },
  { value: 'kaspipay', label: 'Kaspi', icon: 'qr_code_2', accent: true },
  { value: 'mixed', label: tx("Аралас"), icon: 'account_balance' },
];

export default function EditCompletion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [servicePaymentAmount, setServicePaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [materialExpense, setMaterialExpense] = useState('');
  const [partSales, setPartSales] = useState([]);
  const [addPartItemId, setAddPartItemId] = useState('');
  const [addPartQty, setAddPartQty] = useState(1);
  const [addPartUnitPrice, setAddPartUnitPrice] = useState('');
  const [addPartPriceError, setAddPartPriceError] = useState('');
  const [categoriesWithServices, setCategoriesWithServices] = useState([]);
  const [services, setServices] = useState([]);

  const canEdit = user?.role === 'owner' || user?.role === 'manager' || (user?.role === 'worker' && user?.is_senior_worker);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getBooking(id), getInventoryItems()])
      .then(([bookingData, itemsData]) => {
        if (!cancelled && bookingData) {
          setBooking(bookingData);
          setItems(Array.isArray(itemsData) ? itemsData : []);
          setServicePaymentAmount(bookingData.service_payment_amount != null ? String(bookingData.service_payment_amount) : '');
          setPaymentType(bookingData.payment_type || 'cash');
          setMaterialExpense(bookingData.material_expense != null ? String(bookingData.material_expense) : '');
          setPartSales((bookingData.part_sales || []).map((p) => ({
            inventory_item_id: p.inventory_item_id,
            quantity: p.quantity,
            unit_price: p.unit_price,
            name: p.name,
          })));
          setServices((bookingData.services || []).map((s) => ({
            service_catalog_id: s.service_catalog_id,
            quantity: s.quantity ?? 1,
            service_name: s.service_name,
            warranty_mode: !!s.warranty_mode,
            door_side: s.door_side ?? null,
          })));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || tx("Жүктеу сәтсіз"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!booking?.vehicle_catalog_id) {
      getServiceCategoriesWithServices(null, null).then((d) => setCategoriesWithServices(Array.isArray(d) ? d : []));
      return;
    }
    getServiceCategoriesWithServices(booking.vehicle_catalog_id, booking.body_type || null)
      .then((d) => setCategoriesWithServices(Array.isArray(d) ? d : []))
      .catch(() => setCategoriesWithServices([]));
  }, [booking?.vehicle_catalog_id, booking?.body_type]);

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
        setAddPartPriceError(tx(
          "Баға {0}–{1} аралығында болуы керек",
          [min.toLocaleString(), max.toLocaleString()]
        ));
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

  const toggleService = (serviceId, quantity = 1) => {
    const cat = categoriesWithServices.find((c) => c.services?.some((s) => s.id === serviceId));
    const svc = cat?.services?.find((s) => s.id === serviceId);
    const next = [...services];
    const idx = next.findIndex((s) => s.service_catalog_id === serviceId);
    if (idx >= 0) {
      next.splice(idx, 1);
    } else {
      next.push({
        service_catalog_id: serviceId,
        quantity,
        service_name: svc?.name,
        warranty_mode: !!svc?.warranty_mode,
      });
    }
    setServices(next);
  };

  const setServiceQuantity = (serviceId, quantity) => {
    const q = Math.min(10, Math.max(1, quantity));
    setServices((prev) =>
      prev.map((s) => (s.service_catalog_id === serviceId ? { ...s, quantity: q } : s))
    );
  };

  const setServiceWarranty = (serviceId, warranty) => {
    setServices((prev) =>
      prev.map((s) => (s.service_catalog_id === serviceId ? { ...s, warranty_mode: !!warranty } : s))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!services.length) {
      setError(tx("Кем дегенде бір қызметті таңдаңыз"));
      return;
    }
    setSubmitting(true);
    try {
      await updateBookingCompletion(id, {
        service_payment_amount: servicePaymentAmount === '' ? null : Number(servicePaymentAmount),
        payment_type: paymentType,
        material_expense: materialExpense === '' ? null : Number(materialExpense),
        part_sales: partSales.map((p) => ({ inventory_item_id: p.inventory_item_id, quantity: p.quantity, unit_price: p.unit_price })),
        services: services.map((s) => ({ service_catalog_id: s.service_catalog_id, quantity: s.quantity ?? 1, warranty_mode: !!s.warranty_mode, door_side: s.door_side ?? null })),
      });
      navigate(`/booking/${id}`, { replace: true });
    } catch (err) {
      setError(err.message || tx("Сақтау сәтсіз"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canEdit) return null;
  if (loading || !booking) {
    return (
      (<div className="p-4">
        <p className="text-text-muted">{tx("Жүктелуде...")}</p>
      </div>)
    );
  }
  if (booking.status !== 'completed') {
    navigate(`/booking/${id}`, { replace: true });
    return null;
  }

  return (
    (<div className="flex flex-col min-h-full">
      <header className="page-header">
        <button type="button" onClick={() => navigate(`/booking/${id}`)} className="icon-btn -ml-1">
          <span className="material-symbols-outlined text-ink text-2xl">arrow_back</span>
        </button>
        <span className="page-title ml-1">{tx("Төлем мен бөлшектерді өңдеу")}</span>
      </header>
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-6 pb-32 space-y-6">
        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-danger text-sm">{error}</div>
        )}
        <p className="text-text-muted text-sm">{tx(
          "Аяқталған жазбаның төлем сомасын, төлем түрін, материал шығынын және сатылған бөлшектерді өзгертуге болады."
        )}</p>
        <div className="space-y-2">
          <label className="section-label">{tx("Қызмет үшін төлем")}</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={servicePaymentAmount}
              onChange={(e) => setServicePaymentAmount(e.target.value)}
              className="w-full bg-card-bg border border-border-color rounded-xl px-4 py-4 text-ink text-lg placeholder-faint focus:ring-1 focus:ring-primary focus:border-primary outline-none font-medium"
              placeholder={tx("Мысалы: 25000")}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">₸</span>
          </div>
        </div>
        <div className="space-y-3">
          <label className="section-label">{tx("Төлем түрі")}</label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_TYPES.map((pt) => (
              <label
                key={pt.value}
                className={`cursor-pointer rounded-xl py-3 flex flex-col items-center justify-center gap-1.5 border transition-colors ${
                  paymentType === pt.value
                    ? pt.accent ? 'border-danger bg-danger/10' : 'border-primary bg-primary/10'
                    : 'border-border-color bg-raised/40'
                }`}
              >
                <input type="radio" name="payment_type" value={pt.value} checked={paymentType === pt.value} onChange={() => setPaymentType(pt.value)} className="sr-only" />
                <span className={`material-symbols-outlined ${paymentType === pt.value ? (pt.accent ? 'text-danger' : 'text-primary') : 'text-text-muted'}`}>{pt.icon}</span>
                <span className={`text-sm font-medium ${paymentType === pt.value ? (pt.accent ? 'text-danger' : 'text-primary') : 'text-ink'}`}>{pt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <label className="section-label">{tx("Қызметтер (қосу / саны / кепілдік)")}</label>
          <p className="text-text-muted text-xs">{tx(
            "Қай қызметке кепілдік берілгенін «Кепілдік берілді» белгісімен таңдаңыз. Қызмет қосу мен кепілдік беру — бөлек."
          )}</p>
          <div className="space-y-2">
            {services.map((s) => (
              <div key={s.service_catalog_id} className="card p-3 space-y-2">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="font-medium text-ink text-sm">{txData(s.service_name)}</div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => (s.quantity <= 1 ? toggleService(s.service_catalog_id) : setServiceQuantity(s.service_catalog_id, s.quantity - 1))} className="w-8 h-8 rounded-lg bg-raised flex items-center justify-center text-ink">−</button>
                    <span className="w-8 text-center font-bold text-ink">{s.quantity}</span>
                    <button type="button" onClick={() => setServiceQuantity(s.service_catalog_id, (s.quantity || 1) + 1)} className="w-8 h-8 rounded-lg bg-raised flex items-center justify-center text-ink">+</button>
                    <button type="button" onClick={() => toggleService(s.service_catalog_id)} className="text-danger text-xs font-medium ml-1">{tx("Жою")}</button>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!s.warranty_mode}
                    onChange={(e) => setServiceWarranty(s.service_catalog_id, e.target.checked)}
                    className="w-5 h-5 rounded accent-[rgb(var(--primary))]"
                  />
                  <span className="text-text-muted text-xs">{tx("Кепілдік берілді (осы қызметке)")}</span>
                </label>
                <div>
                  <div className="text-text-muted text-xs mb-1">{tx("Есік (қажет болса)")}</div>
                  <DoorSidePicker
                    value={s.door_side ?? null}
                    onChange={(side) => setServices((prev) => prev.map((x) => (x.service_catalog_id === s.service_catalog_id ? { ...x, door_side: side } : x)))}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="text-text-muted text-xs mt-1">{tx("Қызмет қосу:")}</div>
          <div className="flex flex-wrap gap-2">
            {categoriesWithServices.map((cat) =>
              (cat.services || []).map((svc) => {
                const selected = services.some((s) => s.service_catalog_id === svc.id);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => toggleService(svc.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${selected ? 'bg-primary/20 border-primary text-primary' : 'bg-card-bg border-border-color text-ink'}`}
                  >
                    {svc.name}{selected ? ` (${services.find((s) => s.service_catalog_id === svc.id)?.quantity ?? 1})` : ' +'}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label className="section-label">{tx("Материал шығыны")}</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={materialExpense}
              onChange={(e) => setMaterialExpense(e.target.value)}
              className="w-full bg-card-bg border border-border-color rounded-xl px-4 py-4 text-ink text-lg placeholder-faint focus:ring-1 focus:ring-primary focus:border-primary outline-none font-medium"
              placeholder={tx("Сома")}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">₸</span>
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <label className="section-label">{tx("Сатылған бөлшектер")}</label>
          <div className="space-y-2">
            <select
              value={addPartItemId}
              onChange={(e) => { setAddPartItemId(e.target.value); setAddPartUnitPrice(''); setAddPartPriceError(''); }}
              className="field !py-2.5 text-sm"
            >
              <option value="">{tx("Таңдаңыз")}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}{i.quantity != null ? tx(" (қалд. {0})", [i.quantity]) : ''}</option>
              ))}
            </select>
            {selectedItem && (
              <div className="bg-bg-main rounded-lg p-3 space-y-2">
                <p className="text-text-muted text-xs">{tx("Баға:")} {minP === maxP ? `${minP.toLocaleString()} ₸` : `${minP.toLocaleString()}–${maxP.toLocaleString()} ₸`}</p>
                {!isFixedPrice && (
                  <>
                    <input
                      type="number"
                      min={minP}
                      max={maxP}
                      step="1"
                      value={addPartUnitPrice}
                      onChange={(e) => { setAddPartUnitPrice(e.target.value); setAddPartPriceError(''); }}
                      placeholder={`${minP.toLocaleString()}–${maxP.toLocaleString()}`}
                      className="field !py-2.5 text-sm placeholder-text-muted"
                    />
                    {addPartPriceError && <p className="text-danger text-xs">{addPartPriceError}</p>}
                  </>
                )}
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input type="number" min="1" value={addPartQty} onChange={(e) => setAddPartQty(Number(e.target.value) || 1)} className="w-20 bg-card-bg border border-border-color rounded-lg px-2 py-2 text-ink text-center text-sm" />
              <span className="text-text-muted text-sm">{tx("дана")}</span>
              <button type="button" onClick={addPartSale} className="text-primary text-sm font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-lg">add</span> {tx("Қосу")}</button>
            </div>
          </div>
          <div className="space-y-3">
            {partSales.map((p) => (
              <div key={p.inventory_item_id} className="card p-4 flex justify-between items-center">
                <div>
                  <div className="text-ink font-medium text-sm">{p.name}</div>
                  <div className="text-text-muted text-xs mt-0.5">{Number(p.unit_price).toLocaleString()} ₸ × {p.quantity}</div>
                </div>
                <button type="button" onClick={() => removePartSale(p.inventory_item_id)} className="text-danger text-xs font-medium flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-sm">delete</span> {tx("Жою")}</button>
              </div>
            ))}
          </div>
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? tx("Сақталуда...") : tx("Өзгерістерді сақтау")}
        </button>
      </form>
    </div>)
  );
}
