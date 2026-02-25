-- Sale price as range: sale_price_min, sale_price_max. Reports use part_sale.unit_price (actual).
ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS sale_price_min INT NOT NULL DEFAULT 1;
ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS sale_price_max INT NOT NULL DEFAULT 1;

UPDATE inventory_item
SET sale_price_min = GREATEST(1, COALESCE(CAST(sale_price AS INT), 0)),
    sale_price_max = GREATEST(1, COALESCE(CAST(sale_price AS INT), 0))
WHERE sale_price IS NOT NULL;

ALTER TABLE inventory_item ADD CONSTRAINT chk_inventory_item_sale_price_range
  CHECK (sale_price_min > 0 AND sale_price_max >= sale_price_min);

ALTER TABLE inventory_item DROP COLUMN IF EXISTS sale_price;

-- part_sale.unit_price already NOT NULL in 006_inventory.sql; no change needed.