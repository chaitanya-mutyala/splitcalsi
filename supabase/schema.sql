-- Supabase Schema for SplitCalsi MVP

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  public_user_id text unique not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Function to generate unique public_user_id
create or replace function public.generate_public_user_id()
returns trigger as $$
declare
  new_id text;
  done bool default false;
begin
  while not done loop
    new_id := 'SF-' || upper(substring(md5(random()::text) from 1 for 6));
    begin
      insert into public.profiles (id, name, email, public_user_id)
      values (new.id, new.raw_user_meta_data->>'name', new.email, new_id);
      done := true;
    exception when unique_violation then
      -- Loop again if collision occurs
    end;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.generate_public_user_id();


-- 2. Groups Table
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  group_id text unique not null,
  join_link text unique not null,
  name text not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to auto-generate group_id and join_link before insert
create or replace function public.generate_group_id()
returns trigger as $$
declare
  new_id text;
  done bool default false;
begin
  while not done loop
    new_id := 'GRP-' || upper(substring(md5(random()::text) from 1 for 6));
    if not exists (select 1 from public.groups where group_id = new_id) then
      new.group_id := new_id;
      new.join_link := 'https://splitcalsi.app/join/' || new_id; -- Update with your domain
      done := true;
    end if;
  end loop;
  return new;
end;
$$ language plpgsql;

create trigger set_group_id
  before insert on public.groups
  for each row execute procedure public.generate_group_id();

-- 3. Group Members Table
create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('admin', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(group_id, user_id)
);

-- 4. Expenses Table
create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  title text not null,
  description text,
  amount numeric(10, 2) not null check (amount > 0),
  paid_by uuid references public.profiles(id) not null,
  receipt_url text,
  created_by uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Expense Splits Table
create table public.expense_splits (
  id uuid default uuid_generate_v4() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  amount numeric(10, 2) not null check (amount >= 0),
  payment_status text default 'pending' check (payment_status in ('paid', 'pending')) not null
);

-- 6. Settlements Table
create table public.settlements (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  from_user uuid references public.profiles(id) not null,
  to_user uuid references public.profiles(id) not null,
  amount numeric(10, 2) not null check (amount > 0),
  note text,
  settled_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- RLS Policies

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;

-- Profiles: Users can view their own profile and profiles of users in the same groups
create policy "Users can view relevant profiles" on public.profiles
  for select using (
    auth.uid() = id or
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = public.profiles.id
    )
  );

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Groups: Users can view groups they are members of or created
create policy "Users can view their groups" on public.groups
  for select using (
    created_by = auth.uid() or
    exists (
      select 1 from public.group_members where group_id = public.groups.id and user_id = auth.uid()
    )
  );

create policy "Authenticated users can create groups" on public.groups
  for insert with check (auth.uid() = created_by);

create policy "Admins can update groups" on public.groups
  for update using (
    exists (
      select 1 from public.group_members where group_id = public.groups.id and user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete groups" on public.groups
  for delete using (
    exists (
      select 1 from public.group_members where group_id = public.groups.id and user_id = auth.uid() and role = 'admin'
    )
  );

-- Group Members
create policy "Users can view members of their groups" on public.group_members
  for select using (
    exists (
      select 1 from public.group_members my_gm
      where my_gm.group_id = public.group_members.group_id and my_gm.user_id = auth.uid()
    )
  );

create policy "Anyone can insert if joining group via UI" on public.group_members
  for insert with check (
    auth.uid() = user_id
  );

create policy "Admins can insert any member" on public.group_members
  for insert with check (
    exists (
      select 1 from public.group_members admin_gm
      where admin_gm.group_id = public.group_members.group_id and admin_gm.user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can delete themselves (leave group), Admins can delete others" on public.group_members
  for delete using (
    auth.uid() = user_id or
    exists (
      select 1 from public.group_members admin_gm
      where admin_gm.group_id = public.group_members.group_id and admin_gm.user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update roles" on public.group_members
  for update using (
    exists (
      select 1 from public.group_members admin_gm
      where admin_gm.group_id = public.group_members.group_id and admin_gm.user_id = auth.uid() and role = 'admin'
    )
  );


-- Expenses: Users can view, insert, update expenses in their groups
create policy "Users can view expenses in their groups" on public.expenses
  for select using (
    exists (
      select 1 from public.group_members where group_id = public.expenses.group_id and user_id = auth.uid()
    )
  );

create policy "Users can insert expenses in their groups" on public.expenses
  for insert with check (
    exists (
      select 1 from public.group_members where group_id = public.expenses.group_id and user_id = auth.uid()
    )
  );

create policy "Users can update expenses in their groups" on public.expenses
  for update using (
    exists (
      select 1 from public.group_members where group_id = public.expenses.group_id and user_id = auth.uid()
    )
  );

create policy "Users can delete expenses they created" on public.expenses
  for delete using (auth.uid() = created_by);

-- Expense Splits
create policy "Users can view expense splits in their groups" on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on e.group_id = gm.group_id
      where e.id = public.expense_splits.expense_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can insert expense splits for their groups" on public.expense_splits
  for insert with check (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on e.group_id = gm.group_id
      where e.id = public.expense_splits.expense_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can update their own expense splits" on public.expense_splits
  for update using (
    user_id = auth.uid() or
    exists (
      select 1 from public.expenses e
      where e.id = public.expense_splits.expense_id and e.paid_by = auth.uid()
    )
  );

-- Settlements
create policy "Users can view settlements in their groups" on public.settlements
  for select using (
    exists (
      select 1 from public.group_members where group_id = public.settlements.group_id and user_id = auth.uid()
    )
  );

create policy "Users can insert settlements in their groups" on public.settlements
  for insert with check (
    exists (
      select 1 from public.group_members where group_id = public.settlements.group_id and user_id = auth.uid()
    )
  );


-- Storage: Receipts bucket
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true)
on conflict do nothing;

create policy "Anyone can read receipts"
  on storage.objects for select
  using ( bucket_id = 'receipts' );

create policy "Authenticated users can upload receipts"
  on storage.objects for insert
  with check ( bucket_id = 'receipts' and auth.role() = 'authenticated' );
