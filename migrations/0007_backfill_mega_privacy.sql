-- Replace the visibleToViewerSql() rule-based hack with explicit data.
-- Mark Marie's (user_id 7) existing mega.nz-linked entries private so the
-- privacy is a normal visibility flag instead of special-cased SQL.

UPDATE entries
SET visibility = 'private'
WHERE user_id = 7
  AND COALESCE(external_link, '') ILIKE '%mega.nz%';
