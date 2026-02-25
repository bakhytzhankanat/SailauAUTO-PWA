-- Phase 3: Inventory and part sales (IMPLEMENTATION_PLAN 2.9, 2.10, 2.11)
CREATE TABLE IF NOT EXISTS inventory_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  sale_price DECIMAL(12, 2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  min_quantity INT,
  unit VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE inventory_movement_type AS ENUM ('in', 'out', 'sale');
CREATE TYPE inventory_ref_type AS ENUM ('booking_completion', 'manual');

CREATE TABLE IF NOT EXISTS inventory_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
  type inventory_movement_type NOT NULL,
  quantity INT NOT NULL,
  amount DECIMAL(12, 2),
  ref_type inventory_ref_type NOT NULL,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS part_sale (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_item(id) ON DELETE RESTRICT,
  quantity INT NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movement_item ON inventory_movement(item_id);
CREATE INDEX IF NOT EXISTS idx_part_sale_booking ON part_sale(booking_id);
