-- One-time Neon setup, applied after loading schema + data.
-- Run with: psql "$DATABASE_URL" -f db/neon-setup.sql
--
-- WHY: Neon's role default search_path is empty, so unqualified references
-- (`quest_hunts`, `quest_generate_invite_code()`) fail with "does not exist".
-- The pooled endpoint rejects the libpq `options=-c search_path=...` startup
-- param, and ALTER DATABASE ... SET does not reliably propagate through the
-- pooler. Setting it at the ROLE level is applied by the neon-http endpoint
-- (the driver this app uses) and by Vercel (same role/DB), so Drizzle's
-- unqualified table queries and the callRpc* helpers resolve correctly.
--
-- Re-apply this if the Neon database/role is ever recreated.

ALTER ROLE neondb_owner SET search_path TO "$user", public;
ALTER DATABASE neondb SET search_path TO "$user", public;
