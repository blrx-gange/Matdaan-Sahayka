/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = React.useState(1);
  const [data, setData] = React.useState<Partial<UserProfile>>({
    xp: 0,
    badges: [],
    streakDays: 1,
    lastActiveDate: new Date(),
    completedTopics: [],
    knowledgeLevel: 'beginner'
  });

  const nextStep = (update: Partial<UserProfile>) => {
    const newData = { ...data, ...update };
    setData(newData);
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete(newData as UserProfile);
    }
  };

  const steps = [
    {
      title: "Why are you here today?",
      options: [
        { label: "🗳️ First-time Voter", value: "first_voter" },
        { label: "📚 Learn the Basics", value: "learner" },
        { label: "✍️ Exam Prep", value: "exam_prep" },
        { label: "🔍 Just Exploring", value: "explorer" }
      ],
      field: 'purpose'
    },
    {
      title: "What's your age group?",
      options: [
        { label: "🧒 Under 15", value: "under_15" },
        { label: "🧑 15–18", value: "15_to_18" },
        { label: "🧑‍🦱 18–25", value: "18_to_25" },
        { label: "🧔 25+", value: "25_plus" }
      ],
      field: 'ageGroup'
    },
    {
      title: "Preferred language?",
      options: [
        { label: "English", value: "english" },
        { label: "Hindi (हिन्दी)", value: "hindi" },
        { label: "Hinglish", value: "hinglish" }
      ],
      field: 'language'
    }
  ];

  const current = steps[step - 1];

  return (
    <div className="fixed inset-0 bg-[#FFFDF7] z-50 flex items-center justify-center p-6">
      <motion.div
        key={step}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white rounded-[40px] p-8 shadow-2xl border-4 border-orange-50"
      >
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-orange-500 font-bold">Step {step} of 3</span>
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-2 w-8 rounded-full ${i <= step ? 'bg-orange-400' : 'bg-gray-100'}`} />
              ))}
            </div>
          </div>
          <h2 className="text-3xl font-black text-[#1A1A2E] leading-tight">
            {current.title}
          </h2>
        </div>

        <div className="grid gap-3">
          {current.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => nextStep({ [current.field]: opt.value })}
              className="w-full p-6 text-left rounded-3xl border-2 border-transparent bg-gray-50 hover:bg-orange-50 hover:border-orange-200 transition-all text-lg font-bold text-gray-700"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
