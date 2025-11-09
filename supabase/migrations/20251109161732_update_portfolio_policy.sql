-- Allow users to update their own portfolio
drop policy if exists "update own portfolio" on public.portfolios;

create policy "update own portfolio" on public.portfolios
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());