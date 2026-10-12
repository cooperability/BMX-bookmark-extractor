CREATE TABLE "card_trash" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "flag" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "card_trash" ADD CONSTRAINT "card_trash_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trash_user" ON "card_trash" USING btree ("user_id","created_at");--> statement-breakpoint
-- The same tenant wall as every table in 0003_rls. Default privileges there already grant remediate_app.
ALTER TABLE "card_trash" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant" ON "card_trash" TO remediate_app
	USING ("user_id" = current_setting('app.user_id', true))
	WITH CHECK ("user_id" = current_setting('app.user_id', true));
