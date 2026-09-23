-- Row-level security (TDD P0-10). Authenticated requests run inside a transaction
-- that sets app.user_id and switches to remediate_app (see db/index.ts). That role
-- has no BYPASSRLS, so every tenant table below only shows and accepts rows whose
-- user_id matches. The owner role that runs migrations, the seed and the auth
-- lookups is unaffected.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'remediate_app') THEN
		CREATE ROLE remediate_app NOLOGIN;
	END IF;
END
$$;--> statement-breakpoint
-- The connecting role must be a member to SET ROLE to it.
GRANT remediate_app TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO remediate_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO remediate_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO remediate_app;--> statement-breakpoint
-- Tables and sequences added by later migrations are reachable too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO remediate_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO remediate_app;--> statement-breakpoint
ALTER TABLE "nodes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant" ON "nodes" TO remediate_app
	USING ("user_id" = current_setting('app.user_id', true))
	WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "edges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant" ON "edges" TO remediate_app
	USING ("user_id" = current_setting('app.user_id', true))
	WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "review_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant" ON "review_state" TO remediate_app
	USING ("user_id" = current_setting('app.user_id', true))
	WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "review_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant" ON "review_log" TO remediate_app
	USING ("user_id" = current_setting('app.user_id', true))
	WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant" ON "assessments" TO remediate_app
	USING ("user_id" = current_setting('app.user_id', true))
	WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "harvests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant" ON "harvests" TO remediate_app
	USING ("user_id" = current_setting('app.user_id', true))
	WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "quest_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant" ON "quest_runs" TO remediate_app
	USING ("user_id" = current_setting('app.user_id', true))
	WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant" ON "jobs" TO remediate_app
	USING ("user_id" = current_setting('app.user_id', true))
	WITH CHECK ("user_id" = current_setting('app.user_id', true));
