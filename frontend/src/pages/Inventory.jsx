import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInventory, createInventoryItem, createInventoryMovement, deleteInventoryItem } from '../lib/api';
import { Sheet, Loading, EmptyState, ErrorNote } from '../components/ui';

const canEdit = (user) => user?.role === 'owner' || user?.role === 'manager' || user?.is_senior_worker === true;

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
  const [onlyLow, setOnlyLow] = useState(false);

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

  const editable = canEdit(user);

  const handleDeleteItem = async (item) => {
    if (!editable) return;
    if (!window.confirm(`«${item.name}» тауарын жоюды қалайсыз ба? Сатулар болса жою мүмкін емес.`)) return;
    setError('');
    try {
      await deleteInventoryItem(item.id);
      load();
    } catch (e) {
      setError(e.message || 'Жою сәтсіз');
    }
  };

  const lowCount = items.filter((i) => i.low_stock === true).length;
  const shown = onlyLow ? items.filter((i) => i.low_stock === true) : items;

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-20 bg-bg-main/95 backdrop-blur border-b border-border-color/70 px-4 pt-4 pb-3 space-y-3">
        <div>
          <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">Қойма</h1>
          {!loading && <p className="text-sm text-text-muted">{items.length} тауар{lowCount > 0 ? ` · ${lowCount} аз қалды` : ''}</p>}
        </div>
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Іздеу (атауы бойынша)"
            className="field !py-2.5 pl-10"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOnlyLow(false)} className={`chip !py-1.5 ${!onlyLow ? 'chip-on' : ''}`}>Барлығы</button>
          <button type="button" onClick={() => setOnlyLow(true)} className={`chip !py-1.5 ${onlyLow ? 'chip-on !border-danger !bg-danger/10' : ''}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            Аз қалды {lowCount > 0 && <span className="tabular-nums">{lowCount}</span>}
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 pb-28 space-y-2.5">
        <ErrorNote>{error}</ErrorNote>
        {loading ? (
          <Loading />
        ) : shown.length === 0 ? (
          <EmptyState icon="inventory_2" title={onlyLow ? 'Аз қалған тауар жоқ' : 'Тауарлар тізімі бос'} hint={editable && !onlyLow ? 'Жаңа тауарды + батырмасымен қосыңыз.' : null} />
        ) : (
          shown.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              canEdit={editable}
              onAdd={() => openMovement(item, 'in')}
              onOut={() => openMovement(item, 'out')}
              onDelete={() => handleDeleteItem(item)}
            />
          ))
        )}
      </main>
      {editable && (
        <button
          type="button"
          aria-label="Тауар қосу"
          onClick={() => setAddModalOpen(true)}
          className="fixed bottom-[92px] right-4 w-14 h-14 bg-primary text-on-primary rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center z-20 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
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

function ItemCard({ item, canEdit, onAdd, onOut, onDelete }) {
  const lowStock = item.low_stock === true;
  const qty = Number(item.quantity) || 0;
  const min = item.min_quantity != null ? Number(item.min_quantity) : null;
  const fill = min ? Math.min(100, (qty / (min * 3)) * 100) : 100;
  const price = `${Number(item.sale_price_min).toLocaleString('ru-RU')}${item.sale_price_min !== item.sale_price_max ? `–${Number(item.sale_price_max).toLocaleString('ru-RU')}` : ''} ₸`;

  return (
    <div className={`card p-4 ${lowStock ? '!border-danger/40' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-ink leading-snug">{item.name}</h3>
          {item.sku && <p className="text-[11px] text-text-muted">Артикул: {item.sku}</p>}
          <p className="text-sm text-text-muted mt-0.5 tabular-nums">{price} <span className="text-faint">/ {item.unit || 'дана'}</span></p>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-2xl leading-none font-bold tabular-nums ${lowStock ? 'text-danger' : 'text-ink'}`}>{qty}</div>
          <div className="text-[11px] text-text-muted mt-1">қалды</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-raised overflow-hidden">
          <div className={`h-full rounded-full ${lowStock ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${Math.max(4, fill)}%` }} />
        </div>
        {min != null && <span className={`text-[11px] tabular-nums ${lowStock ? 'text-danger font-semibold' : 'text-faint'}`}>{lowStock ? 'Аз қалды · ' : ''}мин {min}</span>}
      </div>
      {canEdit && (
        <div className="flex gap-2 mt-3.5">
          <button type="button" onClick={onOut} className="btn flex-1 py-2.5 text-sm bg-raised text-ink border border-border-color">
            <span className="material-symbols-outlined text-[18px] text-danger">remove</span>
            Шығару
          </button>
          <button type="button" onClick={onAdd} className="btn flex-1 py-2.5 text-sm bg-primary/15 text-primary border border-primary/30">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Қосу
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} className="icon-btn w-11 h-auto rounded-xl border border-border-color hover:!text-danger" title="Тауарды жою" aria-label="Тауарды жою">
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          )}
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
    <Sheet title="Тауар қосу" onClose={onClose} busy={submitting}>
        {err && <div className="mb-4"><ErrorNote>{err}</ErrorNote></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Атауы *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field !py-2.5"
              placeholder="Мысалы: Май сүзгісі"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Сату бағасы мин (₸)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={salePriceMin}
                onChange={(e) => setSalePriceMin(e.target.value)}
                className="field !py-2.5"
                placeholder="Сома"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Сату бағасы макс (₸)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={salePriceMax}
                onChange={(e) => setSalePriceMax(e.target.value)}
                className="field !py-2.5"
                placeholder="Сома"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Бастапқы саны</label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="field !py-2.5"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Минималды қалдық</label>
            <input
              type="number"
              min="0"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              className="field !py-2.5"
              placeholder="Бос қалдыруға болады"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Өлшем бірлігі</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="field !py-2.5"
              placeholder="дана, л, кг..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? 'Сақталуда...' : 'Қосу'}
          </button>
        </form>
    </Sheet>
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
    <Sheet title={isIn ? 'Қоймаға қосу' : 'Шығару'} onClose={onClose} busy={submitting}>
        <div className="flex items-center justify-between rounded-xl bg-raised/50 px-3.5 py-3 mb-4 -mt-1">
          <span className="text-ink text-sm font-medium">{item.name}</span>
          <span className="text-text-muted text-xs tabular-nums">Қалды: {item.quantity}</span>
        </div>
        {err && <div className="mb-4"><ErrorNote>{err}</ErrorNote></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-4 text-center">Саны</label>
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, (q || 1) - 1))}
                className="w-14 h-14 rounded-2xl bg-raised text-ink flex items-center justify-center border border-border-color active:scale-95"
              >
                <span className="material-symbols-outlined text-2xl">remove</span>
              </button>
              <input
                type="number"
                min="1"
                max={isIn ? undefined : item.quantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-24 text-center bg-transparent border-b-2 p-2 text-3xl font-bold text-ink focus:outline-none ${isIn ? 'border-primary focus:border-primary' : 'border-status-danger focus:border-status-danger'}`}
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => (q || 0) + 1)}
                className="w-14 h-14 rounded-2xl bg-raised text-ink flex items-center justify-center border border-border-color active:scale-95"
              >
                <span className="material-symbols-outlined text-2xl">add</span>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Ескерту (міндетті емес)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field !py-2.5"
              placeholder="Мысалы: Закуп, шығару себебі"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={`btn w-full py-4 text-base text-on-primary ${isIn ? 'bg-primary' : 'bg-danger'}`}
          >
            {submitting ? 'Жіберілуде...' : isIn ? 'Қосу' : 'Шығару'}
          </button>
        </form>
    </Sheet>
  );
}
