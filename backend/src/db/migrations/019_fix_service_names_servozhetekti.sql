-- Fix corrupted service names: Серв<｜tool▁call▁begin｜>екті жөндеу (алды/арты)
UPDATE service_catalog SET name = 'Серв<｜tool▁call▁begin｜>екті жөндеу (алды)' WHERE id = 'b0000000-0000-0000-0000-000000000019';
UPDATE service_catalog SET name = 'Серв<｜tool▁call▁begin｜>екті жөндеу (арты)' WHERE id = 'b0000000-0000-0000-0000-000000000020';
