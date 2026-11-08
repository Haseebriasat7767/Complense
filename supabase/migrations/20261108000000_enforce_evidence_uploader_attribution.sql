-- Enforce stable uploader attribution for uploaded evidence.
-- The authenticated API normally supplies createdByUser directly. This
-- database trigger is a defense-in-depth fallback for older API deployments.
create or replace function public.enforce_evidence_uploader()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_user_id public.users.id%type;
begin
  if new.source = 'upload' then
    if new."createdByUser" is null then
      select u.id
        into matched_user_id
        from public.users u
       where u."organizationId" = new."organizationId"
         and lower(u.email) = lower(new."uploadedBy")
       order by u."createdAt" asc
       limit 1;

      if matched_user_id is null then
        raise exception 'Cannot attribute uploaded evidence: no user in this organization matches uploadedBy.'
          using errcode = '23503';
      end if;

      new."createdByUser" := matched_user_id;
    end if;

    if not exists (
      select 1
        from public.users u
       where u.id = new."createdByUser"
         and u."organizationId" = new."organizationId"
    ) then
      raise exception 'Evidence uploader must be a user in the same organization.'
        using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists evidence_enforce_uploader on public.evidence;

create trigger evidence_enforce_uploader
before insert or update of "createdByUser", "uploadedBy", "organizationId", source
on public.evidence
for each row
execute function public.enforce_evidence_uploader();

-- Backfill only when the uploader email maps to a user in the same org.
update public.evidence e
   set "createdByUser" = u.id
  from public.users u
 where e."createdByUser" is null
   and e.source = 'upload'
   and u."organizationId" = e."organizationId"
   and lower(u.email) = lower(e."uploadedBy");
