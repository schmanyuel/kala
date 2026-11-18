-- Realtime sync: broadcast changes to todos and projects like the other tables (see 0002).
CREATE TRIGGER todos_notify AFTER INSERT OR UPDATE OR DELETE ON todos
  FOR EACH STATEMENT EXECUTE FUNCTION tracky_notify_change();
--> statement-breakpoint
CREATE TRIGGER projects_notify AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH STATEMENT EXECUTE FUNCTION tracky_notify_change();
