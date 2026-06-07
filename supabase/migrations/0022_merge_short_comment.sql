-- Reviews now collect a single 心得 (body); the one-line short_comment is gone.
-- Fold any existing short_comment into body (as the first line) so legacy/seed
-- rows render as one comment. Idempotent: short_comment is nulled, so re-running
-- is a no-op. The column is kept (nullable) to avoid a destructive drop.

update reviews
set body = btrim(
      coalesce(short_comment, '')
      || case
           when short_comment is not null and short_comment <> ''
            and body is not null and body <> '' then E'\n'
           else ''
         end
      || coalesce(body, '')
    ),
    short_comment = null
where short_comment is not null and short_comment <> '';
