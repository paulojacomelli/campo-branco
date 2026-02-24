"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { ArrowLeft } from "lucide-react";
import { useRouter } from 'next/navigation';
import ActionCenter, { IdleTerritory } from "@/app/components/Dashboard/ActionCenter";

export default function NotificationsPage() {
    const { user, role, isElder, isServant, congregationId, loading, profileName } = useAuth();
    const router = useRouter();

    // State mirroring Dashboard
    const [pendingMapsCount, setPendingMapsCount] = useState(0);
    const [idleTerritories, setIdleTerritories] = useState<{ id: string; name: string; city: string; lastVisit?: any }[]>([]);
    const [cityCompletion, setCityCompletion] = useState<{ cityName: string; percentage: number } | undefined>();
    const [expiringMaps, setExpiringMaps] = useState<{ id: string, title: string, daysLeft: number }[]>([]);

    // 1. Fetch User Assignments (Pending & Expiring)
    useEffect(() => {
        if (!user) return;
        const fetchAssignments = async () => {
            try {
                const { data: lists, error } = await supabase
                    .from('shared_lists')
                    .select('*')
                    .eq('assigned_to', user.id)
                    .not('status', 'in', '(\'completed\',\'archived\')');

                if (error) throw error;
                if (!lists) return;

                setPendingMapsCount(lists.length);

                const expiring = lists.filter(l => {
                    if (!l.expires_at) return false;
                    const expires = new Date(l.expires_at);
                    const now = new Date();
                    const diffMs = expires.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    return diffDays > 0 && diffDays <= 10;
                }).map(l => {
                    const expires = new Date(l.expires_at);
                    const now = new Date();
                    const diffMs = expires.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    return {
                        id: l.id,
                        title: l.title || "Cartão de Território",
                        daysLeft: diffDays
                    };
                });
                setExpiringMaps(expiring);
            } catch (e) { console.error(e); }
        };
        fetchAssignments();
    }, [user]);

    // 2. Fetch Idle Territories & Stats (Simplified for notifications)
    useEffect(() => {
        if (!congregationId && role !== 'SUPER_ADMIN') return;

        const fetchIdleAndCompletion = async () => {
            try {
                const isGlobal = role === 'SUPER_ADMIN';

                // Fetch Territories
                let terrQuery = supabase.from('territories').select('*');
                if (!isGlobal) terrQuery = terrQuery.eq('congregation_id', congregationId);
                const { data: territories, error: terrError } = await terrQuery;

                if (terrError) throw terrError;
                const mapsCount = territories?.length || 0;

                if (mapsCount > 0 && territories) {
                    // 1. Get ALL shared lists history
                    let historyQuery = supabase.from('shared_lists').select('*');
                    if (!isGlobal) historyQuery = historyQuery.eq('congregation_id', congregationId);
                    const { data: history, error: histError } = await historyQuery;

                    if (histError) throw histError;

                    // Map History Dates
                    const latestActivityMap = new Map<string, number>();
                    const workedMapIds = new Set<string>();

                    history?.forEach(item => {
                        const datesToCheck: number[] = [];
                        if (item.created_at) datesToCheck.push(new Date(item.created_at).getTime());
                        if (item.returned_at) datesToCheck.push(new Date(item.returned_at).getTime());

                        const maxDate = datesToCheck.length > 0 ? Math.max(...datesToCheck) : 0;

                        const updateMap = (id: string) => {
                            const current = latestActivityMap.get(id) || 0;
                            if (maxDate > current) latestActivityMap.set(id, maxDate);
                        };

                        // Support both single territory and collections (items array)
                        if (item.territory_id) updateMap(item.territory_id);
                        if (item.items && Array.isArray(item.items)) {
                            item.items.forEach((id: string) => updateMap(id));
                        }

                        if (item.status === 'completed') {
                            if (item.territory_id) workedMapIds.add(item.territory_id);
                            if (item.items && Array.isArray(item.items)) {
                                item.items.forEach((id: string) => workedMapIds.add(id));
                            }
                        }
                    });

                    // Fetch Cities for names
                    let citiesQuery = supabase.from('cities').select('id, name');
                    if (!isGlobal) citiesQuery = citiesQuery.eq('congregation_id', congregationId);
                    const { data: cities } = await citiesQuery;
                    const cityMap: Record<string, string> = {};
                    cities?.forEach(c => { if (c.name) cityMap[c.id] = c.name; });

                    const now = new Date();
                    const oneYearAgo = new Date();
                    oneYearAgo.setFullYear(now.getFullYear() - 1);

                    const idleList: any[] = [];

                    territories.forEach(t => {
                        if (t.status === 'ASSIGNED' || t.status === 'OCUPADO') return;

                        const historyActivity = latestActivityMap.get(t.id) || 0;
                        const lastActivityDate = historyActivity > 0 ? new Date(historyActivity) : null;
                        const cityName = cityMap[t.city_id] || t.city || 'Cidade Desconhecida';

                        if (!lastActivityDate) {
                            idleList.push({
                                id: t.id,
                                name: t.name || 'Sem Nome',
                                description: t.notes || '',
                                city: cityName,
                                cityId: t.city_id,
                                congregationId: t.congregation_id,
                                lastVisit: null,
                                variant: 'danger'
                            });
                        } else if (lastActivityDate < oneYearAgo) {
                            idleList.push({
                                id: t.id,
                                name: t.name || 'Sem Nome',
                                description: t.notes || '',
                                city: cityName,
                                cityId: t.city_id,
                                congregationId: t.congregation_id,
                                lastVisit: lastActivityDate,
                                variant: 'warning'
                            });
                        }
                    });

                    idleList.sort((a, b) => {
                        if (!a.lastVisit && !b.lastVisit) return 0;
                        if (!a.lastVisit) return -1;
                        if (!b.lastVisit) return 1;
                        return a.lastVisit.getTime() - b.lastVisit.getTime();
                    });
                    setIdleTerritories(idleList);

                    const coverageVal = (workedMapIds.size / mapsCount) * 100;
                    if (coverageVal >= 100) {
                        setCityCompletion({ cityName: "Território Completo", percentage: 100 });
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };

        if (isElder || isServant || role === 'SUPER_ADMIN') {
            fetchIdleAndCompletion();
        }
    }, [congregationId, role, isElder, isServant]);

    const handleQuickAssign = async (territory: IdleTerritory) => {
        router.push(`/share-setup?ids=${territory.id}&returnUrl=/notifications`);
    };

    if (loading) return null;

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main">
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-main" />
                </button>
                <h1 className="font-bold text-lg text-main tracking-tight">Todas as Notificações</h1>
            </header>

            <main className="px-6 py-6 max-w-xl mx-auto">
                <ActionCenter
                    userName={profileName || 'Publicador'}
                    pendingMapsCount={pendingMapsCount}
                    hasPendingAnnotation={false}
                    idleTerritories={isElder || isServant || role === 'SUPER_ADMIN' ? idleTerritories : []}
                    cityCompletion={cityCompletion}
                    expiringMaps={expiringMaps}
                    onAssignTerritory={handleQuickAssign}
                // No limit here
                />
            </main>
        </div>
    );
}
