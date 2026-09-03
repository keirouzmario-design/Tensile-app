create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('coach', 'client')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create table if not exists coach_client_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles (id) on delete cascade,
  client_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (coach_id, client_id)
);

alter table coach_client_links enable row level security;

create policy "Coach can view own client links"
  on coach_client_links for select
  using (auth.uid() = coach_id);

create policy "Client can view own coach links"
  on coach_client_links for select
  using (auth.uid() = client_id);

create policy "Coach can view linked client profiles"
  on profiles for select
  using (
    exists (
      select 1 from coach_client_links
      where coach_client_links.client_id = profiles.id
        and coach_client_links.coach_id = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'New user'),
    coalesce(new.raw_user_meta_data ->> 'role', 'client')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
