import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();
console.log({
  AI_PROVIDER: process.env.AI_PROVIDER,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
});

// ── Provider selection ────────────────────────────────────────────────────────
// Set AI_PROVIDER=ollama in .env to use a local Ollama model instead of Gemini.
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

// ── Gemini setup ──────────────────────────────────────────────────────────────
// Model priority (free-tier availability as of mid-2026):
//   gemini-1.5-flash      → 1500 req/day, 15 RPM  ✅ best free option
//   gemini-2.0-flash-lite → limited free tier
//   gemini-2.0-flash      → paid only on free accounts when quota is 0
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// ── Startup log — always visible in the backend terminal ─────────────────────
// Prints at module load time, regardless of whether AI is ever called.
const OLLAMA_BASE_URL_EARLY = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL_EARLY = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
console.log(
  AI_PROVIDER === 'ollama'
    ? `[AI] Provider: Ollama  model=${OLLAMA_MODEL_EARLY}  url=${OLLAMA_BASE_URL_EARLY}`
    : `[AI] Provider: Gemini  model=${GEMINI_MODEL}`
);
console.log('[AI] Note: generateContent() is only called when rule-based regex cannot determine crm_status from a note.');

let geminiModel: GenerativeModel | null = null;

function getGeminiModel(): GenerativeModel {
  if (!geminiModel) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not set. Add it to backend/.env or set AI_PROVIDER=ollama.'
      );
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    geminiModel = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });
    console.log(`[AI] Using Gemini model: ${GEMINI_MODEL}`);
  }
  return geminiModel;
}

// ── Ollama setup ──────────────────────────────────────────────────────────────
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

async function callOllama(prompt: string): Promise<string> {
  const body = JSON.stringify({
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: 'You are a CRM extraction engine. Return ONLY valid JSON.' },
      { role: 'user', content: prompt },
    ],
    stream: false,
    options: { temperature: 0 },
  });

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(120_000), // 2 min timeout for local models
  });

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { message?: { content?: string } };
  const content = json?.message?.content;
  if (!content) throw new Error('Ollama returned empty response');
  return content;
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;

async function withRetry(fn: () => Promise<string>, label: string): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message;

      // Only retry on transient errors
      const isRetryable =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('quota') ||
        msg.includes('timeout') ||
        msg.includes('ECONNRESET');

      if (!isRetryable || attempt === MAX_RETRIES) break;

      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[${label}] Attempt ${attempt} failed — retrying in ${delay}ms:`, msg.slice(0, 120));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`${label} failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateContent(prompt: string): Promise<string> {
  console.log(`[AI] generateContent() called — provider: ${AI_PROVIDER}`);

  if (AI_PROVIDER === 'ollama') {
    return withRetry(() => callOllama(prompt), 'Ollama');
  }

  // Gemini path
  return withRetry(async () => {
    const result = await getGeminiModel().generateContent(prompt);
    return result.response.text();
  }, `Gemini/${GEMINI_MODEL}`);
}
