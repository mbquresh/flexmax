-- 034_quality_reason_note.sql
-- Applied manually via Supabase SQL Editor.
--
-- Free-text companion to quality_reason_tag. The five presets cover common
-- causes; this is for what they cannot. Deliberately NOT written into
-- quality_reason_tag, whose CHECK constraint (029) allows only the five
-- preset strings and must stay clean -- the tag is countable, the note is not.
--
-- Also deliberately not reflection_why: that column means "why this was
-- missed", and mixing it with "why this was low quality on a block that
-- completed" would blur two different questions in the reflections array.

alter table daily_schedule_instances
  add column if not exists quality_reason_note text;
