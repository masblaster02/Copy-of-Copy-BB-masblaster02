-- Optional demo data. Run AFTER schema.sql.
insert into public.vehicles (registration_number, make, model, year)
values ('DEMO-001', 'Toyota', 'Hilux', 2023)
on conflict (registration_number) do nothing;

-- Demo driver EMP001 / PIN 1234
insert into public.drivers (name, surname, employee_number, pin_hash)
values ('Demo', 'Driver', 'EMP001', crypt('1234', gen_salt('bf')))
on conflict (employee_number) do nothing;
