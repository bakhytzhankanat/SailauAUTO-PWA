DO $$
DECLARE
    cat_id UUID;
    serv_id UUID;
BEGIN
    SELECT id INTO cat_id FROM service_category WHERE name = 'Диагностика' LIMIT 1;
    IF cat_id IS NULL THEN
        cat_id := gen_random_uuid();
        INSERT INTO service_category (id, name, sort_order) VALUES (cat_id, 'Диагностика', 99);
    END IF;

    SELECT id INTO serv_id FROM service_catalog WHERE name = 'Неопределенная' LIMIT 1;
    IF serv_id IS NULL THEN
        INSERT INTO service_catalog (id, category_id, name) VALUES (gen_random_uuid(), cat_id, 'Неопределенная');
    END IF;
END $$;
