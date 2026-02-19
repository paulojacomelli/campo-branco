"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { collection, query, where, getDocs, collectionGroup, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
                const q = query(
                    collection(db, "shared_lists"),
                    where("assignedTo", "==", user.uid)
                );
                const snap = await getDocs(q);
                const lists: any[] = [];
                snap.forEach(d => {
                    const data = d.data();
                    if (data.status !== 'completed' && data.status !== 'archived') {
                        lists.push({ id: d.id, ...data });
                    }
                });

                setPendingMapsCount(lists.length);

                const expiring = lists.filter(l => {
                    if (!l.expiresAt) return false;
                    const expires = new Date(l.expiresAt.seconds * 1000);
                    const now = new Date();
                    const diffMs = expires.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    return diffDays > 0 && diffDays <= 10;
                }).map(l => {
                    const expires = new Date(l.expiresAt.seconds * 1000);
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
                // City Completion Setup
                // Need total maps vs completed maps
                const isGlobal = role === 'SUPER_ADMIN';

                // Fetch Territory Count (All if SuperAdmin)
                const terrQuery = isGlobal
                    ? collection(db, "territories")
                    : query(collection(db, "territories"), where("congregationId", "==", congregationId));
                const terrSnap = await getDocs(terrQuery);
                const mapsCount = terrSnap.size;

                if (mapsCount > 0) {
                    // 1. Get ALL shared lists history
                    const historyQ = isGlobal
                        ? collection(db, "shared_lists")
                        : query(collection(db, "shared_lists"), where("congregationId", "==", congregationId));
                    const historySnap = await getDocs(historyQ);

                    // Map History Dates
                    const latestActivityMap = new Map<string, number>();
                    const workedMapIds = new Set<string>(); // For coverage

                    historySnap.docs.forEach(doc => {
                        const data = doc.data();

                        // A. Build Activity Map
                        const datesToCheck: number[] = [];
                        if (data.createdAt) datesToCheck.push(data.createdAt.seconds * 1000);
                        if (data.completedAt) datesToCheck.push(data.completedAt.seconds * 1000);
                        if (data.returnedAt) datesToCheck.push(data.returnedAt.seconds * 1000);

                        const maxDate = datesToCheck.length > 0 ? Math.max(...datesToCheck) : 0;

                        const updateMap = (id: string) => {
                            const current = latestActivityMap.get(id) || 0;
                            if (maxDate > current) latestActivityMap.set(id, maxDate);
                        };

                        if (data.territoryId) updateMap(data.territoryId);
                        if (data.items && Array.isArray(data.items)) {
                            data.items.forEach((id: string) => updateMap(id));
                        }

                        // B. Collect IDs for Coverage (only completed)
                        if (data.status === 'completed') {
                            if (data.territoryId) workedMapIds.add(data.territoryId);
                            if (data.items && Array.isArray(data.items)) {
                                data.items.forEach((id: string) => workedMapIds.add(id));
                            }
                        }
                    });

                    // Check idle
                    const citiesQuery = isGlobal
                        ? collection(db, "cities")
                        : query(collection(db, "cities"), where("congregationId", "==", congregationId));
                    const citiesSnap = await getDocs(citiesQuery);
                    const cityMap: Record<string, string> = {};
                    citiesSnap.forEach(doc => { const d = doc.data(); if (d.name) cityMap[doc.id] = d.name; });

                    // Time thresholds
                    const now = new Date();
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(now.getMonth() - 6);

                    const oneYearAgo = new Date();
                    oneYearAgo.setFullYear(now.getFullYear() - 1);

                    const idleList: any[] = [];

                    terrSnap.docs.forEach(d => {
                        const data = d.data();
                        // Ignore if currently assigned
                        if (data.assignedTo || data.status === 'OCUPADO') return;

                        // Determine actual last visit from History OR current data
                        let lastActivity = data.lastVisit ? data.lastVisit.toDate().getTime() : 0;
                        const historyActivity = latestActivityMap.get(d.id) || 0;
                        if (historyActivity > lastActivity) {
                            lastActivity = historyActivity;
                        }

                        const lastActivityDate = lastActivity > 0 ? new Date(lastActivity) : null;
                        const cityName = (data.cityId && cityMap[data.cityId]) || data.city || 'Cidade Desconhecida';

                        if (!lastActivityDate) {
                            // CASE 1: NEVER VISITED (Red)
                            idleList.push({
                                id: d.id,
                                name: data.name || 'Sem Nome',
                                city: cityName,
                                cityId: data.cityId,
                                congregationId: data.congregationId,
                                lastVisit: null,
                                variant: 'danger'
                            });
                        } else if (lastActivityDate < oneYearAgo) {
                            // CASE 2: > 1 YEAR (Orange)
                            idleList.push({
                                id: d.id,
                                name: data.name || 'Sem Nome',
                                city: cityName,
                                cityId: data.cityId,
                                congregationId: data.congregationId,
                                lastVisit: lastActivityDate,
                                variant: 'warning'
                            });
                        }
                    });


                    // Sort
                    idleList.sort((a, b) => {
                        if (!a.lastVisit && !b.lastVisit) return 0;
                        if (!a.lastVisit) return -1;
                        if (!b.lastVisit) return 1;
                        return a.lastVisit.getTime() - b.lastVisit.getTime();
                    });
                    setIdleTerritories(idleList);

                    // Coverage Calculation
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
                    userName={profileName || user?.displayName || 'Publicador'}
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
