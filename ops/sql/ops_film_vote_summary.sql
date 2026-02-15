-- Aggregate-only vote health view for internal ops dashboard.
-- Exposes no voter identity/device information.

create or replace view public.ops_film_vote_summary as
select
  fv.film_id,
  count(*)::bigint as votes_total,
  max(fv.created_at) as last_vote_at,
  min(fv.created_at) as first_vote_at,
  count(*) filter (where fv.created_at >= now() - interval '24 hours')::bigint as votes_last_24h,
  count(*) filter (where fv.created_at >= now() - interval '7 days')::bigint as votes_last_7d,
  round(avg(fv.rating)::numeric, 2) as avg_rating,
  jsonb_build_object(
    '1', count(*) filter (where fv.rating = 1),
    '2', count(*) filter (where fv.rating = 2),
    '3', count(*) filter (where fv.rating = 3),
    '4', count(*) filter (where fv.rating = 4),
    '5', count(*) filter (where fv.rating = 5),
    '6', count(*) filter (where fv.rating = 6),
    '7', count(*) filter (where fv.rating = 7),
    '8', count(*) filter (where fv.rating = 8),
    '9', count(*) filter (where fv.rating = 9),
    '10', count(*) filter (where fv.rating = 10)
  ) as rating_counts
from public.film_votes fv
group by fv.film_id;

comment on view public.ops_film_vote_summary is
  'Aggregate vote health metrics by film. Safe for public read if raw film_votes remains protected.';

-- Grants for public dashboard reads.
grant select on public.ops_film_vote_summary to anon, authenticated;

-- RLS reminder:
-- Do not grant anon select on public.film_votes if you only want aggregate access.
-- Keep raw-row access locked down and expose this view (or a SECURITY DEFINER function) instead.
