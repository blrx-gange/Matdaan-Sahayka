/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Lottie from 'lottie-react';
import { motion, AnimatePresence } from 'motion/react';

// Simplified Lottie data or external placeholders would be better
// For now using a purely CSS/SVGMotion based avatar to avoid missing asset errors
export function Avatar({ state }: { state: 'idle' | 'listening' | 'speaking' | 'thinking' | 'celebrating' }) {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="w-full h-full bg-[#FF6B35] rounded-full flex items-center justify-center text-white text-4xl shadow-lg border-4 border-white"
        >
          {state === 'idle' && '👋'}
          {state === 'listening' && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              👂
            </motion.div>
          )}
          {state === 'speaking' && (
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
            >
              🗣️
            </motion.div>
          )}
          {state === 'thinking' && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            >
              🧠
            </motion.div>
          )}
          {state === 'celebrating' && (
            <motion.div
              animate={{ y: [0, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
            >
              🎉
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Background Pulse for Listening */}
      {state === 'listening' && (
        <motion.div
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-0 bg-[#FF6B35] rounded-full -z-10"
        />
      )}
    </div>
  );
}
