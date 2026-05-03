/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppResponse, UserProfile } from "./types";
import { STATIC_DB } from "./constants";
import { askGemini } from "./services/geminiService";

export async function getResponse(query: string, profile: UserProfile): Promise<AppResponse> {
  const norm = query.toLowerCase().trim();
  
  // High-Speed Keyword Match
  for (const [key, val] of Object.entries(STATIC_DB)) {
    const searchTerms = [key.replace(/_/g, ' '), ...(val as any).match || []];
    if (searchTerms.some(term => norm.includes(term.toLowerCase()))) {
      console.log("⚡ Instant Match:", key);
      return { 
        ...val, 
        language: profile.language,
        meta: { servedBy: 'static' } 
      } as any;
    }
  }

  // AI Fallback
  console.log("🤖 AI Engine Start...");
  return askGemini(query, profile);
}
