-- Notify listening clients (via realtime.ts's LISTEN connection) whenever
-- data changes, so open browser tabs can refetch instead of polling.
CREATE OR REPLACE FUNCTION tracky_notify_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('tracky_changes', TG_TABLE_NAME);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_entries_notify AFTER INSERT OR UPDATE OR DELETE ON time_entries
  FOR EACH STATEMENT EXECUTE FUNCTION tracky_notify_change();

CREATE TRIGGER jobs_notify AFTER INSERT OR UPDATE OR DELETE ON jobs
  FOR EACH STATEMENT EXECUTE FUNCTION tracky_notify_change();

CREATE TRIGGER wage_rates_notify AFTER INSERT OR UPDATE OR DELETE ON wage_rates
  FOR EACH STATEMENT EXECUTE FUNCTION tracky_notify_change();

CREATE TRIGGER settings_notify AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH STATEMENT EXECUTE FUNCTION tracky_notify_change();
