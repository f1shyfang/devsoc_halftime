import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("audio") as Blob | File | null;
  if (!file || typeof (file as Blob).arrayBuffer !== "function") {
    return NextResponse.json({ error: "missing audio" }, { status: 400 });
  }
  const isFile = typeof (file as File).name === "string";
  // Whisper SDK accepts a File-like object.
  const upload = isFile
    ? (file as File)
    : new File([file as Blob], "turn.webm", {
        type: (file as Blob).type || "audio/webm",
      });
  try {
    const client = getOpenAI();
    const resp = await client.audio.transcriptions.create({
      file: upload,
      model: "whisper-1",
    });
    return NextResponse.json({ transcript: resp.text ?? "" });
  } catch (err) {
    console.error("transcribe error", err);
    return NextResponse.json(
      { error: "transcription failed" },
      { status: 502 }
    );
  }
}
