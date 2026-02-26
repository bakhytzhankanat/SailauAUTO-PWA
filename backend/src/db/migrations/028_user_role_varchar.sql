-- role was VARCHAR(10); 'super_admin' is 11 chars — extend to VARCHAR(20)
ALTER TABLE "user" ALTER COLUMN role TYPE VARCHAR(20);
