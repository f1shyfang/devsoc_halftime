import Anthropic from "@anthropic-ai/sdk";

declare global {
  var __debateconnect_anthropic: Anthropic | undefined;
}

export function getAnthropic(): Anthropic {
  if (!global.__debateconnect_anthropic) {
    global.__debateconnect_anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }
  return global.__debateconnect_anthropic;
}

export const JUDGE_MODEL = "claude-haiku-4-5-20251001";
export const PROMPT_MODEL = "claude-haiku-4-5-20251001";

const FALLBACK_PROMPTS = [
  "Remote work is net negative for society",
  "Social media has done more harm than good",
  "AI will eliminate more jobs than it creates",
];

export function pickFallbackPrompt(): string {
  return FALLBACK_PROMPTS[Math.floor(Math.random() * FALLBACK_PROMPTS.length)];
}

const PROMPT_TIMEOUT_MS = 5000;

export async function generateDebatePrompt(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROMPT_TIMEOUT_MS);
  try {
    const client = getAnthropic();
    const resp = await client.messages.create(
      {
        model: PROMPT_MODEL,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `Generate a controversial but not offensive debate topic for strangers.
One sentence. No need to pick a side. Return ONLY JSON: {"prompt": "..."}`,
          },
        ],
      },
      { signal: controller.signal }
    );
    const text = resp.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return pickFallbackPrompt();
    const parsed = JSON.parse(match[0]) as { prompt?: string };
    if (typeof parsed.prompt === "string" && parsed.prompt.length > 5) {
      return parsed.prompt.trim();
    }
    return pickFallbackPrompt();
  } catch {
    return pickFallbackPrompt();
  } finally {
    clearTimeout(timer);
  }
}
