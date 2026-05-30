import { pgTable, index, foreignKey, unique, check, uuid, text, timestamp, integer, boolean, numeric, jsonb, smallint, primaryKey, pgView } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const questHuntSessions = pgTable("quest_hunt_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	huntId: uuid("hunt_id").notNull(),
	state: text().default('lobby').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	currentTier: integer("current_tier").default(1).notNull(),
	currentSequence: integer("current_sequence").default(1).notNull(),
	hintPenaltySeconds: integer("hint_penalty_seconds").default(0).notNull(),
	totalTimeSeconds: integer("total_time_seconds"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	abandonedAt: timestamp("abandoned_at", { withTimezone: true, mode: 'string' }),
	resultsCardUrl: text("results_card_url"),
}, (table) => [
	index("quest_hunt_sessions_hunt_idx").using("btree", table.huntId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.huntId],
			foreignColumns: [questHunts.id],
			name: "quest_hunt_sessions_hunt_id_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [questTeams.id],
			name: "quest_hunt_sessions_team_id_fkey"
		}).onDelete("cascade"),
	unique("quest_hunt_sessions_team_id_key").on(table.teamId),
	check("quest_hunt_sessions_state_check", sql`state = ANY (ARRAY['lobby'::text, 'in_progress'::text, 'completed'::text, 'abandoned'::text])`),
]);

export const questProfiles = pgTable("quest_profiles", {
	userId: uuid("user_id").primaryKey().notNull(),
	displayName: text("display_name").notNull(),
	avatarColor: text("avatar_color").default('#ef5b3a').notNull(),
	unswVerified: boolean("unsw_verified").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const questClues = pgTable("quest_clues", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	huntId: uuid("hunt_id").notNull(),
	tier: integer().notNull(),
	sequenceInTier: integer("sequence_in_tier").notNull(),
	type: text().default('riddle').notNull(),
	bodyText: text("body_text").notNull(),
	imageUrl: text("image_url"),
	verificationType: text("verification_type").default('gps').notNull(),
	locationName: text("location_name"),
	locationLat: numeric("location_lat", { precision: 9, scale:  6 }),
	locationLng: numeric("location_lng", { precision: 9, scale:  6 }),
	geofenceRadiusM: integer("geofence_radius_m").default(25).notNull(),
	qrCodePayload: text("qr_code_payload"),
	photoChallengePrompt: text("photo_challenge_prompt"),
	hints: jsonb().default([]).notNull(),
}, (table) => [
	index("quest_clues_hunt_idx").using("btree", table.huntId.asc().nullsLast().op("int4_ops"), table.tier.asc().nullsLast().op("uuid_ops"), table.sequenceInTier.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.huntId],
			foreignColumns: [questHunts.id],
			name: "quest_clues_hunt_id_fkey"
		}).onDelete("cascade"),
	unique("quest_clues_hunt_id_tier_sequence_in_tier_key").on(table.huntId, table.tier, table.sequenceInTier),
	check("quest_clues_sequence_in_tier_check", sql`(sequence_in_tier >= 1) AND (sequence_in_tier <= 9)`),
	check("quest_clues_tier_check", sql`(tier >= 1) AND (tier <= 3)`),
	check("quest_clues_type_check", sql`type = ANY (ARRAY['riddle'::text, 'image_clue'::text])`),
	check("quest_clues_verification_type_check", sql`verification_type = ANY (ARRAY['gps'::text, 'qr'::text, 'gps_plus_photo'::text])`),
]);

export const buildingEnrichments = pgTable("building_enrichments", {
	buildingId: text("building_id").primaryKey().notNull(),
	buildingName: text("building_name").notNull(),
	foursquarePlaceId: text("foursquare_place_id"),
	photoUrl: text("photo_url"),
	address: text(),
	matchConfidence: text("match_confidence").notNull(),
	matchMethod: text("match_method"),
	enrichedAt: timestamp("enriched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("building_enrichments_match_confidence_check", sql`match_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, 'no_match'::text])`),
	check("building_enrichments_match_method_check", sql`match_method = ANY (ARRAY['name_and_proximity'::text, 'proximity_only'::text, 'manual'::text])`),
]);

export const mvpPlayers = pgTable("mvp_players", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	gameId: uuid("game_id").notNull(),
	name: text().notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	totalTimeSeconds: integer("total_time_seconds"),
	awaitingWalkAck: boolean("awaiting_walk_ack").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mvp_players_game_idx").using("btree", table.gameId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [mvpGames.id],
			name: "mvp_players_game_id_fkey"
		}).onDelete("cascade"),
]);

