import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	bigserial,
	foreignKey,
	index,
	integer,
	jsonb,
	pgPolicy,
	pgTable,
	primaryKey,
	real,
	smallint,
	text,
	timestamp,
	unique,
	uniqueIndex,
	vector
} from 'drizzle-orm/pg-core';

// TDD §4. Every table carries user_id on the row, denormalized on purpose: the
// Phase 1 RLS policies read it locally, and a join to prove tenancy is both
// slower and a bug waiting to happen.

// TDD §7.6. withTenant sets app.user_id per transaction. FORCE lives in a custom
// migration because drizzle cannot express it.
const tenantIsolation = () =>
	pgPolicy('tenant_isolation', {
		using: sql`user_id = current_setting('app.user_id', true)`
	});

// FK checks bypass RLS, so a plain FK to nodes.id would let one tenant attach
// rows to another's node and probe which ids exist. Keying every node reference
// on (user_id, id) confines the check to the caller's own nodes.
const ownNode = (userId: AnyPgColumn, nodeId: AnyPgColumn) =>
	foreignKey({ columns: [userId, nodeId], foreignColumns: [node.userId, node.id] });

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

/**
 * The shared primitive. One row reads as a flashcard, a harvested document, or a
 * Quest room depending on the surface asking.
 */
export const node = pgTable(
	'nodes',
	{
		// Derived, URL-safe, and owner-scoped so two tenants importing the same shared
		// deck do not collide on this global key. See ingest/identity.ts.
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		// Raw base91. Contains < & / # %, so it never reaches markup or a path.
		ankiGuid: text('anki_guid'),
		kind: text('kind').notNull().default('card'), // card | doc | concept
		notetype: text('notetype').notNull().default('Basic'),
		front: text('front').notNull(),
		back: text('back').notNull().default(''),
		deck: text('deck').notNull(),
		tags: text('tags')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		url: text('url'), // docs only
		extractionTier: text('extraction_tier'), // full | metadata | failed
		summary: text('summary'), // AI
		difficulty: smallint('difficulty'), // AI, 1-5
		embedding: vector('embedding', { dimensions: 1024 }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(t) => [
		// Idempotent re-import: same GUID updates instead of duplicating.
		uniqueIndex('idx_guid').on(t.userId, t.ankiGuid),
		index('idx_node_deck').on(t.userId, t.deck),
		index('idx_node_embed').using('hnsw', t.embedding.op('vector_cosine_ops')),
		unique('nodes_user_id_id_unique').on(t.userId, t.id),
		tenantIsolation()
	]
);

export const edge = pgTable(
	'edges',
	{
		id: bigserial('id', { mode: 'bigint' }).primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		srcId: text('src_id').notNull(),
		dstId: text('dst_id').notNull(),
		kind: text('kind').notNull(), // deck | tag | similar_to | prereq_of | cites
		weight: real('weight').notNull().default(1),
		provenance: text('provenance').notNull() // import | ai | manual
	},
	(t) => [
		// Quest traversal.
		index('idx_edge_src').on(t.userId, t.srcId, t.kind),
		uniqueIndex('idx_edge_unique').on(t.userId, t.srcId, t.dstId, t.kind),
		ownNode(t.userId, t.srcId),
		ownNode(t.userId, t.dstId),
		tenantIsolation()
	]
);

/**
 * FSRS state. `stability` is the hinge of the product: the scheduler's
 * memory-strength estimate and the Quest door gate are the same column.
 *
 * Optional per node. Harvested documents have no schedule until promoted, because
 * auto-enrolling 3,861 bookmarks would destroy the review queue.
 */
export const reviewState = pgTable(
	'review_state',
	{
		nodeId: text('node_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		stability: real('stability').notNull().default(0),
		difficulty: real('difficulty').notNull().default(0),
		due: timestamp('due', { withTimezone: true, mode: 'date' }).notNull(),
		reps: integer('reps').notNull().default(0),
		lapses: integer('lapses').notNull().default(0),
		state: smallint('state').notNull().default(0), // 0 new 1 learn 2 review 3 relearn
		lastReview: timestamp('last_review', { withTimezone: true, mode: 'date' })
	},
	(t) => [
		// The hot path. Partial, because new cards are not due-queried.
		index('idx_review_due')
			.on(t.userId, t.due)
			.where(sql`state != 0`),
		primaryKey({ columns: [t.userId, t.nodeId] }),
		ownNode(t.userId, t.nodeId),
		tenantIsolation()
	]
);

export const reviewLog = pgTable(
	'review_log',
	{
		id: bigserial('id', { mode: 'bigint' }).primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		nodeId: text('node_id').notNull(),
		rating: smallint('rating').notNull(), // 1..4
		elapsedDays: integer('elapsed_days').notNull().default(0),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.defaultNow(),
		// Cards or Quest. One write path, observable per surface, so "does the game
		// improve adherence?" is answerable with data.
		surface: text('surface').notNull()
	},
	(t) => [
		index('idx_log_node').on(t.userId, t.nodeId),
		ownNode(t.userId, t.nodeId),
		tenantIsolation()
	]
);

/**
 * A harvest attempt, kept separate from the graph. Most harvests are not nodes:
 * 3,861 URLs produce failures, duplicates and low-confidence proposals, and a
 * failed fetch should be a row you can retry rather than a missing node.
 */
export const harvest = pgTable(
	'harvests',
	{
		id: bigserial('id', { mode: 'bigint' }).primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		urlNormalized: text('url_normalized').notNull(), // utm stripped, no fragment
		contentHash: text('content_hash'), // cross-domain duplicate detection
		status: text('status').notNull().default('queued'),
		tier: text('tier'), // full | metadata | failed
		confidence: real('confidence'),
		proposal: jsonb('proposal'),
		nodeId: text('node_id'),
		failReason: text('fail_reason'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('idx_url').on(t.userId, t.urlNormalized),
		ownNode(t.userId, t.nodeId),
		tenantIsolation()
	]
);

export const questRun = pgTable(
	'quest_runs',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		currentNodeId: text('current_node_id'),
		visited: text('visited')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		state: jsonb('state')
	},
	(t) => [ownNode(t.userId, t.currentNodeId), tenantIsolation()]
);

/** Queue on Postgres. Claimed with FOR UPDATE SKIP LOCKED by the cron worker. */
export const job = pgTable(
	'jobs',
	{
		id: bigserial('id', { mode: 'bigint' }).primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		kind: text('kind').notNull(), // extract | triage | embed | link
		status: text('status').notNull().default('queued'),
		payload: jsonb('payload'),
		attempts: integer('attempts').notNull().default(0),
		claimedAt: timestamp('claimed_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(t) => [index('idx_job_claim').on(t.status, t.kind), tenantIsolation()]
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Node = typeof node.$inferSelect;
export type Edge = typeof edge.$inferSelect;
export type ReviewState = typeof reviewState.$inferSelect;
export type ReviewLog = typeof reviewLog.$inferSelect;
export type Harvest = typeof harvest.$inferSelect;
export type QuestRun = typeof questRun.$inferSelect;
export type Job = typeof job.$inferSelect;
