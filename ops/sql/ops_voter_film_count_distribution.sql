create or replace view public.ops_voter_film_count_distribution as
with voter_films as (
  select
    coalesce(visitor_id, device_id) as voter_key,
    count(distinct film_id)::int as films_voted
  from public.film_votes
  where coalesce(visitor_id, device_id) is not null
  group by coalesce(visitor_id, device_id)
)
select
  films_voted,
  count(*)::int as voters
from voter_films
group by films_voted
order by films_voted asc;

-- grant select on public.ops_voter_film_count_distribution to anon;
-- grant select on public.ops_voter_film_count_distribution to authenticated;
