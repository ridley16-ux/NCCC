create or replace view public.ops_votes_by_day as
select
  date_trunc('day', created_at)::date as day,
  count(*)::int as votes,
  count(distinct coalesce(visitor_id, device_id))::int as unique_voters,
  coalesce(sum(rating), 0)::int as raw_score_total,
  round(avg(rating)::numeric, 2) as avg_rating
from public.film_votes
group by 1
order by 1 asc;

grant select on public.ops_votes_by_day to anon;
grant select on public.ops_votes_by_day to authenticated;
