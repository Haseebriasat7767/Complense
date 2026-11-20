-- Private bucket for original customer evidence files.
-- The application accesses Storage server-side with its secret/service key;
-- no anon or authenticated object policies are created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence-originals',
  'evidence-originals',
  false,
  4194304,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
