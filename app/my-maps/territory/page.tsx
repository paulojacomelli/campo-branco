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
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatRelativeDate } from '@/lib/dateUtils';
import { getServiceYearRange, getServiceYear } from '@/lib/serviceYearUtils';

interface Territory {
    id: string;
    name: string;
    description?: string;
    city_id: string;
    congregation_id: string;
    created_at?: string;
    lat?: number;
    lng?: number;
    status?: 'LIVRE' | 'OCUPADO';
}

function TerritoryListContent() {
    const searchParams = useSearchParams();
    const congregationId = searchParams.get('congregationId');
    const cityId = searchParams.get('cityId');
    const { user, isAdmin, isElder, isServant, loading: authLoading } = useAuth();
    const router = useRouter();

    // State
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [localTermType, setLocalTermType] = useState<'city' | 'neighborhood'>('city');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [cityName, setCityName] = useState('');

    // Create State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTerritoryName, setNewTerritoryName] = useState('');
    const [newTerritoryDesc, setNewTerritoryDesc] = useState('');
    const [newTerritoryLat, setNewTerritoryLat] = useState('');
    const [newTerritoryLng, setNewTerritoryLng] = useState('');

    // Edit State
    const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareExpiration, setShareExpiration] = useState('24h');

    // Data State
    const [addressCounts, setAddressCounts] = useState<Record<string, number>>({});
    const [genderStats, setGenderStats] = useState<Record<string, { men: number, women: number, couples: number }>>({});
    const [territorySearchIndex, setTerritorySearchIndex] = useState<Record<string, string>>({});
    const [allAddresses, setAllAddresses] = useState<any[]>([]);

    // History & Assignments
    const [selectedTerritoryForHistory, setSelectedTerritoryForHistory] = useState<{ id: string, name: string } | null>(null);
    const [territoryAssignments, setTerritoryAssignments] = useState<Record<string, any[]>>({});
    const [sharingStatusMap, setSharingStatusMap] = useState<Record<string, boolean>>({});
    const [lastCompletionDates, setLastCompletionDates] = useState<Record<string, Date>>({});
    const [selectedTerritoryForAssignments, setSelectedTerritoryForAssignments] = useState<{ id: string, name: string, assignments: any[] } | null>(null);

    // UI
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [searchInItems, setSearchInItems] = useState(false);


    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null);
        if (activeMenu) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [activeMenu]);

    // Fetch City Name
    useEffect(() => {
        if (!cityId) return;
        const fetchCity = async () => {
            const { data } = await supabase.from('cities').select('name').eq('id', cityId).single();
            if (data) setCityName(data.name);
        };
        fetchCity();
    }, [cityId]);

    // Fetch Congregation Settings
    useEffect(() => {
        if (!congregationId) return;
        const fetchSettings = async () => {
            const { data } = await supabase.from('congregations').select('term_type').eq('id', congregationId).single();
            if (data) setLocalTermType(data.term_type as any || 'city');
        };
        fetchSettings();
    }, [congregationId]);

    // Fetch Territories
    const fetchTerritories = async () => {
        if (!congregationId || !cityId) return;
        try {
            const { data, error } = await supabase
                .from('territories')
                .select('*')
                .eq('congregation_id', congregationId)
                .eq('city_id', cityId)
                .order('name'); // Basic sort, refinement needed for numeric strings

            if (error) throw error;

            // Client-side numeric sort for names like "1", "2", "10"
            const sorted = (data || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            setTerritories(sorted);
        } catch (error) {
            console.error("Error fetching territories:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTerritories();

        if (congregationId && cityId) {
            const subscription = supabase
                .channel('territories_list')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'territories', filter: `city_id=eq.${cityId}` }, () => {
                    fetchTerritories();
                })
                .subscribe();

            return () => { subscription.unsubscribe(); };
        }
    }, [congregationId, cityId]);

    // Fetch Addresses (for counts and search)
    const fetchAddresses = async () => {
        if (!congregationId || !cityId) return;
        // Optimization: We could use a VIEW or RPC for counts to avoid fetching all addresses
        // For now, mirroring existing logic but selecting fewer fields
        try {
            const { data, error } = await supabase
                .from('addresses')
                .select('id, territory_id, is_active, street, number, resident_name, notes, gender')
                .eq('congregation_id', congregationId)
                .eq('city_id', cityId);

            if (error) throw error;

            const counts: Record<string, number> = {};
            const gStats: Record<string, { men: number, women: number, couples: number }> = {};
            const searchIndex: Record<string, string> = {};

            const addresses = data || [];

            addresses.forEach((addr: any) => {
                if (addr.territory_id && addr.is_active !== false) {
                    counts[addr.territory_id] = (counts[addr.territory_id] || 0) + 1;

                    const searchString = `${addr.street || ''} ${addr.number || ''} ${addr.resident_name || ''} ${addr.notes || ''}`.toLowerCase();
                    searchIndex[addr.territory_id] = (searchIndex[addr.territory_id] || '') + ' ' + searchString;

                    if (!gStats[addr.territory_id]) gStats[addr.territory_id] = { men: 0, women: 0, couples: 0 };

                    const g = addr.gender; // Assuming localized or enum values
                    if (g === 'HOMEM') gStats[addr.territory_id].men++;
                    else if (g === 'MULHER') gStats[addr.territory_id].women++;
                    else if (g === 'CASAL') gStats[addr.territory_id].couples++;
                }
            });

            setAddressCounts(counts);
            setGenderStats(gStats);
            setTerritorySearchIndex(searchIndex);
            setAllAddresses(addresses);
        } catch (error) {
            console.error("Error fetching addresses:", error);
        }
    };

    useEffect(() => {
        fetchAddresses();
        // Realtime for addresses updates affecting counts
        if (congregationId && cityId) {
            const subscription = supabase
                .channel('addresses_count')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'addresses', filter: `city_id=eq.${cityId}` }, () => {
                    fetchAddresses();
                })
                .subscribe();
            return () => { subscription.unsubscribe(); };
        }
    }, [congregationId, cityId]);

    // Fetch Shared Lists (Assignments)
    // TODO: Migrate shared_lists logic fully. This is a placeholder for reading existing structure if migrated, 
    // or assuming we create a new structure. For now, we assume 'shared_lists' table exists in Supabase.
    useEffect(() => {
        if (!congregationId) return;

        const fetchSharedLists = async () => {
            const { data, error } = await supabase
                .from('shared_lists')
                .select('*')
                .eq('congregation_id', congregationId);

            if (error) {
                console.error("Error fetching shared lists:", error);
                return;
            }

            const assignmentsMap: Record<string, any[]> = {};
            const sharedMap: Record<string, boolean> = {};
            // const completionMap: Record<string, Date> = {}; // TODO: Logic for completion history

            data?.forEach(list => {
                if (list.type === 'territory' && list.items && Array.isArray(list.items)) {
                    // Active
                    if (list.status !== 'completed') {
                        list.items.forEach((tId: string) => {
                            sharedMap[tId] = true;
                            if (list.assigned_name && list.assigned_to) {
                                if (!assignmentsMap[tId]) assignmentsMap[tId] = [];
                                assignmentsMap[tId].push({
                                    id: list.id,
                                    listTitle: list.title,
                                    assignedName: list.assigned_name,
                                    assignedTo: list.assigned_to,
                                    assignedAt: list.assigned_at
                                });
                            }
                        });
                    }
                }
            });

            setTerritoryAssignments(assignmentsMap);
            setSharingStatusMap(sharedMap);
        };

        fetchSharedLists();
    }, [congregationId]);


    const handleCreateTerritory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTerritoryName.trim() || !cityId || !congregationId) return;

        try {
            const { error } = await supabase.from('territories').insert({
                name: newTerritoryName.trim(),
                description: newTerritoryDesc.trim(),
                city_id: cityId,
                congregation_id: congregationId,
                lat: newTerritoryLat ? parseFloat(newTerritoryLat) : null,
                lng: newTerritoryLng ? parseFloat(newTerritoryLng) : null,
                status: 'LIVRE'
            });

            if (error) throw error;

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
            const { error } = await supabase
                .from('territories')
                .update({
                    name: editName,
                    description: editDescription
                })
                .eq('id', editingTerritory.id);

            if (error) throw error;

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
            const { error } = await supabase.from('territories').delete().eq('id', id);
            if (error) throw error;
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
        setIsSelectionMode(newSelected.size > 0);
    };

    // simplified sharing for Supabase migration MVP
    const handleConfirmShare = async () => {
        if (selectedIds.size === 0) return;
        alert("Funcionalidade de compartilhamento em migração. Aguarde a próxima atualização.");
        // TODO: Implement shared list creation with Supabase (requires new table structure or adapting existing)
        setIsShareModalOpen(false);
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
                            // const historyDate = lastCompletionDates[t.id];
                            // const isOutdated = historyDate && historyDate < getServiceYearRange(getServiceYear()).start;

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
                                                                    setEditingTerritory(t);
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
                )}

                {/* Floating Action Bar (Admin/Leaders) - for sharing multiple maps selection */}
                {(isAdmin || isServant) && selectedIds.size > 0 && (
                    <div className="fixed bottom-24 left-6 right-6 z-40 bg-gray-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-3">
                            <span className="bg-primary px-3 py-1 rounded-lg text-xs font-bold">{selectedIds.size}</span>
                            <span className="text-sm">selecionados</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleConfirmShare} // Call handler directly for now
                                className="bg-white text-gray-900 px-4 py-2 rounded-xl text-xs font-bold flex gap-2 active:scale-95 transition-transform"
                            >
                                <LinkIcon className="w-4 h-4" /> LINK
                            </button>
                        </div>
                    </div>
                )}


            </div>

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

        </div>
    );
}

export default function TerritoryListPage() {
    return <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-primary" />}><TerritoryListContent /></Suspense>;
}
