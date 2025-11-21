import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config/env";

if (!GEMINI_API_KEY) {
  console.warn(
    "[geminiClient] GEMINI_API_KEY is not set. LLM features will be disabled."
  );
}

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export interface PrSummaryLLMInput {
  prTitle: string;
  prBody: string;
  repoFullName: string;
  number: number;
  author: string;
  branchFrom: string;
  branchTo: string;
  filesSummary: {
    filename: string;
    additions: number;
    deletions: number;
  }[];
  patchSnippets: string[]; // truncated chunks
  systemLabels: string[];
  riskFlags: string[];
  riskScore: number;
  diffStats: {
    totalAdditions: number;
    totalDeletions: number;
    changedFilesCount: number;
  };
}

export interface PrSummaryLLMOutput {
  tldr: string;
  risks: string[];
  labels: string[];
}

export async function generatePrSummaryWithGemini(
  input: PrSummaryLLMInput
): Promise<PrSummaryLLMOutput> {
  if (!ai) {
    throw new Error("Gemini disabled: GEMINI_API_KEY is not configured");
  }

  // 1) System instruction
  const systemPrompt = `
You are a senior engineer summarizing GitHub pull requests.

You are given deterministic analysis (systemLabels, riskFlags, riskScore, diffStats).
Treat that analysis as ground truth. Do not contradict it.

Return ONLY valid JSON with this exact shape:
{
  "tldr": string,
  "risks": string[],
  "labels": string[]
}
No extra keys.
`.trim();

  // 2) User content (all PR context)
  const userPayload = {
    pr: {
      title: input.prTitle,
      body: input.prBody,
      repoFullName: input.repoFullName,
      number: input.number,
      author: input.author,
      branchFrom: input.branchFrom,
      branchTo: input.branchTo,
    },
    deterministic: {
      systemLabels: input.systemLabels,
      riskFlags: input.riskFlags,
      riskScore: input.riskScore,
      diffStats: input.diffStats,
    },
    filesSummary: input.filesSummary,
    patchSnippets: input.patchSnippets,
  };

  const userContent = JSON.stringify(userPayload, null, 2);

  // 3) Use structured JSON output (Gemini JSON mode)
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "user", parts: [{ text: userContent }] },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          tldr: { type: "string" },
          risks: { type: "array", items: { type: "string" } },
          labels: { type: "array", items: { type: "string" } },
        },
        required: ["tldr", "risks", "labels"],
      },
    },
  });

  // In the new GenAI SDK, response.text is convenient for text output.
  const raw = response.text; // should be a JSON string

  if (!raw) {
    throw new Error("Gemini returned empty response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error("Failed to parse Gemini JSON: " + String(e));
  }

  const tldr = String(parsed.tldr || "").trim();
  const risks = Array.isArray(parsed.risks)
    ? parsed.risks.map((r: any) => String(r))
    : [];
  const labels = Array.isArray(parsed.labels)
    ? parsed.labels.map((l: any) => String(l))
    : [];

  if (!tldr) {
    throw new Error("Gemini did not return a TLDR");
  }

  return { tldr, risks, labels };
}

