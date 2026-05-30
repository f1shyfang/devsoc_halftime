-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "quest_hunt_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"hunt_id" uuid NOT NULL,
	"state" text DEFAULT 'lobby' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"current_tier" integer DEFAULT 1 NOT NULL,
	"current_sequence" integer DEFAULT 1 NOT NULL,
	"hint_penalty_seconds" integer DEFAULT 0 NOT NULL,
	"total_time_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"abandoned_at" timestamp with time zone,
	"results_card_url" text,
	CONSTRAINT "quest_hunt_sessions_team_id_key" UNIQUE("team_id"),
	CONSTRAINT "quest_hunt_sessions_state_check" CHECK (state = ANY (ARRAY['lobby'::text, 'in_progress'::text, 'completed'::text, 'abandoned'::text]))
);
--> statement-breakpoint
CREATE TABLE "quest_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_color" text DEFAULT '#ef5b3a' NOT NULL,
	"unsw_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest_clues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hunt_id" uuid NOT NULL,
	"tier" integer NOT NULL,
	"sequence_in_tier" integer NOT NULL,
	"type" text DEFAULT 'riddle' NOT NULL,
	"body_text" text NOT NULL,
	"image_url" text,
	"verification_type" text DEFAULT 'gps' NOT NULL,
	"location_name" text,
	"location_lat" numeric(9, 6),
	"location_lng" numeric(9, 6),
	"geofence_radius_m" integer DEFAULT 25 NOT NULL,
	"qr_code_payload" text,
	"photo_challenge_prompt" text,
	"hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "quest_clues_hunt_id_tier_sequence_in_tier_key" UNIQUE("hunt_id","tier","sequence_in_tier"),
	CONSTRAINT "quest_clues_sequence_in_tier_check" CHECK ((sequence_in_tier >= 1) AND (sequence_in_tier <= 9)),
	CONSTRAINT "quest_clues_tier_check" CHECK ((tier >= 1) AND (tier <= 3)),
	CONSTRAINT "quest_clues_type_check" CHECK (type = ANY (ARRAY['riddle'::text, 'image_clue'::text])),
	CONSTRAINT "quest_clues_verification_type_check" CHECK (verification_type = ANY (ARRAY['gps'::text, 'qr'::text, 'gps_plus_photo'::text]))
);
--> statement-breakpoint
CREATE TABLE "building_enrichments" (
	"building_id" text PRIMARY KEY NOT NULL,
	"building_name" text NOT NULL,
	"foursquare_place_id" text,
	"photo_url" text,
	"address" text,
	"match_confidence" text NOT NULL,
	"match_method" text,
	"enriched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "building_enrichments_match_confidence_check" CHECK (match_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, 'no_match'::text])),
	CONSTRAINT "building_enrichments_match_method_check" CHECK (match_method = ANY (ARRAY['name_and_proximity'::text, 'proximity_only'::text, 'manual'::text]))
);
--> statement-breakpoint
CREATE TABLE "mvp_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"name" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_time_seconds" integer,
	"awaiting_walk_ack" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mvp_puzzles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hunt_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" text NOT NULL,
	"prompt" text NOT NULL,
	"answer" text,
	"verification_code" text,
	"walk_to_prompt" text,
	"optional" boolean DEFAULT false NOT NULL,
	CONSTRAINT "mvp_puzzles_hunt_id_sequence_key" UNIQUE("hunt_id","sequence"),
	CONSTRAINT "mvp_puzzles_sequence_check" CHECK (sequence >= 0),
	CONSTRAINT "mvp_puzzles_type_check" CHECK (type = ANY (ARRAY['anagram'::text, 'riddle_to_geocache'::text, 'photo'::text]))
);
--> statement-breakpoint
CREATE TABLE "quest_clue_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hunt_session_id" uuid NOT NULL,
	"clue_id" uuid NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"manual_override" boolean DEFAULT false NOT NULL,
	"photo_capture_url" text,
	"maps_used" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "quest_clue_progress_hunt_session_id_clue_id_key" UNIQUE("hunt_session_id","clue_id"),
	CONSTRAINT "quest_clue_progress_hints_used_check" CHECK ((hints_used >= 0) AND (hints_used <= 2)),
	CONSTRAINT "quest_clue_progress_maps_used_check" CHECK ((maps_used >= 0) AND (maps_used <= 1))
);
--> statement-breakpoint
CREATE TABLE "quest_hunts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer,
	"recommended_team_size" text DEFAULT '2-6',
	"hero_emoji" text DEFAULT '🗺️',
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_hunts_slug_key" UNIQUE("slug"),
	CONSTRAINT "quest_hunts_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))
);
--> statement-breakpoint
CREATE TABLE "mvp_hunts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mvp_hunts_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))
);
--> statement-breakpoint
CREATE TABLE "mvp_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hunt_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hardcoded_start_location" text DEFAULT 'Head to the pitch room.' NOT NULL,
	CONSTRAINT "mvp_games_status_check" CHECK (status = ANY (ARRAY['lobby'::text, 'active'::text, 'ended'::text]))
);
--> statement-breakpoint
CREATE TABLE "quest_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_code" text NOT NULL,
	"name" text NOT NULL,
	"hunt_id" uuid NOT NULL,
	"leader_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_teams_invite_code_key" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "quest_team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_team_members_pkey" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "mvp_puzzle_progress" (
	"player_id" uuid NOT NULL,
	"puzzle_id" uuid NOT NULL,
	"solved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"photo_url" text,
	"skipped" boolean DEFAULT false NOT NULL,
	CONSTRAINT "mvp_puzzle_progress_pkey" PRIMARY KEY("player_id","puzzle_id")
);
--> statement-breakpoint
ALTER TABLE "quest_hunt_sessions" ADD CONSTRAINT "quest_hunt_sessions_hunt_id_fkey" FOREIGN KEY ("hunt_id") REFERENCES "public"."quest_hunts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_hunt_sessions" ADD CONSTRAINT "quest_hunt_sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."quest_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_clues" ADD CONSTRAINT "quest_clues_hunt_id_fkey" FOREIGN KEY ("hunt_id") REFERENCES "public"."quest_hunts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mvp_players" ADD CONSTRAINT "mvp_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."mvp_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mvp_puzzles" ADD CONSTRAINT "mvp_puzzles_hunt_id_fkey" FOREIGN KEY ("hunt_id") REFERENCES "public"."mvp_hunts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_clue_progress" ADD CONSTRAINT "quest_clue_progress_clue_id_fkey" FOREIGN KEY ("clue_id") REFERENCES "public"."quest_clues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_clue_progress" ADD CONSTRAINT "quest_clue_progress_hunt_session_id_fkey" FOREIGN KEY ("hunt_session_id") REFERENCES "public"."quest_hunt_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mvp_games" ADD CONSTRAINT "mvp_games_hunt_id_fkey" FOREIGN KEY ("hunt_id") REFERENCES "public"."mvp_hunts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_teams" ADD CONSTRAINT "quest_teams_hunt_id_fkey" FOREIGN KEY ("hunt_id") REFERENCES "public"."quest_hunts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_team_members" ADD CONSTRAINT "quest_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."quest_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mvp_puzzle_progress" ADD CONSTRAINT "mvp_puzzle_progress_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."mvp_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mvp_puzzle_progress" ADD CONSTRAINT "mvp_puzzle_progress_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "public"."mvp_puzzles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quest_hunt_sessions_hunt_idx" ON "quest_hunt_sessions" USING btree ("hunt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "quest_clues_hunt_idx" ON "quest_clues" USING btree ("hunt_id" int4_ops,"tier" uuid_ops,"sequence_in_tier" int4_ops);--> statement-breakpoint
CREATE INDEX "mvp_players_game_idx" ON "mvp_players" USING btree ("game_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "quest_clue_progress_session_idx" ON "quest_clue_progress" USING btree ("hunt_session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "quest_teams_hunt_idx" ON "quest_teams" USING btree ("hunt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "quest_team_members_user_idx" ON "quest_team_members" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE VIEW "public"."mvp_puzzles_public" AS (SELECT id, hunt_id, sequence, type, prompt, walk_to_prompt, optional FROM public.mvp_puzzles);
*/