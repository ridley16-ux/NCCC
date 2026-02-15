create or replace view public.ops_vote_totals as
select
  count(*)::int as total_votes,
  count(*) filter (
    where created_at >= date_trunc('day', now())
  )::int as votes_today,
  count(*) filter (
    where created_at >= now() - interval '24 hours'
  )::int as votes_24h,
  count(*) filter (
    where created_at >= now() - interval '7 days'
  )::int as votes_7d,
  count(distinct coalesce(visitor_id, device_id))::int as unique_voters,
  max(created_at) as last_vote_at,
  round(
    count(*)::numeric /
    greatest(count(distinct coalesce(visitor_id, device_id)), 1),
    2
  ) as votes_per_voter
from public.film_votes;

grant select on public.ops_vote_totals to anon;
grant select on public.ops_vote_totals to authenticated;
