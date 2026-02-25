import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInventory, createInventoryItem, createInventoryMovement } from '../lib/api';

const canEdit = (role) => role === 'owner' || role === 'manager';

export default function Inventory() {
  const [searchParams] = useSearchParams();
  const itemIdFromUrl = searchParams.get('item');
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (itemIdFromUrl && items.length > 0) {
      const found = items.find((i) => i.id === itemIdFromUrl);
      if (found && !search) setSearch(found.name);
    }
  }, [itemIdFromUrl, items, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getInventory(search);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Жүктеу сәтсіз');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openMovement = (item, type) => {
    setSelectedItem({ ...item, movementType: type });
    setMovementModalOpen(true);
  };
  const closeMovement = () => {
    setSelectedItem(null);
    setMovementModalOpen(false);
  };

  const editable = canEdit(user?.role);

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 pt-4 pb-4 flex flex-col gap-4 bg-bg-main border-b border-border-color sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Қойма</h1>
        </div>
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
            <span className="material-symbols-outlined text-lg">search</span>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Іздеу (атауы бойынша)"
            className="block w-full pl-10 pr-3 py-2.5 border border-border-color rounded-lg bg-card-bg text-white placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}
        {loading ? (
          <p className="text-text-muted">Жүктелуде...</p>
        ) : items.length === 0 ? (
          <p className="text-text-muted">Тауарлар тізімі бос</p>
        ) : (
          items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              canEdit={editable}
              onAdd={() => openMovement(item, 'in')}
              onOut={() => openMovement(item, 'out')}
            />
          ))
        )}
      </main>
      {editable && (
        <button
          type="button"
          aria-label="Тауар қосу"
          onClick={() => setAddModalOpen(true)}
          className="fixed bottom-24 right-4 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center z-20 hover:scale-105 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-white text-3xl">add</span>
        </button>
      )}
      {addModalOpen && (
        <AddItemModal
          onClose={() => setAddModalOpen(false)}
          onSaved={() => {
            setAddModalOpen(false);
            load();
          }}
        />
      )}
      {movementModalOpen && selectedItem && (
        <MovementModal
          item={selectedItem}
          type={selectedItem.movementType}
          onClose={closeMovement}
          onSaved={() => {
            closeMovement();
            load();
          }}
        />
      )}
    </div>
  );
}

