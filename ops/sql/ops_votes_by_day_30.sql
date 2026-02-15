create or replace view public.ops_votes_by_day_30 as
select *
from (
  select
    date_trunc('day', created_at)::date as day,
    count(*)::int as votes,
    count(distinct coalesce(visitor_id, device_id))::int as unique_voters,
    round(avg(rating)::numeric, 2) as avg_rating
  from public.film_votes
  group by 1
) t
where day >= current_date - interval '30 days'
order by day asc;

grant select on public.ops_votes_by_day_30 to anon;
grant select on public.ops_votes_by_day_30 to authenticated;
