/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';

interface TimelineProps {
  steps: { label: string; active: boolean; completed: boolean }[];
  currentStep: number;
}

export function TimelineView({ steps, currentStep }: TimelineProps) {
  return (
    <div className="w-full overflow-x-auto py-6 px-4 no-scrollbar">
      <div className="flex items-center space-x-8 min-w-max">
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center space-y-2 relative">
            <motion.div
              initial={false}
              animate={{
                scale: idx <= currentStep ? 1 : 0.8,
                backgroundColor: idx < currentStep ? '#28A745' : (idx === currentStep ? '#FF6B35' : '#E8E0D5')
              }}
              className="w-12 h-12 rounded-full border-4 border-white flex items-center justify-center text-white shadow-md z-10"
            >
              {idx < currentStep ? <CheckCircle2 size={24} /> : (idx + 1)}
            </motion.div>
            
            <span className={cn(
              "text-sm font-medium",
              idx === currentStep ? "text-[#FF6B35]" : "text-gray-500"
            )}>
              {step.label}
            </span>

            {/* Connector Line */}
            {idx < steps.length - 1 && (
              <div className="absolute top-6 left-12 w-8 h-1 bg-[#E8E0D5] -z-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
