
"use client";

import { useState, useCallback } from "react";

/**
 * Stub para o hook useFCM.
 * O Firebase foi removido e as notificações Push precisam ser migradas para o Supabase Edge Functions ou similares.
 * Por hora, este hook retorna um estado desativado para não quebrar a build.
 */
export default function useFCM({ withListener = true } = {}) {
    const [token] = useState<string | null>(null);
    const [permission] = useState<NotificationPermission>('default');

    const requestPermission = useCallback(async () => {
        console.log("FCM is currently disabled during migration to Supabase.");
        return 'default';
    }, []);

    return { token, permission, requestPermission };
}
