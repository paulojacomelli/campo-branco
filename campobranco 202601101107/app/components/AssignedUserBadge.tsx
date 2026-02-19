"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
                // We utilize Firestore cache by default, so repetitive fetches for same user are cheap
                const snap = await getDoc(doc(db, "users", userId));
                if (isMounted && snap.exists()) {
                    const data = snap.data();
                    if (data.name) {
                        setDisplayName(data.name.split(' ')[0].toUpperCase());
                    }
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
