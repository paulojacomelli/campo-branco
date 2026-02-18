"use client";

import { useState, useEffect } from 'react';
import useFCM from '../hooks/useFCM';
import { Bell, X, CheckCircle2 } from 'lucide-react';

export default function NotificationOnboardingModal() {
    const [isVisible, setIsVisible] = useState(false);
    // Don't listen, just check/request permission
    const { permission, requestPermission } = useFCM({ withListener: false });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkVisibility = () => {
            // 1. Check if already seen forever
            const hasSeen = localStorage.getItem('notification_onboarding_seen');
            if (hasSeen) return;

            // 2. Check Permission status
            // Only show if 'default'
            if (permission === 'default') {
                setIsVisible(true);
            }
        };

        // Show after a small delay to not overwhelm immediate page load
        const timer = setTimeout(checkVisibility, 3500);
        return () => clearTimeout(timer);
    }, [permission]);

    const handleEnable = async () => {
        try {
            // Mark as seen immediately
            localStorage.setItem('notification_onboarding_seen', 'true');
            await requestPermission();
            setIsVisible(false);
        } catch (e) {
            console.error("Error prompting push", e);
            alert("Não foi possível ativar. Verifique as permissões do navegador.");
        }
    };

    const handleDismiss = () => {
        localStorage.setItem('notification_onboarding_seen', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-500">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative animate-in zoom-in-95 duration-500">
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-gray-500 transition-colors rounded-full hover:bg-gray-100"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center space-y-6">
                    <div className="w-20 h-20 bg-primary-light/50 rounded-full flex items-center justify-center mx-auto animate-in bounce-in duration-1000">
                        <Bell className="w-10 h-10 text-primary" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-gray-900">Não perca nada!</h2>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Receba notificações sobre suas designações.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleEnable}
                            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-lg shadow-lg shadow-primary-light/500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 className="w-5 h-5" />
                            Ativar Notificações
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="w-full bg-white hover:bg-gray-50 text-gray-400 font-bold py-3 rounded-lg transition-colors text-sm"
                        >
                            Talvez depois
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
