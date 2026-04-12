'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Target, Zap, CheckCircle2, ArrowRight } from 'lucide-react';

export const CaseStudies: React.FC = () => {
  const [activeCaseStudy, setActiveCaseStudy] = useState(0);

  const caseStudies = [
    {
      id: 'business-plan',
      industry: 'Startup Founder',
      title: 'From One Sentence to Full Financial Model in 14 Steps',
      challenge: 'Founders spend days building spreadsheet models from scratch — manually setting up months, writing formulas for subscribers, revenue, COGS, and profit. One wrong formula cascades errors across the entire model.',
      solution: [
        'One-sentence prompt builds 12-month projection with 7 columns',
        'Formula-first engine: Subscribers, Revenue, COGS, Marketing, OpEx, Net Profit — all native formulas at $0 cost',
        'Auto-links columns: Revenue = Subscribers × Price, COGS = 40% of Revenue',
        'Conditional formatting highlights negative profit months in red',
        'Net Profit trend chart auto-generated as final step'
      ],
      results: [
        { metric: '25+', label: 'Tool Calls from 3 Messages', description: 'One prompt → 15+ actions: writeData → formula ×9 → format → chart' },
        { metric: '$0.00', label: 'Formula Cost', description: '11 formula columns (break-even, ROAS) all native Sheets — zero LLM cost' },
        { metric: '< 45s', label: 'Blank Sheet → Full Plan', description: 'Financial model + GTM strategy + ad spend + charts + analysis' }
      ],
      quote: {
        text: "I typed one sentence about my cold brew subscription idea and got a complete financial model with formulas, formatting, and charts. The formulas are native Sheets formulas — they update live when I change assumptions.",
        author: 'Indie Founder',
        company: 'FrostBrew Coffee Co.'
      },
      keyFeatures: [
        {
          icon: <Zap className="w-5 h-5" />,
          title: 'Formula-First Architecture', 
          description: 'Math operations use native =SUM(), =IF() formulas — zero LLM cost, live-updating, auditable'
        },
        {
          icon: <Target className="w-5 h-5" />,
          title: 'Multi-Step Task Chains',
          description: 'One prompt triggers writeData → formula × 6 → format → conditionalFormat → chart automatically'
        },
        {
          icon: <TrendingUp className="w-5 h-5" />,
          title: 'Self-Correcting Formulas',
          description: 'Agent validates each formula after applying — detects #REF!, #VALUE! errors and fixes in-place'
        }
      ],
      workflow: [
        { step: '1', action: 'Financial model + break-even + charts', time: '20s', output: 'writeData → formula ×9 → format → conditionalFormat → chart ×2 (15+ tool calls)' },
        { step: '2', action: 'GTM strategy + ad spend + ROAS', time: '15s', output: 'writeData ×2 → formula ×2 → format ×2 → chart (8-10 tool calls)' },
        { step: '3', action: 'Strategic analysis + 90-day plan', time: '8s', output: 'Cross-table analysis with specific dollar amounts and recommendations' }
      ],
      image: '/case-studies/business-plan-demo.png',
      video: '/case-studies/business-plan-video.mp4',
      demoLink: 'https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853'
    }
  ];

  const activeStudy = caseStudies[activeCaseStudy];

  return (
    <section id="case-studies" className="py-24 bg-linear-to-b from-[#FAFAFA] to-white">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block"
          >
            <span className="inline-block px-4 py-1.5 bg-[#FFB701]/10 text-[#FFB701] rounded-full text-sm font-bold uppercase tracking-wider mb-4">
              Real Results
            </span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif text-[#023047] mb-4 sm:mb-6 px-4"
          >
            See How Teams Use AISheet
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            From product teams analyzing feedback to sales teams enriching leads - real workflows, measurable ROI.
          </motion.p>
        </div>

        {/* Case Study Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCaseStudy}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid lg:grid-cols-2 gap-8 md:gap-12 items-start px-4"
          >
            
            {/* Left: Story */}
            <div className="space-y-6 md:space-y-8">
              
              {/* Industry Tag */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#219EBB]/10 text-[#219EBB] rounded-full text-sm font-semibold">
                <div className="w-2 h-2 bg-[#219EBB] rounded-full"></div>
                {activeStudy.industry}
              </div>

              {/* Title */}
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#023047] leading-tight">
                {activeStudy.title}
              </h3>

              {/* Challenge */}
              <div className="p-6 bg-red-50 border-l-4 border-red-400 rounded-r-xl">
                <h4 className="font-bold text-red-900 mb-2">The Challenge</h4>
                <p className="text-red-800 leading-relaxed">{activeStudy.challenge}</p>
              </div>

              {/* Solution */}
              <div>
                <h4 className="font-bold text-[#023047] mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#FFB701]" />
                  The AISheet Solution
                </h4>
                <ul className="space-y-3">
                  {activeStudy.solution.map((item, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{item}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Key Features */}
              <div className="grid gap-4">
                {activeStudy.keyFeatures.map((feature, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-[#219EBB] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#219EBB]/10 flex items-center justify-center text-[#219EBB] shrink-0">
                      {feature.icon}
                    </div>
                    <div>
                      <h5 className="font-semibold text-[#023047] mb-1">{feature.title}</h5>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Quote */}
              <div className="p-6 bg-linear-to-br from-[#023047] to-[#219EBB] text-white rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 text-[200px] font-serif opacity-10">"</div>
                <p className="text-lg leading-relaxed mb-4 relative z-10">
                  {activeStudy.quote.text}
                </p>
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold">
                    {activeStudy.quote.author[0]}
                  </div>
                  <div>
                    <div className="font-semibold">{activeStudy.quote.author}</div>
                    <div className="text-sm text-white/70">{activeStudy.quote.company}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Results & Workflow */}
            <div className="space-y-8">
              
              {/* Results Cards */}
              <div className="grid gap-6">
                <h4 className="font-bold text-[#023047] text-xl">Measurable Impact</h4>
                {activeStudy.results.map((result, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-6 bg-linear-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 hover:shadow-lg transition-shadow"
                  >
                    <div className="text-4xl font-bold text-green-700 mb-2">{result.metric}</div>
                    <div className="font-semibold text-green-900 mb-1">{result.label}</div>
                    <div className="text-sm text-green-700">{result.description}</div>
                  </motion.div>
                ))}
              </div>

              {/* Workflow Timeline */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <h4 className="font-bold text-[#023047] mb-6 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-[#FFB701]" />
                  3-Step Workflow
                </h4>
                <div className="space-y-4">
                  {activeStudy.workflow.map((step, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex gap-4"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#FFB701] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {step.step}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[#023047]">{step.action}</span>
                          <span className="text-xs text-gray-500 font-mono">{step.time}</span>
                        </div>
                        <p className="text-sm text-gray-600">{step.output}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                {/* Total Time */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#023047]">Total Time</span>
                    <span className="text-2xl font-bold text-[#219EBB]">~45 seconds</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    25-30 tool calls from just 3 user messages
                  </p>
                </div>
              </div>

              {/* CTA */}
              <motion.a
                href={activeStudy.demoLink}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="block w-full py-4 px-6 bg-[#023047] text-white rounded-xl font-bold text-center hover:bg-[#034663] transition-colors shadow-lg hover:shadow-xl"
              >
                Try This Demo →
              </motion.a>
            </div>

          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
};
