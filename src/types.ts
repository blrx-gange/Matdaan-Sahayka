/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  purpose: 'first_voter' | 'learner' | 'exam_prep' | 'explorer';
  ageGroup: 'under_15' | '15_to_18' | '18_to_25' | '25_plus';
  language: 'hindi' | 'english' | 'hinglish';
  state?: string;
  knowledgeLevel: 'beginner' | 'intermediate' | 'advanced';
  xp: number;
  badges: string[];
  streakDays: number;
  lastActiveDate: any;
  completedTopics: string[];
}

export interface ChatMessage {
  id: string;
  timestamp: any;
  inputType: 'text' | 'voice';
  userQuery: string;
  role: 'user' | 'assistant';
  response?: AppResponse;
}

export interface AppResponse {
  type: 'info' | 'quiz' | 'simulation' | 'steps' | 'timeline' | 'error';
  language: 'hindi' | 'english' | 'hinglish';
  text: {
    title: string;
    body: string;
  };
  steps?: {
    stepNumber: number;
    label: string;
    detail?: string;
    isCompleted: boolean;
    isActive: boolean;
    link?: string;
  }[];
  timeline?: {
    event: string;
    dayOffset: number;
    label: string;
    isCurrentPhase: boolean;
  }[];
  mcq?: MCQ;
  media?: {
    type: 'youtube' | 'link' | 'infographic' | 'none';
    label: string;
    url: string;
  };
  voiceText: string;
  avatarState?: 'idle' | 'listening' | 'speaking' | 'celebrating' | 'thinking';
  suggestions: string[];
}

export interface MCQ {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanationCorrect: string;
  explanationWrong: string;
  topic: string;
}
