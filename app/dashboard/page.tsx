"use client";
// Force rebuild

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
    Map as MapIcon,
    Home,
    BarChart3,
    User,
    Shield,
    FileText,
    TrendingUp,
    Users,
    Lightbulb,
    CheckCircle,
    AlertCircle,
    Copy,
    Trash2,
    History,
    Loader2,
    Calendar,
    Share2,
    Clock,
    ExternalLink,
    MoreVertical,
    UserMinus,
    Bell,
    CheckCircle2,
    ChevronDown
} from "lucide-react";
import { toast } from 'sonner';
import { getServiceYear, getServiceYearRange } from "@/lib/serviceYearUtils";
import { useRouter } from 'next/navigation'; // Added useRouter
import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import ActionCenter, { IdleTerritory } from "@/app/components/Dashboard/ActionCenter";
import VisitsHistory from "@/app/components/Dashboard/VisitsHistory";
// import NotificationPromptBanner from "@/app/components/NotificationPromptBanner"; // Removed
// import NotificationOnboardingModal from "@/app/components/NotificationOnboardingModal"; // Removed


export default function DashboardPage() {
    const { user, role, isElder, isServant, congregationId, loading, profileName, isSuperAdmin } = useAuth();
    const router = useRouter(); // Added router
    const [sharedHistory, setSharedHistory] = useState<any[]>([]);
    const [myAssignments, setMyAssignments] = useState<any[]>([]); // New dedicated state
    const [historyLoading, setHistoryLoading] = useState(false);
    const [stats, setStats] = useState({
        congregations: 0,
        cities: 0,
        maps: 0,
        addresses: 0,
        visits: 0,
        revisits: 0,
        pubs: 0,
        publicWitnessing: 0,
        coverage: 0
    });

    const [congregations, setCongregations] = useState<{ id: string, name: string }[]>([]);
    const [selectedCongId, setSelectedCongId] = useState<string>('all');

    const [pendingMapsCount, setPendingMapsCount] = useState(0);
    const [idleTerritories, setIdleTerritories] = useState<{ id: string; name: string; city: string; lastVisit?: any }[]>([]);
    const [cityCompletion, setCityCompletion] = useState<{ cityName: string; percentage: number } | undefined>();
    const [expiringMaps, setExpiringMaps] = useState<{ id: string, title: string, daysLeft: number }[]>([]);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        variant: 'danger' | 'warning';
    } | null>(null);

    const totalNotifications = pendingMapsCount + expiringMaps.length + (isElder ? idleTerritories.length : 0) + (cityCompletion && cityCompletion.percentage === 100 ? 1 : 0);

    // Redirect Unassigned Users
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        } else if (!loading && user && !congregationId && !isSuperAdmin) {
            router.push('/unassigned');
        }
    }, [user, loading, congregationId, isSuperAdmin, router]);

    // Fetch user's assigned maps (Dedicated Query)
    useEffect(() => {
        if (!user) return;

        const fetchMyAssignments = async () => {
            try {
                // Query by UID (Robust) instead of Name
                // We fetch ALL assigned cards to the user, then filter/sort client-side
                const { data: lists, error } = await supabase
                    .from('shared_lists')
                    .select('*')
                    .eq('assigned_to', user.id);

                if (error) {
                    console.error("Error fetching my assignments:", error);
                    return;
                }

                const processedLists: any[] = [];
                lists.forEach((data: any) => {
                    if (data.status !== 'completed' && data.status !== 'archived') {
                        processedLists.push({
                            ...data,
                            responsibleName: 'Você'
                        });
                    }
                });

                processedLists.sort((a, b) => {
                    const dateA = new Date(a.created_at || 0).getTime();
                    const dateB = new Date(b.created_at || 0).getTime();
                    return dateB - dateA;
                });

                const expiring = processedLists.filter(l => {
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
                setMyAssignments(processedLists);
                setPendingMapsCount(processedLists.length);
            } catch (e) {
                console.error("Error fetching my assignments:", e);
            }
        };

        fetchMyAssignments();
        if (isSuperAdmin) {
            supabase.from('congregations').select('id, name').order('name')
                .then(({ data }) => {
                    if (data) setCongregations(data);
                });
        }
    }, [user, isSuperAdmin]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    // Determine specific role label
    const roleLabel = role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' :
        role === 'ANCIAO' ? 'Superintendente de Serviço' :
            role === 'SERVO' ? 'Servo de Territórios' :
                'Publicador';

    const fetchSharedHistory = useCallback(async () => {
        if (!congregationId && role !== 'SUPER_ADMIN') {
            return;
        }

        setHistoryLoading(true);
        try {
            let query = supabase.from('shared_lists').select('*');

            if (role !== 'SUPER_ADMIN') {
                query = query.eq('congregation_id', congregationId);
            } else if (selectedCongId !== 'all') {
                query = query.eq('congregation_id', selectedCongId);
            } else {
                query = query.limit(50);
            }

            const usersMap: Record<string, string> = {};
            try {
                let uQuery = supabase.from('users').select('id, name');
                if (congregationId && role !== 'SUPER_ADMIN') {
                    uQuery = uQuery.eq('congregation_id', congregationId);
                } else if (role === 'SUPER_ADMIN' && selectedCongId !== 'all') {
                    uQuery = uQuery.eq('congregation_id', selectedCongId);
                } else if (role === 'SUPER_ADMIN') {
                    uQuery = uQuery.limit(500);
                }

                const { data: users } = await uQuery;
                if (users) {
                    users.forEach((u: any) => {
                        usersMap[u.id] = u.name || "";
                    });
                }
            } catch (e) {
                console.warn("Error fetching users map:", e);
            }

            const { data: lists, error } = await query;
            if (error) throw error;

            const processedLists: any[] = [];
            if (lists) {
                for (const data of lists) {
                    let responsible = 'Não atribuído';
                    if (data.assigned_to && usersMap[data.assigned_to]) {
                        responsible = usersMap[data.assigned_to];
                    } else {
                        responsible = data.assigned_name || 'Não atribuído';
                    }

                    processedLists.push({
                        ...data,
                        responsibleName: responsible
                    });
                }
            }

            // Filter for Publisher: only show their own cards
            let filteredLists = [...processedLists];
            if (!isElder && !isServant && role !== 'SUPER_ADMIN') {
                filteredLists = processedLists.filter(l => l.assigned_to === user?.id);
            }

            // Custom sort: active (not completed) first
            filteredLists.sort((a, b) => {
                const isAActive = a.status !== 'completed';
                const isBActive = b.status !== 'completed';
                if (isAActive && !isBActive) return -1;
                if (!isAActive && isBActive) return 1;

                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            });

            setSharedHistory(filteredLists);
        } catch (err) {
            console.error("Error fetching shared history:", err);
        } finally {
            setHistoryLoading(false);
        }
    }, [congregationId, role, isElder, isServant, profileName, user, selectedCongId]);

    // --- NOTIFICATION & ENCOURAGEMENT LOGIC ---
    useEffect(() => {
        if (!user || sharedHistory.length === 0) return;

        const checkNotifications = async () => {
            try {
                // 1. Fetch Active Templates (System Only)
                const { data: templatesData } = await supabase
                    .from('notification_templates')
                    .select('*')
                    .eq('is_active', true);

                const templates: Record<string, any> = {};
                if (templatesData) {
                    templatesData.forEach((data: any) => {
                        if (data.slug) {
                            templates[data.slug] = data;
                        }
                    });
                }

                const now = new Date();
                const notifiedKeys: string[] = [];

                // Helper to trigger and mark
                const trigger = (slug: string, uniqueKey: string) => {
                    const storageKey = `notified_${slug}_${uniqueKey}`;
                    if (localStorage.getItem(storageKey)) return; // Already verified per user/list

                    const tpl = templates[slug];
                    if (tpl && Notification.permission === 'granted') {
                        new Notification(tpl.title, {
                            body: tpl.body,
                            icon: "/app-icon.png"
                        });
                        localStorage.setItem(storageKey, new Date().toISOString());
                        notifiedKeys.push(storageKey);
                    }
                };

                const myActiveLists = sharedHistory.filter(l => {
                    const isAssigned = l.assigned_to === user?.id || l.created_by === user?.id;
                    return isAssigned && l.status === 'active';
                });

                myActiveLists.forEach(list => {
                    if (!list.created_at) return;
                    const created = new Date(list.created_at);
                    const diffMs = now.getTime() - created.getTime();
                    const diffDays = diffMs / (1000 * 60 * 60 * 24);
                    const diffHours = diffMs / (1000 * 60 * 60);

                    if (diffHours < 24) {
                        trigger('map_assigned', list.id);
                        trigger('encourage_finish', list.id);
                    }
                    if (diffDays >= 6 && diffDays <= 8) {
                        trigger('encourage_1week', list.id);
                    }
                    if (diffDays >= 13 && diffDays <= 15) {
                        trigger('encourage_2weeks', list.id);
                    }

                    if (list.expires_at) {
                        const expires = new Date(list.expires_at);
                        if (expires > now && (expires.getTime() - now.getTime()) < (24 * 60 * 60 * 1000)) {
                            trigger('link_expiration', list.id);
                        }
                    }
                });

            } catch (error) {
                console.error("Error checking notifications:", error);
            }
        };

        const timer = setTimeout(checkNotifications, 3000);
        return () => clearTimeout(timer);
    }, [user, sharedHistory, profileName]);

    useEffect(() => {
        if (!congregationId && role !== 'SUPER_ADMIN') return;

        const fetchStats = async () => {
            try {
                let congCount = 0;
                let cityCount = 0;
                let mapsCount = 0;
                let addressCount = 0;
                let visitCount = 0;
                let publicWitnessingCount = 0;
                let coverageVal = 0;

                // Helper for Supabase count
                const countTable = async (table: string, filters: any = {}) => {
                    let q = supabase.from(table).select('*', { count: 'exact', head: true });
                    Object.entries(filters).forEach(([col, val]) => {
                        if (val !== undefined && val !== 'all') {
                            q = q.eq(col, val);
                        }
                    });
                    const { count, error } = await q;
                    if (error) console.error(`Error counting ${table}:`, error);
                    return count || 0;
                };

                // Função auxiliar para contar cidades distintas com base nos territórios da congregação
                const countDistinctCitiesFromTerritories = async (congId?: string) => {
                    let q = supabase.from('territories').select('city_id');
                    if (congId) q = q.eq('congregation_id', congId);
                    const { data, error } = await q;
                    if (error) { console.error('Error counting cities:', error); return 0; }
                    // Conta UUIDs únicos de cidades
                    const unique = new Set((data || []).map((r: any) => r.city_id).filter(Boolean));
                    return unique.size;
                };

                if (role === 'SUPER_ADMIN') {
                    const targetCong = selectedCongId === 'all' ? undefined : selectedCongId;
                    const [congC, cityC, mapC, addrC, pwC, visitC] = await Promise.all([
                        countTable('congregations'),
                        countDistinctCitiesFromTerritories(targetCong),
                        countTable('territories', { congregation_id: targetCong }),
                        countTable('addresses', { congregation_id: targetCong }),
                        countTable('witnessing_points', { congregation_id: targetCong }),
                        countTable('visits', { congregation_id: targetCong })
                    ]);

                    congCount = congC;
                    cityCount = cityC;
                    mapsCount = mapC;
                    addressCount = addrC;
                    publicWitnessingCount = pwC;
                    visitCount = visitC;
                } else {
                    congCount = 1;
                    cityCount = await countDistinctCitiesFromTerritories(congregationId || undefined);
                    mapsCount = await countTable('territories', { congregation_id: congregationId });
                    addressCount = await countTable('addresses', { congregation_id: congregationId });
                    publicWitnessingCount = await countTable('witnessing_points', { congregation_id: congregationId });
                    visitCount = await countTable('visits', { congregation_id: congregationId });
                }

                // 7. Action Center Logic 
                if (mapsCount > 0) {
                    try {
                        let mapsQuery = supabase.from('territories').select('*');
                        let citiesQuery = supabase.from('cities').select('*');
                        let historyQuery = supabase.from('shared_lists').select('*');

                        if (role !== 'SUPER_ADMIN') {
                            mapsQuery = mapsQuery.eq('congregation_id', congregationId);
                            citiesQuery = citiesQuery.eq('congregation_id', congregationId);
                            historyQuery = historyQuery.eq('congregation_id', congregationId);
                        } else if (selectedCongId !== 'all') {
                            mapsQuery = mapsQuery.eq('congregation_id', selectedCongId);
                            citiesQuery = citiesQuery.eq('congregation_id', selectedCongId);
                            historyQuery = historyQuery.eq('congregation_id', selectedCongId);
                        }

                        const [
                            { data: mapsData },
                            { data: citiesData },
                            { data: historyData }
                        ] = await Promise.all([mapsQuery, citiesQuery, historyQuery]);

                        const latestWorkMap = new Map<string, number>();
                        const latestAnyActivityMap = new Map<string, number>();

                        if (historyData) {
                            historyData.forEach((data: any) => {
                                const processDate = (id: string) => {
                                    const created = data.created_at ? new Date(data.created_at).getTime() : 0;
                                    const completed = data.completed_at ? new Date(data.completed_at).getTime() : 0;
                                    const returned = data.returned_at ? new Date(data.returned_at).getTime() : 0;

                                    if (created > (latestAnyActivityMap.get(id) || 0)) latestAnyActivityMap.set(id, created);
                                    if (completed > (latestWorkMap.get(id) || 0)) latestWorkMap.set(id, completed);
                                    if (completed > (latestAnyActivityMap.get(id) || 0)) latestAnyActivityMap.set(id, completed);
                                    if (returned > (latestWorkMap.get(id) || 0)) latestWorkMap.set(id, returned);
                                    if (returned > (latestAnyActivityMap.get(id) || 0)) latestAnyActivityMap.set(id, returned);
                                };

                                if (data.territory_id) processDate(data.territory_id);
                                // Check if items is array?
                            });
                        }

                        const cityMap: Record<string, string> = {};
                        if (citiesData) {
                            citiesData.forEach((d: any) => {
                                if (d.name) cityMap[d.id] = d.name;
                            });
                        }

                        const currentYear = getServiceYear();
                        const { start: syStart, end: syEnd } = getServiceYearRange(currentYear);
                        const idleList: any[] = [];
                        let coveredCount = 0;

                        if (mapsData) {
                            mapsData.forEach((data: any) => {
                                let lastWork = 0;
                                if (data.manual_last_completed_date) lastWork = new Date(data.manual_last_completed_date).getTime();
                                if (data.last_visit && !lastWork) lastWork = new Date(data.last_visit).getTime();

                                const historyWork = latestWorkMap.get(data.id) || 0;
                                if (historyWork > lastWork) lastWork = historyWork;

                                const lastWorkDate = lastWork > 0 ? new Date(lastWork) : null;
                                if (lastWorkDate && lastWorkDate >= syStart && lastWorkDate <= syEnd) {
                                    coveredCount++;
                                }

                                let lastAny = lastWork;
                                const historyAny = latestAnyActivityMap.get(data.id) || 0;
                                if (historyAny > lastAny) lastAny = historyAny;

                                const lastAnyDate = lastAny > 0 ? new Date(lastAny) : null;
                                const cityName = (data.city_id && cityMap[data.city_id]) || data.city || 'Cidade Desconhecida';

                                if (data.assigned_to || data.status === 'OCUPADO') return;

                                const rollingYearAgo = new Date();
                                rollingYearAgo.setFullYear(rollingYearAgo.getFullYear() - 1);

                                if (!lastAnyDate) {
                                    idleList.push({
                                        id: data.id,
                                        name: data.name || 'Sem Nome',
                                        city: cityName,
                                        city_id: data.city_id,
                                        congregation_id: data.congregation_id,
                                        lastVisit: null,
                                        variant: 'danger'
                                    });
                                } else if (lastAnyDate < rollingYearAgo) {
                                    idleList.push({
                                        id: data.id,
                                        name: data.name || 'Sem Nome',
                                        city: cityName,
                                        city_id: data.city_id,
                                        congregation_id: data.congregation_id,
                                        lastVisit: lastAnyDate,
                                        variant: 'warning'
                                    });
                                }
                            });
                        }

                        if (mapsCount > 0) {
                            coverageVal = Math.floor((coveredCount / mapsCount) * 100);
                        }

                        idleList.sort((a, b) => {
                            if (!a.lastVisit && !b.lastVisit) return 0;
                            if (!a.lastVisit) return -1;
                            if (!b.lastVisit) return 1;
                            return a.lastVisit.getTime() - b.lastVisit.getTime();
                        });

                        setIdleTerritories(idleList);

                    } catch (e) { console.error("Idle check error", e); }
                }

                if (coverageVal >= 100 && mapsCount > 0) {
                    setCityCompletion({ cityName: "Território Completo", percentage: 100 });
                } else {
                    setCityCompletion(undefined);
                }

                setStats({
                    congregations: congCount,
                    cities: cityCount,
                    maps: mapsCount,
                    visits: visitCount,
                    addresses: addressCount,
                    publicWitnessing: publicWitnessingCount,
                    revisits: 0,
                    pubs: 0,
                    coverage: Math.floor(coverageVal)
                });
            } catch (error) {
                console.error("Critical Error fetching stats:", error);
            }
        };

        fetchStats();
        fetchSharedHistory();
    }, [congregationId, role, isElder, isServant, profileName, user?.id, fetchSharedHistory, selectedCongId]);

    const handleCopyLink = async (id: string) => {
        const shareUrl = window.location.origin + "/share?id=" + id;
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Link copiado com sucesso!");
        } catch (err) {
            console.error("Error copying link:", err);
            toast.error("Erro ao copiar link.");
        }
    };

    const handleShareLink = async (id: string, title?: string) => {
        const shareUrl = window.location.origin + "/share?id=" + id;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title || 'Campo Branco - Cartão de Território',
                    text: 'Acesse o cartão de território do Campo Branco:',
                    url: shareUrl
                });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error("Error sharing:", err);
                }
            }
        } else {
            handleCopyLink(id);
        }
    };

    const handleOpenLink = (id: string) => {
        window.open(window.location.origin + "/share?id=" + id, "_blank");
    };

    const handleDeleteShare = async (id: string) => {
        setConfirmModal(null);
        try {
            const { error } = await supabase.from('shared_lists').delete().eq('id', id);
            if (error) throw error;
            toast.success("Cartão removido do histórico.");
            setSharedHistory(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            console.error("Error deleting share:", err);
            toast.error("Erro ao excluir cartão.");
        }
    };

    const handleRemoveResponsible = async (id: string) => {
        setConfirmModal(null);
        try {
            const { error } = await supabase.from('shared_lists').update({
                assigned_to: null,
                assigned_name: null
            }).eq('id', id);
            if (error) throw error;
            fetchSharedHistory();
            setMyAssignments(prev => prev.filter(item => item.id !== id));
            toast.success("Responsável removido com sucesso!");
        } catch (err) {
            console.error("Error removing responsible:", err);
            toast.error("Erro ao remover responsável.");
        }
    };

    const handleQuickAssign = async (territory: IdleTerritory) => {
        router.push(`/share-setup?ids=${territory.id}&returnUrl=/dashboard`);
    };

    // ------------------------------------------------------------
    // Dynamic Views
    // ------------------------------------------------------------


    // --- HELPER COMPONENTS ---

    const SharedHistoryListComponent = ({ title, items, icon: Icon = History }: { title: string, items: any[], icon?: any }) => {
        const isMine = title === 'Meus Cartões';
        const targetLink = `/dashboard/cards?scope=${isMine ? 'mine' : 'managed'}`;

        const limit = 4;
        const visibleItems = items.slice(0, limit);
        const hasMore = items.length > limit;

        return (
            <div className="bg-surface p-6 rounded-lg shadow-sm border border-surface-border">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-main">{title}</h3>
                    </div>
                    {hasMore && (
                        <Link
                            href={targetLink}
                            className="text-[10px] font-extrabold text-primary uppercase tracking-widest hover:text-primary-dark transition-colors bg-primary-light/50 dark:bg-primary-dark/30 px-3 py-1.5 rounded-full"
                        >
                            Ver Tudo
                        </Link>
                    )}
                </div>

                {historyLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : items.length === 0 ? (
                    <div className="text-center py-6 opacity-50">
                        <p className="text-sm text-muted">Nenhum cartão encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visibleItems.map((list) => (
                            <div key={list.id} className="p-4 rounded-lg bg-background border border-surface-border hover:border-primary/30 dark:hover:border-primary-dark/50 transition-colors group relative">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-main text-sm truncate">
                                            {list.context?.territoryName ? `${list.context.territoryName} - ${list.context.featuredDetails || 'Mapa'}` : (list.title || "Cartão de Território")}
                                        </h4>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <User className="w-3 h-3 text-muted" />
                                            <span className="text-[10px] font-bold text-muted truncate">{list.responsibleName}</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 pt-1 flex items-center gap-2">
                                        {list.status === 'completed' ? (
                                            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider">Concluído</span>
                                        ) : (
                                            <span className="bg-primary/20 dark:bg-primary-dark/40 text-primary dark:text-primary-light text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider border border-primary/10">Ativo</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-surface-border/10">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-muted" />
                                            <span className="text-[10px] text-muted font-medium">Início: {formatDate(list.created_at)}</span>
                                        </div>
                                        {list.status === 'completed' && list.returned_at ? (
                                            <div className="flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3 text-green-600" />
                                                <span className="text-[10px] text-muted font-medium">Conclusão: {formatDate(list.returned_at)}</span>
                                            </div>
                                        ) : (
                                            list.status !== 'completed' && list.expires_at && formatExpirationTime(list.expires_at) && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-orange-400" />
                                                    <span className={`text-[10px] font-bold ${(list.expires_at && (new Date(list.expires_at).getTime() - Date.now()) < 5 * 24 * 60 * 60 * 1000)
                                                        ? 'text-red-500 dark:text-red-400'
                                                        : 'text-orange-500 dark:text-orange-400'
                                                        }`}>
                                                        {formatExpirationTime(list.expires_at)}
                                                    </span>
                                                </div>
                                            )
                                        )}
                                    </div>

                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === list.id ? null : list.id);
                                            }}
                                            className="p-1.5 text-muted hover:text-main hover:bg-surface rounded-lg transition-all shadow-sm"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {openMenuId === list.id && (
                                            <div className="absolute right-0 top-8 w-48 bg-surface rounded-lg shadow-xl border border-surface-border py-2 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                                                <button
                                                    onClick={() => {
                                                        handleOpenLink(list.id);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-main hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 hover:text-primary dark:hover:text-primary-light flex items-center gap-2 transition-colors border-b border-surface-border"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                    Abrir Link
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleCopyLink(list.id);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-main hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 hover:text-primary dark:hover:text-primary-light flex items-center gap-2 transition-colors border-b border-surface-border"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                    Copiar Link
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleShareLink(list.id, list.title);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-main hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 hover:text-primary dark:hover:text-primary-light flex items-center gap-2 transition-colors border-b border-surface-border"
                                                >
                                                    <Share2 className="w-3.5 h-3.5" />
                                                    Enviar Link
                                                </button>
                                                {(isElder || isServant || role === 'SUPER_ADMIN') && (
                                                    <button
                                                        onClick={() => {
                                                            setConfirmModal({
                                                                title: 'Remover Responsável?',
                                                                message: 'Tem certeza que deseja remover o responsável deste cartão?',
                                                                variant: 'warning',
                                                                onConfirm: () => handleRemoveResponsible(list.id)
                                                            });
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 flex items-center gap-2 transition-colors border-b border-surface-border"
                                                    >
                                                        <UserMinus className="w-3.5 h-3.5" />
                                                        Remover Responsável
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setConfirmModal({
                                                            title: 'Excluir Cartão?',
                                                            message: 'Tem certeza que deseja excluir? O link deixará de funcionar.',
                                                            variant: 'danger',
                                                            onConfirm: () => handleDeleteShare(list.id)
                                                        });
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Excluir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };




    const formatDate = (dateString: any) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    const formatExpirationTime = (expiresAtString: any) => {
        if (!expiresAtString) return "Por tempo indeterminado";

        const expiresAt = new Date(expiresAtString);
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();

        if (diffMs <= 0) return "Vencido";

        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = Math.ceil(diffHours / 24);

        if (diffDays > 1000) return "Por tempo indeterminado"; // Handle dates set far in future

        if (diffHours < 1) {
            return "Vence em menos de uma hora";
        } else if (diffHours < 24) {
            return `Vence em ${Math.floor(diffHours)} horas`;
        } else {
            return `Faltam ${diffDays} dias`;
        }
    };

    if (loading) return null;

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main">
            {/* Header */}
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-transparent p-0 rounded-lg">
                        <Image src="/app-icon.svg" alt="Logo" width={40} height={40} className="object-contain drop-shadow-md" priority />
                    </div>
                    <div>
                        <span className="font-bold text-lg text-main tracking-tight block leading-tight">Campo Branco</span>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Início</span>
                    </div>
                </div>

                {/* Role Badge & Help */}
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1
                        ${isElder ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' :
                            isServant ? 'bg-primary-light/50 dark:bg-primary-dark/30 text-primary dark:text-primary-light' :
                                'bg-gray-100 dark:bg-gray-800 text-muted'}
                    `}>
                        <Shield className="w-3 h-3" />
                        {roleLabel}
                    </span>

                    <Link
                        href="/notifications"
                        className="relative p-1.5 text-muted hover:text-primary hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 rounded-full transition-colors"
                        title="Notificações"
                    >
                        <Bell className="w-5 h-5" />
                        {totalNotifications > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center border-2 border-surface">
                                {totalNotifications}
                            </span>
                        )}
                    </Link>

                </div>
            </header>


            <main className="px-6 py-6 max-w-xl mx-auto space-y-10">

                {/* <NotificationPromptBanner /> Removed */}

                {/* Greeting */}
                <div>
                    <h1 className="text-2xl font-bold text-main tracking-tight">
                        Olá, {(profileName || user?.user_metadata?.full_name || user?.email)?.split(' ')[0] || 'Irmão'}
                    </h1>
                    <p className="text-muted text-sm">
                        Aqui está o resumo para sua função.
                    </p>
                </div>

                {/* SECTION 1: MINISTÉRIO (Todos) */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-1 h-6 bg-primary rounded-full" />
                        <h2 className="text-lg font-bold text-main tracking-tight uppercase text-[12px]">Ministério</h2>
                    </div>

                    {(isElder || isServant || role === 'SUPER_ADMIN') && (
                        <ActionCenter
                            userName={profileName || user?.user_metadata?.full_name || user?.email || 'Publicador'}
                            pendingMapsCount={pendingMapsCount}
                            hasPendingAnnotation={false}
                            idleTerritories={isElder || isServant || role === 'SUPER_ADMIN' ? idleTerritories : []}
                            cityCompletion={cityCompletion}
                            expiringMaps={expiringMaps}
                            onAssignTerritory={handleQuickAssign}
                            limit={3}
                        />
                    )}

                    {/* My Cards Section */}
                    <SharedHistoryListComponent
                        title="Meus Cartões"
                        items={myAssignments}
                        icon={User}
                    />

                    {/* My Personal History */}
                    <VisitsHistory scope="mine" />
                </section>

                {/* SECTION 2: GESTÃO DE TERRITÓRIOS (Servos e Anciãos) */}
                {(isElder || isServant || role === 'SUPER_ADMIN') && (
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1 h-6 bg-purple-600 rounded-full" />
                            <h2 className="text-lg font-bold text-main tracking-tight uppercase text-[12px]">Gestão de Territórios</h2>
                        </div>

                        {/* All Sent Cards */}
                        <SharedHistoryListComponent
                            title="Cartões Enviados"
                            items={sharedHistory.filter(l => l.status !== 'completed' || isElder || isServant).slice(0, 15)}
                        />

                        {/* General History */}
                        <VisitsHistory scope="all" />
                    </section>
                )}

                <section className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-6 bg-emerald-600 rounded-full" />
                            <h2 className="text-lg font-bold text-main tracking-tight uppercase text-[12px]">A Congregação</h2>
                        </div>

                        {role === 'SUPER_ADMIN' && congregations.length > 0 && (
                            <div className="relative group min-w-[200px]">
                                <select
                                    value={selectedCongId}
                                    onChange={(e) => setSelectedCongId(e.target.value)}
                                    className="w-full appearance-none bg-surface border border-surface-border rounded-lg px-4 py-2 pr-10 text-xs font-bold text-main focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="all">Todas as Congregações</option>
                                    {congregations.map(cong => (
                                        <option key={cong.id} value={cong.id}>{cong.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted group-hover:text-primary transition-colors">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {role === 'SUPER_ADMIN' && selectedCongId === 'all' && (
                            <div className="col-span-2 bg-surface p-4 rounded-lg shadow-sm border border-surface-border flex flex-col justify-center">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest line-clamp-1">CONGREGAÇÕES</p>
                                <p className="text-2xl font-bold text-main">{stats.congregations}</p>
                            </div>
                        )}
                        <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface-border flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">CIDADES</p>
                            <p className="text-2xl font-bold text-main">{stats.cities}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface-border flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">MAPAS</p>
                            <p className="text-2xl font-bold text-main">{stats.maps}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface-border flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">ENDEREÇOS</p>
                            <p className="text-2xl font-bold text-main">{stats.addresses}</p>
                        </div>
                        {(isElder || isServant || role === 'SUPER_ADMIN') && (
                            <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface-border flex flex-col justify-center">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">VISITAS</p>
                                <p className="text-2xl font-bold text-main">{stats.visits}</p>
                            </div>
                        )}
                        <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface-border flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">T. PÚBLICO</p>
                            <p className="text-2xl font-bold text-main">{stats.publicWitnessing || 0}</p>
                        </div>
                        {(isElder || isServant || role === 'SUPER_ADMIN') && (
                            <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface-border flex flex-col justify-center">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-tight mb-1">COBERTURA</p>
                                <p className="text-2xl font-bold text-main">{stats.coverage}%</p>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            {confirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-surface rounded-xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border">
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-16 h-16 ${confirmModal.variant === 'danger' ? 'bg-red-100 dark:bg-red-900/20 text-red-600' : 'bg-orange-100 dark:bg-orange-900/20 text-orange-600'} rounded-full flex items-center justify-center mb-4`}>
                                {confirmModal.variant === 'danger' ? <Trash2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                            </div>
                            <h2 className="text-lg font-bold text-main mb-2">{confirmModal.title}</h2>
                            <p className="text-sm text-muted mb-6">{confirmModal.message}</p>
                            <div className="flex flex-col w-full gap-2">
                                <button
                                    onClick={confirmModal.onConfirm}
                                    className={`w-full py-3 ${confirmModal.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-lg font-bold text-sm transition-colors`}
                                >
                                    Confirmar
                                </button>
                                <button
                                    onClick={() => setConfirmModal(null)}
                                    className="w-full py-3 bg-background text-muted rounded-lg font-bold text-sm hover:bg-surface-highlight border border-surface-border transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <BottomNav />
        </div>
    );
}
