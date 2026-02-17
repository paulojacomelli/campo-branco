"use client";

import { useState, useEffect, Suspense } from 'react';
import {
    Map as MapIcon,
    Search,
    Loader2,
    Store,
    ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import BottomNav from '@/app/components/BottomNav';

interface City {
    id: string;
    name: string;
    uf: string;
    congregation_id: string; // Note: snake_case from Supabase
}

function WitnessingCityListContent() {
    const searchParams = useSearchParams();
    const congregationId = searchParams.get('congregationId');
    const { loading: authLoading } = useAuth();
    const [cities, setCities] = useState<City[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!congregationId) {
            setLoading(false);
            return;
        }

        const fetchCities = async () => {
            const { data, error } = await supabase
                .from('cities')
                .select('*')
                .eq('congregation_id', congregationId)
                .order('name');

            if (data) {
                setCities(data);
            }
            if (error) {
                console.error("Error fetching cities:", error);
            }
            setLoading(false);
        };

        fetchCities();

        const subscription = supabase
            .channel(`cities:congrgation=${congregationId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'cities',
                filter: `congregation_id=eq.${congregationId}`
            }, (payload) => {
                fetchCities();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [congregationId]);

    const filteredCities = cities.filter(city =>
        city.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!congregationId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <p>Congregação não especificada.</p>
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main">
            {/* Header */}
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-500 p-2 rounded-xl text-white shadow-md">
                        <Store className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                        <span className="font-bold text-lg text-main tracking-tight block leading-tight">Cidades</span>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-widest block">Selecione para T. Público</span>
                    </div>
                </div>
            </header>

            {/* Search */}
            <div className="px-6 pt-6 pb-2">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-amber-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar cidade..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border-0 text-main text-sm font-medium rounded-2xl py-4 pl-12 pr-4 shadow-[0_4px_30px_rgba(0,0,0,0.03)] focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all placeholder:text-muted"
                    />
                </div>
            </div>

            {/* List */}
            <main className="px-6 py-4 space-y-3">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    </div>
                ) : filteredCities.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <MapIcon className="w-12 h-12 mx-auto mb-3 text-muted" />
                        <p className="text-muted font-medium">Nenhuma cidade encontrada</p>
                    </div>
                ) : (
                    filteredCities.map(city => (
                        <Link
                            key={city.id}
                            href={`/witnessing/city?congregationId=${congregationId}&cityId=${city.id}`}
                            className="group bg-surface rounded-2xl p-4 border border-surface-border shadow-sm hover:shadow-md transition-all flex items-center gap-4"
                        >
                            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                                <Store className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-main text-base truncate">{city.name}</h3>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">VER PONTOS</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted group-hover:text-amber-500 transition-colors" />
                        </Link>
                    ))
                )}
            </main>

            <BottomNav />
        </div>
    );
}

export default function WitnessingCityList() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <WitnessingCityListContent />
        </Suspense>
    );
}
