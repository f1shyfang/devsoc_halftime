// scripts/clean-room-hunts.ts
// Purge generated free-room quests (slug like 'rooms-%').
//
// FK cascade map (from schema.ts):
//   questClues          → questHunts (hunt_id)   : onDelete cascade ✓
//   questHuntSessions   → questTeams (team_id)   : onDelete cascade ✓
//   questHuntSessions   → questHunts (hunt_id)   : NO cascade ✗
//   questTeamMembers    → questTeams (team_id)   : onDelete cascade ✓
//   questClueProgress   → questHuntSessions (id) : onDelete cascade ✓
//   questClueProgress   → questClues (clue_id)   : NO cascade ✗
//
// Because questHuntSessions.hunt_id has no cascade we must delete sessions
// before deleting their hunt. Deleting sessions cascades to questClueProgress.
// Deleting questTeams cascades to questTeamMembers. Deleting questHunts
// cascades to questClues.
//
// Safe delete order:
//   1. questHuntSessions  (by hunt_id) → cascades questClueProgress
//   2. questTeams         (by hunt_id) → cascades questTeamMembers
//   3. questHunts         (by id)      → cascades questClues
import { db } from "@/lib/db/client";
import { questHunts, questHuntSessions, questTeams } from "@/lib/db/schema";
import { inArray, like } from "drizzle-orm";

async function main() {
  const generated = await db
    .select({ id: questHunts.id, slug: questHunts.slug })
    .from(questHunts)
    .where(like(questHunts.slug, "rooms-%"));

  if (generated.length === 0) {
    console.log("No generated room hunts to clean.");
    return;
  }

  const huntIds = generated.map((h) => h.id);

  // 1. Delete sessions (cascades to questClueProgress)
  await db.delete(questHuntSessions).where(inArray(questHuntSessions.huntId, huntIds));
  // 2. Delete teams (cascades to questTeamMembers)
  await db.delete(questTeams).where(inArray(questTeams.huntId, huntIds));
  // 3. Delete hunts (cascades to questClues)
  await db.delete(questHunts).where(inArray(questHunts.id, huntIds));

  console.log(`Deleted ${generated.length} generated room hunt(s):`);
  for (const h of generated) console.log(`  - ${h.slug}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
