"use client";

import { useState, useEffect, Suspense } from 'react';
import {
    Plus,
    Link as LinkIcon,
    Link2,
    X,
    Map as MapIcon,
    Search,
    MapPin,
    ArrowRight,
    Loader2,
    Trash2,
    LogOut,
    Building2,
    List,
    History,
    MoreVertical,
    User,
    HelpCircle
} from 'lucide-react';
import HelpModal from '@/app/components/HelpModal';
import MapView from '@/app/components/MapView';
import BottomNav from '@/app/components/BottomNav';
import TerritoryHistoryModal from '@/app/components/TerritoryHistoryModal';
import TerritoryAssignmentsModal from '@/app/components/TerritoryAssignmentsModal';
import AssignedUserBadge from '@/app/components/AssignedUserBadge';
import { db, auth } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp, addDoc, deleteDoc, doc, where, serverTimestamp, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatRelativeDate } from '@/lib/dateUtils';
import { getServiceYearRange, getServiceYear } from '@/lib/serviceYearUtils';

interface Territory {
    id: string;
    name: string;
    description?: string;
    cityId: string;
    congregationId: string;
    createdAt?: Timestamp;
    lat?: number;
    lng?: number;
    status?: 'LIVRE' | 'OCUPADO';
}

function TerritoryListContent() {
    const searchParams = useSearchParams();
    const congregationId = searchParams.get('congregationId');
    const cityId = searchParams.get('cityId');
    const { user, isAdmin, isElder, isServant, loading: authLoading } = useAuth();
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [localTermType, setLocalTermType] = useState<'city' | 'neighborhood'>('city');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTerritoryName, setNewTerritoryName] = useState('');
    const [newTerritoryDesc, setNewTerritoryDesc] = useState('');
    const [cityName, setCityName] = useState('');
    const router = useRouter();


    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const [shareExpiration, setShareExpiration] = useState('24h');

    // History state
    const [selectedTerritoryForHistory, setSelectedTerritoryForHistory] = useState<{ id: string, name: string } | null>(null);

    // Dropdown state
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    // Edit State
    const [editingTerritory, setEditingTerritory] = useState<{ id: string, name: string, description: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null);
        if (activeMenu) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [activeMenu]);

    useEffect(() => {
        if (cityId) {
            getDoc(doc(db, "cities", cityId)).then(doc => {
                if (doc.exists()) {
                    setCityName(doc.data().name);
                }
            });
        }
    }, [cityId]);

    // Fetch Congregation Settings (TermType)
    useEffect(() => {
        if (!congregationId) return;

        const fetchSettings = async () => {
            try {
                const { getDoc, doc } = await import('firebase/firestore');
                const docSnap = await getDoc(doc(db, "congregations", congregationId));
                if (docSnap.exists()) {
                    setLocalTermType(docSnap.data().termType || 'city');
                }
            } catch (err) {
                console.error("Error fetching congregation termType:", err);
            }
        };

        fetchSettings();
    }, [congregationId]);

    // Address Counts State
    const [addressCounts, setAddressCounts] = useState<Record<string, number>>({});

    // Territory Assignments State: territoryId -> Assignment[]
    interface Assignment {
        id: string; // shared_list doc id
        listTitle: string;
        assignedName: string;
        assignedTo: string;
        assignedAt?: any;
    }
    const [territoryAssignments, setTerritoryAssignments] = useState<Record<string, Assignment[]>>({});
    const [sharingStatusMap, setSharingStatusMap] = useState<Record<string, boolean>>({}); // Just tracking if it is shared (for orange badge fallback)

    // Modal state for assignments
    const [selectedTerritoryForAssignments, setSelectedTerritoryForAssignments] = useState<{ id: string, name: string, assignments: Assignment[] } | null>(null);

    // Gender Stats State: territoryId -> { men: number, women: number, couples: number }
    const [genderStats, setGenderStats] = useState<Record<string, { men: number, women: number, couples: number }>>({});

    // Last Completion Date State: territoryId -> Date
    const [lastCompletionDates, setLastCompletionDates] = useState<Record<string, Date>>({});

    // New Territory Lat/Lng
    const [newTerritoryLat, setNewTerritoryLat] = useState('');
    const [newTerritoryLng, setNewTerritoryLng] = useState('');

    // Deep Search State
    const [searchInItems, setSearchInItems] = useState(false);
    const [territorySearchIndex, setTerritorySearchIndex] = useState<Record<string, string>>({});



    useEffect(() => {
        if (!congregationId || !cityId) return;

        // Query territories filtered by cityId and congregationId
        const q = query(
            collection(db, "territories"),
            where("congregationId", "==", congregationId),
            where("cityId", "==", cityId)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const data: Territory[] = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as Territory);
            });
            // Client-side sort
            data.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            setTerritories(data);

            setLoading(false);
        });

        return () => unsubscribe();
    }, [congregationId, cityId]);

    const [allAddresses, setAllAddresses] = useState<any[]>([]);

    useEffect(() => {
        if (!congregationId || !cityId) return;

        const q = query(
            collection(db, "addresses"),
            where("congregationId", "==", congregationId),
            where("cityId", "==", cityId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const counts: Record<string, number> = {};
            const gStats: Record<string, { men: number, women: number, couples: number }> = {};
            const searchIndex: Record<string, string> = {};
            const loadedAddresses: any[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                const tId = data.territoryId;

                loadedAddresses.push({ id: doc.id, ...data });

                if (tId && data.isActive !== false) {
                    counts[tId] = (counts[tId] || 0) + 1;

                    // Build search index
                    const searchString = `${data.street || ''} ${data.number || ''} ${data.residentName || ''} ${data.notes || ''}`.toLowerCase();
                    searchIndex[tId] = (searchIndex[tId] || '') + ' ' + searchString;

                    if (!gStats[tId]) gStats[tId] = { men: 0, women: 0, couples: 0 };
                    if (data.gender === 'HOMEM') gStats[tId].men++;
                    else if (data.gender === 'MULHER') gStats[tId].women++;
                    else if (data.gender === 'CASAL') gStats[tId].couples++;
                }
            });
            setAddressCounts(counts);
            setGenderStats(gStats);
            setTerritorySearchIndex(searchIndex);
            setAllAddresses(loadedAddresses);
        });

        return () => unsubscribe();
    }, [congregationId, cityId]);

    // Fetch Active Shared Lists to determine status and assignments
    useEffect(() => {
        if (!congregationId) return;

        const q = query(
            collection(db, "shared_lists"),
            where("congregationId", "==", congregationId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const assignmentsMap: Record<string, Assignment[]> = {};
            const sharedMap: Record<string, boolean> = {};
            const completionMap: Record<string, Date> = {};

            // Sort docs in memory descending by creation time
            const sortedDocs = [...snapshot.docs].sort((a, b) => {
                const ta = a.data().createdAt?.seconds || 0;
                const tb = b.data().createdAt?.seconds || 0;
                return tb - ta;
            });

            sortedDocs.forEach(doc => {
                const data = doc.data();

                if (data.type === 'territory' && data.items && Array.isArray(data.items)) {
                    // Active Assignments
                    if (data.status !== 'completed') {
                        data.items.forEach((tId: string) => {
                            sharedMap[tId] = true;
                            if (data.assignedName && data.assignedTo) {
                                if (!assignmentsMap[tId]) assignmentsMap[tId] = [];
                                assignmentsMap[tId].push({
                                    id: doc.id,
                                    listTitle: data.title,
                                    assignedName: data.assignedName,
                                    assignedTo: data.assignedTo,
                                    assignedAt: data.assignedAt
                                });
                            }
                        });
                    }
                    // Completed History (Find latest)
                    else if (data.status === 'completed' && (data.completedAt || data.returnedAt)) {
                        data.items.forEach((tId: string) => {
                            const existing = completionMap[tId];
                            // Safety check for toDate
                            const dateField = data.returnedAt || data.completedAt;
                            const current = dateField.toDate ? dateField.toDate() : new Date(dateField.seconds * 1000);
                            if (!existing || current > existing) {
                                completionMap[tId] = current;
                            }
                        });
                    }
                }
            });
            setTerritoryAssignments(assignmentsMap);
            setSharingStatusMap(sharedMap);
            setLastCompletionDates(completionMap);
        });

        return () => unsubscribe();
    }, [congregationId]);

    const handleCreateTerritory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTerritoryName.trim() || !cityId || !congregationId) return;

        try {
            await addDoc(collection(db, "territories"), {
                name: newTerritoryName.trim(),
                description: newTerritoryDesc.trim(),
                cityId: cityId,
                congregationId: congregationId,
                lat: newTerritoryLat ? parseFloat(newTerritoryLat) : null,
                lng: newTerritoryLng ? parseFloat(newTerritoryLng) : null,
                status: 'LIVRE',
                createdAt: serverTimestamp()
            });
            setNewTerritoryName('');
            setNewTerritoryDesc('');
            setNewTerritoryLat('');
            setNewTerritoryLng('');
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error("Error creating territory:", error);
            alert("Erro ao criar território.");
        }
    };

    const handleUpdateTerritory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTerritory || !editName.trim()) return;

        try {
            const { updateDoc, doc } = await import('firebase/firestore');
            await updateDoc(doc(db, "territories", editingTerritory.id), {
                name: editName,
                description: editDescription
            });
            setIsEditModalOpen(false);
            setEditingTerritory(null);
        } catch (error) {
            console.error("Error updating territory:", error);
            alert("Erro ao atualizar território.");
        }
    };

    const handleDeleteTerritory = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja excluir o território ${name}?`)) return;
        try {
            await deleteDoc(doc(db, "territories", id));
        } catch (error) {
            console.error("Error deleting territory:", error);
            alert("Erro ao excluir território.");
        }
    };

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);

        if (newSelected.size === 0) {
            setIsSelectionMode(false);
        } else {
            setIsSelectionMode(true);
        }
    };

    const handleConfirmShare = async () => {
        if (selectedIds.size === 0) return;

        try {
            const { writeBatch, doc, collection } = await import('firebase/firestore');

            const now = new Date();
            let expiresAt = new Date();

            switch (shareExpiration) {
                case '1h': expiresAt.setHours(now.getHours() + 1); break;
                case '24h': expiresAt.setHours(now.getHours() + 24); break;
                case '7d': expiresAt.setDate(now.getDate() + 7); break;
                case '30d': expiresAt.setDate(now.getDate() + 30); break;
                case 'never': expiresAt.setFullYear(now.getFullYear() + 100); break;
            }

            const batch = writeBatch(db);
            const shareRef = doc(collection(db, "shared_lists"));

            batch.set(shareRef, {
                type: 'territory',
                items: Array.from(selectedIds), // Keep this for reference/indexing if needed
                createdBy: user?.uid,
                congregationId: congregationId,
                cityId: cityId,
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(expiresAt),
                status: 'active',
                title: selectedIds.size + " Territórios Compartilhados"
            });

            // Snapshot Items (Territories)
            selectedIds.forEach(id => {
                const territory = territories.find(t => t.id === id);
                if (territory) {
                    const itemRef = doc(shareRef, "items", id);
                    batch.set(itemRef, {
                        ...territory,
                        originalId: territory.id,
                        snapshottedAt: serverTimestamp()
                    });

                    // Snapshot Addresses for this Territory
                    const territoryAddresses = allAddresses.filter(a => a.territoryId === id);
                    territoryAddresses.forEach(addr => {
                        const addrRef = doc(shareRef, "territory_addresses", addr.id);
                        batch.set(addrRef, {
                            ...addr,
                            originalId: addr.id, // Store original ID for reference
                            snapshottedAt: serverTimestamp()
                        });
                    });
                }
            });

            await batch.commit();

            const shareUrl = window.location.origin + "/share?id=" + shareRef.id;
            await navigator.clipboard.writeText(shareUrl);
            alert("Link copiado para a área de transferência! Validade definida.");
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            setIsShareModalOpen(false);
        } catch (error) {
            console.error("Error creating share:", error);
            alert("Erro ao gerar link de compartilhamento.");
        }
    };

    const filteredTerritories = territories.filter(t => {
        const matchesName = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchTerm.toLowerCase());

        if (searchInItems && searchTerm) {
            const indexContent = territorySearchIndex[t.id] || '';
            const matchesContent = indexContent.includes(searchTerm.toLowerCase());
            return matchesName || matchesContent;
        }

        return matchesName;
    });

    if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    if (!congregationId || !cityId) {
        return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-muted">Informações incompletas.</div>;
    }

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main transition-colors duration-300">
            {/* Header */}
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex justify-between items-center shadow-sm dark:shadow-none transition-colors">
                <div className="flex items-center gap-3">
                    <Link href={`/my-maps/city?congregationId=${congregationId}`} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title={`Voltar para ${localTermType === 'neighborhood' ? 'Bairros' : 'Cidades'}`}>
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </Link>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg text-main tracking-tight leading-none">{cityName}</span>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider">{localTermType === 'neighborhood' ? 'Bairro' : 'Cidade'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {(isElder || isServant) && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-gray-900 border-gray-900 border hover:bg-black dark:bg-surface-highlight dark:hover:bg-slate-800 text-white dark:text-main dark:border-surface-border p-2 rounded-xl shadow-lg transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="p-1.5 text-muted hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                        title="Ajuda"
                    >
                        <HelpCircle className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <HelpModal
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
                title="Gestão de Territórios"
                description={`Visualize e gerencie os territórios do ${localTermType === 'neighborhood' ? 'bairro selecionado' : 'cidade selecionada'}.`}
                steps={[
                    { title: "Status", text: "Veja quais territórios estão 'Livres', 'Ocupados' ou 'Compartilhados'." },
                    { title: "Histórico", text: "Acesse o menu de três pontos para ver quem trabalhou no território anteriormente." },
                    { title: "Endereços", text: "Clique no território para ver a lista de endereços e registrar visitas." }
                ]}
                tips={[
                    "O selo azul mostra quantos endereços ativos existem em cada território.",
                    "Se você é admin, pode compartilhar vários territórios de uma vez selecionando-os pela caixa de seleção."
                ]}
            />

            <div className="px-6 pt-6 space-y-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar território..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-transparent dark:border-surface-border text-main text-sm font-medium rounded-2xl py-4 pl-12 pr-36 shadow-sm dark:shadow-none focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-muted"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={searchInItems}
                                onChange={(e) => setSearchInItems(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-primary hover:text-primary-dark transition-colors"
                            />
                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 select-none hover:text-primary transition-colors">Buscar itens</span>
                        </label>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : filteredTerritories.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <MapIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-400 font-medium">Nenhum território encontrado</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredTerritories.map(t => {
                            const isSelected = selectedIds.has(t.id);
                            const assignments = territoryAssignments[t.id] || [];
                            const hasSharing = sharingStatusMap[t.id];
                            const historyDate = lastCompletionDates[t.id];
                            const isOutdated = historyDate && historyDate < getServiceYearRange(getServiceYear()).start;

                            return (
                                <div
                                    key={t.id}
                                    className={`group bg-surface rounded-2xl p-3 border border-surface-border shadow-sm hover:shadow-md transition-all relative ${isSelected ? 'ring-2 ring-primary bg-primary-light/10' : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        {(isAdmin || isServant) && (
                                            <div onClick={(e) => e.stopPropagation()} className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(t.id)}
                                                    className="w-5 h-5 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-primary focus:ring-primary transition-all cursor-pointer"
                                                />
                                            </div>
                                        )}

                                        <Link
                                            href={`/my-maps/address?congregationId=${congregationId}&cityId=${cityId}&territoryId=${t.id}`}
                                            className="flex-1 min-w-0 flex flex-col gap-1.5 pb-1"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.status === 'OCUPADO' ? 'bg-primary-light/50 dark:bg-primary-dark/20 text-primary dark:text-primary-light' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}>
                                                    <MapIcon className="w-4.5 h-4.5" />
                                                </div>
                                                <div className="min-w-0 flex-1 pt-0.5">
                                                    <h3 className="font-bold text-main text-base leading-tight truncate pr-1">{t.name}</h3>
                                                    <p className="text-xs text-muted font-medium line-clamp-2 mt-0.5 leading-snug">{t.description || 'Sem descrição'}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 pl-0.5">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap ${!addressCounts[t.id] ? 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' : 'text-primary bg-primary-light/50 dark:bg-primary-dark/30 dark:text-primary-light'}`}>
                                                    {addressCounts[t.id] || 0} Endereços
                                                </span>

                                                {genderStats[t.id] && (genderStats[t.id].men > 0 || genderStats[t.id].women > 0 || genderStats[t.id].couples > 0) && (
                                                    <div className="flex items-center gap-2 px-1 border-l border-gray-200 dark:border-gray-700">
                                                        {genderStats[t.id].men > 0 && <div className="flex items-center gap-0.5 text-blue-500"><User className="w-3 h-3 fill-current" /><span className="text-[10px] font-black">{genderStats[t.id].men}</span></div>}
                                                        {genderStats[t.id].women > 0 && <div className="flex items-center gap-0.5 text-pink-500"><User className="w-3 h-3 fill-current" /><span className="text-[10px] font-black">{genderStats[t.id].women}</span></div>}
                                                        {genderStats[t.id].couples > 0 && <div className="flex items-center gap-0.5 text-purple-600"><div className="flex -space-x-1"><User className="w-2.5 h-2.5 fill-current" /><User className="w-2.5 h-2.5 fill-current" /></div><span className="text-[10px] font-black">{genderStats[t.id].couples}</span></div>}
                                                    </div>
                                                )}

                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${isOutdated ? 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : 'text-muted bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                                                    <History className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase whitespace-nowrap">
                                                        {historyDate ? formatRelativeDate(historyDate) : 'Sem dados'}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>

                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            {(isElder || isServant) && (
                                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => setActiveMenu(activeMenu === t.id ? null : t.id)} className={`p-1.5 rounded-lg transition-colors ${activeMenu === t.id ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/50' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                                        <MoreVertical className="w-4.5 h-4.5" />
                                                    </button>
                                                    {activeMenu === t.id && (
                                                        <div className="absolute right-0 mt-2 w-48 bg-surface rounded-2xl shadow-xl border border-surface-border z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                                                            <Link href={`/my-maps/address?congregationId=${congregationId}&cityId=${cityId}&territoryId=${t.id}`} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors w-full text-left">
                                                                <ArrowRight className="w-4 h-4" /> Abrir
                                                            </Link>
                                                            <button onClick={() => { setSelectedTerritoryForHistory({ id: t.id, name: t.name }); setActiveMenu(null); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors w-full text-left">
                                                                <History className="w-4 h-4" /> Histórico
                                                            </button>
                                                            {(isAdmin || isServant) && (
                                                                <button onClick={() => {
                                                                    setEditingTerritory({ id: t.id, name: t.name, description: t.description || '' });
                                                                    setEditName(t.name);
                                                                    setEditDescription(t.description || '');
                                                                    setIsEditModalOpen(true);
                                                                    setActiveMenu(null);
                                                                }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors w-full text-left">
                                                                    <List className="w-4 h-4" /> Editar
                                                                </button>
                                                            )}
                                                            {(isElder || isServant) && (
                                                                <>
                                                                    <div className="h-px bg-gray-100 dark:bg-gray-800 mx-2 my-1" />
                                                                    <button onClick={() => { handleDeleteTerritory(t.id, t.name); setActiveMenu(null); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full text-left">
                                                                        <Trash2 className="w-4 h-4" /> Excluir
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div onClick={e => e.stopPropagation()}>
                                                {assignments.length > 0 ? (
                                                    <button onClick={() => setSelectedTerritoryForAssignments({ id: t.id, name: t.name, assignments })} className="flex flex-col items-end">
                                                        <div className="text-[10px] font-bold text-primary-600 bg-primary-50 border border-primary-100 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-400 px-2 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors flex items-center gap-1">
                                                            <AssignedUserBadge userId={assignments[0].assignedTo} fallbackName={assignments[0].assignedName} />
                                                            {assignments.length > 1 && <span className="ml-0.5 bg-primary-200 dark:bg-primary-800 text-primary-800 dark:text-primary-200 px-1 rounded-full text-[9px]">+{assignments.length - 1}</span>}
                                                        </div>
                                                    </button>
                                                ) : hasSharing ? (
                                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400 px-2 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">Compartilhado</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400 px-2 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">Livre</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
                }

                {/* Floating Action Bar (Admin/Leaders) - for sharing multiple maps selection */}
                {(isAdmin || isServant) && selectedIds.size > 0 && (
                    <div className="fixed bottom-24 left-6 right-6 z-40 bg-gray-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-3">
                            <span className="bg-primary px-3 py-1 rounded-lg text-xs font-bold">{selectedIds.size}</span>
                            <span className="text-sm">selecionados</span>
                        </div>
                        <button
                            onClick={() => {
                                const ids = Array.from(selectedIds).join(',');
                                const currentPath = window.location.pathname; // Capture current path for return
                                router.push(`/share-setup?ids=${ids}&returnUrl=${encodeURIComponent(currentPath)}`);
                            }}
                            className="bg-white text-gray-900 px-4 py-2 rounded-xl text-xs font-bold flex gap-2 active:scale-95 transition-transform"
                        >
                            <LinkIcon className="w-4 h-4" /> LINK
                        </button>
                    </div>
                )}

                {/* Share Modal */}
                {isShareModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200">
                            <button
                                onClick={() => setIsShareModalOpen(false)}
                                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Configurar Link</h2>
                                <p className="text-sm text-gray-500">Defina por quanto tempo o link será válido.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Validade</label>
                                    <select
                                        value={shareExpiration}
                                        onChange={(e) => setShareExpiration(e.target.value)}
                                        className="w-full bg-gray-50 border-none rounded-xl p-3 text-gray-900 font-bold focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="1h">1 Hora</option>
                                        <option value="24h">24 Horas (1 Dia)</option>
                                        <option value="7d">7 Dias</option>
                                        <option value="30d">30 Dias</option>
                                        <option value="never">Sem validade (Permanente)</option>
                                    </select>
                                </div>

                                <button
                                    onClick={handleConfirmShare}
                                    className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-colors mt-2"
                                >
                                    <Link2 className="w-5 h-5" />
                                    GERAR LINK AGORA
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div >

            {/* Create Modal */}
            {
                isCreateModalOpen && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-transparent dark:border-slate-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Plus className="w-6 h-6 text-primary" />
                                Novo Território
                            </h2>
                            <form onSubmit={handleCreateTerritory} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Número/Nome</label>
                                    <input
                                        type="text"
                                        value={newTerritoryName}
                                        onChange={(e) => setNewTerritoryName(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 font-bold text-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-gray-400"
                                        placeholder="Ex: 01"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Descrição</label>
                                    <textarea
                                        rows={3}
                                        value={newTerritoryDesc}
                                        onChange={(e) => setNewTerritoryDesc(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none resize-none placeholder:text-gray-400"
                                        placeholder="Ex: Centro, perto da praça..."
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors">Criar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Edit Modal */}
            {
                isEditModalOpen && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-transparent dark:border-slate-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <List className="w-6 h-6 text-primary" />
                                Editar Território
                            </h2>
                            <form onSubmit={handleUpdateTerritory} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Número/Nome</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 font-bold text-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-gray-400"
                                        placeholder="Ex: 01"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Descrição</label>
                                    <textarea
                                        rows={3}
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none resize-none placeholder:text-gray-400"
                                        placeholder="Ex: Centro, perto da praça..."
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors">Salvar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            <BottomNav />

            {/* History Modal */}
            {
                selectedTerritoryForHistory && (
                    <TerritoryHistoryModal
                        territoryId={selectedTerritoryForHistory.id}
                        territoryName={selectedTerritoryForHistory.name}
                        onClose={() => setSelectedTerritoryForHistory(null)}
                    />
                )
            }

            {/* Assignments Modal */}
            {
                selectedTerritoryForAssignments && (
                    <TerritoryAssignmentsModal
                        territoryName={selectedTerritoryForAssignments.name}
                        assignments={selectedTerritoryForAssignments.assignments}
                        onClose={() => setSelectedTerritoryForAssignments(null)}
                    />
                )
            }
        </div >
    );
}

export default function TerritoryListPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <TerritoryListContent />
        </Suspense>
    );
}
