-- Authors can delete their own Tower posts.
-- Run this in the Supabase SQL editor. There is no service-role key in the app.
create policy "tower authors delete their own posts"
on public.tower_posts for delete using (
  exists (
    select 1 from public.profiles
    where profiles.id = tower_posts.author_profile_id
      and profiles.user_id = auth.uid()
  )
);
