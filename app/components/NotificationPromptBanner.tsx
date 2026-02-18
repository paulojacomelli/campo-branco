"use client";

import { useState, useEffect } from 'react';
import useFCM from '../hooks/useFCM';
import { Bell, X } from 'lucide-react';

export default function NotificationPromptBanner() {
    const [isVisible, setIsVisible] = useState(false);
    // Don't enable listener here to avoid duplicates
    const { permission, requestPermission } = useFCM({ withListener: false });

    // Constants
    const STORAGE_KEY_DISMISSED = 'fcm_banner_dismissed';

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkVisibility = () => {
            // 1. Check if dismissed in this session
            const isDismissed = sessionStorage.getItem(STORAGE_KEY_DISMISSED);
            if (isDismissed) return;

            // 2. Check permission state
            // Only show if 'default' (not granted and not denied)
            if (permission === 'default') {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        const timer = setTimeout(checkVisibility, 2000);
        return () => clearTimeout(timer);
    }, [permission]);

    const handleEnable = async () => {
        await requestPermission();
        // UI update is reactive to 'permission' state change in hook
    };

    const handleDismiss = () => {
        sessionStorage.setItem(STORAGE_KEY_DISMISSED, 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="bg-primary dark:bg-primary-dark text-white p-4 rounded-lg shadow-lg shadow-primary-light/20 dark:shadow-primary-dark/20 mb-6 flex items-center justify-between gap-4 animate-in slide-in-from-top-4 fade-in duration-700">
            <div className="flex items-center gap-4">
                <div className="bg-white/20 p-2 rounded-md shrink-0">
                    <Bell className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-sm md:text-base">Ative as Notificações</h3>
                    <p className="text-xs md:text-sm text-primary-light leading-tight mt-0.5">
                        Receba notificações sobre suas designações.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={handleDismiss}
                    className="text-xs font-bold text-primary-light hover:text-white px-3 py-2 transition-colors uppercase tracking-wider"
                >
                    Agora não
                </button>
                <button
                    onClick={handleEnable}
                    className="bg-white text-primary hover:bg-primary-light text-xs font-black py-2 px-4 rounded-md shadow-sm transition-all active:scale-95 uppercase tracking-wider"
                >
                    Ativar
                </button>
            </div>
        </div>
    );
}
