-- Helper functions to avoid infinite recursion in RLS policies
create or replace function public.get_user_groups()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select group_id from group_members where user_id = auth.uid();
$$;

create or replace function public.get_admin_groups()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select group_id from group_members where user_id = auth.uid() and role = 'admin';
$$;

-- Drop all existing policies on group_members
drop policy if exists "Users can view members of their groups" on public.group_members;
drop policy if exists "Anyone can insert if joining group via UI" on public.group_members;
drop policy if exists "Admins can insert any member" on public.group_members;
drop policy if exists "Users can delete themselves (leave group), Admins can delete others" on public.group_members;
drop policy if exists "Admins can update roles" on public.group_members;

-- Recreate group_members policies
create policy "Users can view members of their groups" on public.group_members
  for select using ( group_id in (select public.get_user_groups()) );

create policy "Anyone can insert if joining group via UI" on public.group_members
  for insert with check ( auth.uid() = user_id );

create policy "Admins can insert any member" on public.group_members
  for insert with check ( group_id in (select public.get_admin_groups()) );

create policy "Users can delete themselves (leave group), Admins can delete others" on public.group_members
  for delete using ( auth.uid() = user_id or group_id in (select public.get_admin_groups()) );

create policy "Admins can update roles" on public.group_members
  for update using ( group_id in (select public.get_admin_groups()) );

-- Drop existing profiles policy and recreate
drop policy if exists "Users can view relevant profiles" on public.profiles;

create policy "Users can view relevant profiles" on public.profiles
  for select using (
    auth.uid() = id or
    id in (
      select user_id from public.group_members 
      where group_id in (select public.get_user_groups())
    )
  );

-- Fix groups admin policies
drop policy if exists "Admins can update groups" on public.groups;
drop policy if exists "Admins can delete groups" on public.groups;

create policy "Admins can update groups" on public.groups
  for update using ( id in (select public.get_admin_groups()) );

create policy "Admins can delete groups" on public.groups
  for delete using ( id in (select public.get_admin_groups()) );
