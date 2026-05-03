/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { AppResponse } from '../types';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  response?: AppResponse;
  onSuggestionClick: (query: string) => void;
}

export function ChatBubble({ role, text, response, onSuggestionClick }: ChatBubbleProps) {
  const isAssistant = role === 'assistant';

  return (
    <div className={cn(
      "flex flex-col w-full mb-6",
      isAssistant ? "items-start" : "items-end"
    )}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className={cn(
          "max-w-[85%] p-5 rounded-3xl shadow-sm",
          isAssistant 
            ? "bg-white text-gray-800 rounded-tl-none border border-orange-50" 
            : "bg-[#006494] text-white rounded-tr-none"
        )}
      >
        {isAssistant && response?.text.title && (
          <h4 className="font-black text-orange-600 mb-2 uppercase text-xs tracking-widest">
            {response.text.title}
          </h4>
        )}
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>

        {isAssistant && response?.steps && (
          <div className="mt-4 space-y-3">
            {response.steps.map((step, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                  {step.stepNumber}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{step.label}</span>
                  {step.detail && <span className="text-xs text-gray-500">{step.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {isAssistant && response?.suggestions && (
        <div className="flex flex-wrap gap-2 mt-3 px-2">
          {response.suggestions.map((suggestion, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSuggestionClick(suggestion)}
              className="px-4 py-2 bg-orange-50 text-orange-600 border border-orange-100 rounded-full text-sm font-semibold hover:bg-orange-100 transition-colors"
            >
              {suggestion}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
