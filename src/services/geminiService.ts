/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { AppResponse, UserProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// Token-optimized system instruction
const SYSTEM_INSTRUCTION = `Matdaan Mitra: Indian election tutor.
Target: {ageGroup} {purpose}. Language: {language}.
STRICT: JSON only. Max 100 words. No political bias.
Schema: {type, language, text:{title, body}, voiceText, suggestions:[]}`;

export async function askGemini(query: string, profile: UserProfile): Promise<AppResponse> {
  const model = "gemini-3-flash-preview";
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ role: "user", parts: [{ text: query }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION
          .replace("{purpose}", profile.purpose)
          .replace("{ageGroup}", profile.ageGroup)
          .replace("{language}", profile.language),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            language: { type: Type.STRING },
            text: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                body: { type: Type.STRING }
              },
              required: ["title", "body"]
            },
            voiceText: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["type", "language", "text", "voiceText", "suggestions"]
        }
      }
    });

    if (!response.text) throw new Error("Empty AI response");
    return JSON.parse(response.text) as AppResponse;
  } catch (error) {
    console.error("AI FAIL:", error);
    return {
      type: 'error',
      language: profile.language,
      text: {
        title: "Brief Offline",
        body: "I'm checking my notes! Can you try asking about 'registration' or 'EVMs' in the meantime?"
      },
      voiceText: "Sorry, I'm having trouble thinking right now. Please try again or ask something simple.",
      suggestions: ["How to register?", "What is EVM?"]
    };
  }
}
