-- Tabela de Visitas (anteriormente subcoleção no Firebase)
create table if not exists public.visits (
  id uuid default uuid_generate_v4() primary key,
  address_id uuid references public.addresses(id) on delete cascade,
  territory_id uuid references public.territories(id),
  congregation_id uuid references public.congregations(id),
  publisher_id uuid references public.users(id),
  publisher_name text,
  status text, -- contacted, not_found, etc.
  notes text,
  date timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Habilita RLS
alter table public.visits enable row level security;

-- Políticas de RLS
create policy "Users can view visits of their congregation"
  on public.visits for select
  using ( congregation_id = (select congregation_id from public.users where id = auth.uid()) );

create policy "Users can insert visits"
  on public.visits for insert
  with check ( auth.uid() is not null );

create policy "Elders/SuperAdmins can delete/update visits"
  on public.visits for all
  using ( 
    (select role from public.users where id = auth.uid()) in ('ANCIAO', 'SUPER_ADMIN') 
    and congregation_id = (select congregation_id from public.users where id = auth.uid())
  );
