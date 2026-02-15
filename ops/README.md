# Ops: Vote Health Dashboard

This folder contains the SQL and operational notes for the hidden internal vote-health page:

- Page path: `/pages/ops/9f3a7e2c/raw-scores.html`
- Aggregate source: `public.ops_film_vote_summary`

## Apply SQL in Supabase

1. Open Supabase Studio for your project.
2. Go to **SQL Editor**.
3. Paste and run `ops/sql/ops_film_vote_summary.sql`.
4. Verify with:
   ```sql
   select * from public.ops_film_vote_summary order by last_vote_at desc limit 20;
   ```

## Security notes

- This page is **obscurity-only**, not true access control.
- Keep `film_votes` raw rows protected by RLS/policies.
- The page should read only `ops_film_vote_summary` (aggregate columns only).
- If you need tighter guarantees, replace direct view access with a `SECURITY DEFINER` RPC function that returns the same aggregate shape.

## Rotating the hidden path

If this URL leaks and you want a new path:

1. Create a new folder under `/pages/ops/<new-token>/`.
2. Move/copy `raw-scores.html` into that folder.
3. Share only the new URL internally.
4. Remove the old folder and re-deploy.

Do not add any links, nav items, sitemap entries, or robots references to this page.
