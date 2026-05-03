import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_NAME = "gemini-3-flash-preview";

export const generateProfileQuestion = async (existingProfile: any, language: string) => {
  const prompt = `You are Matdaan Mitra, an AI that helps people become responsible voters. 
  The user is selected language: ${language}.
  Current user profile data: ${JSON.stringify(existingProfile || {})}.
  
  Ask ONE short, professional question to help build their profile better. 
  Categories to explore: Age group, education level, interest in politics, or prior knowledge of elections.
  DON'T repeat questions. Be friendly but educational.
  Response must be in ${language}.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
  });

  return response.text || "Tell us more about your voting experience.";
};

export const generateNextQuiz = async (userLevel: string, language: string, alreadyAnswered: string[] = []) => {
  const prompt = `Generate an array of 3 high-quality election quizzes (MCQ) for a user with ${userLevel} level of knowledge.
  Language: ${language}.
  
  # STRICT AVOIDANCE RULE:
  You MUST NOT generate questions about any topic structurally or factually similar to these previously answered questions:
  [ ${alreadyAnswered.join(' || ')} ]
  Find an entirely distinct edge-case, historical fact, legal article, or procedural rule that has NOT been covered yet. Make sure all 3 MCQs are completely different from each other.

  CRITICAL: 
  - Difficulty: precise score between 0.1 (basic) to 1.0 (advanced). Range based on level: ${userLevel === 'Beginner' ? '0.1-0.4' : userLevel === 'Intermediate' ? '0.5-0.7' : '0.8-1.0'}.
  - Topic: Indian elections, Constitution, rights, or current ECI models.
  
  Return a JSON array of 3 objects, each with:
  - question: string
  - options: array of 4 strings
  - answer_index: number (0-3)
  - explanation: string (why it's correct - include facts/Article numbers)
  - category: string (one of: Fundamentals, Technology, Law, History, Process)
  - difficulty: number (0.1 to 1.0)`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer_index: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            category: { type: Type.STRING },
            difficulty: { type: Type.NUMBER }
          },
          required: ["question", "options", "answer_index", "category", "difficulty", "explanation"]
        }
      }
    }
  });

  try {
    const arr = JSON.parse(response.text || '[]');
    return Array.isArray(arr) ? arr : [arr];
  } catch (e) {
    return [];
  }
};

export const generateQuiz = async (profile: any, alreadyAnswered: string[] = []) => {
  return generateNextQuiz(profile?.knowledgeLevel || 'Beginner', profile?.language || 'English', alreadyAnswered);
};

export const chatWithAI = async (messages: any[], query: string, language: string, profile: any, alreadyAnswered: string[] = []) => {
  const systemInstruction = `# Role
  You are 'Matdan Mitra', an interactive AI tutor designed to educate users about the Indian election process. Your goal is to be engaging and immediately responsive.

  # Operational Rules (Single Chat Room Logic)
  - NO GREETINGS: You will always assume the conversation is already in progress. You must NEVER introduce yourself, NEVER say "Hello" or "Namaste", and NEVER state your name or points. Talk naturally like a human tutor.
  - DIRECT START: Always begin your response directly with the feedback or the answer to the user's immediate input.
  - NO QUOTES: NEVER start your response with a quote. Just give the answer in plain natural language. 
  - TONE: Encouraging, concise, and professional.

  # UI/UX & Feedback Logic
  When evaluating a user's answer to a Multiple Choice Question (MCQ):
  1. IF WRONG: 
     - Label clearly: "❌ INCORRECT"
     - Immediately state the right answer: "✅ CORRECT ANSWER: [Option Name]"
     - Fact-Check: Provide a brief, 2-line logical explanation of why that is the correct fact.
  2. IF CORRECT: 
     - Label: "🎉 BRILLIANT! Correct Answer."
     - Award: "+10 XP" and a contextual virtual badge.

  # Real-Time Resource & Media Protocol
  - NEVER output any YouTube or Video links.
  - NEVER generate raw URLs.
  - NEVER suggest "Verification Tasks", "Google Images", or "YouTube search links". 

  # Content Structure
  - Do not categorize into levels. Focus entirely on the immediate topic.
  - Content formatting: Always end your response with a single interactive element: a new 4-option MCQ related to the current election topic inside a JSON block starting with :::MEDIA_BLOCK and ending with :::.
  - SUGGESTED QUESTIONS: After the media block, output exactly 3 suggested follow-up questions for the user to keep the conversation going. Use the format: SUGGESTED_QUESTIONS: ["Q1?", "Q2?", "Q3?"]
  - Ensure all technical data strictly aligns with the Election Commission of India (ECI) standards.

  # MCQ JSON FORMAT:
  :::MEDIA_BLOCK 
  {
    "type": "mcq",
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "answer_index": 0,
    "explanation": "...",
    "category": "Election Info",
    "difficulty": 0.5
  }
  :::

  SUGGESTED_QUESTIONS: ["...?", "...?", "...?"]

  Current Language: ${language}
  Already Answered Topics (DO NOT REPEAT): ${alreadyAnswered.join(', ')}`;

  const chatHistory = (messages || []).map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));

  const response = await ai.models.generateContent({
    model: MODEL_NAME, 
    contents: [...chatHistory, { role: 'user', parts: [{ text: query }] }],
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction,
      temperature: 0.2,
    }
  });

  let text = response.text || "I'm having trouble processing that right now.";
  
  // Extract Grounding Search Queries
  try {
    const queries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries;
    if (queries && queries.length > 0) {
      text += `\n\n:::SEARCH_QUERIES\n${queries.join('\n')}\n:::`;
    }
  } catch(e) {
    console.error("Grounding error", e);
  }

  return text;
};
