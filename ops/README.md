# Ops: Vote Health Dashboard

This folder contains the SQL and operational notes for the hidden internal vote-health page:

- Page path: `/pages/ops/<token>/raw-scores.html` (current token managed internally)
- Aggregate source: `public.ops_film_vote_summary`
- Voter engagement source: `public.ops_voter_film_count_distribution`
- Totals KPI source: `public.ops_vote_totals`
- Daily trend source: `public.ops_votes_by_day_30`


## Supabase setup for Ops dashboard

1. Open Supabase Studio for your project and go to **SQL Editor**.
2. Run all Ops SQL view files, including:
   - `ops/sql/ops_film_vote_summary.sql`
   - `ops/sql/ops_voter_film_count_distribution.sql`
   - `ops/sql/ops_vote_totals.sql`
   - `ops/sql/ops_votes_by_day_30.sql`
3. After creating or updating views, refresh schema cache in Supabase Dashboard (**Settings → API → Reload schema cache**).
4. If the client reports `Could not find ... in schema cache`, reload schema cache and re-run the query.
5. If it still persists, follow Supabase PostgREST schema cache troubleshooting guidance in your project docs/process.

## Security notes

- This page is **obscurity-only**, not true access control.
- Keep `film_votes` raw rows protected by RLS/policies.
- The page should read only `ops_film_vote_summary`, `ops_voter_film_count_distribution`, `ops_vote_totals`, and `ops_votes_by_day_30` (aggregate columns only).
- If you need tighter guarantees, replace direct view access with a `SECURITY DEFINER` RPC function that returns the same aggregate shape.

## Rotating the hidden path

If this URL leaks and you want a new path:

1. Create a new folder under `/pages/ops/<new-token>/`.
2. Move/copy `raw-scores.html` into that folder.
3. Share only the new URL internally.
4. Remove the old folder and re-deploy.

Do not add any links, nav items, sitemap entries, or robots references to this page.
