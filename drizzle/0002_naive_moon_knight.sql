CREATE TABLE "login_throttle" (
	"email" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"sends" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "card_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "standing" jsonb;--> statement-breakpoint
ALTER TABLE "review_log" ADD COLUMN "state" smallint;