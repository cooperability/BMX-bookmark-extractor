ALTER TABLE "review_log" ADD COLUMN "attempt" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Number existing rows per round and card so relearning repeats logged before this column existed do not collide.
UPDATE "review_log" SET "attempt" = n.attempt FROM (SELECT "id", (row_number() OVER (PARTITION BY "assessment_id", "node_id" ORDER BY "id") - 1)::smallint AS attempt FROM "review_log" WHERE "assessment_id" IS NOT NULL) n WHERE "review_log"."id" = n."id";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_log_attempt" ON "review_log" USING btree ("assessment_id","node_id","attempt");
