# "Leer ons kennen" — Supabase setup

The profile cards on `gettoknow.html` are stored in a small free Supabase database so
that when one person updates their card, the others see it. This is a one-time setup of
about 5 minutes. Everything below is copy-paste.

Your project: <https://supabase.com/dashboard/project/vnykifzufcupspmnsvhy>

---

## Step 1 — Create the tables and the PIN check

1. Open the dashboard link above.
2. In the left sidebar, click **SQL Editor** → **+ New query**.
3. Paste the whole block below and click **Run**.

```sql
-- Public, readable profile data (no secrets in here).
create table if not exists public.profiles (
  name       text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Personal PINs. This table is NEVER readable from the website.
create table if not exists public.profile_pins (
  name text primary key references public.profiles(name) on delete cascade,
  pin  text not null
);

-- Turn on row-level security.
alter table public.profiles      enable row level security;
alter table public.profile_pins  enable row level security;

-- Anyone with the site may READ profiles, but not write them directly.
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
  for select using (true);

-- profile_pins gets NO policies, so the website can never read or change it.

-- Check a PIN without ever exposing it. Runs with elevated rights (security definer).
create or replace function public.verify_pin(p_name text, p_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profile_pins where name = p_name and pin = p_pin
  );
$$;

-- Save a profile, but only if the PIN is correct. Also runs security definer.
create or replace function public.save_profile(p_name text, p_pin text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profile_pins where name = p_name and pin = p_pin
  ) then
    raise exception 'Onjuiste pincode';
  end if;

  update public.profiles
     set data = p_data, updated_at = now()
   where name = p_name;
end;
$$;

-- Let the website (the anon role) call only these two functions.
grant execute on function public.verify_pin(text, text)          to anon;
grant execute on function public.save_profile(text, text, jsonb) to anon;
```

---

## Step 2 — Add the six people and their PINs

Change the six PINs below to whatever you like (any text — digits are easiest on a phone),
then run this in a **New query**. Share each person's PIN with them privately.

```sql
insert into public.profiles (name) values
  ('Jorg'), ('Sara'), ('Freddie'), ('Layla'), ('Ward'), ('Charlotte')
on conflict (name) do nothing;

insert into public.profile_pins (name, pin) values
  ('Jorg',      '1111'),
  ('Sara',      '2222'),
  ('Freddie',   '3333'),
  ('Layla',     '4444'),
  ('Ward',      '5555'),
  ('Charlotte', '6666')
on conflict (name) do update set pin = excluded.pin;
```

To change one PIN later:

```sql
update public.profile_pins set pin = 'nieuwe-code' where name = 'Sara';
```

---

## Step 3 — Paste your keys into the website

1. In the dashboard, go to **Project Settings** (gear icon) → **API**.
2. Copy two values:
   - **Project URL** — should be `https://vnykifzufcupspmnsvhy.supabase.co` (already filled in).
   - **Project API keys → `anon` `public`** — a long string starting with `eyJ…`.
3. Open **`profiles.js`** and paste the anon key into the CONFIG block near the top:

   ```js
   const SUPABASE_URL = 'https://vnykifzufcupspmnsvhy.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ…your anon key…';
   ```

Both values are safe to commit publicly: the anon key can only read profiles and call the
two functions above, and editing still requires a correct PIN checked inside the database.

---

## Step 4 — Test

Open `gettoknow.html`, click **Bewerk mijn kaart** on your own card, enter your PIN, fill
something in and save. Reload — your text should still be there. Ask someone else to open
the page; they should see your update too.

## Notes & options

- **Privacy:** anything saved here is readable by anyone who has the site (the site password
  is only a light client-side gate). Keep the cards to trip-useful info; don't put sensitive
  data in them.
- **Add a field:** edit the `KW_PROFILE_FIELDS` list in `profiles.js`. Because everything is
  stored in one `data` JSON column, you don't need to change the database.
- **Stronger PINs:** the PINs are stored as plain text in a table the website can't read.
  That's fine for six friends. If you ever want them hashed, say so and I'll adjust the
  functions to use `crypt()`.
