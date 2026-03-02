import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBooking, getInventoryItems, updateBookingCompletion } from '../lib/api';

const PAYMENT_TYPES = [
  { value: 'cash', label: 'Қолма-қол', icon: 'payments' },
  { value: 'kaspipay', label: 'Kaspi', icon: 'qr_code_2', accent: true },
  { value: 'mixed', label: 'Аралас', icon: 'account_balance' },
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
    setPartSales((prev) => [
      ...prev.filter((p) => p.inventory_item_id !== addPartItemId),
      { inventory_item_id: addPartItemId, quantity: addPartQty, unit_price: unitPrice, name: item.name },
    ]);
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
      await updateBookingCompletion(id, {
        service_payment_amount: servicePaymentAmount === '' ? null : Number(servicePaymentAmount),
        payment_type: paymentType,
        material_expense: materialExpense === '' ? null : Number(materialExpense),
        part_sales: partSales.map((p) => ({ inventory_item_id: p.inventory_item_id, quantity: p.quantity, unit_price: p.unit_price })),
      });
      navigate(`/booking/${id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Сақтау сәтсіз');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canEdit) return null;
  if (loading || !booking) {
    return (
      <div className="p-4">
        <p className="text-text-muted">Жүктелуде...</p>
      </div>
    );
  }
  if (booking.status !== 'completed') {
    navigate(`/booking/${id}`, { replace: true });
    return null;
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 flex items-center bg-bg-main border-b border-border-color sticky top-0 z-10">
        <button type="button" onClick={() => navigate(`/booking/${id}`)} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-card-bg">
          <span className="material-symbols-outlined text-white text-2xl">arrow_back</span>
        </button>
        <span className="text-lg font-bold text-white ml-2">Төлем мен бөлшектерді өңдеу</span>
      </header>
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-6 pb-32 space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}
        <p className="text-text-muted text-sm">Аяқталған жазбаның төлем сомасын, төлем түрін, материал шығынын және сатылған бөлшектерді өзгертуге болады.</p>
        <div className="space-y-2">
          <label className="text-text-muted text-xs uppercase font-semibold tracking-wider ml-1">Қызмет үшін төлем</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={servicePaymentAmount}
              onChange={(e) => setServicePaymentAmount(e.target.value)}
              className="w-full bg-card-bg border border-border-color rounded-xl px-4 py-4 text-white text-lg placeholder-[#555] focus:ring-1 focus:ring-primary focus:border-primary outline-none font-medium"
              placeholder="Мысалы: 25000"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">₸</span>
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-text-muted text-xs uppercase font-semibold tracking-wider ml-1">Төлем түрі</label>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_TYPES.map((pt) => (
              <label
                key={pt.value}
                className={`cursor-pointer rounded-xl p-4 flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                  paymentType === pt.value
                    ? pt.accent ? 'border-red-500 bg-red-500/10' : 'border-primary bg-primary/10'
                    : 'border-border-color bg-card-bg hover:border-[#333]'
                }`}
              >
                <input type="radio" name="payment_type" value={pt.value} checked={paymentType === pt.value} onChange={() => setPaymentType(pt.value)} className="sr-only" />
                <span className={`material-symbols-outlined ${paymentType === pt.value ? (pt.accent ? 'text-red-500' : 'text-primary') : 'text-text-muted'}`}>{pt.icon}</span>
                <span className={`text-sm font-medium ${paymentType === pt.value ? (pt.accent ? 'text-red-500' : 'text-primary') : 'text-white'}`}>{pt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-text-muted text-xs uppercase font-semibold tracking-wider ml-1">Материал шығыны</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={materialExpense}
              onChange={(e) => setMaterialExpense(e.target.value)}
              className="w-full bg-card-bg border border-border-color rounded-xl px-4 py-4 text-white text-lg placeholder-[#555] focus:ring-1 focus:ring-primary focus:border-primary outline-none font-medium"
              placeholder="Сома"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">₸</span>
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <label className="text-text-muted text-xs uppercase font-semibold tracking-wider ml-1">Сатылған бөлшектер</label>
          <div className="space-y-2">
            <select
              value={addPartItemId}
              onChange={(e) => { setAddPartItemId(e.target.value); setAddPartUnitPrice(''); setAddPartPriceError(''); }}
              className="w-full bg-card-bg border border-border-color rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="">Таңдаңыз</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}{i.quantity != null ? ` (қалд. ${i.quantity})` : ''}</option>
              ))}
            </select>
            {selectedItem && (
              <div className="bg-bg-main rounded-lg p-3 space-y-2">
                <p className="text-text-muted text-xs">Баға: {minP === maxP ? `${minP.toLocaleString()} ₸` : `${minP.toLocaleString()}–${maxP.toLocaleString()} ₸`}</p>
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
                      className="w-full bg-card-bg border border-border-color rounded-lg px-3 py-2 text-white text-sm placeholder-text-muted"
                    />
                    {addPartPriceError && <p className="text-red-400 text-xs">{addPartPriceError}</p>}
                  </>
                )}
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input type="number" min="1" value={addPartQty} onChange={(e) => setAddPartQty(Number(e.target.value) || 1)} className="w-20 bg-card-bg border border-border-color rounded-lg px-2 py-2 text-white text-center text-sm" />
              <span className="text-text-muted text-sm">дана</span>
              <button type="button" onClick={addPartSale} className="text-primary text-sm font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-lg">add</span> Қосу
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {partSales.map((p) => (
              <div key={p.inventory_item_id} className="bg-card-bg border border-border-color rounded-xl p-4 flex justify-between items-center">
                <div>
                  <div className="text-white font-medium text-sm">{p.name}</div>
                  <div className="text-text-muted text-xs mt-0.5">{Number(p.unit_price).toLocaleString()} ₸ × {p.quantity}</div>
                </div>
                <button type="button" onClick={() => removePartSale(p.inventory_item_id)} className="text-red-400 text-xs font-medium flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-sm">delete</span> Жою
                </button>
              </div>
            ))}
          </div>
        </div>
        <button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
          {submitting ? 'Сақталуда...' : 'Өзгерістерді сақтау'}
        </button>
      </form>
    </div>
  );
}
