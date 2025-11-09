-- Allow users to insert their own portfolio
create policy "insert own portfolio" on public.portfolios
  for insert
  with check (user_id = auth.uid());