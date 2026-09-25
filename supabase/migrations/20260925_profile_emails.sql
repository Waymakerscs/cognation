-- Attach personal and professional emails to the one account's two profile pages.
-- Run after 20260924_cognation_social.sql.

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  drop constraint if exists profiles_email_format;

alter table public.profiles
  add constraint profiles_email_format
  check (
    email is null
    or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  );

create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(email))
  where email is not null;

-- Signup still creates one auth user. Personal email is auth.users.email.
-- Both profile rows share that user_id.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  supplied_handle text := lower(coalesce(new.raw_user_meta_data ->> 'handle', ''));
  supplied_name text := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));
  personal_email text := lower(coalesce(nullif(new.raw_user_meta_data ->> 'personal_email', ''), new.email));
  professional_email text := lower(coalesce(new.raw_user_meta_data ->> 'professional_email', ''));
  professional_handle text;
begin
  supplied_handle := regexp_replace(supplied_handle, '[^a-z0-9_-]', '', 'g');
  if char_length(supplied_handle) < 3 then
    supplied_handle := 'member_' || replace(left(new.id::text, 8), '-', '');
  end if;
  if supplied_handle !~ '^[a-z0-9_-]{3,40}$' then
    raise exception 'A valid handle is required';
  end if;

  insert into public.profiles (user_id, kind, handle, display_name, email)
  values (new.id, 'personal', supplied_handle, left(supplied_name, 80), nullif(personal_email, ''));

  if professional_email <> '' and professional_email <> personal_email then
    professional_handle := left(supplied_handle, 36) || '-pro';
    insert into public.profiles (user_id, kind, handle, display_name, email)
    values (
      new.id,
      'professional',
      professional_handle,
      left(supplied_name, 80),
      professional_email
    );
  end if;

  return new;
end;
$$;
