"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, HelpCircle, Info, Lightbulb, CheckCircle2 } from "lucide-react";

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    steps?: { title: string; text: string }[];
    tips?: string[];
}

export default function HelpModal({ isOpen, onClose, title, description, steps, tips }: HelpModalProps) {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isOpen || !isMounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface rounded-lg w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-start mb-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-light/50 dark:bg-blue-900/30 p-2.5 rounded-lg text-primary dark:text-blue-400">
                            <HelpCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-main leading-tight">{title}</h2>
                            <p className="text-xs text-primary dark:text-blue-400 font-bold uppercase tracking-wider">Ajuda e Guia</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-background rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    <div className="bg-background p-4 rounded-lg border border-surface-border italic text-muted text-sm leading-relaxed">
                        &quot;{description}&quot;
                    </div>

                    {steps && steps.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-main text-sm flex items-center gap-2">
                                <Info className="w-4 h-4 text-primary-light/500" />
                                O que você pode fazer aqui:
                            </h3>
                            <div className="space-y-3">
                                {steps.map((step, i) => (
                                    <div key={i} className="flex gap-3">
                                        <div className="shrink-0 w-6 h-6 bg-primary-light dark:bg-blue-900/50 text-primary-dark dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-black">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-main text-sm leading-tight mb-0.5">{step.title}</p>
                                            <p className="text-muted text-xs leading-relaxed">{step.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tips && tips.length > 0 && (
                        <div className="space-y-3 pt-2">
                            <h3 className="font-bold text-main text-sm flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-amber-500" />
                                Dicas Importantes:
                            </h3>
                            <div className="space-y-2">
                                {tips.map((tip, i) => (
                                    <div key={i} className="flex gap-2 items-start bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100/50 dark:border-amber-900/20">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                        <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">{tip}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full bg-gray-100 dark:bg-surface-highlight hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-900 dark:text-main font-bold py-4 rounded-lg shadow-lg transition-all active:scale-95 border border-transparent dark:border-surface-border"
                    >
                        Entendi
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
