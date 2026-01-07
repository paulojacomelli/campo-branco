"use client";

import { useEffect, useState } from 'react';
import useFCM from '../hooks/useFCM';
import { Loader2 } from 'lucide-react';

export default function NotificationToggle() {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    // Don't modify permission state or listen on mount, just check
    const { permission, requestPermission } = useFCM({ withListener: false });

    useEffect(() => {
        // Sync 'enabled' state with 'permission'
        // In web push, 'granted' usually means enabled for the origin.
        if (typeof window !== 'undefined') {
            setEnabled(permission === 'granted');
            setLoading(false);
        }
    }, [permission]);

    const toggle = async () => {
        setLoading(true);
        try {
            if (enabled) {
                // Browsers don't allow programmatically revoking permission easily via JS api
                // We can only guide user to settings or just pretend we disabled it in our UI context
                // But for now, let's alert user or just do nothing?
                // Actually, standard pattern is to show "Enabled" and maybe allow "Disable" by clearing token?
                // But permission remains 'granted'.
                // Let's just alert for now as reverting 'granted' is specific.
                alert("Para desativar notificações, você deve alterar as permissões no seu navegador (clique no cadeado ao lado da URL).");
            } else {
                await requestPermission();
            }
        } catch (e) {
            console.error("Error toggling subscription", e);
            alert("Erro ao alterar notificação. Verifique permissões do navegador.");
        } finally {
            setLoading(false);
        }
    };

    if (loading && permission === 'default') return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />;

    return (
        <button
            onClick={toggle}
            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2  focus-visible:ring-white focus-visible:ring-opacity-75 ${enabled ? 'bg-primary' : 'bg-gray-200'
                }`}
        >
            <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
            />
        </button>
    );
}
