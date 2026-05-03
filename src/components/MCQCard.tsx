/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { MCQ } from '../types';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';

interface MCQCardProps {
  quiz: MCQ;
  onAnswer: (isCorrect: boolean) => void;
}

export function MCQCard({ quiz, onAnswer }: MCQCardProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [isAnswered, setIsAnswered] = React.useState(false);

  const handleSelect = (optionId: string) => {
    if (isAnswered) return;
    setSelected(optionId);
    setIsAnswered(true);
    const correct = optionId === quiz.correctAnswer;
    if (correct) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
    onAnswer(correct);
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white rounded-3xl p-6 shadow-xl border-2 border-orange-100 max-w-md w-full"
    >
      <div className="text-sm font-semibold text-orange-500 mb-2 uppercase tracking-wider">
        Quiz: {quiz.topic}
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-6 leading-tight">
        {quiz.question}
      </h3>

      <div className="space-y-3">
        {quiz.options.map((opt) => {
          const isCorrect = opt.id === quiz.correctAnswer;
          const isSelected = opt.id === selected;
          
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              disabled={isAnswered}
              className={cn(
                "w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between",
                !isAnswered && "border-gray-100 hover:border-orange-200 hover:bg-orange-50",
                isAnswered && isCorrect && "border-green-500 bg-green-50 text-green-700",
                isAnswered && isSelected && !isCorrect && "border-red-500 bg-red-50 text-red-700",
                isAnswered && !isSelected && !isCorrect && "border-gray-100 opacity-50"
              )}
            >
              <span className="font-medium">{opt.text}</span>
              {isAnswered && isCorrect && <span>✅</span>}
              {isAnswered && isSelected && !isCorrect && <span>❌</span>}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-6 pt-6 border-t border-gray-100 text-sm italic text-gray-600"
        >
          {selected === quiz.correctAnswer ? quiz.explanationCorrect : quiz.explanationWrong}
        </motion.div>
      )}
    </motion.div>
  );
}
