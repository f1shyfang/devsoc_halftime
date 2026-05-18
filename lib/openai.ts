import OpenAI from "openai";

declare global {
  var __debateconnect_openai: OpenAI | undefined;
}

export function getOpenAI(): OpenAI {
  if (!global.__debateconnect_openai) {
    global.__debateconnect_openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }
  return global.__debateconnect_openai;
}
