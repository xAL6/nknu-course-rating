-- Maintain reviews.like_count / useful_count from the votes table via trigger.

create or replace function refresh_review_votes(p_review uuid) returns void language sql as $$
  update reviews r set
    like_count   = (select count(*) from votes v where v.review_id = p_review and v.kind = 'like'),
    useful_count = (select count(*) from votes v where v.review_id = p_review and v.kind = 'useful')
  where r.id = p_review;
$$;

create or replace function on_vote_change() returns trigger language plpgsql as $$
begin
  perform refresh_review_votes(coalesce(new.review_id, old.review_id));
  return coalesce(new, old);
end; $$;

drop trigger if exists trg_vote_counts on votes;
create trigger trg_vote_counts after insert or delete on votes
  for each row execute function on_vote_change();
