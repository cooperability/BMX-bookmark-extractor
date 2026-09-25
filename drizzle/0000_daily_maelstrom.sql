CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"deck" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"card_count" integer DEFAULT 0 NOT NULL,
	"score" real,
	"areas" jsonb,
	"strong" text[] DEFAULT '{}'::text[] NOT NULL,
	"weak" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "login_code" (
	"email" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"current_node_id" text,
	"visited" text[] DEFAULT '{}'::text[] NOT NULL,
	"state" jsonb
);
--> statement-breakpoint
CREATE TABLE "review_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"node_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"surface" text NOT NULL,
	"assessment_id" text
);
--> statement-breakpoint
CREATE TABLE "review_state" (
	"node_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stability" real DEFAULT 0 NOT NULL,
	"difficulty" real DEFAULT 0 NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"learning_steps" integer DEFAULT 0 NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"last_review" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_src_id_nodes_id_fk" FOREIGN KEY ("src_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_dst_id_nodes_id_fk" FOREIGN KEY ("dst_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_runs" ADD CONSTRAINT "quest_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_runs" ADD CONSTRAINT "quest_runs_current_node_id_nodes_id_fk" FOREIGN KEY ("current_node_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_state" ADD CONSTRAINT "review_state_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_state" ADD CONSTRAINT "review_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assessment_deck" ON "assessments" USING btree ("user_id","deck","finished_at");--> statement-breakpoint
CREATE INDEX "idx_edge_src" ON "edges" USING btree ("user_id","src_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_edge_unique" ON "edges" USING btree ("user_id","src_id","dst_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_url" ON "harvests" USING btree ("user_id","url_normalized");--> statement-breakpoint
CREATE INDEX "idx_job_claim" ON "jobs" USING btree ("status","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_guid" ON "nodes" USING btree ("user_id","anki_guid");--> statement-breakpoint
CREATE INDEX "idx_node_deck" ON "nodes" USING btree ("user_id","deck");--> statement-breakpoint
CREATE INDEX "idx_node_embed" ON "nodes" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_log_node" ON "review_log" USING btree ("user_id","node_id");--> statement-breakpoint
CREATE INDEX "idx_review_due" ON "review_state" USING btree ("user_id","due") WHERE state != 0;