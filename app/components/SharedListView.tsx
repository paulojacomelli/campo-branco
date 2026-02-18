"use client";

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Map as MapIcon,
    Loader2,
    MapPin,
    Building2,
    ChevronRight,
    Share2,
    CheckCircle2,
    ThumbsUp,
    ThumbsDown,
    Minus,
    User,
    Users,
    Ear,
    Baby,
    GraduationCap,
    FileText,
    ClipboardList,
    CheckCircle,
    Navigation,
    MoreVertical,
    History as HistoryIcon
} from 'lucide-react';
import VisitReportModal from '@/app/components/VisitReportModal';
import VisitHistoryModal from '@/app/components/VisitHistoryModal';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import BottomNav from '@/app/components/BottomNav';

interface SharedList {
    type: 'address' | 'city' | 'territory';
    items: string[];
    context?: any;
    congregationId?: string;
    cityId?: string;
    territoryId?: string;
    createdAt?: any;
    assignedTo?: string;
    assignedName?: string;
    status?: string;
    expiresAt?: any;
}

interface SharedListViewProps {
    id?: string;
}

export default function SharedListView({ id: propId }: SharedListViewProps) {
    const searchParams = useSearchParams();
    const id = propId || searchParams.get('id');
    const { user, profileName } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [returning, setReturning] = useState(false);
    const [error, setError] = useState('');
    const [listData, setListData] = useState<SharedList | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [isResponsibilityModalOpen, setIsResponsibilityModalOpen] = useState(false);
    const [accepting, setAccepting] = useState(false);

    // Modals State
    const [visitingItem, setVisitingItem] = useState<any | null>(null);
    const [viewingHistoryItem, setViewingHistoryItem] = useState<any | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Stats
    const [addressCounts, setAddressCounts] = useState<Record<string, number>>({});
    const [globalStats, setGlobalStats] = useState({
        total: 0,
        processed: 0,
        contacted: 0,
        not_contacted: 0,
        moved: 0,
        do_not_visit: 0,
        contested: 0
    });

    useEffect(() => {
        const fetchList = async () => {
            if (!id) {
                setError("Link incompleto (ID ausente).");
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch List Metadata from Supabase
                const { data: list, error: listError } = await supabase
                    .from('shared_lists')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (listError || !list) {
                    setError("Link não encontrado.");
                    setLoading(false);
                    return;
                }

                if (list.expires_at) {
                    const now = new Date();
                    const expires = new Date(list.expires_at);
                    if (now > expires) {
                        setError("Link expirado.");
                        setLoading(false);
                        return;
                    }
                }

                setListData({
                    ...list,
                    assignedTo: list.assigned_to,
                    assignedName: list.assigned_name,
                    congregationId: list.congregation_id,
                    territoryId: list.territory_id,
                    cityId: list.city_id,
                    expiresAt: list.expires_at
                } as any);

                // Show responsibility modal if no one is assigned and list is active
                if (!list.assigned_to && !list.assigned_name && list.status !== 'completed') {
                    setIsResponsibilityModalOpen(true);
                }

                // 2. Fetch Scoped Results (Visits) for this shared list
                const { data: visits, error: visitsError } = await supabase
                    .from('visits')
                    .select('*')
                    .eq('shared_list_id', id);

                const linkResults: Record<string, any> = {};
                if (visits) {
                    visits.forEach(v => {
                        linkResults[v.address_id] = v;
                    });
                }

                // 3. Fetch Items (Territories/Cities/Addresses)
                let fetchedItems: any[] = [];
                const itemIds = list.items || [];

                if (itemIds.length > 0) {
                    // Try to fetch from Snapshots first
                    const { data: snapData } = await supabase
                        .from('shared_list_snapshots')
                        .select('data')
                        .eq('shared_list_id', id)
                        .in('item_id', itemIds);

                    if (snapData && snapData.length > 0) {
                        fetchedItems = snapData.map(s => ({ ...s.data, id: s.data.id }));
                    } else {
                        // Fallback to main tables
                        let tableName = 'territories';
                        if (list.type === 'city') tableName = 'cities';
                        if (list.type === 'address') tableName = 'addresses';

                        const { data: itemsData } = await supabase
                            .from(tableName)
                            .select('*')
                            .in('id', itemIds);

                        if (itemsData) fetchedItems = itemsData;
                    }
                }

                // Merge Items with Results
                const mergedItems = fetchedItems.map((item: any) => {
                    const result = linkResults[item.id];
                    return {
                        ...item,
                        completed: (result?.status || item.visit_status) === 'contacted',
                        visitStatus: result?.status || item.visit_status || ''
                    };
                });

                setItems(mergedItems);

                // 4. Calculate Counts and Stats (if Territory)
                if (list.type === 'territory') {
                    // We need ALL addresses of these territories
                    // If we have snapshots, we can use them
                    const { data: addrSnapshots } = await supabase
                        .from('shared_list_snapshots')
                        .select('data')
                        .eq('shared_list_id', id);

                    let allAddresses: any[] = [];
                    if (addrSnapshots && addrSnapshots.length > fetchedItems.length) {
                        // Filrando pelo que parece ser endereço (tem street ou territory_id)
                        allAddresses = addrSnapshots
                            .map(s => s.data)
                            .filter(d => d.territory_id);
                    } else if (list.items && list.items.length > 0) {
                        // Fallback to main addresses table
                        const { data: addrData } = await supabase
                            .from('addresses')
                            .select('*')
                            .in('territory_id', list.items);
                        if (addrData) allAddresses = addrData;
                    }

                    const counts: Record<string, number> = {};
                    const stats = {
                        total: 0,
                        processed: 0,
                        contacted: 0,
                        not_contacted: 0,
                        moved: 0,
                        do_not_visit: 0,
                        contested: 0
                    };

                    allAddresses.forEach((addr: any) => {
                        if (addr.is_active !== false) {
                            counts[addr.territory_id] = (counts[addr.territory_id] || 0) + 1;
                            stats.total++;

                            const result = linkResults[addr.id];
                            const currentStatus = result?.status || addr.visit_status;

                            if (currentStatus && currentStatus !== 'none') {
                                stats.processed++;
                                if (currentStatus === 'contacted') stats.contacted++;
                                else if (currentStatus === 'not_contacted') stats.not_contacted++;
                                else if (currentStatus === 'moved') stats.moved++;
                                else if (currentStatus === 'do_not_visit') stats.do_not_visit++;
                                else if (currentStatus === 'contested') stats.contested++;
                            }
                        }
                    });

                    setAddressCounts(counts);
                    setGlobalStats(stats);
                }
            } catch (err) {
                console.error(err);
                setError("Erro ao carregar lista compartilhada.");
            } finally {
                setLoading(false);
            }
        }

        if (id) {
            fetchList();
        }
    }, [id]);

    const handleReturnMap = async () => {
        if (!id) return;
        if (!confirm("Confirmar devolução do mapa? O link será encerrado em breve.")) return;
        setReturning(true);
        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            const { error } = await supabase.from('shared_lists').update({
                expires_at: expiresAt.toISOString(),
                returned_at: new Date().toISOString(),
                status: 'completed'
            }).eq('id', id);

            if (error) throw error;

            alert("Mapa devolvido com sucesso! O acesso será encerrado em 24 horas.");
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Erro ao devolver mapa.");
            setReturning(false);
        }
    };

    const handleReturnTerritory = async (territoryId: string, territoryName: string) => {
        if (!confirm(`Confirmar devolução do território ${territoryName}?`)) return;

        // Optimistic Update
        setItems(prev => prev.map(item =>
            item.id === territoryId ? { ...item, visitStatus: 'completed' } : item
        ));

        try {
            // Update snapshot entry to mark as completed
            const { error: snapError } = await supabase
                .from('shared_list_snapshots')
                .update({ data: { ...items.find(i => i.id === territoryId), visitStatus: 'completed' } })
                .eq('shared_list_id', id)
                .eq('item_id', territoryId);

            if (snapError) throw snapError;

            // Check if all items are completed
            const allCompleted = items.every(item =>
                item.id === territoryId ? true : item.visitStatus === 'completed'
            );

            if (allCompleted) {
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24);

                await supabase.from('shared_lists').update({
                    expires_at: expiresAt.toISOString(),
                    returned_at: new Date().toISOString(),
                    status: 'completed'
                }).eq('id', id);

                alert("Todos os territórios foram devolvidos! O mapa será encerrado em 24h.");
                window.location.reload();
            }

        } catch (e) {
            console.error(e);
            alert("Erro ao sincronizar devolução. Tente novamente.");
            // Revert optimistic update on error
            setItems(prev => prev.map(item =>
                item.id === territoryId ? { ...item, visitStatus: 'active' } : item
            ));
        }
    };

    const handleUndoReturnTerritory = async (territoryId: string, territoryName: string) => {
        if (!confirm(`Desfazer devolução do território ${territoryName}?`)) return;

        // Optimistic Update
        setItems(prev => prev.map(item =>
            item.id === territoryId ? { ...item, visitStatus: 'active' } : item
        ));

        try {
            const { error: snapError } = await supabase
                .from('shared_list_snapshots')
                .update({ data: { ...items.find(i => i.id === territoryId), visitStatus: 'active' } })
                .eq('shared_list_id', id)
                .eq('item_id', territoryId);

            if (snapError) throw snapError;

        } catch (e) {
            console.error(e);
            alert("Erro ao desfazer ação.");
            // Revert optimistic
            setItems(prev => prev.map(item =>
                item.id === territoryId ? { ...item, visitStatus: 'completed' } : item
            ));
        }
    };

    const handleAcceptResponsibility = async () => {
        if (!user) {
            router.push(`/login?redirect=/share?id=${id}`);
            return;
        }
        if (!id) return;
        setAccepting(true);
        try {
            // 1. Assign territory to user in Supabase
            const { error: listError } = await supabase
                .from('shared_lists')
                .update({
                    assigned_to: user.id,
                    assigned_name: profileName || 'Irmão sem Nome'
                })
                .eq('id', id);

            if (listError) throw listError;

            // 2. Automatic Binding: If user has no congregation, bind to this one
            if (listData?.congregationId) {
                const { data: userData, error: userFetchError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (userData && !userData.congregation_id) {
                    await supabase.from('users').update({
                        congregation_id: listData.congregationId,
                        role: 'PUBLICADOR'
                    }).eq('id', user.id);
                    window.location.reload();
                    return;
                }
            }

            setIsResponsibilityModalOpen(false);
            setListData(prev => prev ? { ...prev, assignedTo: user.id, assignedName: profileName || 'Irmão sem Nome' } : null);
        } catch (e) {
            console.error("Error accepting responsibility:", e);
            alert("Erro ao aceitar responsabilidade ou vincular à congregação.");
        } finally {
            setAccepting(false);
        }
    };

    const handleSaveVisit = async (data: any) => {
        if (!visitingItem || !id) return;

        // Optimistic UI Update
        setItems(prev => prev.map(item =>
            item.id === visitingItem.id
                ? { ...item, completed: data.status === 'contacted', visitStatus: data.status }
                : item
        ));

        const savedItem = visitingItem;
        setVisitingItem(null);

        try {
            const visit_date = new Date().toISOString();

            // 1. Visit Log in Supabase
            const { error: visitError } = await supabase.from('visits').insert({
                address_id: savedItem.id,
                shared_list_id: id,
                status: data.status,
                visit_date: visit_date,
                user_id: user?.id,
                publisher_name: profileName || 'Publicador',
                notes: data.observations || '',
                congregation_id: listData?.congregationId,
                territory_id: savedItem.territory_id || listData?.territoryId,
                tags_snapshot: {
                    isDeaf: data.isDeaf || false,
                    isMinor: data.isMinor || false,
                    isStudent: data.isStudent || false,
                    isNeurodivergent: data.isNeurodivergent || false
                }
            });

            if (visitError) throw visitError;

            // 2. Address Update in Supabase
            const addressUpdates: any = {
                visit_status: data.status,
                last_visited_at: visit_date,
                is_deaf: data.isDeaf || false,
                is_minor: data.isMinor || false,
                is_student: data.isStudent || false,
                is_neurodivergent: data.isNeurodivergent || false,
                observations: data.observations || ''
            };
            if (data.status === 'contacted') addressUpdates.completed = true;

            const { error: addrError } = await supabase
                .from('addresses')
                .update(addressUpdates)
                .eq('id', savedItem.id);

            if (addrError) console.warn("Address update skipped (permissions/schema):", addrError);

        } catch (e) {
            console.error("Error saving visit:", e);
            alert("Erro ao salvar. Verifique sua conexão.");
            // Revert Optimistic Update
            setItems(prev => prev.map(item =>
                item.id === savedItem.id
                    ? { ...item, completed: false, visitStatus: savedItem.visitStatus }
                    : item
            ));
        }
    };

    const handleOpenMap = (item: any) => {
        const query = `${item.street}, ${item.number}`;
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);

        let url = '';
        if (isIOS) {
            url = `maps://?q=${encodeURIComponent(query)}`;
        } else if (isAndroid) {
            url = `geo:0,0?q=${encodeURIComponent(query)}`;
        } else {
            url = item.googleMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        }

        window.open(url, '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-gray-400 text-sm font-bold animate-pulse">Carregando lista...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-primary-light/30 rounded-full flex items-center justify-center mx-auto text-primary">
                        <MapIcon className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">Ops!</h1>
                    <p className="text-gray-500">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen font-sans pb-10 text-main">
            {/* Minimal Header */}
            <header className="px-6 py-6 bg-surface border-b border-surface-border flex items-center justify-center sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 text-primary bg-primary-light/50 dark:bg-primary-dark/30 rounded-lg flex items-center justify-center shadow-md shadow-primary-light/10 dark:shadow-none">
                        <Share2 className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-lg text-main tracking-tight">Lista Compartilhada</span>
                </div>
            </header>

            <main className="max-w-xl mx-auto px-5 py-8 space-y-6">

                {/* Context Header */}
                {/* Instruction Card */}
                {/* Global Progress Bar & Return Action */}
                {listData?.type === 'territory' && (
                    <div className="bg-surface rounded-lg p-6 shadow-xl shadow-primary-light/5 space-y-6 border border-surface-border relative overflow-hidden">

                        {/* Title & Status */}
                        <div className="flex flex-col gap-1">
                            <h2 className="text-2xl font-bold text-main">Cobertura do mapa</h2>
                            <p className="text-muted text-sm">
                                {globalStats.total > 0 && globalStats.processed === globalStats.total
                                    ? (listData?.status === 'completed' ? "Este mapa já foi devolvido." : "Parabéns! Todos os territórios foram trabalhados.")
                                    : "Registre o resultado de cada visita abaixo."}
                            </p>
                        </div>

                        {/* Expiration Notice if Completed */}
                        {listData?.status === 'completed' && (
                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                                    <HistoryIcon className="w-5 h-5" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-sm font-bold text-orange-800 dark:text-orange-300">Acesso Temporário</p>
                                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">O acesso a este link será encerrado automaticamente em 24h.</p>
                                </div>
                            </div>
                        )}

                        {/* Progress Bar */}
                        {globalStats.total > 0 && (
                            <div className="space-y-2">
                                <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                                    {/* Contacted */}
                                    <div style={{ width: `${(globalStats.contacted / globalStats.total) * 100}%` }} className="bg-green-600 h-full transition-all duration-500" title={`Contatados: ${globalStats.contacted}`} />
                                    {/* Not Contacted */}
                                    <div style={{ width: `${(globalStats.not_contacted / globalStats.total) * 100}%` }} className="bg-orange-500 h-full transition-all duration-500" title={`Não Contatados: ${globalStats.not_contacted}`} />
                                    {/* Moved */}
                                    <div style={{ width: `${(globalStats.moved / globalStats.total) * 100}%` }} className="bg-primary h-full transition-all duration-500" title={`Mudou-se: ${globalStats.moved}`} />
                                    {/* Do Not Visit */}
                                    <div style={{ width: `${(globalStats.do_not_visit / globalStats.total) * 100}%` }} className="bg-red-500 h-full transition-all duration-500" title={`Não Visitar: ${globalStats.do_not_visit}`} />
                                </div>
                                <div className="flex justify-between text-xs font-bold text-muted">
                                    <span>{globalStats.processed} de {globalStats.total} visitas concluídas</span>
                                    <span>{Math.round((globalStats.processed / globalStats.total) * 100)}%</span>
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-600" /><span className="text-[10px] text-muted font-bold uppercase">Contatado</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-[10px] text-muted font-bold uppercase">Não Contatado</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /><span className="text-[10px] text-muted font-bold uppercase">Mudou</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] text-muted font-bold uppercase">Não Visitar</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" /><span className="text-[10px] text-muted font-bold uppercase">Não Trabalhado</span></div>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            {/* Return Button - Only if 100% complete */}
                            {globalStats.total > 0 && globalStats.processed === globalStats.total && (
                                <button
                                    onClick={handleReturnMap}
                                    disabled={returning || listData?.status === 'completed'}
                                    className={`flex-1 px-6 py-3.5 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg
                                        ${listData?.status === 'completed'
                                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 shadow-none cursor-not-allowed'
                                            : 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20'
                                        }`}
                                >
                                    {returning ? <Loader2 className="w-4 h-4 animate-spin" /> : (listData?.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />)}
                                    {listData?.status === 'completed' ? 'Mapa Devolvido' : 'Devolver Mapa'}
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert("Link copiado!");
                                }}
                                className="flex-1 bg-surface hover:bg-background text-primary dark:text-primary-light active:scale-95 transition-all px-6 py-3.5 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-surface-border shadow-sm"
                            >
                                <Share2 className="w-4 h-4" />
                                <span className="uppercase text-xs font-bold tracking-wider">Copiar Link</span>
                            </button>
                        </div>
                    </div>
                )}

                {listData?.type !== 'territory' && (
                    <div className="bg-primary rounded-lg p-6 shadow-xl shadow-primary-light/20 text-white space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Relatório de Campo</h2>
                            <p className="text-primary-light/80 text-sm leading-relaxed">
                                Clique em cada endereço abaixo para registrar o resultado da sua visita.
                                O mapa será marcado como concluído automaticamente ao terminar todos.
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                alert("Link copiado!");
                            }}
                            className="bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-white/10 w-full justify-center sm:w-auto"
                        >
                            <Share2 className="w-4 h-4" />
                            Copiar Link do Cartão
                        </button>
                    </div>
                )}

                {/* List Items */}
                <div className="space-y-3">
                    {items.length === 0 && !loading && (
                        <div className="text-center py-10 text-muted">
                            <p>Nenhum item encontrado nesta lista.</p>
                            <p className="text-xs mt-2 opacity-50">ID: {id}</p>
                        </div>
                    )}
                    {items.map((item) => {
                        let href = '#';
                        let isExternal = false;

                        if (listData?.type === 'city') {
                            href = `/share/preview?type=city&id=${item.id}&shareId=${id}`;
                        } else if (listData?.type === 'territory') {
                            href = `/share/preview?type=territory&id=${item.id}&shareId=${id}`;
                        } else if (listData?.type === 'address') {
                            if (item.googleMapsLink) {
                                href = item.googleMapsLink;
                                isExternal = true;
                            } else if (item.lat && item.lng) {
                                href = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
                                isExternal = true;
                            } else {
                                href = '#';
                            }
                        }

                        return (
                            <div key={item.id} className="block group">
                                <div className="bg-surface p-4 rounded-lg border border-surface-border flex items-center gap-4 shadow-sm group-hover:border-primary-light dark:group-hover:border-primary-dark group-hover:shadow-md transition-all relative overflow-hidden">

                                    {/* Hover Highlight */}
                                    <div
                                        onClick={() => {
                                            if (listData?.type === 'address') {
                                                if (!user) {
                                                    if (confirm("Você precisa estar logado para registrar uma visita. Deseja entrar agora?")) {
                                                        router.push(`/login?redirect=/share?id=${id}`);
                                                    }
                                                    return;
                                                }
                                                setVisitingItem(item);
                                            } else if (href !== '#') {
                                                router.push(href);
                                            }
                                        }}
                                        className={`absolute inset-0 z-0 ${listData?.type === 'address' ? 'cursor-pointer' : ''}`}
                                    />

                                    {/* Icon based on type */}
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-colors shadow-sm
                                                        ${listData?.type === 'address'
                                            ? (item.visitStatus === 'contacted' ? 'bg-[#21832B] text-white' :
                                                item.visitStatus === 'not_contacted' ? 'bg-orange-500 text-white' :
                                                    item.visitStatus === 'moved' ? 'bg-primary text-white' :
                                                        item.visitStatus === 'do_not_visit' ? 'bg-red-500 text-white' :
                                                            'bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light group-hover:bg-primary-light/80 dark:group-hover:bg-primary-dark/50 group-hover:text-primary-dark dark:group-hover:text-primary-light')
                                            : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700 group-hover:bg-primary-light/50 dark:group-hover:bg-primary-dark/30 group-hover:text-primary dark:group-hover:text-primary-light'
                                        }`}
                                    >
                                        {listData?.type === 'city' && <Building2 className="w-6 h-6" />}
                                        {listData?.type === 'territory' && <MapIcon className="w-6 h-6" />}

                                        {listData?.type === 'address' && (
                                            <>
                                                {item.gender === 'HOMEM' && <User className={`w-5 h-5 ${item.visitStatus ? 'text-white' : 'text-primary fill-primary'}`} />}
                                                {item.gender === 'MULHER' && <User className={`w-5 h-5 ${item.visitStatus ? 'text-white' : 'text-pink-500 fill-pink-500'}`} />}
                                                {item.gender === 'CASAL' && (
                                                    <div className="flex items-center -space-x-1">
                                                        <User className={`w-4 h-4 ${item.visitStatus ? 'text-white' : 'text-primary fill-primary'}`} />
                                                        <User className={`w-4 h-4 ${item.visitStatus ? 'text-white' : 'text-pink-500 fill-pink-500'}`} />
                                                    </div>
                                                )}
                                                {!item.gender && <MapPin className={`w-6 h-6 ${item.visitStatus ? 'text-white' : 'text-primary'}`} />}
                                            </>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        {listData?.type === 'address' && (
                                            <>
                                                <h3 className="font-bold text-main truncate group-hover:text-primary-dark dark:group-hover:text-primary-light transition-colors">
                                                    {item.street}
                                                    {!item.street?.includes(item.number || '') && item.number !== 'S/N' ? `, ${item.number}` : ''}
                                                    {item.complement ? ` - ${item.complement}` : ''}
                                                </h3>

                                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted">
                                                    {item.peopleCount ? (
                                                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md" title="Número de Pessoas">
                                                            <Users className="w-3 h-3" />
                                                            <span className="font-bold">{item.peopleCount}</span>
                                                        </div>
                                                    ) : null}
                                                    {item.residentName && <span className="font-semibold text-main">{item.residentName}</span>}

                                                    {item.gender && (
                                                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase ${item.gender === 'HOMEM' ? 'bg-primary-light/50 text-primary-dark dark:bg-primary-dark/30 dark:text-primary-light' :
                                                            item.gender === 'MULHER' ? 'bg-pink-100/50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400' :
                                                                'bg-primary-light/30 text-primary-dark dark:bg-primary-dark/20 dark:text-primary-light'
                                                            }`}>
                                                            {item.gender === 'HOMEM' && <User className="w-3 h-3 fill-current" />}
                                                            {item.gender === 'MULHER' && <User className="w-3 h-3 fill-current" />}
                                                            {item.gender === 'CASAL' && (
                                                                <div className="flex -space-x-1">
                                                                    <User className="w-2.5 h-2.5 fill-current" />
                                                                    <User className="w-2.5 h-2.5 fill-current" />
                                                                </div>
                                                            )}
                                                            {item.gender === 'HOMEM' ? 'Homem' : item.gender === 'MULHER' ? 'Mulher' : 'Casal'}
                                                        </span>
                                                    )}

                                                    {item.is_deaf && (
                                                        <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                            <Ear className="w-3 h-3" /> Surdo
                                                        </span>
                                                    )}
                                                    {item.is_minor && (
                                                        <span className="flex items-center gap-1 bg-primary-light/30 text-primary-dark px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                            <Baby className="w-3 h-3" /> Menor
                                                        </span>
                                                    )}
                                                    {item.is_student && (
                                                        <span className="flex items-center gap-1 bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                            <GraduationCap className="w-3 h-3" /> Estudante
                                                        </span>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        {listData?.type === 'city' && (
                                            <h3 className="font-bold text-main truncate group-hover:text-primary-dark dark:group-hover:text-primary-light transition-colors">{item.name}</h3>
                                        )}
                                        {listData?.type === 'territory' && (
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-main text-base truncate">{item.name}</h3>
                                                    <span className="text-[10px] font-bold text-primary-dark bg-primary-light/50 dark:bg-primary-dark/50 dark:text-primary-light px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        {addressCounts[item.id] || 0} Endereços
                                                    </span>
                                                </div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider line-clamp-1">
                                                    {item.description || 'VER ENDEREÇOS'}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Menu Action */}
                                    <div className="relative z-10 flex flex-col gap-2 items-end">
                                        {listData?.type === 'address' ? (
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === item.id ? null : item.id);
                                                    }}
                                                    className={`p-2 rounded-full transition-colors ${openMenuId === item.id ? 'bg-primary-light/50 dark:bg-primary-dark/30 text-primary dark:text-primary-light' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>

                                                {openMenuId === item.id && (
                                                    <div className="absolute right-0 top-10 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-primary-light/20 dark:border-slate-800 p-1 z-[30] min-w-[170px] animate-in fade-in zoom-in-95 duration-200">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewingHistoryItem(item);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-primary-light/20 dark:hover:bg-primary-dark/20 hover:text-primary dark:hover:text-primary-light rounded-lg transition-colors w-full text-left"
                                                        >
                                                            <HistoryIcon className="w-4 h-4" />
                                                            Ver Histórico
                                                        </button>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenMap(item);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 text-primary dark:text-primary-light rounded-lg transition-colors w-full text-left"
                                                        >
                                                            <Navigation className="w-4 h-4" />
                                                            Abrir no Mapa
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                {/* Individual Return Action for Territories */}
                                                {listData?.type === 'territory' && listData.items.length > 1 && (
                                                    <div onClick={e => e.stopPropagation()}>
                                                        {item.visitStatus === 'completed' ? (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleUndoReturnTerritory(item.id, item.name);
                                                                }}
                                                                className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                                                                title="Desfazer devolução"
                                                            >
                                                                <CheckCircle className="w-5 h-5" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleReturnTerritory(item.id, item.name);
                                                                }}
                                                                className="p-2 rounded-full text-gray-300 hover:text-green-500 hover:bg-green-50 transition-colors"
                                                                title="Devolver Território"
                                                            >
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

            </main>

            {visitingItem && (
                <VisitReportModal
                    address={visitingItem}
                    onClose={() => setVisitingItem(null)}
                    onSave={handleSaveVisit}
                    onViewHistory={() => {
                        setViewingHistoryItem(visitingItem);
                        setVisitingItem(null);
                    }}
                />
            )}

            {/* History Modal */}
            {viewingHistoryItem && (
                <VisitHistoryModal
                    onClose={() => setViewingHistoryItem(null)}
                    addressId={viewingHistoryItem.id}
                    address={viewingHistoryItem.street}
                />
            )}

            {isResponsibilityModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-surface w-full max-w-sm rounded-[2rem] p-6 space-y-6 animate-in slide-in-from-bottom-5">
                        <h2 className="text-xl font-black text-center">Aceitar Responsabilidade?</h2>
                        <p className="text-center text-muted">Ao aceitar, você se compromete a trabalhar este território.</p>
                        <div className="space-y-3">
                            <button onClick={handleAcceptResponsibility} disabled={accepting} className="w-full bg-primary text-white py-4 rounded-lg font-bold">
                                {accepting ? "Aceitando..." : "Sim, Aceitar"}
                            </button>
                            <button onClick={() => setIsResponsibilityModalOpen(false)} className="w-full text-muted py-3 font-bold">
                                Apenas Visualizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BottomNav />
        </div>
    );
}