export const mvpPuzzles = pgTable("mvp_puzzles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	huntId: uuid("hunt_id").notNull(),
	sequence: integer().notNull(),
	type: text().notNull(),
	prompt: text().notNull(),
	answer: text(),
	verificationCode: text("verification_code"),
	walkToPrompt: text("walk_to_prompt"),
	optional: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.huntId],
			foreignColumns: [mvpHunts.id],
			name: "mvp_puzzles_hunt_id_fkey"
		}).onDelete("cascade"),
	unique("mvp_puzzles_hunt_id_sequence_key").on(table.huntId, table.sequence),
	check("mvp_puzzles_sequence_check", sql`sequence >= 0`),
	check("mvp_puzzles_type_check", sql`type = ANY (ARRAY['anagram'::text, 'riddle_to_geocache'::text, 'photo'::text])`),
]);

export const questClueProgress = pgTable("quest_clue_progress", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	huntSessionId: uuid("hunt_session_id").notNull(),
	clueId: uuid("clue_id").notNull(),
	unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	hintsUsed: integer("hints_used").default(0).notNull(),
	manualOverride: boolean("manual_override").default(false).notNull(),
	photoCaptureUrl: text("photo_capture_url"),
	mapsUsed: smallint("maps_used").default(0).notNull(),
}, (table) => [
	index("quest_clue_progress_session_idx").using("btree", table.huntSessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.clueId],
			foreignColumns: [questClues.id],
			name: "quest_clue_progress_clue_id_fkey"
		}),
	foreignKey({
			columns: [table.huntSessionId],
			foreignColumns: [questHuntSessions.id],
			name: "quest_clue_progress_hunt_session_id_fkey"
		}).onDelete("cascade"),
	unique("quest_clue_progress_hunt_session_id_clue_id_key").on(table.huntSessionId, table.clueId),
	check("quest_clue_progress_hints_used_check", sql`(hints_used >= 0) AND (hints_used <= 2)`),
	check("quest_clue_progress_maps_used_check", sql`(maps_used >= 0) AND (maps_used <= 1)`),
]);

export const questHunts = pgTable("quest_hunts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	description: text(),
	durationMinutes: integer("duration_minutes"),
	recommendedTeamSize: text("recommended_team_size").default('2-6'),
	heroEmoji: text("hero_emoji").default('🗺️'),
	status: text().default('published').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("quest_hunts_slug_key").on(table.slug),
	check("quest_hunts_status_check", sql`status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])`),
]);

export const mvpHunts = pgTable("mvp_hunts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	status: text().default('published').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("mvp_hunts_status_check", sql`status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])`),
]);

export const mvpGames = pgTable("mvp_games", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	huntId: uuid("hunt_id").notNull(),
	status: text().default('active').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	hardcodedStartLocation: text("hardcoded_start_location").default('Head to the pitch room.').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.huntId],
			foreignColumns: [mvpHunts.id],
			name: "mvp_games_hunt_id_fkey"
		}),
	check("mvp_games_status_check", sql`status = ANY (ARRAY['lobby'::text, 'active'::text, 'ended'::text])`),
]);

export const questTeams = pgTable("quest_teams", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	inviteCode: text("invite_code").notNull(),
	name: text().notNull(),
	huntId: uuid("hunt_id").notNull(),
	leaderUserId: uuid("leader_user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("quest_teams_hunt_idx").using("btree", table.huntId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.huntId],
			foreignColumns: [questHunts.id],
			name: "quest_teams_hunt_id_fkey"
		}),
	unique("quest_teams_invite_code_key").on(table.inviteCode),
]);

export const questTeamMembers = pgTable("quest_team_members", {
	teamId: uuid("team_id").notNull(),
	userId: uuid("user_id").notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("quest_team_members_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [questTeams.id],
			name: "quest_team_members_team_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.teamId, table.userId], name: "quest_team_members_pkey"}),
]);

export const mvpPuzzleProgress = pgTable("mvp_puzzle_progress", {
	playerId: uuid("player_id").notNull(),
	puzzleId: uuid("puzzle_id").notNull(),
	solvedAt: timestamp("solved_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	attempts: integer().default(1).notNull(),
	photoUrl: text("photo_url"),
	skipped: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [mvpPlayers.id],
			name: "mvp_puzzle_progress_player_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.puzzleId],
			foreignColumns: [mvpPuzzles.id],
			name: "mvp_puzzle_progress_puzzle_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.playerId, table.puzzleId], name: "mvp_puzzle_progress_pkey"}),
]);
export const mvpPuzzlesPublic = pgView("mvp_puzzles_public", {	id: uuid(),
	huntId: uuid("hunt_id"),
	sequence: integer(),
	type: text(),
	prompt: text(),
	walkToPrompt: text("walk_to_prompt"),
	optional: boolean(),
}).as(sql`SELECT id, hunt_id, sequence, type, prompt, walk_to_prompt, optional FROM public.mvp_puzzles`);