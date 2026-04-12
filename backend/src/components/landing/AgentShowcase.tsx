'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Sparkles, ChevronRight, Play, RotateCcw } from 'lucide-react';

interface ConversationStep {
  type: 'user' | 'agent' | 'result';
  content: string;
  delay: number;
}

interface DemoScenario {
  id: string;
  title: string;
  icon: string;
  description: string;
  conversation: ConversationStep[];
  beforeData: string[][];
  afterData: string[][];
}

const scenarios: DemoScenario[] = [
  {
    id: 'bizplan',
    title: 'Business Plan Builder',
    icon: '🧊',
    description: 'Build a full financial model from one sentence',
    conversation: [
      { type: 'user', content: "I'm launching FrostBrew — cold brew subscription at $29/mo. Build me a 12-month financial projection. 50 subscribers growing 15% monthly, COGS 40%, marketing starts at $1,500 and should scale. I need break-even analysis and a Revenue vs Profit chart.", delay: 0 },
      { type: 'agent', content: "Planning 15-step workflow:\n\n1. writeData → Month + seed assumptions\n2. formula × 6 → Subs, Revenue, COGS, Marketing, OpEx, Profit\n3. formula × 3 → Cumulative Profit, Margin %, Break-Even flag\n4. format → currency, bold headers\n5. conditionalFormat → green/red profit\n6. chart × 2 → Revenue vs Profit combo + Subscriber Growth\n\n9 formula columns = $0 cost. Starting...", delay: 1800 },
      { type: 'result', content: "✅ 15 steps complete!\n\n• 12 months of projections with 9 formula columns\n• Break-even: Month 9 (cumulative turns positive at $1,247)\n• Revenue vs Profit combo chart + Subscriber Growth chart created\n• All formulas are native Sheets — change an assumption, everything updates live.\n\nTotal cost: $0.003 (only seed data used LLM)", delay: 4000 },
      { type: 'user', content: "Now help me plan the go-to-market — 8 channels with realistic CAC, plus an 8-week ad spend ramp. My first-month LTV is $29.", delay: 5000 },
      { type: 'result', content: "✅ 9 more tool calls!\n\n• GTM table: 8 channels with realistic CAC ($8 referral → $22 Instagram)\n• Ad spend ramp: conservative Week 1 → aggressive Week 8\n• CPA + ROAS are live formulas — $0 cost\n• Spend vs Conversions chart created\n\nReady for strategic analysis across all tables.", delay: 6800 }
    ],
    beforeData: [
      ['Month', 'Subs', 'Revenue', 'COGS', 'Marketing', 'OpEx', 'Profit'],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '']
    ],
    afterData: [
      ['Month', 'Subs', 'Revenue', 'COGS', 'Mktg', 'Profit', 'Cumul.', 'Break-Even'],
      ['Jan', '50', '$1,450', '$580', '$1,500', '-$1,760', '-$1,760', 'NO'],
      ['Feb', '58', '$1,668', '$667', '$1,500', '-$1,619', '-$3,379', 'NO'],
      ['Mar', '66', '$1,918', '$767', '$1,500', '-$1,446', '-$4,825', 'NO']
    ]
  },
  {
    id: 'formula',
    title: 'Formula-First Engine',
    icon: '⚡',
    description: 'Native formulas at zero LLM cost',
    conversation: [
      { type: 'user', content: "Calculate annual revenue — multiply price × quantity for each row", delay: 0 },
      { type: 'agent', content: "⚡ Pattern matched in 8ms — similar column types seen before.\n\nChecking column types... Price column has $ symbols and /mo suffixes. Need to handle mixed formats.\n\nUsing native Sheets formula — $0 LLM cost.", delay: 1200 },
      { type: 'result', content: "⚠️ Self-correction triggered!\n\n• Attempt: =C2*D2\n• Issue: Price has $ and /mo text — can't multiply\n• Fix: Strip symbols, detect monthly → annualize\n\n✅ Formula applied to 4 rows. Pattern saved (accuracy: 0.95)", delay: 3200 },
      { type: 'user', content: "Which product is most profitable?", delay: 4200 },
      { type: 'result', content: "CloudSync at $203K/yr — a recurring SaaS model with 85 seats at $199/mo.\n\nDataVault is second ($188K/yr) but has 3.8× more users, suggesting lower ARPU.\n\nWidget Pro has highest margin per unit but limited by one-time purchases.", delay: 5800 }
    ],
    beforeData: [
      ['Product', 'Category', 'Price', 'Qty', 'Revenue'],
      ['Widget Pro', 'Electronics', '$49.99', '120', ''],
      ['CloudSync', 'Software', '$199/mo', '85', ''],
      ['DataVault', 'Software', '$49/mo', '320', '']
    ],
    afterData: [
      ['Product', 'Category', 'Price', 'Qty', 'Revenue'],
      ['Widget Pro', 'Electronics', '$49.99', '120', '$5,999'],
      ['CloudSync', 'Software', '$199/mo', '85', '$203K/yr'],
      ['DataVault', 'Software', '$49/mo', '320', '$188K/yr']
    ]
  },
  {
    id: 'analysis',
    title: 'Strategic Advisor',
    icon: '🧠',
    description: 'Cross-table analysis with specific insights',
    conversation: [
      { type: 'user', content: "Step back and be my advisor. How much cash do I need before break-even? Which 2 channels give best unit economics? Give me a 90-day launch plan.", delay: 0 },
      { type: 'agent', content: "Reading 3 tables: financial projections (A1:J13), GTM channels (L1:Q9), ad spend plan (L12:S20).\n\nCross-referencing break-even timing against CAC data and ROAS...", delay: 1800 },
      { type: 'result', content: "📊 Strategic Analysis:\n\n1. Cash Runway: Peak cumulative loss of -$8,200 in Month 7. You need $10K minimum runway before break-even in Month 9.\n\n2. Best Unit Economics:\n   • Referral ($8 CAC vs $29 LTV = 3.6x)\n   • Google Search ($18 CAC = 1.6x)\n   TikTok's $25 CAC only works at scale.\n\n3. 90-Day Plan:\n   • Wk 1-4: Launch referral program ($500/mo), seed 20 founders\n   • Wk 5-8: Scale Google to $2K/mo as conversion data proves out\n   • Wk 9-12: Add Instagram at $1.5K/mo for brand awareness\n\nKill risk: Your 15% monthly growth assumption. At 10%, break-even pushes to Month 14 and requires $15K runway.", delay: 4500 },
      { type: 'user', content: "Stress test the model at 10% growth rate", delay: 5500 },
      { type: 'result', content: "✅ Sensitivity analysis complete.\n\nAt 10% growth:\n• Break-even: Month 14 (vs Month 9 at 15%)\n• Peak cash need: -$14,800 (vs -$8,200)\n• Revenue at Month 12: $6,840 (vs $9,420)\n\nRecommendation: Secure $15K runway minimum. If Month 3 growth is below 12%, pivot marketing budget from awareness to conversion channels.", delay: 7200 }
    ],
    beforeData: [
      ['Insight', 'Current Model', 'Action Needed'],
      ['Break-even', 'Month 9', ''],
      ['Peak loss', '-$8,200', ''],
      ['Best channel', '???', '']
    ],
    afterData: [
      ['Insight', 'Finding', 'Action', 'Impact'],
      ['Cash runway', '-$8.2K peak', 'Secure $10K', 'Critical'],
      ['Best CAC', 'Referral $8', 'Double budget', 'High'],
      ['Kill risk', '15% growth', 'Stress test 10%', 'Critical']
    ]
  }
];

