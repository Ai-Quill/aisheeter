'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Sparkles, RotateCw, FileSpreadsheet, ChevronRight, Lightbulb, Zap, CheckCircle2, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ----- Types -----
interface ScenarioAction {
  text: string;
  col: string;
}

interface ScenarioRow {
  id: number;
  raw: string;
  results: string[];
}

interface Scenario {
  id: string;
  sheetName: string;
  aiPrompt: string;
  userCommand: string;
  // Step 2 — thinking
  thinkingText: string;
  thinkingDuration: number; // ms to show thinking
  // Step 3 — action plan
  actions: ScenarioAction[];
  // Skill badge & intent speed
  skillBadge: string;
  intentSpeed: string | null; // null = no cache hit shown
  // Self-correction (optional)
  selfCorrection: { attempt: string; issue: string; fix: string } | null;
  // Pattern learning (optional)
  patternLearned: string | null;
  // Grid data
  colHeaders: string[];
  colWidths: string[];
  initialData: ScenarioRow[];
  filledData: ScenarioRow[];
  resultColors: ((v: string) => string)[];
  // Status
  processedLabel: string;
  costLabel: string;
  // Suggestion
  suggestion: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'bizplan',
    sheetName: 'FrostBrew Financials',
    aiPrompt: "I see an empty sheet. Describe what you need and I'll build it.",
    userCommand: "I'm launching FrostBrew — cold brew subscription at $29/month. Build me a 12-month financial projection. 50 subscribers growing 15% monthly, COGS 40%, marketing starts at $1,500. Show me break-even and chart it.",
    thinkingText: "Planning 15-step workflow: seed data, 9 formula columns (Subs, Revenue, COGS, Marketing, OpEx, Profit, Cumulative, Margin%, Break-Even), formatting, conditional colors, 2 charts. Formulas = $0 cost.",
    thinkingDuration: 2200,
    actions: [
      { text: "Write seed data (Month + headers) to", col: "A1:A13" },
      { text: "Apply 9 formula columns to", col: "B–J" },
      { text: "Format currency + conditional colors", col: "A1:J13" },
      { text: "Create 2 charts (combo + growth)", col: "📊" },
    ],
    skillBadge: "writeData → formula × 9 → chart × 2",
    intentSpeed: null,
    selfCorrection: null,
    patternLearned: null,
    colHeaders: ["A: Month", "B: Subs", "C: Revenue", "D: COGS", "E: Marketing", "F: OpEx", "G: Profit"],
    colWidths: ["w-20", "w-14", "w-18", "w-16", "w-18", "w-16", "w-16"],
    initialData: [
      { id: 1, raw: "", results: ["", "", "", "", "", ""] },
      { id: 2, raw: "", results: ["", "", "", "", "", ""] },
      { id: 3, raw: "", results: ["", "", "", "", "", ""] },
      { id: 4, raw: "", results: ["", "", "", "", "", ""] },
    ],
    filledData: [
      { id: 1, raw: "Jan", results: ["50", "$1,450", "$580", "$1,500", "$1,130", "-$1,760"] },
      { id: 2, raw: "Feb", results: ["58", "$1,668", "$667", "$1,500", "$1,120", "-$1,619"] },
      { id: 3, raw: "Mar", results: ["66", "$1,918", "$767", "$1,500", "$1,097", "-$1,446"] },
      { id: 4, raw: "Apr", results: ["76", "$2,205", "$882", "$1,551", "$1,059", "-$1,287"] },
    ],
    resultColors: [
      () => "bg-gray-100 text-gray-700",
      () => "bg-green-50 text-green-700",
      () => "bg-red-50 text-red-600",
      () => "bg-blue-50 text-blue-700",
      () => "bg-gray-100 text-gray-700",
      (v: string) => v.startsWith("-") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700",
    ],
    processedLabel: "15 steps · 9 formulas · 2 charts",
    costLabel: "$0.003",
    suggestion: "Now plan my go-to-market with 8 channels and ad spend ROAS",
  },
  {
    id: 'formula',
    sheetName: 'FrostBrew Financials',
    aiPrompt: "💬 I see your financial model. 10 columns, 13 rows. Ready for next step.",
    userCommand: "Now help me plan the go-to-market — lay out 8 channels with realistic CAC for DTC coffee, then build an 8-week ad spend ramp. My first-month LTV is $29. Chart spend vs conversions.",
    thinkingText: "Multi-area task: GTM table at col L + ad spend below it. CPA and ROAS will be native formulas — $0 cost. Adding spend vs conversions chart.",
    thinkingDuration: 1800,
    actions: [
      { text: "Write 8 channels to", col: "L1:Q9" },
      { text: "Write 8-week ad spend to", col: "L12:S20" },
      { text: "Apply CPA + ROAS formulas", col: "Col R-S" },
      { text: "Create spend vs conversions chart", col: "📊" },
    ],
    skillBadge: "writeData × 2 → formula × 2 → chart",
    intentSpeed: null,
    selfCorrection: null,
    patternLearned: "DTC channel pricing → estimates saved",
    colHeaders: ["A: Channel", "B: Budget", "C: CAC", "D: Signups", "E: Timeline"],
    colWidths: ["w-24", "w-18", "w-16", "w-18", "w-18"],
    initialData: [
      { id: 1, raw: "", results: ["", "", "", ""] },
      { id: 2, raw: "", results: ["", "", "", ""] },
      { id: 3, raw: "", results: ["", "", "", ""] },
      { id: 4, raw: "", results: ["", "", "", ""] },
    ],
    filledData: [
      { id: 1, raw: "Instagram", results: ["$2,500", "$22", "114", "Immediate"] },
      { id: 2, raw: "Google", results: ["$2,000", "$18", "111", "2-4 weeks"] },
      { id: 3, raw: "Referral", results: ["$500", "$8", "63", "Month 2+"] },
      { id: 4, raw: "SEO", results: ["$300", "$0*", "—", "3-6 months"] },
    ],
    resultColors: [
      () => "bg-gray-100 text-gray-700",
      (v: string) => v.includes("$0") ? "bg-green-100 text-green-700" : "bg-blue-50 text-blue-700",
      () => "bg-gray-100 text-gray-700",
      (v: string) => v.includes("Immediate") ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-700",
    ],
    processedLabel: "9 tool calls · 2 tables · 1 chart",
    costLabel: "$0.004",
    suggestion: "What's my cash runway risk before break-even?",
  },
  {
    id: 'selffix',
    sheetName: 'Revenue Model',
    aiPrompt: "⚡ Pattern match: similar column types seen before (8ms)",
    userCommand: "Calculate annual revenue — multiply price × quantity for each row",
    thinkingText: "Checking column types... Price column has $ symbols and /mo suffixes — need to strip formatting first.",
    thinkingDuration: 1800,
    actions: [
      { text: "Parse currency format in", col: "Col C" },
      { text: "Calculate revenue to", col: "Col E" },
    ],
    skillBadge: "formula",
    intentSpeed: "8ms",
    selfCorrection: {
      attempt: "=C2*D2",
      issue: "Price has $ and /mo text — can't multiply",
      fix: "Strip symbols, detect monthly pricing",
    },
    patternLearned: "Currency-cleaning formula → pattern saved (accuracy: 0.95)",
    colHeaders: ["A: Product", "B: Category", "C: Price", "D: Qty", "E: Revenue"],
    colWidths: ["w-28", "w-24", "w-20", "w-16", "w-20"],
    initialData: [
      { id: 1, raw: "Widget Pro", results: ["Electronics", "$49.99", "120", ""] },
      { id: 2, raw: "CloudSync", results: ["Software", "$199/mo", "85", ""] },
      { id: 3, raw: "Nano Clip", results: ["Accessories", "$7.25", "890", ""] },
      { id: 4, raw: "DataVault", results: ["Software", "$49/mo", "320", ""] },
    ],
    filledData: [
      { id: 1, raw: "Widget Pro", results: ["Electronics", "$49.99", "120", "$5,999"] },
      { id: 2, raw: "CloudSync", results: ["Software", "$199/mo", "85", "$203K/yr"] },
      { id: 3, raw: "Nano Clip", results: ["Accessories", "$7.25", "890", "$6,453"] },
      { id: 4, raw: "DataVault", results: ["Software", "$49/mo", "320", "$188K/yr"] },
    ],
    resultColors: [
      () => "bg-gray-100 text-gray-700",
      () => "bg-gray-100 text-gray-700",
      () => "bg-gray-100 text-gray-700",
      (v: string) => v.includes("K/yr") ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700",
    ],
    processedLabel: "Self-corrected → 4 rows",
    costLabel: "$0.00",
    suggestion: "Which product is most profitable?",
  },
  {
    id: 'chain',
    sheetName: 'FrostBrew Financials',
    aiPrompt: "💬 I see 3 tables: financial model, GTM channels, ad spend plan.",
    userCommand: "Step back and be my business advisor. How much cash do I need to survive until break-even? Which channels should I double down on? Give me a 90-day launch plan.",
    thinkingText: "Cross-table analysis: reading financial model (break-even Month 9), GTM channel CACs, ad spend ROAS. Synthesizing specific recommendations with dollar amounts.",
    thinkingDuration: 2500,
    actions: [
      { text: "Analyze financial model", col: "A-J" },
      { text: "Cross-reference GTM channels", col: "L-Q" },
      { text: "Synthesize 90-day plan", col: "💡" },
    ],
    skillBadge: "analyze (cross-table)",
    intentSpeed: "12ms",
    selfCorrection: null,
    patternLearned: null,
    colHeaders: ["A: Insight", "B: Detail", "C: Action", "D: Impact"],
    colWidths: ["w-28", "flex-1", "w-28", "w-20"],
    initialData: [
      { id: 1, raw: "Cash Runway", results: ["Analyzing...", "", ""] },
      { id: 2, raw: "Best Channels", results: ["Analyzing...", "", ""] },
      { id: 3, raw: "90-Day Plan", results: ["Analyzing...", "", ""] },
      { id: 4, raw: "Kill Risk", results: ["Analyzing...", "", ""] },
    ],
    filledData: [
      { id: 1, raw: "Cash Runway", results: ["Peak loss -$8.2K Month 7", "Secure $10K runway", "Critical"] },
      { id: 2, raw: "Best Channels", results: ["Referral ($8 CAC) + Google ($18)", "Double referral budget", "High"] },
      { id: 3, raw: "90-Day Plan", results: ["Wk1-4: Referral, Wk5-8: Paid", "Allocate $4K/mo", "Medium"] },
      { id: 4, raw: "Kill Risk", results: ["15% growth rate assumption", "Stress test at 10%", "Critical"] },
    ],
    resultColors: [
      () => "bg-gray-100 text-gray-700",
      () => "bg-blue-50 text-blue-700",
      (v: string) => v === "Critical" ? "bg-red-100 text-red-700" : v === "High" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700",
    ],
    processedLabel: "Cross-table analysis",
    costLabel: "$0.005",
    suggestion: "Stress test the model at 10% growth rate",
  },
];

