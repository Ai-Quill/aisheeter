'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, MessageSquare, Shield, Workflow, Sliders, BrainCircuit, Sparkles, History, BarChart3, Eye, RefreshCw, Lightbulb } from 'lucide-react';

const features = [
  {
    title: "10 Specialized Skills",
    description: "Format, chart, formula, filter, validation, conditional formatting, sheet ops, data writing, analysis & chat — each skill optimized with expert-level instructions.",
    icon: <BrainCircuit size={24} className="text-[#FFB701]" />,
    color: "bg-[#FFB701]",
    colSpan: "md:col-span-1",
    tag: "Core"
  },
  {
    title: "Thinking & Reasoning",
    description: "See the model's thought process with progressive disclosure. GPT-5.4, o3, o4-mini reasoning models with transparent thinking indicators.",
    icon: <Lightbulb size={24} className="text-violet-500" />,
    color: "bg-violet-500",
    colSpan: "md:col-span-1",
    tag: "New"
  },
  {
    title: "Multi-Step Task Chains",
    description: "One command executes multiple steps. Extract → Score → Chart in a single conversation. The agent decides which tools to call.",
    icon: <Workflow size={24} className="text-[#209EBB]" />,
    color: "bg-[#209EBB]",
    colSpan: "md:col-span-1",
    tag: "Unique"
  },
  {
    title: "Self-Correcting Agent",
    description: "Evaluator-optimizer pattern catches wrong column refs, missing fields, and illogical params — then retries automatically before execution.",
    icon: <RefreshCw size={24} className="text-teal-500" />,
    color: "bg-teal-500",
    colSpan: "md:col-span-1",
    tag: "New"
  },
  {
    title: "Conversation Memory",
    description: "Session memory, workflow memory with pgvector semantic search, and learning loops. Builds on successful past commands automatically.",
    icon: <History size={24} className="text-[#FC8500]" />,
    color: "bg-[#FC8500]",
    colSpan: "md:col-span-1",
    tag: "Unique"
  },
  {
    title: "Intent Learning",
    description: "Embedding-based classification that gets smarter over time. Cache hits resolve in ~10ms. Every successful command improves future accuracy.",
    icon: <Eye size={24} className="text-indigo-500" />,
    color: "bg-indigo-500",
    colSpan: "md:col-span-1",
    tag: "New"
  },
  {
    title: "Formula First (FREE)",
    description: "AI uses native Google Sheets formulas when possible — instant results with zero AI cost. Knows when NOT to use AI.",
    icon: <Zap size={24} className="text-emerald-500" />,
    color: "bg-emerald-500",
    colSpan: "md:col-span-1"
  },
  {
    title: "Deep Context Awareness",
    description: "AI understands your headers, data types, sample values, row counts, and empty columns — derives exact cell references automatically.",
    icon: <Sliders size={24} className="text-[#8ECAE6]" />,
    color: "bg-[#8ECAE6]",
    colSpan: "md:col-span-1"
  },
  {
    title: "Smart Suggestions",
    description: "After completing tasks, suggests logical next steps based on your data. One-click execution for each suggestion.",
    icon: <Sparkles size={24} className="text-purple-500" />,
    color: "bg-purple-500",
    colSpan: "md:col-span-1",
    tag: "Unique"
  },
  {
    title: "5+ AI Providers (BYOK)",
    description: "GPT-5.4, Claude Sonnet 4.5, Gemini 2.5, Groq, DeepSeek. Bring your own API keys with zero markup. Switch models per task.",
    icon: <BarChart3 size={24} className="text-amber-500" />,
    color: "bg-amber-500",
    colSpan: "md:col-span-1"
  },
  {
    title: "Data Security",
    description: "Your API keys encrypted with AES. No training on your content. Server-side prompts never exposed to client.",
    icon: <Shield size={24} className="text-[#023047]" />,
    color: "bg-[#023047]",
    colSpan: "md:col-span-1"
  },
  {
    title: "Natural Conversation",
    description: "Fuzzy column matching, task type inference, and intent classification. Say \"Revenue\" when the column is \"Sales\" — it just works.",
    icon: <MessageSquare size={24} className="text-rose-500" />,
    color: "bg-rose-500",
    colSpan: "md:col-span-1"
  }
];

export const FeatureGrid: React.FC = () => {
  return (
    <section id="features" className="py-28 px-4 max-w-7xl mx-auto relative">
        {/* Subtle background accents */}
        <div className="absolute top-20 right-0 w-96 h-96 bg-[#8ECAE6]/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-20 left-0 w-72 h-72 bg-[#FFB701]/10 rounded-full blur-3xl -z-10" />
        
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
        >
            <motion.span 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="inline-block px-4 py-1.5 bg-[#023047]/5 text-[#023047] text-sm font-medium rounded-full mb-6"
            >
              Agent Capabilities
            </motion.span>
            <h2 className="font-serif text-4xl md:text-5xl text-[#023047] mb-6 tracking-tight">
                An agent that <br />
                <span className="italic gradient-text">thinks before it acts</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg leading-relaxed">
                10 specialized skills. Self-correcting reasoning. Conversation memory that learns. A true intelligent agent — not a formula wrapper.
            </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {features.map((feature, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.08 }}
                    whileHover={{ y: -6, scale: 1.01 }}
                    className={`bg-white rounded-3xl p-7 shadow-lg shadow-gray-200/50 border-2 border-gray-100 flex flex-col justify-between hover:shadow-xl hover:border-[#209EBB]/20 transition-all duration-300 group ${feature.colSpan}`}
                >
                    <div>
                        <div className="flex items-center justify-between mb-5">
                            <div className={`w-12 h-12 rounded-2xl ${feature.color} bg-opacity-10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                {feature.icon}
                            </div>
                            {feature.tag && (
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${
                                    feature.tag === 'Unique' ? 'bg-gradient-to-r from-[#FC8500]/10 to-[#FFB701]/10 text-[#FC8500]' :
                                    feature.tag === 'New' ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {feature.tag}
                                </span>
                            )}
                        </div>
                        
                        <h3 className="font-serif text-xl text-[#023047] mb-3 group-hover:text-[#209EBB] transition-colors">{feature.title}</h3>
                        <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    </section>
  );
};
