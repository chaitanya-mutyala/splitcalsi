-- Function to join a group by its public group_id securely
create or replace function public.join_group_by_id(p_group_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
begin
  select id, name, group_id into v_group from public.groups where group_id = p_group_id;
  if v_group is null then
    raise exception 'Group not found';
  end if;
  
  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'member')
  on conflict do nothing;
  
  return json_build_object('id', v_group.id, 'name', v_group.name, 'group_id', v_group.group_id);
end;
$$;

-- Function for admins to add a member via their public_user_id
create or replace function public.add_member_by_user_id(p_group_id uuid, p_public_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_is_admin boolean;
begin
  -- check if caller is admin
  select true into v_is_admin from public.group_members 
  where group_id = p_group_id and user_id = auth.uid() and role = 'admin';
  
  if v_is_admin is null then
    raise exception 'Not authorized: You must be an admin of this group.';
  end if;

  -- find user by public_user_id
  select id into v_user_id from public.profiles where public_user_id = p_public_user_id;
  if v_user_id is null then
    raise exception 'User not found. Please check the User ID.';
  end if;

  -- insert member
  insert into public.group_members (group_id, user_id, role)
  values (p_group_id, v_user_id, 'member')
  on conflict do nothing;
  
  return true;
end;
$$;