// ---- Sub-components ----

const ThinkingIndicator: React.FC<{ text: string; visible: boolean }> = ({ text, visible }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/60 rounded-xl p-2.5 text-[10px] text-violet-700 leading-relaxed"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
            <Brain size={10} className="text-violet-500" />
          </motion.div>
          <span className="font-bold uppercase tracking-wider text-[9px] text-violet-500">Thinking...</span>
        </div>
        <span className="text-violet-600/80 italic">{text}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

const SelfCorrectionBadge: React.FC<{ correction: Scenario['selfCorrection']; visible: boolean }> = ({ correction, visible }) => (
  <AnimatePresence>
    {visible && correction && (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-2.5 text-[10px] space-y-1"
      >
        <div className="flex items-center gap-1.5">
          <RotateCw size={10} className="text-amber-600" />
          <span className="font-bold text-amber-700 uppercase tracking-wider text-[9px]">Self-Correction</span>
        </div>
        <div className="text-red-600/80 line-through text-[9px]">Attempt 1: {correction.attempt}</div>
        <div className="text-amber-700 text-[9px]">⚠ {correction.issue}</div>
        <div className="text-green-700 font-medium text-[9px]">✓ Fix: {correction.fix}</div>
      </motion.div>
    )}
  </AnimatePresence>
);

const PatternLearnedBadge: React.FC<{ text: string | null; visible: boolean }> = ({ text, visible }) => (
  <AnimatePresence>
    {visible && text && (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/60 rounded-lg px-2.5 py-1.5 text-[9px] text-emerald-700"
      >
        <Lightbulb size={10} className="text-emerald-500 flex-shrink-0" />
        <span>📝 {text}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

export const DashboardMockup: React.FC = () => {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  // Steps: 0=idle, 1=user typing, 2=thinking, 3=self-correction (if applicable), 4=action plan, 5=results
  const [step, setStep] = useState(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[scenarioIndex];
  const hasCorrection = !!scenario.selfCorrection;

  // Auto-scroll sidebar
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [step]);

  // Animation sequence — loops through scenarios
  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>(r => { if (!cancelled) setTimeout(r, ms); });

    const runSequence = async () => {
      await wait(4500);        // idle
      if (cancelled) return;
      setStep(1);              // user typing
      await wait(2200);
      if (cancelled) return;
      setStep(2);              // thinking
      await wait(scenario.thinkingDuration);
      if (cancelled) return;
      if (hasCorrection) {
        setStep(3);            // self-correction
        await wait(2200);
        if (cancelled) return;
      }
      setStep(4);              // action plan
      await wait(2000);
      if (cancelled) return;
      setStep(5);              // results + pattern learned
      await wait(4500);
      if (cancelled) return;
      // Next scenario
      setStep(0);
      setScenarioIndex((prev) => (prev + 1) % SCENARIOS.length);
    };

    runSequence();
    return () => { cancelled = true; };
  }, [scenarioIndex]);

  const currentData = step >= 5 ? scenario.filledData : scenario.initialData;

  return (
    <div className="w-full max-w-6xl mx-auto h-[500px] sm:h-[550px] md:h-[650px] bg-white/70 backdrop-blur-xl border border-white/60 rounded-t-3xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col lg:flex-row relative group">

        {/* ---- Left Sidebar ---- */}
        <div className="w-full lg:w-72 bg-white/40 border-r lg:border-r border-b lg:border-b-0 border-white/30 flex flex-col z-20 backdrop-blur-md max-h-[200px] lg:max-h-none">
            {/* Header */}
            <div className="p-3 sm:p-4 lg:p-5 border-b border-white/30 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3 text-[#023047]">
                     <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#219EBB] rounded-lg flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
                        <FileSpreadsheet size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </div>
                    <span className="font-serif font-bold text-base sm:text-lg">AISheeter</span>
                </div>
                <div className="flex gap-1">
                    {SCENARIOS.map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === scenarioIndex ? 'bg-[#219EBB]' : 'bg-gray-300'}`} />
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 p-3 lg:p-4 flex flex-col gap-2 overflow-y-auto relative" ref={chatContainerRef}>
                <div className="space-y-2 flex-1">
                    {/* Agent greeting */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`ai-${scenario.id}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-white/80 p-2.5 rounded-2xl rounded-tl-none border border-white/50 shadow-sm text-[11px] text-gray-700 leading-relaxed"
                        >
                            {scenario.aiPrompt}
                        </motion.div>
                    </AnimatePresence>

                    {/* User command */}
                    <AnimatePresence>
                        {step >= 1 && (
                            <motion.div
                                key={`user-${scenario.id}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-[#219EBB]/20 p-2.5 rounded-2xl rounded-tr-none border border-[#219EBB]/20 text-[11px] text-[#023047] font-medium self-end ml-4 shadow-sm backdrop-blur-sm"
                            >
                                {step === 1 ? (
                                    <span className="typing-cursor">{scenario.userCommand}</span>
                                ) : (
                                    scenario.userCommand
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Intent speed badge */}
                    <AnimatePresence>
                        {step >= 2 && scenario.intentSpeed && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-1 self-start"
                            >
                                <span className="bg-[#219EBB]/10 text-[#219EBB] text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Zap size={8} />
                                    Intent: {scenario.skillBadge} · cache hit {scenario.intentSpeed}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Thinking indicator */}
                    <ThinkingIndicator text={scenario.thinkingText} visible={step === 2 || (step === 3 && !hasCorrection)} />

                    {/* Self-correction */}
                    <SelfCorrectionBadge correction={scenario.selfCorrection} visible={step === 3 && hasCorrection} />

                    {/* Action plan */}
                    <AnimatePresence>
                        {step >= 4 && (
                            <motion.div
                                key={`plan-${scenario.id}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-white/90 p-2.5 rounded-2xl rounded-tl-none border border-white/60 shadow-md text-xs w-full backdrop-blur-md"
                            >
                                <div className="flex items-center justify-between mb-1.5 border-b border-gray-100 pb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-[#023047] uppercase tracking-wider text-[9px]">Action Plan</span>
                                        <span className="bg-[#219EBB]/10 text-[#219EBB] text-[8px] font-mono px-1.5 py-0.5 rounded">{scenario.skillBadge}</span>
                                    </div>
                                    {step === 4 ? (
                                        <RotateCw size={10} className="animate-spin text-[#FFB701]" />
                                    ) : (
                                        <span className="text-green-600 font-bold text-[9px] flex items-center gap-0.5">
                                            <CheckCircle2 size={10} /> DONE
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    {scenario.actions.map((action, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                            <motion.div
                                                className={`w-2 h-2 rounded-full flex items-center justify-center ${step >= 5 ? 'bg-green-400' : step === 4 && i === 0 ? 'bg-[#FFB701] animate-pulse' : 'bg-gray-200'}`}
                                                initial={false}
                                                animate={step >= 5 ? { scale: [1, 1.3, 1] } : {}}
                                                transition={{ delay: i * 0.1 }}
                                            />
                                            <span className="text-gray-600 text-[10px]">
                                                {action.text} <span className="font-mono text-[#219EBB]">{action.col}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Pattern learned */}
                    <PatternLearnedBadge text={scenario.patternLearned} visible={step >= 5} />

                    {/* Suggestion pill */}
                    <AnimatePresence>
                        {step >= 5 && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="flex items-center gap-1.5 self-start"
                            >
                                <span className="bg-[#FFB701]/10 text-[#023047] text-[9px] font-medium px-2.5 py-1 rounded-full border border-[#FFB701]/20 flex items-center gap-1 cursor-default">
                                    <Sparkles size={9} className="text-[#FFB701]" />
                                    💡 {scenario.suggestion}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Input */}
                <div className="relative mt-1">
                    <input
                        disabled
                        className="w-full bg-white/60 border border-white/50 rounded-xl py-2 px-3 text-[11px] shadow-inner backdrop-blur-sm placeholder:text-gray-400"
                        placeholder="Tell me what to do..."
                    />
                    <div className="absolute right-2.5 top-2 text-[#FFB701]"><Sparkles size={13} /></div>
                </div>
            </div>
        </div>

        {/* ---- Right Spreadsheet Grid ---- */}
        <div className="flex-1 bg-white/30 backdrop-blur-sm flex flex-col relative overflow-hidden">
             {/* Toolbar */}
             <div className="h-10 sm:h-11 border-b border-white/30 flex items-center justify-between px-2 sm:px-4 bg-white/20">
                <div className="flex items-center gap-2 sm:gap-3">
                    <AnimatePresence mode="wait">
                        <motion.h3
                            key={scenario.sheetName}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="font-serif text-xs sm:text-sm text-[#023047] truncate max-w-[140px] sm:max-w-none"
                        >
                            {scenario.sheetName}
                        </motion.h3>
                    </AnimatePresence>
                    <span className="px-1.5 sm:px-2 py-0.5 bg-green-100/80 text-green-800 text-[8px] sm:text-[9px] rounded-full font-bold border border-green-200/50">LIVE</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-gray-400">
                    <div className="text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-0.5 sm:gap-1">
                        <span className="hidden lg:inline">Using</span>
                        <span className="font-mono text-[#219EBB] font-bold text-[8px] sm:text-[9px]">GPT-5.4 Mini</span>
                        <ChevronRight size={8} className="sm:w-[10px] sm:h-[10px]" />
                    </div>
                    <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/40 rounded-full flex items-center justify-center border border-white/40">
                        <Bot size={10} className="sm:w-3 sm:h-3" />
                    </div>
                </div>
             </div>

             {/* Grid */}
             <div className="flex-1 overflow-auto p-2 md:p-3">
                 <div className="bg-white/80 border border-white/60 shadow-sm rounded-lg overflow-hidden backdrop-blur-md">
                     {/* Header row */}
                     <div className="flex border-b border-gray-200/50 bg-gray-50/50">
                         <div className="w-7 border-r border-gray-200/50 p-1.5"></div>
                         {scenario.colHeaders.map((header, i) => (
                             <motion.div
                                key={`${scenario.id}-header-${i}`}
                                className={`${scenario.colWidths[i]} border-r border-gray-200/50 p-1.5 text-[9px] font-bold uppercase tracking-wide ${
                                    i === 0 ? 'text-gray-500' : 'text-[#219EBB]'
                                } ${i > 0 ? 'bg-[#219EBB]/5' : ''}`}
                                initial={{ opacity: i === 0 ? 1 : 0 }}
                                animate={{ opacity: i === 0 ? 1 : step >= 4 ? 1 : 0.3 }}
                             >
                                {header}
                             </motion.div>
                         ))}
                     </div>

                     {/* Data rows */}
                     {currentData.map((row, rowIdx) => (
                         <div key={`${scenario.id}-row-${row.id}`} className="flex border-b border-gray-100 last:border-0 hover:bg-white/60 transition-colors">
                             <div className="w-7 border-r border-gray-100 p-1.5 text-center text-[9px] text-gray-400 font-mono bg-gray-50/30">
                                {row.id}
                             </div>

                             <div className={`${scenario.colWidths[0]} border-r border-gray-100 p-1.5 text-[10px] text-gray-700 font-mono truncate`}>
                                 {step >= 5 || row.raw ? row.raw : (
                                   <div className="h-2 w-16 bg-gray-100 rounded" />
                                 )}
                             </div>

                             {row.results.map((result, colIdx) => (
                                 <motion.div
                                    key={`${scenario.id}-${row.id}-${colIdx}`}
                                    className={`${scenario.colWidths[colIdx + 1]} border-r border-gray-100 p-1.5 text-[9px] font-medium flex items-center ${colIdx > 0 ? 'bg-[#219EBB]/5' : ''}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: step >= 4 ? 1 : 0 }}
                                 >
                                    {step >= 5 && result ? (
                                        <motion.span
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: rowIdx * 0.08 + colIdx * 0.04 }}
                                            className={`px-1 py-0.5 rounded text-[8px] ${scenario.resultColors[colIdx](result)}`}
                                        >
                                            {result}
                                        </motion.span>
                                    ) : step >= 4 ? (
                                        <div className="h-2 w-10 bg-gray-200/50 rounded animate-pulse" />
                                    ) : null}
                                 </motion.div>
                             ))}
                         </div>
                     ))}
                 </div>
             </div>

             {/* Status bar */}
             <div className="h-7 border-t border-white/30 bg-white/20 flex items-center justify-between px-3 text-[8px] text-gray-500">
                <span>{currentData.length} rows × {scenario.colHeaders.length} cols</span>
                <span className="flex items-center gap-2">
                    {step >= 5 && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1">
                        <span className="text-green-600 font-medium">✓ {scenario.processedLabel}</span>
                        <span className="text-gray-400">·</span>
                        <span className={`font-mono font-bold ${scenario.costLabel === '$0.00' ? 'text-emerald-600' : 'text-gray-500'}`}>
                          Cost: {scenario.costLabel}
                        </span>
                      </motion.span>
                    )}
                    {(step === 2 || step === 3 || step === 4) && (
                      <span className="text-[#FFB701] font-medium animate-pulse">
                        {step === 2 ? 'Thinking...' : step === 3 ? 'Self-correcting...' : 'Processing...'}
                      </span>
                    )}
                </span>
             </div>
        </div>
    </div>
  );
};
