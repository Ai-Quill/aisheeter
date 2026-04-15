import React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap } from 'lucide-react';

export const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="py-24 px-4 bg-[#F5F7FA]">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 md:mb-16 px-4">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#023047] mb-3 md:mb-4">Simple, transparent pricing</h2>
                <p className="text-gray-500 text-sm sm:text-base">Start free with 100 AI credits. Upgrade when you need more.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Free Plan */}
                <motion.div 
                    whileHover={{ y: -8 }}
                    className="bg-white p-7 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col"
                >
                    <div className="mb-6">
                        <span className="text-gray-500 font-bold text-sm tracking-widest uppercase">Free</span>
                        <h3 className="font-serif text-5xl text-[#023047] mt-3 mb-2">$0</h3>
                        <p className="text-gray-400 text-sm">Forever free. No credit card.</p>
                    </div>
                    <ul className="space-y-3.5 mb-8 flex-1">
                        {[
                            { text: "100 AI credits/month", highlight: true },
                            { text: "600 BYOK requests/month" },
                            { text: "Agent Mode + All Skills" },
                            { text: "Mini AI models (GPT-5 Mini, Flash, Haiku)" },
                            { text: "All features included" },
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                <div className={`p-1 rounded-full shrink-0 ${item.highlight ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
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
                        className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition text-center block text-sm"
                    >
                        Get Started Free
                    </a>
                </motion.div>

                {/* Pro Plan */}
                <motion.div 
                    whileHover={{ y: -8 }}
                    className="bg-[#023047] p-7 sm:p-8 rounded-3xl shadow-xl flex flex-col relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-3">
                        <span className="bg-[#FFB701] text-[#023047] text-[10px] font-bold px-2.5 py-1 rounded-full">BEST VALUE</span>
                    </div>
                    
                    <div className="mb-6">
                        <span className="text-[#8ECAE6] font-bold text-sm tracking-widest uppercase">Pro</span>
                        <h3 className="font-serif text-5xl text-white mt-3 mb-2">$14.99<span className="text-lg text-white/50 font-sans font-normal">/mo</span></h3>
                        <p className="text-white/60 text-sm">For serious spreadsheet users.</p>
                    </div>
                    <ul className="space-y-3.5 mb-8 flex-1">
                        {[
                            { text: "1,000 AI credits/month", highlight: true },
                            { text: "Unlimited BYOK requests" },
                            { text: "All AI models (GPT-5, Sonnet 4.5, Gemini Pro)" },
                            { text: "Persistent conversation memory" },
                            { text: "Priority support" },
                            { text: "Early access to new features" },
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-white/90">
                                <div className={`p-1 rounded-full shrink-0 ${item.highlight ? 'bg-[#FFB701] text-[#023047]' : 'bg-[#219EBB] text-white'}`}>
                                    {item.highlight ? <Zap size={12} /> : <Check size={12} />}
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
                        className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#219EBB] to-[#8ECAE6] text-white font-medium hover:opacity-90 transition shadow-lg text-center block text-sm"
                    >
                        Subscribe Now
                    </a>
                </motion.div>
            </div>

            <div className="text-center mt-8 space-y-1">
                <p className="text-gray-400 text-xs">
                    All plans support Bring Your Own Keys (BYOK) — use your own API keys for access at your own cost.
                </p>
                <p className="text-gray-400 text-xs">
                    Legacy users from before Nov 2024 keep unlimited BYOK access forever.
                </p>
            </div>
        </div>
    </section>
  );
};
