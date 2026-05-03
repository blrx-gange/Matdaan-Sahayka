/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppResponse } from './types';

export const QUICK_STARTS = [
  "How to register for Voter ID?",
  "Check eligibility for voting",
  "What is an EVM?",
  "Polling day steps",
  "Check my name in list",
  "View Election Timeline"
];

export const STATIC_DB: Record<string, AppResponse> = {
  "how_to_register": {
    "type": "steps",
    "language": "english",
    "text": {
      "title": "Registration Process",
      "body": "Registration is easy! You can do it online via the Voter Portal."
    },
    "steps": [
      { "stepNumber": 1, "label": "Visit voters.eci.gov.in", "isCompleted": false, "isActive": true },
      { "stepNumber": 2, "label": "Fill Form 6", "isCompleted": false, "isActive": false },
      { "stepNumber": 3, "label": "Upload Aadhaar/Photo", "isCompleted": false, "isActive": false }
    ],
    "voiceText": "Visit the ECI voter portal and fill Form 6 to register.",
    "suggestions": ["Check status", "Documents needed"]
  },
  "what_is_an_evm": {
    "type": "info",
    "language": "english",
    "text": {
      "title": "EVM Explained",
      "body": "An Electronic Voting Machine is a secure device used to record votes electronically."
    },
    "voiceText": "EVM is a secure way to cast your vote electronically.",
    "suggestions": ["How VVPAT works?", "Security of EVM"]
  }
};

export const INITIAL_QUIZ: AppResponse = {
  type: 'quiz',
  language: 'english',
  text: {
    title: 'Quick Check',
    body: 'Let\'s see how much you know about Indian elections!'
  },
  mcq: {
    id: 'q1',
    topic: 'Basics',
    question: 'What is the minimum age to vote in India?',
    options: [
      { id: 'a', text: '16 years' },
      { id: 'b', text: '18 years' },
      { id: 'c', text: '21 years' },
      { id: 'd', text: '25 years' }
    ],
    correctAnswer: 'b',
    explanationCorrect: 'Correct! The voting age was reduced from 21 to 18 by the 61st Amendment Act in 1988.',
    explanationWrong: 'Actually, it is 18 years. It was reduced from 21 to 18 in 1988.'
  },
  voiceText: 'What is the minimum age to vote in India?',
  suggestions: ['How to register?', 'Why 18?']
};

export const FLOW_STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "eligibility", label: "Eligiblity" },
  { id: "registration", label: "Registration" },
  { id: "polling", label: "Polling Day" },
  { id: "counting", label: "Results" }
];
