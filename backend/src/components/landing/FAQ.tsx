'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "Do I need my own API keys?",
    answer: "Not to start — the Free plan includes 100 managed credits per month with no setup. For unlimited usage, you can bring your own keys (BYOK) from OpenAI, Anthropic, Google, Groq, or DeepSeek and pay providers directly with zero markup."
  },
  {
    question: "What makes AISheeter different from other AI add-ons?",
    answer: "AISheeter is a true conversational agent, not a formula wrapper. It has conversation memory that persists across commands, multi-step task chains that execute complex workflows in one command, a self-correcting evaluator-optimizer, thinking model transparency (see the model's reasoning), and an intent learning loop that gets faster with every command you run."
  },
  {
    question: "What AI models are supported?",
    answer: "GPT-5, GPT-5.4 (Nano/Mini/Full), o3, o4-mini from OpenAI. Claude Sonnet 4.5 and Haiku 4.5 from Anthropic. Gemini 2.5 Flash and Pro from Google. Llama 3.3 70B from Groq. DeepSeek V3 and R1. You can switch models mid-conversation — each task can use a different model."
  },
  {
    question: "Is my data secure?",
    answer: "Security is our priority. Your API keys are encrypted using AES before being stored. Your spreadsheet data is sent directly to the AI providers via our secure proxy and is never stored or used for training. System prompts are server-side only — never exposed to the client."
  },
  {
    question: "Does it work on large datasets?",
    answer: "Yes. Our Bulk Processing feature handles jobs up to 10,000 rows on the Power plan. Jobs run on our servers in the background — close the sidebar or the entire sheet and come back later. Results appear in your sheet as each batch completes."
  },
  {
    question: "What are the 10 skills?",
    answer: "Format (styles, colors, borders), Chart (14 chart types), Conditional Format (30+ rule types), Data Validation (28 types), Filter (22 operators), Write Data (tables, CSV), Sheet Ops (freeze, sort, resize), Formula (native Sheets formulas), Chat (analysis, Q&A), and Analyze (multi-step row-by-row AI processing)."
  },
  {
    question: "What's the thinking/reasoning feature?",
    answer: "When using reasoning models like GPT-5.4 or o4-mini, you can see the model's thought process in real-time with a progressive disclosure UI — starts compact, shows a teaser after 3 seconds, and expands to full reasoning on click. This transparency helps you understand and trust the AI's decisions."
  }
];

export const FAQ: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <section className="py-24 px-4 bg-white border-t border-gray-100">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12 md:mb-16 px-4">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#023047] mb-3 md:mb-4">Frequently Asked Questions</h2>
          <p className="text-gray-500 text-sm sm:text-base">Everything you need to know about AISheeter.</p>
        </div>

        <div className="space-y-3 md:space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className="border border-gray-200 rounded-2xl overflow-hidden bg-[#FAFAFA] hover:border-[#219EBB]/50 transition-colors"
            >
              <button
                onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                className="w-full px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 text-left focus:outline-none"
              >
                <span className="font-semibold text-sm sm:text-base text-[#023047]">{faq.question}</span>
                <motion.div
                  animate={{ rotate: activeIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="text-gray-400" size={20} />
                </motion.div>
              </button>

              <AnimatePresence>
                {activeIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 text-gray-600 text-sm leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
