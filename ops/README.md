# Ops: Vote Health Dashboard

This folder contains the SQL and operational notes for the hidden internal vote-health page:

- Page path: `/pages/ops/<token>/raw-scores.html` (current token managed internally)
- Aggregate source: `public.ops_film_vote_summary`
- Voter engagement source: `public.ops_voter_film_count_distribution`

## Apply SQL in Supabase

1. Open Supabase Studio for your project.
2. Go to **SQL Editor**.
3. Paste and run `ops/sql/ops_film_vote_summary.sql`.
4. Paste and run `ops/sql/ops_voter_film_count_distribution.sql`.
5. Verify with:
   ```sql
   select * from public.ops_film_vote_summary order by last_vote_at desc limit 20;
   select * from public.ops_voter_film_count_distribution order by films_voted asc;
   ```

## How to deploy

1. Apply SQL in Supabase SQL Editor.
2. Grant `select` permissions for the ops views.
3. Refresh schema cache in Supabase (**Settings → API → Reload schema cache**).
4. Reminder: this page is obscurity-only (hidden URL + `noindex`), not secure.

## Security notes

- This page is **obscurity-only**, not true access control.
- Keep `film_votes` raw rows protected by RLS/policies.
- The page should read only `ops_film_vote_summary` and `ops_voter_film_count_distribution` (aggregate columns only).
- If you need tighter guarantees, replace direct view access with a `SECURITY DEFINER` RPC function that returns the same aggregate shape.

## Rotating the hidden path

If this URL leaks and you want a new path:

1. Create a new folder under `/pages/ops/<new-token>/`.
2. Move/copy `raw-scores.html` into that folder.
3. Share only the new URL internally.
4. Remove the old folder and re-deploy.

Do not add any links, nav items, sitemap entries, or robots references to this page.