function ItemCard({ item, canEdit, onAdd, onOut }) {
  const lowStock = item.low_stock === true;
  const borderClass = lowStock
    ? 'border-status-danger/40'
    : 'border-border-color';
  const qtyColor = lowStock ? 'text-status-danger' : 'text-primary';

  return (
    <div className={`bg-card-bg border ${borderClass} rounded-xl p-4 shadow-sm relative overflow-hidden`}>
      {lowStock && (
        <div className="absolute top-0 right-0 bg-status-danger/10 text-status-danger text-[10px] font-bold px-2 py-1 rounded-bl-lg border-b border-l border-status-danger/20 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">warning</span>
          Аз қалды
        </div>
      )}
      <div className="flex justify-between items-start mb-2 pr-20">
        <div>
          <h3 className="text-base font-semibold text-white mb-0.5">{item.name}</h3>
          {item.sku && <p className="text-[11px] text-text-muted font-mono">Артикул: {item.sku}</p>}
        </div>
      </div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="block text-lg font-bold text-white">
            {Number(item.sale_price_min).toLocaleString()}
            {item.sale_price_min !== item.sale_price_max ? `–${Number(item.sale_price_max).toLocaleString()}` : ''} ₸
          </span>
          <span className="text-[10px] text-text-muted">дана бағасы</span>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${qtyColor}`}>Қалған саны: {item.quantity}</div>
          {item.min_quantity != null && (
            <div className="text-[10px] text-text-muted">Минималды қалдық: {item.min_quantity}</div>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-3 pt-3 border-t border-border-color">
          <button
            type="button"
            onClick={onOut}
            className="flex-1 py-3 px-3 bg-status-danger hover:bg-red-600 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">remove</span>
            Шығару
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="flex-1 py-3 px-3 bg-primary hover:bg-primary/90 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Қосу
          </button>
        </div>
      )}
    </div>
  );
}

function AddItemModal({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [salePriceMin, setSalePriceMin] = useState('');
  const [salePriceMax, setSalePriceMax] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [minQuantity, setMinQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!name.trim()) {
      setErr('Атауы болуы керек');
      return;
    }
    const minP = salePriceMin === '' ? 0 : Number(salePriceMin);
    const maxP = salePriceMax === '' ? 0 : Number(salePriceMax);
    if (!Number.isInteger(minP) || minP <= 0) {
      setErr('Сату бағасы (мин) 0-ден үлкен бүтін сан болуы керек');
      return;
    }
    if (!Number.isInteger(maxP) || maxP < minP) {
      setErr('Сату бағасы (макс) мин-ден кем болмауы керек');
      return;
    }
    setSubmitting(true);
    try {
      await createInventoryItem({
        name: name.trim(),
        sale_price_min: minP,
        sale_price_max: maxP,
        quantity: quantity === '' ? 0 : Number(quantity),
        min_quantity: minQuantity === '' ? null : Number(minQuantity),
        unit: unit.trim() || null,
      });
      onSaved();
    } catch (e) {
      setErr(e.message || 'Сақтау сәтсіз');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="bg-card-bg w-full sm:w-[400px] rounded-t-2xl sm:rounded-2xl border-t sm:border border-border-color shadow-2xl relative z-10 p-6 pb-safe">
        <div className="w-12 h-1 bg-border-color rounded-full mx-auto mb-6" />
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Тауар қосу</h2>
          <button type="button" onClick={onClose} className="p-2 text-text-muted hover:text-white bg-border-color rounded-full">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {err && <div className="mb-4 p-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{err}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Атауы *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary"
              placeholder="Мысалы: Май сүзгісі"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Сату бағасы мин (₸)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={salePriceMin}
                onChange={(e) => setSalePriceMin(e.target.value)}
                className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary"
                placeholder="Сома"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Сату бағасы макс (₸)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={salePriceMax}
                onChange={(e) => setSalePriceMax(e.target.value)}
                className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary"
                placeholder="Сома"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Бастапқы саны</label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Минималды қалдық</label>
            <input
              type="number"
              min="0"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary"
              placeholder="Бос қалдыруға болады"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Өлшем бірлігі</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary"
              placeholder="дана, л, кг..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-primary hover:bg-primary/90 rounded-xl text-base font-bold text-white disabled:opacity-50"
          >
            {submitting ? 'Сақталуда...' : 'Қосу'}
          </button>
        </form>
      </div>
    </div>
  );
}

function MovementModal({ item, type, onClose, onSaved }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const isIn = type === 'in';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    const q = Number(quantity);
    if (!Number.isInteger(q) || q <= 0) {
      setErr('Саны 0-ден үлкен бүтін сан болуы керек');
      return;
    }
    if (!isIn && q > item.quantity) {
      setErr('Қалдық жеткіліксіз. Қалдық: ' + item.quantity);
      return;
    }
    setSubmitting(true);
    try {
      await createInventoryMovement({
        inventory_item_id: item.id,
        type: isIn ? 'in' : 'out',
        quantity: q,
        note: note.trim() || undefined,
      });
      onSaved();
    } catch (e) {
      setErr(e.message || 'Сәтсіз');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className={`bg-card-bg w-full sm:w-[400px] rounded-t-2xl sm:rounded-2xl border-t sm:border border-border-color shadow-2xl relative z-10 p-6 pb-safe ${isIn ? '' : 'border-status-danger/30'}`}>
        <div className="w-12 h-1 bg-border-color rounded-full mx-auto mb-6" />
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-xl font-bold ${isIn ? 'text-white' : 'text-status-danger'}`}>
            {isIn ? 'Қоймаға қосу' : 'Шығару'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-text-muted hover:text-white bg-border-color rounded-full">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="text-text-muted text-sm mb-4">{item.name}</p>
        {err && <div className="mb-4 p-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{err}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-4 text-center">Саны</label>
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, (q || 1) - 1))}
                className="w-14 h-14 rounded-xl bg-border-color text-white hover:bg-[#333] flex items-center justify-center border border-[#333]"
              >
                <span className="material-symbols-outlined text-2xl">remove</span>
              </button>
              <input
                type="number"
                min="1"
                max={isIn ? undefined : item.quantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-24 text-center bg-transparent border-b-2 p-2 text-3xl font-bold text-white focus:outline-none ${isIn ? 'border-primary focus:border-primary' : 'border-status-danger focus:border-status-danger'}`}
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => (q || 0) + 1)}
                className="w-14 h-14 rounded-xl bg-border-color text-white hover:bg-[#333] flex items-center justify-center border border-[#333]"
              >
                <span className="material-symbols-outlined text-2xl">add</span>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Ескерту (міндетті емес)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary"
              placeholder="Мысалы: Закуп, шығару себебі"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-4 rounded-xl text-base font-bold text-white disabled:opacity-50 ${isIn ? 'bg-primary hover:bg-primary/90' : 'bg-status-danger hover:bg-red-600'}`}
          >
            {submitting ? 'Жіберілуде...' : isIn ? 'Қосу' : 'Шығару'}
          </button>
        </form>
      </div>
    </div>
  );
}
