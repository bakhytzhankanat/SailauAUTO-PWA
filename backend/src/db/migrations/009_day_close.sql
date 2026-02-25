-- Phase 5: Day Close Snapshot Engine (Ауысымды жабу)
CREATE TABLE IF NOT EXISTS day_close (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  closed_by_id UUID NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  service_income_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  part_sales_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  kaspi_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  cash_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  material_expense_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  opex_lunch DECIMAL(12, 2) NOT NULL DEFAULT 0,
  opex_transport DECIMAL(12, 2) NOT NULL DEFAULT 0,
  opex_rent DECIMAL(12, 2) NOT NULL DEFAULT 0,

  kaspi_tax_percent DECIMAL(5, 2) NOT NULL,
  kaspi_tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  charity_percent DECIMAL(5, 2) NOT NULL,
  charity_raw DECIMAL(12, 2) NOT NULL DEFAULT 0,
  charity_rounded DECIMAL(12, 2) NOT NULL DEFAULT 0,
  round_charity_to_nearest_1000 BOOLEAN NOT NULL DEFAULT true,
  net_before_charity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  distributable_after_charity DECIMAL(12, 2) NOT NULL DEFAULT 0,

  manager_percent DECIMAL(5, 2) NOT NULL,
  manager_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  remainder_after_manager DECIMAL(12, 2) NOT NULL DEFAULT 0,
  masters_percent DECIMAL(5, 2) NOT NULL,
  owner_percent DECIMAL(5, 2) NOT NULL,
  masters_pool_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  owner_service_dividend DECIMAL(12, 2) NOT NULL DEFAULT 0,
  owner_parts_dividend DECIMAL(12, 2) NOT NULL DEFAULT 0,

  edit_reason TEXT
);

CREATE TABLE IF NOT EXISTS day_close_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_close_id UUID NOT NULL REFERENCES day_close(id) ON DELETE CASCADE,
  master_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  amount DECIMAL(12, 2) NOT NULL,
  UNIQUE(day_close_id, master_user_id)
);

CREATE INDEX IF NOT EXISTS idx_day_close_date ON day_close(date);
