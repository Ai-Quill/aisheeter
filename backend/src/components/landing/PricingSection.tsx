import React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

export const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="py-24 px-4 bg-[#F5F7FA]">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 md:mb-16 px-4">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#023047] mb-3 md:mb-4">Simple, transparent pricing</h2>
                <p className="text-gray-500 text-sm sm:text-base">Start free with 100 credits. Scale as you grow. Annual plans save 20%.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
                {/* Free Plan */}
                <motion.div 
                    whileHover={{ y: -10 }}
                    className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-gray-100 flex flex-col"
                >
                    <div className="mb-6">
                        <span className="text-gray-500 font-bold text-sm tracking-widest uppercase">Free</span>
                        <h3 className="font-serif text-4xl text-[#023047] mt-3 mb-2">$0</h3>
                        <p className="text-gray-400 text-sm">Forever free. No credit card.</p>
                    </div>
                    <ul className="space-y-3 mb-6 flex-1">
                        {[
                            { text: "100 credits/month", highlight: true },
                            { text: "BYOK (rate-limited)" },
                            { text: "Agent Mode + All 10 Skills" },
                            { text: "Basic models included" },
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                <div className={`p-1 rounded-full ${item.highlight ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                                    {item.highlight ? <Sparkles size={12} /> : <Check size={12} />}
                                </div>
                                <span className={item.highlight ? 'font-medium text-green-700' : ''}>
                                    {item.text}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <a 
                        href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition text-center block text-sm"
                    >
                        Get Started Free
                    </a>
                </motion.div>

                {/* Starter Plan */}
                <motion.div 
                    whileHover={{ y: -10 }}
                    className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-gray-100 flex flex-col"
                >
                    <div className="mb-6">
                        <span className="text-[#219EBB] font-bold text-sm tracking-widest uppercase">Starter</span>
                        <h3 className="font-serif text-4xl text-[#023047] mt-3 mb-2">$7<span className="text-lg text-gray-400 font-sans font-normal">/mo</span></h3>
                        <p className="text-gray-400 text-sm">For regular users.</p>
                    </div>
                    <ul className="space-y-3 mb-6 flex-1">
                        {[
                            { text: "1,000 credits/month", highlight: true },
                            { text: "All AI models" },
                            { text: "Sidebar agent + BYOK" },
                            { text: "5 saved prompts" },
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                <div className={`p-1 rounded-full ${item.highlight ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                                    {item.highlight ? <Sparkles size={12} /> : <Check size={12} />}
                                </div>
                                <span className={item.highlight ? 'font-medium text-green-700' : ''}>
                                    {item.text}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <a 
                        href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl border border-[#219EBB]/30 text-[#219EBB] font-medium hover:bg-[#219EBB]/5 transition text-center block text-sm"
                    >
                        Start Starter
                    </a>
                </motion.div>

                {/* Pro Plan */}
                <motion.div 
                    whileHover={{ y: -10 }}
                    className="bg-[#023047] p-6 sm:p-7 rounded-3xl shadow-xl flex flex-col relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-3">
                        <span className="bg-[#FFB701] text-[#023047] text-[10px] font-bold px-2.5 py-1 rounded-full">POPULAR</span>
                    </div>
                    
                    <div className="mb-6">
                        <span className="text-[#8ECAE6] font-bold text-sm tracking-widest uppercase">Pro</span>
                        <h3 className="font-serif text-4xl text-white mt-3 mb-2">$15<span className="text-lg text-white/50 font-sans font-normal">/mo</span></h3>
                        <p className="text-white/60 text-sm">For power users.</p>
                    </div>
                    <ul className="space-y-3 mb-6 flex-1">
                        {[
                            { text: "10,000 credits/month", highlight: true },
                            { text: "Bulk processing (500 rows)" },
                            { text: "Web search integration" },
                            { text: "Persistent conversation memory" },
                            { text: "Priority support" },
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-white/90">
                                <div className={`p-1 rounded-full ${item.highlight ? 'bg-[#FFB701] text-[#023047]' : 'bg-[#219EBB] text-white'}`}>
                                    {item.highlight ? <Sparkles size={12} /> : <Check size={12} />}
                                </div>
                                <span className={item.highlight ? 'font-medium text-[#FFB701]' : ''}>
                                    {item.text}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <a 
                        href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#219EBB] to-[#8ECAE6] text-white font-medium hover:opacity-90 transition shadow-lg text-center block text-sm"
                    >
                        Subscribe Now
                    </a>
                </motion.div>

                {/* Power Plan */}
                <motion.div 
                    whileHover={{ y: -10 }}
                    className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border-2 border-[#FFB701]/30 flex flex-col"
                >
                    <div className="mb-6">
                        <span className="text-[#FC8500] font-bold text-sm tracking-widest uppercase">Power</span>
                        <h3 className="font-serif text-4xl text-[#023047] mt-3 mb-2">$29<span className="text-lg text-gray-400 font-sans font-normal">/mo</span></h3>
                        <p className="text-gray-400 text-sm">For teams &amp; heavy use.</p>
                    </div>
                    <ul className="space-y-3 mb-6 flex-1">
                        {[
                            { text: "50,000 credits/month", highlight: true },
                            { text: "Bulk processing (10K rows)" },
                            { text: "Priority job queue" },
                            { text: "Everything in Pro" },
                            { text: "Early access to new features" },
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                <div className={`p-1 rounded-full ${item.highlight ? 'bg-[#FC8500]/10 text-[#FC8500]' : 'bg-gray-100 text-gray-600'}`}>
                                    {item.highlight ? <Sparkles size={12} /> : <Check size={12} />}
                                </div>
                                <span className={item.highlight ? 'font-medium text-[#FC8500]' : ''}>
                                    {item.text}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <a 
                        href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FC8500] to-[#FFB701] text-white font-medium hover:opacity-90 transition shadow-lg text-center block text-sm"
                    >
                        Go Power
                    </a>
                </motion.div>
            </div>

            {/* BYOK + Annual note */}
            <div className="text-center mt-8 space-y-1">
                <p className="text-gray-400 text-xs">
                    All plans support Bring Your Own Keys (BYOK) — use your own API keys for unlimited access at your own cost.
                </p>
                <p className="text-gray-400 text-xs">
                    Annual billing saves 20%. Legacy users from before Nov 2024 keep free formula access forever.
                </p>
            </div>
        </div>
    </section>
  );
};