const MiniSpreadsheet: React.FC<{ data: string[][]; highlight?: boolean }> = ({ data, highlight }) => (
  <motion.div 
    className={`bg-white rounded-xl border-2 ${highlight ? 'border-emerald-300 shadow-emerald-100/50 shadow-lg' : 'border-gray-100'} overflow-hidden text-xs transition-all duration-500`}
    animate={highlight ? { scale: [1, 1.01, 1] } : {}}
    transition={{ duration: 0.3 }}
  >
    <div className="overflow-x-auto">
      <table className="w-full">
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className={rowIdx === 0 ? 'bg-gradient-to-r from-gray-50 to-gray-100/50 font-semibold text-[#023047]' : 'hover:bg-gray-50/50 transition-colors'}>
              {row.map((cell, cellIdx) => (
                <motion.td
                  key={cellIdx}
                  initial={highlight && rowIdx > 0 && cellIdx >= data[0].length - 3 ? { backgroundColor: 'transparent' } : {}}
                  animate={highlight && rowIdx > 0 && cellIdx >= data[0].length - 3 ? { backgroundColor: 'rgb(236 253 245)' } : {}}
                  transition={{ duration: 0.5, delay: rowIdx * 0.1 }}
                  className={`px-3 py-2 border-b border-r border-gray-100/80 truncate max-w-[100px]`}
                >
                  {cell}
                </motion.td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </motion.div>
);

const ConversationMessage: React.FC<{ step: ConversationStep }> = ({ step }) => {
  if (step.type === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="flex justify-end"
      >
        <div className="bg-gradient-to-br from-[#023047] to-[#034a6e] text-white px-5 py-3 rounded-2xl rounded-br-md max-w-[80%] shadow-lg shadow-[#023047]/20">
          <p className="text-sm leading-relaxed">{step.content}</p>
        </div>
      </motion.div>
    );
  }

  if (step.type === 'agent') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="flex justify-start"
      >
        <div className="bg-white border-2 border-gray-100 text-gray-700 px-5 py-3 rounded-2xl rounded-bl-md max-w-[80%] shadow-md">
          <div className="flex items-center gap-2 text-[#209EBB] mb-2">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Sparkles size={14} />
            </motion.div>
            <span className="text-xs font-semibold uppercase tracking-wide">Agent</span>
          </div>
          <div className="whitespace-pre-line text-sm leading-relaxed">{step.content}</div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex justify-start"
    >
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 text-emerald-800 px-5 py-3 rounded-2xl max-w-[80%] shadow-md shadow-emerald-100">
        <div className="whitespace-pre-line text-sm leading-relaxed font-medium">{step.content}</div>
      </div>
    </motion.div>
  );
};

export const AgentShowcase: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState(scenarios[0]);
  const [visibleSteps, setVisibleSteps] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAfter, setShowAfter] = useState(false);

  const resetDemo = () => {
    setVisibleSteps(0);
    setIsPlaying(false);
    setShowAfter(false);
  };

  const playDemo = () => {
    resetDemo();
    setIsPlaying(true);

    activeScenario.conversation.forEach((step, idx) => {
      setTimeout(() => {
        setVisibleSteps(idx + 1);
        if (idx === activeScenario.conversation.length - 1) {
          setTimeout(() => setShowAfter(true), 500);
        }
      }, step.delay);
    });
  };

  useEffect(() => {
    resetDemo();
  }, [activeScenario]);

  return (
    <section className="py-28 px-4 bg-gradient-to-b from-white via-gray-50/50 to-white relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 dot-pattern opacity-50" />
      
      {/* Decorative blurs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#8ECAE6]/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#FFB701]/10 rounded-full blur-3xl" />
      
      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <motion.span 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="inline-block px-4 py-1.5 bg-[#209EBB]/10 text-[#209EBB] text-sm font-medium rounded-full mb-6"
          >
            Interactive Demo
          </motion.span>
          <h2 className="font-serif text-4xl md:text-5xl text-[#023047] mb-6 tracking-tight">
            See the <span className="italic gradient-text">agent</span> in action
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg leading-relaxed">
            One conversation. Multiple steps. Real results in your spreadsheet.
          </p>
        </motion.div>

        {/* Scenario Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {scenarios.map((scenario, idx) => (
            <motion.button
              key={scenario.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => setActiveScenario(scenario)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-6 py-3.5 rounded-2xl flex items-center gap-3 transition-all duration-300 font-medium ${
                activeScenario.id === scenario.id
                  ? 'bg-[#023047] text-white shadow-xl shadow-[#023047]/20'
                  : 'bg-white text-gray-600 border-2 border-gray-100 hover:border-[#209EBB]/30 hover:shadow-lg'
              }`}
            >
              <span className="text-xl">{scenario.icon}</span>
              <span>{scenario.title}</span>
            </motion.button>
          ))}
        </div>

        {/* Demo Area */}
        <motion.div
          key={activeScenario.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid md:grid-cols-2 gap-8"
        >
          {/* Conversation Panel */}
          <div className="bg-white rounded-3xl border-2 border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden hover-lift">
            <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#209EBB] to-[#8ECAE6] flex items-center justify-center">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <span className="font-semibold text-[#023047]">Agent Conversation</span>
              </div>
              <div className="flex items-center gap-2">
                {visibleSteps > 0 && (
                  <motion.button
                    whileHover={{ rotate: -180 }}
                    transition={{ duration: 0.3 }}
                    onClick={resetDemo}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <RotateCcw size={16} className="text-gray-400" />
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={playDemo}
                  disabled={isPlaying && visibleSteps < activeScenario.conversation.length}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#209EBB] to-[#8ECAE6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#209EBB]/30 transition-all disabled:opacity-50 shimmer-btn"
                >
                  <Play size={14} fill="white" />
                  {visibleSteps === 0 ? 'Play Demo' : 'Replay'}
                </motion.button>
              </div>
            </div>
            
            <div className="h-[350px] overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-white to-gray-50/30">
              {visibleSteps === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles size={48} className="mb-4 text-[#209EBB]/30" />
                  </motion.div>
                  <p className="font-medium">Click &quot;Play Demo&quot; to see the agent in action</p>
                </div>
              ) : (
                <AnimatePresence>
                  {activeScenario.conversation.slice(0, visibleSteps).map((step, idx) => (
                    <ConversationMessage key={idx} step={step} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Spreadsheet Panel */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-600">Before</span>
              </div>
              <MiniSpreadsheet data={activeScenario.beforeData} />
            </div>
            
            <div className="flex justify-center">
              <ChevronRight size={24} className="text-gray-300 rotate-90" />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-600">After</span>
                {showAfter && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
                  >
                    New columns added
                  </motion.span>
                )}
              </div>
              <MiniSpreadsheet data={activeScenario.afterData} highlight={showAfter} />
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-14 text-center"
        >
          <motion.a 
            href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex bg-gradient-to-r from-[#023047] to-[#034a6e] text-white px-10 py-5 rounded-2xl hover:shadow-2xl hover:shadow-[#023047]/30 transition-all font-semibold text-lg items-center gap-3 shimmer-btn group"
          >
            Try It With Your Data
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </motion.span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};
