# Fleet Guardian

Vehicle inspection and damage tracking SPA. Built as a pure client-side Vite + React app talking directly to your own Supabase project. Deploys to Netlify (or any static host).

## Stack

- Vite + React 18 + TypeScript
- React Router v6
- Tailwind CSS + shadcn/ui
- @supabase/supabase-js
- TanStack Query
- Recharts (dashboard charts)

No server functions, no edge functions. All security lives in Supabase RLS + RPCs.

---

## 1. Supabase setup (one-time)

1. Create a Supabase project at https://supabase.com (or use existing).
2. Open **SQL editor** → paste and run [`supabase/schema.sql`](./supabase/schema.sql).
3. (Optional) Run [`supabase/seed.sql`](./supabase/seed.sql) to get a demo vehicle and driver (`EMP001` / PIN `1234`).
4. Create **Storage** buckets (Storage → New bucket):
   - `inspection-photos` — **private**
   - `damage-photos` — **private**
   - `vehicle-blueprints` — **public**
   - `vehicle-base-photos` — **private**

   For each private bucket add this policy on `storage.objects` (SQL editor):
   ```sql
   create policy "auth read inspection-photos"
     on storage.objects for select to authenticated
     using (bucket_id = 'inspection-photos');
   create policy "anon write inspection-photos"
     on storage.objects for insert to anon
     with check (bucket_id = 'inspection-photos');
   ```
   Repeat for `damage-photos` and `vehicle-base-photos`. Tighten later as needed.

5. Create your first admin:
   - **Authentication → Users → Add user** (email + password, auto-confirm).
   - SQL editor:
     ```sql
     insert into public.user_roles (user_id, role)
     values ('<paste the user uuid>', 'admin');
     ```

6. Copy your project **URL** and **anon key** from Project Settings → API.

---

## 2. Local dev

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
bun install
bun run dev
```

App runs on http://localhost:8080.

---

## 3. Deploy to Netlify

1. Push this repo to GitHub.
2. Netlify → **Add new site → Import from GitHub**.
3. Build command: `bun run build` · Publish directory: `dist`.
4. Site settings → **Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. The included `public/_redirects` handles SPA deep-link routing.

---

## Driver demo

Visit `/`, choose **I'm a Driver**, enter `EMP001` and PIN `1234`.

## Admin demo

Visit `/admin/login` with the credentials of the user you promoted in step 5 above.

---

## Phase 1 scope

- Driver PIN auth + admin email/password auth
- Drivers CRUD (with PIN set/reset via RPC)
- Vehicles CRUD (status, archive, blueprint view)
- Vehicle sessions (start/return)
- Pre-trip + return inspections with photo per item
- Damage markers on blueprint with photos and status workflow
- Admin dashboard with stat cards and Recharts charts
- CSV exports: Damages, Vehicle history, Inspections, Driver activity

## Notes / hardening to-do

- Driver writes use Supabase's `anon` role gated by RLS that currently trusts the client. For higher security move all driver writes into security-definer RPCs that re-verify a fresh PIN-derived token. The shape is in place — `verify_driver_pin` can be extended to mint a short-lived signed claim.
- Replace the generic SVG silhouette in `VehicleBlueprint` with per-vehicle blueprint images from the `vehicle_blueprints` table when you upload them.
