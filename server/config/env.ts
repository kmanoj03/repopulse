/**
 * Environment configuration for Gemini AI integration
 */

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash"; // default model

/**
 * Check if Gemini is properly configured
 */
export function isGeminiEnabled(): boolean {
  return !!GEMINI_API_KEY;
}

/**
 * Log Gemini configuration status
 */
export function logGeminiConfig(): void {
  if (GEMINI_API_KEY) {
    console.log(`✅ Gemini AI enabled with model: ${GEMINI_MODEL}`);
  } else {
    console.log(`⚠️  Gemini AI disabled - GEMINI_API_KEY not set`);
  }
}

