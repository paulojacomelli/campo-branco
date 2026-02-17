-- Cria tabela para relatórios de erros/bugs
create table if not exists public.error_reports (
  id uuid default uuid_generate_v4() primary key,
  description text,
  screenshot text,
  user_id uuid references public.users(id),
  user_name text,
  url text,
  user_agent text,
  status text default 'open',
  created_at timestamp with time zone default now()
);

-- Habilita RLS
alter table public.error_reports enable row level security;

-- Políticas de RLS
create policy "Super Admins can view all error reports"
  on public.error_reports for select
  using ( (select role from public.users where id = auth.uid()) = 'SUPER_ADMIN' );

create policy "Super Admins can update error reports"
  on public.error_reports for update
  using ( (select role from public.users where id = auth.uid()) = 'SUPER_ADMIN' );

create policy "Authenticated users can insert error reports"
  on public.error_reports for insert
  with check ( auth.uid() is not null );
