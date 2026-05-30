import { relations } from "drizzle-orm/relations";
import { questHunts, questHuntSessions, questTeams, questClues, mvpGames, mvpPlayers, mvpHunts, mvpPuzzles, questClueProgress, questTeamMembers, mvpPuzzleProgress } from "./schema";

export const questHuntSessionsRelations = relations(questHuntSessions, ({one, many}) => ({
	questHunt: one(questHunts, {
		fields: [questHuntSessions.huntId],
		references: [questHunts.id]
	}),
	questTeam: one(questTeams, {
		fields: [questHuntSessions.teamId],
		references: [questTeams.id]
	}),
	questClueProgresses: many(questClueProgress),
}));

export const questHuntsRelations = relations(questHunts, ({many}) => ({
	questHuntSessions: many(questHuntSessions),
	questClues: many(questClues),
	questTeams: many(questTeams),
}));

export const questTeamsRelations = relations(questTeams, ({one, many}) => ({
	questHuntSessions: many(questHuntSessions),
	questHunt: one(questHunts, {
		fields: [questTeams.huntId],
		references: [questHunts.id]
	}),
	questTeamMembers: many(questTeamMembers),
}));

export const questCluesRelations = relations(questClues, ({one, many}) => ({
	questHunt: one(questHunts, {
		fields: [questClues.huntId],
		references: [questHunts.id]
	}),
	questClueProgresses: many(questClueProgress),
}));

export const mvpPlayersRelations = relations(mvpPlayers, ({one, many}) => ({
	mvpGame: one(mvpGames, {
		fields: [mvpPlayers.gameId],
		references: [mvpGames.id]
	}),
	mvpPuzzleProgresses: many(mvpPuzzleProgress),
}));

export const mvpGamesRelations = relations(mvpGames, ({one, many}) => ({
	mvpPlayers: many(mvpPlayers),
	mvpHunt: one(mvpHunts, {
		fields: [mvpGames.huntId],
		references: [mvpHunts.id]
	}),
}));

export const mvpPuzzlesRelations = relations(mvpPuzzles, ({one, many}) => ({
	mvpHunt: one(mvpHunts, {
		fields: [mvpPuzzles.huntId],
		references: [mvpHunts.id]
	}),
	mvpPuzzleProgresses: many(mvpPuzzleProgress),
}));

export const mvpHuntsRelations = relations(mvpHunts, ({many}) => ({
	mvpPuzzles: many(mvpPuzzles),
	mvpGames: many(mvpGames),
}));

export const questClueProgressRelations = relations(questClueProgress, ({one}) => ({
	questClue: one(questClues, {
		fields: [questClueProgress.clueId],
		references: [questClues.id]
	}),
	questHuntSession: one(questHuntSessions, {
		fields: [questClueProgress.huntSessionId],
		references: [questHuntSessions.id]
	}),
}));

export const questTeamMembersRelations = relations(questTeamMembers, ({one}) => ({
	questTeam: one(questTeams, {
		fields: [questTeamMembers.teamId],
		references: [questTeams.id]
	}),
}));

export const mvpPuzzleProgressRelations = relations(mvpPuzzleProgress, ({one}) => ({
	mvpPlayer: one(mvpPlayers, {
		fields: [mvpPuzzleProgress.playerId],
		references: [mvpPlayers.id]
	}),
	mvpPuzzle: one(mvpPuzzles, {
		fields: [mvpPuzzleProgress.puzzleId],
		references: [mvpPuzzles.id]
	}),
}));