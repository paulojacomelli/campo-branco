"use client";

import { useEffect, useState, Suspense } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, documentId, getDocs, updateDoc, serverTimestamp, Timestamp, setDoc } from 'firebase/firestore';
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
    const { user } = useAuth();
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
                // 1. Fetch List Metadata (Directly from Firestore)
                const docRef = doc(db, "shared_lists", id);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    setError("Link não encontrado.");
                    setLoading(false);
                    return;
                }

                const list = docSnap.data() as SharedList;

                if (list.expiresAt) {
                    const now = new Date();
                    const expires = list.expiresAt.toDate ? list.expiresAt.toDate() : new Date(list.expiresAt.seconds * 1000);
                    if (now > expires) {
                        setError("Link expirado.");
                        setLoading(false);
                        return;
                    }
                }

                setListData(list);

                // Show responsibility modal if no one is assigned and list is active
                if (!list.assignedTo && !list.assignedName && list.status !== 'completed') {
                    setIsResponsibilityModalOpen(true);
                }

                // 2. Fetch Snapshotted Items (Public Subcollection)
                console.log(`[SharedListView] Fetching items for list ${id}...`);
                const itemsRef = collection(db, "shared_lists", id, "items");
                const itemsSnap = await getDocs(itemsRef);
                console.log(`[SharedListView] Items snapshot size: ${itemsSnap.size}`);

                const fetchedItems: any[] = [];

                if (!itemsSnap.empty) {
                    itemsSnap.forEach(doc => {
                        fetchedItems.push(doc.data());
                    });
                } else if (list.items && list.items.length > 0) {
                    console.log("[SharedListView] Subcollection empty, falling back to live items from ID array.");

                    // Determine collection
                    let collectionName = 'territories';
                    if (list.type === 'city') collectionName = 'cities';
                    if (list.type === 'address') collectionName = 'addresses';

                    // Chunk queries to avoid "in" limits (max 30 usually, keep safe at 10)
                    const chunks = [];
                    for (let i = 0; i < list.items.length; i += 10) {
                        chunks.push(list.items.slice(i, i + 10));
                    }

                    for (const chunk of chunks) {
                        // Use documentId() to query by ID
                        const q = query(collection(db, collectionName), where(documentId(), "in", chunk));
                        const snap = await getDocs(q);
                        snap.forEach(d => fetchedItems.push({ id: d.id, ...d.data() }));
                    }
                }

                // 3. Fetch Scoped Results (Public Subcollection - Client Side)
                const resultsRef = collection(db, "shared_lists", id, "results");
                const resultsSnap = await getDocs(resultsRef);
                const linkResults: Record<string, any> = {};
                resultsSnap.forEach(rdoc => {
                    linkResults[rdoc.id] = rdoc.data();
                });

                // Merge Items with Results
                const mergedItems = fetchedItems.map((item: any) => {
                    const result = linkResults[item.id];
                    // Fallback to the item's own status if no link-specific result exists (and it was active at snapshot time)
                    return {
                        ...item,
                        completed: (result?.status || item.visitStatus) === 'contacted',
                        visitStatus: result?.status || item.visitStatus || ''
                    };
                });

                console.log(`[SharedListView] Merging ${fetchedItems.length} items with ${Object.keys(linkResults).length} results.`);

                setItems(mergedItems);
                console.log(`[SharedListView] setItems called with ${mergedItems.length} items.`);

                // 4. Calculate Counts and Stats (if Territory)
                if (list.type === 'territory') {
                    // Fetch Snapshotted Addresses for Stats
                    const addrRef = collection(db, "shared_lists", id, "territory_addresses");
                    const addrSnap = await getDocs(addrRef);

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

                    addrSnap.forEach((doc) => {
                        const addr = doc.data();

                        // Count per territory - ONLY if active
                        if (addr.territoryId && addr.isActive !== false) {
                            counts[addr.territoryId] = (counts[addr.territoryId] || 0) + 1;
                        }

                        if (addr.isActive !== false) {
                            stats.total++;

                            // Override status with link-specific result
                            const result = linkResults[addr.id];
                            const currentStatus = result?.status;

                            if (currentStatus) {
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

            await updateDoc(doc(db, "shared_lists", id), {
                expiresAt: Timestamp.fromDate(expiresAt),
                returnedAt: serverTimestamp(),
                status: 'completed'
            });

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
            const res = await fetch(`/api/share/${id}/return-item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ territoryId, action: 'return' })
            });

            if (!res.ok) throw new Error("Erro ao processar devolução.");

            const data = await res.json();

            if (data.listCompleted) {
                alert("Todos os territórios foram devolvidos! O mapa será concluído.");
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
            const res = await fetch(`/api/share/${id}/return-item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ territoryId, action: 'undo' })
            });

            if (!res.ok) throw new Error("Erro ao desfazer devolução.");

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
            // 1. Assign territory to user
            await updateDoc(doc(db, "shared_lists", id), {
                assignedTo: user.uid,
                assignedName: user.displayName || 'Irmão sem Nome',
                assignedAt: serverTimestamp()
            });

            // 2. Automatic Binding: If user has no congregation, bind to this one
            if (listData?.congregationId) {
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));

                let targetRef = userRef;
                if (!userSnap.empty) targetRef = userSnap.docs[0].ref;

                const userDoc = await getDoc(targetRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (!userData.congregationId) {
                        await updateDoc(targetRef, {
                            congregationId: listData.congregationId,
                            role: 'PUBLICADOR',
                            updatedAt: serverTimestamp()
                        });
                        window.location.reload();
                        return;
                    }
                } else {
                    await setDoc(targetRef, {
                        email: user.email,
                        name: user.displayName,
                        congregationId: listData.congregationId,
                        role: 'PUBLICADOR',
                        createdAt: serverTimestamp()
                    });
                    window.location.reload();
                    return;
                }
            }

            setIsResponsibilityModalOpen(false);
            setListData(prev => prev ? { ...prev, assignedTo: user.uid, assignedName: user.displayName || 'Irmão sem Nome' } : null);
        } catch (e) {
            console.error("Error accepting responsibility:", e);
            alert("Erro ao aceitar responsabilidade ou vincular à congregação.");
        } finally {
            setAccepting(false);
        }

    };

    const handleSaveVisit = async (data: any) => {
        if (!visitingItem || !id) return;

        // Optimistic UI Update (Feedback Instantâneo)
        setItems(prev => prev.map(item =>
            item.id === visitingItem.id
                ? { ...item, completed: data.status === 'contacted', visitStatus: data.status }
                : item
        ));

        // Armazena ID temporário para reverter em caso de erro fatal
        const savedItem = visitingItem;
        setVisitingItem(null);

        try {
            const { writeBatch } = await import('firebase/firestore');
            const batch = writeBatch(db);
            const now = serverTimestamp();

            // 1. Visit Log
            const visitRef = doc(collection(db, "addresses", savedItem.id, "visits"));
            batch.set(visitRef, {
                status: data.status,
                date: now,
                userId: user?.uid,
                userName: user?.displayName || 'Publicador',
                notes: data.observations || '',
                congregationId: listData?.congregationId || listData?.context?.congregationId,
                cityId: savedItem.cityId || listData?.cityId,
                territoryId: savedItem.territoryId || listData?.territoryId,
                tagsSnapshot: {
                    isDeaf: data.isDeaf || false,
                    isMinor: data.isMinor || false,
                    isStudent: data.isStudent || false,
                    isNeurodivergent: data.isNeurodivergent || false
                },
                shareId: id
            });

            // 2. Shared List Result (Public/Open)
            const resultRef = doc(db, "shared_lists", id, "results", savedItem.id);
            batch.set(resultRef, {
                status: data.status,
                observations: data.observations || '',
                updatedAt: now,
                reportedBy: user?.uid
            }, { merge: true });

            await batch.commit();

            // 3. Address Update (Best Effort)
            try {
                const addressRef = doc(db, "addresses", savedItem.id);
                const addressUpdates: any = {
                    visitStatus: data.status,
                    lastVisitedAt: now,
                    isDeaf: data.isDeaf || false,
                    isMinor: data.isMinor || false,
                    isStudent: data.isStudent || false,
                    isNeurodivergent: data.isNeurodivergent || false,
                    observations: data.observations || ''
                };
                if (data.status === 'contacted') addressUpdates.completed = true;

                await updateDoc(addressRef, addressUpdates);
            } catch (localErr) {
                console.warn("Address update skipped (permissions):", localErr);
            }

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
                    <div className="bg-surface rounded-3xl p-6 shadow-xl shadow-primary-light/5 space-y-6 border border-surface-border relative overflow-hidden">

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
                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
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
                                    className={`flex-1 px-6 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg
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
                                className="flex-1 bg-surface hover:bg-background text-primary dark:text-primary-light active:scale-95 transition-all px-6 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-surface-border shadow-sm"
                            >
                                <Share2 className="w-4 h-4" />
                                <span className="uppercase text-xs font-bold tracking-wider">Copiar Link</span>
                            </button>
                        </div>
                    </div>
                )}

                {listData?.type !== 'territory' && (
                    <div className="bg-primary rounded-3xl p-6 shadow-xl shadow-primary-light/20 text-white space-y-6">
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
                            className="bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-white/10 w-full justify-center sm:w-auto"
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
                                <div className="bg-surface p-4 rounded-2xl border border-surface-border flex items-center gap-4 shadow-sm group-hover:border-primary-light dark:group-hover:border-primary-dark group-hover:shadow-md transition-all relative overflow-hidden">

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
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-sm
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

                                                    {item.isDeaf && (
                                                        <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                            <Ear className="w-3 h-3" /> Surdo
                                                        </span>
                                                    )}
                                                    {item.isMinor && (
                                                        <span className="flex items-center gap-1 bg-primary-light/30 text-primary-dark px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                            <Baby className="w-3 h-3" /> Menor
                                                        </span>
                                                    )}
                                                    {item.isStudent && (
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
                                                    <div className="absolute right-0 top-10 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-primary-light/20 dark:border-slate-800 p-1 z-[30] min-w-[170px] animate-in fade-in zoom-in-95 duration-200">
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
                    isOpen={!!visitingItem}
                    onClose={() => setVisitingItem(null)}
                    address={visitingItem}
                    onSave={handleSaveVisit}
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
                            <button onClick={handleAcceptResponsibility} disabled={accepting} className="w-full bg-primary text-white py-4 rounded-xl font-bold">
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

