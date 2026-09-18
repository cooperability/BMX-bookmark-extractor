-- Hand-written: drizzle cannot emit FORCE. Without it the table owner skips every
-- tenant_isolation policy.
ALTER TABLE "nodes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "edges" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "review_state" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "review_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quest_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "harvests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs" FORCE ROW LEVEL SECURITY;
