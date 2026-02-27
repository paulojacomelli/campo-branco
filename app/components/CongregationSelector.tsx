"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown } from 'lucide-react';

interface Congregation {
    id: string;
    name: string;
}

interface CongregationSelectorProps {
    currentId?: string;
    className?: string;
}

export default function CongregationSelector({ currentId, className = '' }: CongregationSelectorProps) {
    const router = useRouter();
    const [congregations, setCongregations] = useState<Congregation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'congregations'), orderBy('name', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name
            })) as Congregation[];
            setCongregations(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching congregations:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleChange = (newId: string) => {
        if (!newId) return;
        router.push(`/my-maps/${newId}`);
    };

    if (loading) return <div className="animate-pulse w-32 h-8 bg-gray-200 rounded-lg"></div>;

    return (
        <div className={`relative group ${className}`}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 className="h-4 w-4 text-primary" />
            </div>
            <select
                value={currentId || ''}
                onChange={(e) => handleChange(e.target.value)}
                className="appearance-none bg-primary-light/50 hover:bg-primary-light dark:bg-blue-900/20 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-800 text-blue-900 dark:text-blue-300 text-xs font-bold py-2 pl-9 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-colors w-full min-w-[180px]"
            >
                <option value="" disabled className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">Selecione a Congregação</option>
                {congregations.map((cong) => (
                    <option key={cong.id} value={cong.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                        {cong.name}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-primary">
                <ChevronDown className="h-4 w-4" />
            </div>
        </div>
    );
}
