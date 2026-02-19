"use client";

import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Building2, ChevronRight, Search, Store } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import BottomNav from '@/app/components/BottomNav';

interface Congregation {
    id: string;
    name: string;
}

export default function WitnessingPage() {
    const { user, congregationId, isSuperAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [congregations, setCongregations] = useState<Congregation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            router.push('/login');
            return;
        }

        // If not super admin, redirect to their congregation
        if (!isSuperAdmin && congregationId) {
            router.push(`/witnessing/congregation?congregationId=${congregationId}`);
            return;
        }

        // If Super Admin (or no congregation assigned), load list
        if (isSuperAdmin) {
            const q = query(collection(db, "congregations"), orderBy("name"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data: Congregation[] = [];
                snapshot.forEach((doc) => {
                    data.push({ id: doc.id, ...doc.data() } as Congregation);
                });
                setCongregations(data);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            setLoading(false);
        }

    }, [user, congregationId, isSuperAdmin, authLoading, router]);

    const filteredCongregations = congregations.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (authLoading || (isSuperAdmin && loading)) {
        return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!isSuperAdmin && !congregationId) {
        return (
            <div className="bg-background min-h-screen flex flex-col items-center justify-center p-6 text-center">
                <Store className="w-16 h-16 text-muted mb-4" />
                <h1 className="text-xl font-bold text-main mb-2">Acesso Restrito</h1>
                <p className="text-muted">Você não está associado a nenhuma congregação.</p>
                <BottomNav />
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main">
            {/* Header */}
            <div className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-500 p-2 rounded-xl text-white shadow-amber-200 shadow-md">
                        <Store className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-main tracking-tight block leading-tight">Testemunho Público</h1>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Selecione uma Congregação</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="px-6 pt-6 pb-2">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-amber-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border-0 text-main text-sm font-medium rounded-2xl py-4 pl-12 pr-4 shadow-[0_4px_30px_rgba(0,0,0,0.03)] focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all placeholder:text-muted"
                    />
                </div>
            </div>

            <main className="px-6 py-4 max-w-xl mx-auto space-y-3">
                {filteredCongregations.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <p className="text-gray-400 font-medium">Nenhuma congregação encontrada.</p>
                    </div>
                ) : (
                    filteredCongregations.map(cong => (
                        <Link
                            key={cong.id}
                            href={`/witnessing/congregation?congregationId=${cong.id}`}
                            className="block bg-surface rounded-2xl p-4 border border-surface-border shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-primary-light/50 dark:bg-blue-900/30 text-primary dark:text-blue-400 p-3 rounded-xl">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-bold text-main text-base">{cong.name}</h3>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted" />
                            </div>
                        </Link>
                    ))
                )}
            </main>

            <BottomNav />
        </div>
    );
}
