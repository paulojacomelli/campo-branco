"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AssignedUserBadgeProps {
    userId: string;
    fallbackName: string;
}

export default function AssignedUserBadge({ userId, fallbackName }: AssignedUserBadgeProps) {
    // Initial state derived from fallback to show something immediately
    const [displayName, setDisplayName] = useState(() => {
        return (fallbackName || '???').split(' ')[0].toUpperCase();
    });

    useEffect(() => {
        if (!userId) return;

        let isMounted = true;
        const fetchName = async () => {
            try {
                // We utilize Supabase cache/query
                const { data } = await supabase
                    .from('users')
                    .select('name')
                    .eq('id', userId)
                    .single();

                if (isMounted && data && data.name) {
                    setDisplayName(data.name.split(' ')[0].toUpperCase());
                }
            } catch (e) {
                console.warn("Error fetching badge name", e);
            }
        };

        fetchName();

        return () => { isMounted = false; };
    }, [userId]);

    return <>{displayName}</>;
}
