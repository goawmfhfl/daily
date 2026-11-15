import OpenAI from "openai";

let client: OpenAI | null = null;

export function openai() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 가 설정되지 않았습니다.");
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const MODELS = {
  fast: process.env.OPENAI_MODEL_FAST || "gpt-5-mini",
  report: process.env.OPENAI_MODEL_REPORT || "gpt-5",
  embedding: process.env.OPENAI_MODEL_EMBEDDING || "text-embedding-3-small",
};

export function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function embed(text: string): Promise<number[] | null> {
  if (!hasOpenAI()) return null;
  try {
    const res = await openai().embeddings.create({
      model: MODELS.embedding,
      input: text.slice(0, 8000),
      dimensions: 1536,
    });
    return res.data[0]?.embedding ?? null;
  } catch (e) {
    console.error("[embed] failed", e);
    return null;
  }
}
