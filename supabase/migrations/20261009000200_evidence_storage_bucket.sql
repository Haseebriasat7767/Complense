-- =============================================================================
-- ComplyLens AI — private evidence bucket (Supabase Storage)
-- =============================================================================
-- Original uploaded bytes are stored as Storage objects, never as rows. The
-- bucket is PRIVATE: there is no public URL. Every download goes through
-- `GET /api/evidence/:id/file`, which validates the session token and the
-- organisation scope before the server streams the object with its server-only
-- secret key.
--
-- Object key layout (non-guessable, org/workspace scoped):
--   org/<organizationId>/ws/<workspaceId>/<evidenceId>-<32 hex chars>.<ext>
--
-- This migration is a no-op on a plain PostgreSQL instance without the Supabase
-- `storage` schema, so the core schema migration can still be applied locally.
-- =============================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present — skipping evidence bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'evidence',
    'evidence',
    false,                 -- PRIVATE. Never flip this to true.
    26214400,              -- 25 MB hard ceiling; the app enforces MAX_UPLOAD_MB below it.
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/csv',
      'application/octet-stream'
    ]
  )
  on conflict (id) do update
    set public             = false,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
end;
$$;

-- No storage policies are created for `anon` / `authenticated`. With RLS on
-- storage.objects (Supabase default) and no permissive policy, browser-held
-- keys cannot list, read, write or delete any object in this bucket. The
-- backend's secret key bypasses RLS, which is the only supported access path.
--
-- Defense in depth: an explicit restrictive policy that can never be satisfied
-- by a browser role, so an accidentally added permissive policy still cannot
-- expose evidence.
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  begin
    execute 'drop policy if exists complylens_evidence_private on storage.objects';
    execute $policy$
      create policy complylens_evidence_private
        on storage.objects
        as restrictive
        to anon, authenticated
        using (bucket_id <> 'evidence')
        with check (bucket_id <> 'evidence')
    $policy$;
  exception
    when insufficient_privilege or undefined_object then
      raise notice 'could not manage storage.objects policies — apply this migration with the Supabase CLI or the SQL editor';
  end;
end;
$$;
