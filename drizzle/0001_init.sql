CREATE TABLE "edges" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"src_id" text NOT NULL,
	"dst_id" text NOT NULL,
	"kind" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"provenance" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "harvests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url_normalized" text NOT NULL,
	"content_hash" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"tier" text,
	"confidence" real,
	"proposal" jsonb,
	"node_id" text,
	"fail_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "harvests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"anki_guid" text,
	"kind" text DEFAULT 'card' NOT NULL,
	"notetype" text DEFAULT 'Basic' NOT NULL,
	"front" text NOT NULL,
	"back" text DEFAULT '' NOT NULL,
	"deck" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"url" text,
	"extraction_tier" text,
	"summary" text,
	"difficulty" smallint,
	"embedding" vector(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_user_id_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "nodes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quest_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"current_node_id" text,
	"visited" text[] DEFAULT '{}'::text[] NOT NULL,
	"state" jsonb
);
--> statement-breakpoint
ALTER TABLE "quest_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"node_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"surface" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_state" (
	"node_id" text NOT NULL,
	"user_id" text NOT NULL,
	"stability" real DEFAULT 0 NOT NULL,
	"difficulty" real DEFAULT 0 NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"last_review" timestamp with time zone,
	CONSTRAINT "review_state_user_id_node_id_pk" PRIMARY KEY("user_id","node_id")
);
--> statement-breakpoint
ALTER TABLE "review_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_user_id_src_id_nodes_user_id_id_fk" FOREIGN KEY ("user_id","src_id") REFERENCES "public"."nodes"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_user_id_dst_id_nodes_user_id_id_fk" FOREIGN KEY ("user_id","dst_id") REFERENCES "public"."nodes"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_user_id_node_id_nodes_user_id_id_fk" FOREIGN KEY ("user_id","node_id") REFERENCES "public"."nodes"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_runs" ADD CONSTRAINT "quest_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_runs" ADD CONSTRAINT "quest_runs_user_id_current_node_id_nodes_user_id_id_fk" FOREIGN KEY ("user_id","current_node_id") REFERENCES "public"."nodes"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_user_id_node_id_nodes_user_id_id_fk" FOREIGN KEY ("user_id","node_id") REFERENCES "public"."nodes"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_state" ADD CONSTRAINT "review_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_state" ADD CONSTRAINT "review_state_user_id_node_id_nodes_user_id_id_fk" FOREIGN KEY ("user_id","node_id") REFERENCES "public"."nodes"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_edge_src" ON "edges" USING btree ("user_id","src_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_edge_unique" ON "edges" USING btree ("user_id","src_id","dst_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_url" ON "harvests" USING btree ("user_id","url_normalized");--> statement-breakpoint
CREATE INDEX "idx_job_claim" ON "jobs" USING btree ("status","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_guid" ON "nodes" USING btree ("user_id","anki_guid");--> statement-breakpoint
CREATE INDEX "idx_node_deck" ON "nodes" USING btree ("user_id","deck");--> statement-breakpoint
CREATE INDEX "idx_node_embed" ON "nodes" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_log_node" ON "review_log" USING btree ("user_id","node_id");--> statement-breakpoint
CREATE INDEX "idx_review_due" ON "review_state" USING btree ("user_id","due") WHERE state != 0;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "edges" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "harvests" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "jobs" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "nodes" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "quest_runs" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "review_log" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "review_state" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true));