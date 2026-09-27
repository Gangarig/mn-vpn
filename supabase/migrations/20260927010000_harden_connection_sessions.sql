-- Session rows are an audit trail: clients may start one and close their own
-- open row, but may never rewrite its identity, location, start time, or reopen it.
create or replace function public.enforce_connection_session_close()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.server_location is distinct from old.server_location
     or new.started_at is distinct from old.started_at then
    raise exception 'Connection session identity fields are immutable';
  end if;
  if old.ended_at is not null or new.ended_at is null then
    raise exception 'Only an open connection session may be closed';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_connection_session_close on public.connection_sessions;
create trigger enforce_connection_session_close
  before update on public.connection_sessions
  for each row execute procedure public.enforce_connection_session_close();

revoke execute on function public.enforce_connection_session_close() from public, anon, authenticated;

