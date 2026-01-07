"use client";

import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';

export default function CookieBanner() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookieConsent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-96 z-[60] animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 border border-surface-border p-4 rounded-2xl shadow-xl flex items-start gap-3">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-xl text-primary shrink-0">
                    <Cookie className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium leading-tight">
                        Utilizamos apenas cookies essenciais para autenticação e segurança. Sem rastreadores.
                    </p>
                    <button
                        onClick={handleAccept}
                        className="text-xs font-bold text-primary hover:text-primary-dark hover:underline transition-colors"
                    >
                        Entendi, fechar aviso
                    </button>
                </div>
                <button
                    onClick={handleAccept}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
