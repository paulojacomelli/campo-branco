"use client";

import { useState, useEffect, Suspense, Fragment } from 'react';
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
    Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import RoleBasedSwitcher from '@/app/components/RoleBasedSwitcher';
import CSVActionButtons from '@/app/components/CSVActionButtons';
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
    notes?: string;
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
    const { user, isAdmin, isSuperAdmin, isElder, isServant, loading: authLoading } = useAuth();
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

    // Delete State
    const [territoryToDelete, setTerritoryToDelete] = useState<{ id: string, name: string } | null>(null);

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
        if (!congregationId || !cityId) {
            setLoading(false);
            return;
        }
        try {
            const response = await fetch(`/api/territories/list?cityId=${cityId}&congregationId=${congregationId}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Erro ao buscar territórios');
            }

            // Client-side numeric sort for names like "1", "2", "10"
            const sorted = (data.territories || []).sort((a: Territory, b: Territory) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
            // Realtime is still active, but when it triggers, fetch from backend to bypass RLS
            const subscription = supabase
                .channel('territories_list')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'territories', filter: `city_id=eq.${cityId}` }, () => {
                    fetchTerritories();
                })
                .subscribe();

            return () => {
                setTimeout(() => {
                    subscription.unsubscribe();
                }, 100);
            };
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
                .select('id, territory_id, is_active, street, resident_name, observations, gender, is_deaf, is_neurodivergent, is_student, is_minor')
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

                    const searchString = `${addr.street || ''} ${addr.resident_name || ''} ${addr.observations || ''}`.toLowerCase();
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
            return () => {
                setTimeout(() => {
                    subscription.unsubscribe();
                }, 100);
            };
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
            const response = await fetch('/api/territories/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newTerritoryName.trim(),
                    notes: newTerritoryDesc.trim(),
                    city_id: cityId,
                    congregation_id: congregationId,
                    lat: newTerritoryLat ? parseFloat(newTerritoryLat) : null,
                    lng: newTerritoryLng ? parseFloat(newTerritoryLng) : null,
                    status: 'LIVRE'
                })
            });

            const resData = await response.json();
            if (!response.ok) {
                throw new Error(resData.error || 'Erro ao criar território');
            }

            setNewTerritoryName('');
            setNewTerritoryDesc('');
            setNewTerritoryLat('');
            setNewTerritoryLng('');
            setIsCreateModalOpen(false);
            fetchTerritories();
            toast.success("Território criado com sucesso!");
        } catch (error) {
            console.error("Error creating territory:", error);
            toast.error("Erro ao criar território.");
        }
    };

    const handleUpdateTerritory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTerritory || !editName.trim()) return;

        try {
            const response = await fetch('/api/territories/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingTerritory.id,
                    name: editName,
                    notes: editDescription
                })
            });

            const resData = await response.json();
            if (!response.ok) {
                throw new Error(resData.error || 'Erro ao atualizar território');
            }

            toast.success("Território atualizado com sucesso!");
            fetchTerritories();
            setIsEditModalOpen(false);
            setEditingTerritory(null);
        } catch (error) {
            console.error("Error updating territory:", error);
            toast.error("Erro ao atualizar território.");
        }
    };

    const handleDeleteTerritory = (id: string, name: string) => {
        setTerritoryToDelete({ id, name });
    };

    const confirmDeleteTerritory = async () => {
        if (!territoryToDelete) return;
        const { id } = territoryToDelete;
        setTerritoryToDelete(null); // Fecha o modal imediatamente
        try {
            const response = await fetch('/api/territories/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            const resData = await response.json();
            if (!response.ok) {
                throw new Error(resData.error || 'Erro ao excluir território');
            }
            toast.success("Território excluído com sucesso!");
            fetchTerritories();
        } catch (error) {
            console.error("Error deleting territory:", error);
            toast.error("Erro ao excluir território.");
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

    // Simplified sharing: navigates to the setup page with selected IDs
    const handleConfirmShare = async () => {
        if (selectedIds.size === 0) return;

        const ids = Array.from(selectedIds).join(',');
        const currentUrl = window.location.pathname + window.location.search;
        router.push(`/share-setup?ids=${ids}&returnUrl=${encodeURIComponent(currentUrl)}`);
    };

    const filteredTerritories = territories.filter(t => {
        const matchesName = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.notes?.toLowerCase().includes(searchTerm.toLowerCase());

        if (searchInItems && searchTerm) {
            const indexContent = territorySearchIndex[t.id] || '';
            const matchesContent = indexContent.includes(searchTerm.toLowerCase());
            return matchesName || matchesContent;
        }

        return matchesName;
    });

    if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>;

    // Role Guard: Only Servants, Elders and SuperAdmins can see this page
    if (user && !isServant) {
        router.replace('/dashboard');
        return null;
    }

    if (!congregationId || !cityId) {
        return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-muted">Informações incompletas.</div>;
    }

    // View state
    const currentView = searchParams.get('view') || 'grid';

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main transition-colors duration-300">
            {/* ... Header ... */}
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex justify-between items-center shadow-sm dark:shadow-none transition-colors">
                <div className="flex items-center gap-3">
                    <Link href={`/my-maps/city?congregationId=${congregationId}`} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title={`Voltar para ${localTermType === 'neighborhood' ? 'Bairros' : 'Cidades'}`}>
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </Link>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg text-main tracking-tight leading-none">{cityName}</span>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider">{localTermType === 'neighborhood' ? 'Bairro' : 'Cidade'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <RoleBasedSwitcher />
                    {(isElder || isServant || isAdmin || isSuperAdmin) && (
                        <>
                            <CSVActionButtons
                                congregationId={congregationId}
                                cityId={cityId}
                                onImportSuccess={fetchTerritories}
                            />
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="bg-gray-900 border-gray-900 border hover:bg-black dark:bg-surface-highlight dark:hover:bg-slate-800 text-white dark:text-main dark:border-surface-border p-2 rounded-lg shadow-lg transition-all active:scale-95"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </header>


            <div className="px-6 pt-6 space-y-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar território..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-transparent dark:border-surface-border text-main text-sm font-medium rounded-lg py-4 pl-12 pr-36 shadow-sm dark:shadow-none focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-muted"
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
                ) : currentView === 'table' ? (
                    <div className="w-full overflow-x-auto pb-4 flex justify-start lg:justify-center">
                        <div className="bg-surface rounded-lg border border-surface-border shadow-sm inline-block min-w-full sm:min-w-0">
                            <table className="w-auto min-w-full sm:min-w-0 text-left text-sm">
                                <thead className="bg-surface-highlight border-b border-surface-border text-muted uppercase tracking-wider text-[10px] font-bold">
                                    <tr>
                                        <th className="px-6 py-4 w-[100px] text-left">Opções</th>
                                        <th className="px-6 py-4 text-left">Nome</th>
                                        <th className="px-6 py-4 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-border">
                                    {filteredTerritories.map(t => {
                                        const assignments = territoryAssignments[t.id] || [];
                                        const territoryAddresses = allAddresses.filter(a => a.territory_id === t.id);
                                        return (
                                            <Fragment key={t.id}>
                                                <tr className="hover:bg-surface-highlight/50 transition-colors group bg-surface">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-start gap-2">
                                                            {(isElder || isServant) && (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingTerritory(t);
                                                                            setEditName(t.name);
                                                                            setEditDescription(t.notes || '');
                                                                            setIsEditModalOpen(true);
                                                                        }}
                                                                        className="p-2 text-muted hover:text-main hover:bg-background rounded-lg transition-colors"
                                                                        title="Editar"
                                                                    >
                                                                        <Pencil className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteTerritory(t.id, t.name)}
                                                                        className="p-2 text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                                        title="Excluir"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-main whitespace-nowrap">
                                                        <Link href={`/my-maps/address?congregationId=${congregationId}&cityId=${cityId}&territoryId=${t.id}`} className="hover:text-primary transition-colors block">
                                                            {t.name} {t.notes ? `- ${t.notes}` : ''}
                                                        </Link>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {assignments.length > 0 ? (
                                                            <div className="flex -space-x-2">
                                                                {assignments.map((a, i) => (
                                                                    <div key={i} className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold border-2 border-surface" title={a.publisher_id}>
                                                                        {a.publisher_id.substring(0, 1).toUpperCase()}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-[10px] font-bold uppercase">
                                                                Livre
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {/* Addresses Row */}
                                                <tr>
                                                    <td colSpan={3} className="p-0 border-b border-surface-border/50">
                                                        <div className="overflow-x-auto w-full">
                                                            <table className="w-full text-xs bg-surface border-x border-b border-surface-border/50 shadow-sm first:border-t-0">
                                                                <tbody className="divide-y divide-surface-border/50">
                                                                    {territoryAddresses.length > 0 ? territoryAddresses.map(addr => (
                                                                        <tr key={addr.id} className="hover:bg-surface-highlight/30 transition-colors group/addr">
                                                                            <td className="px-6 py-3 whitespace-nowrap w-[60px]">
                                                                                <div className="flex items-center justify-center">
                                                                                    <Link
                                                                                        href={`/my-maps/address?congregationId=${congregationId}&cityId=${cityId}&territoryId=${t.id}`}
                                                                                        className="p-1.5 text-muted hover:text-main hover:bg-surface-highlight rounded-lg transition-colors"
                                                                                        title="Gerenciar Endereço"
                                                                                    >
                                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                                    </Link>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-3 font-medium text-main whitespace-nowrap">
                                                                                <div className="flex items-center justify-start gap-2">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                                                                                    <span>{addr.street}, {addr.number}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-3 text-main whitespace-nowrap text-left">
                                                                                {addr.resident_name || <span className="text-muted italic">Sem nome</span>}
                                                                            </td>
                                                                            <td className="px-6 py-3 text-muted flex gap-2 items-center justify-start whitespace-nowrap">
                                                                                {addr.gender && (
                                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${addr.gender === 'HOMEM' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50' :
                                                                                        addr.gender === 'MULHER' ? 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-900/50' :
                                                                                            'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/50'
                                                                                        }`}>
                                                                                        {addr.gender}
                                                                                    </span>
                                                                                )}
                                                                                {addr.is_deaf && (
                                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-900/50">
                                                                                        Surdo
                                                                                    </span>
                                                                                )}
                                                                                {addr.is_neurodivergent && (
                                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 dark:border-fuchsia-900/50">
                                                                                        Neuro
                                                                                    </span>
                                                                                )}
                                                                                {addr.is_student && (
                                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/50">
                                                                                        Estudante
                                                                                    </span>
                                                                                )}
                                                                                {addr.is_minor && (
                                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/50">
                                                                                        Menor
                                                                                    </span>
                                                                                )}
                                                                                {addr.notes && <span className="truncate max-w-[100px] text-[9px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">{addr.notes}</span>}
                                                                            </td>
                                                                        </tr>
                                                                    )) : (
                                                                        <tr>
                                                                            <td colSpan={3} className="px-6 py-4 text-center text-muted italic text-xs">
                                                                                Nenhum endereço cadastrado.
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                        {filteredTerritories.map(t => {
                            const isSelected = selectedIds.has(t.id);
                            const assignments = territoryAssignments[t.id] || [];
                            const hasSharing = sharingStatusMap[t.id];
                            // const historyDate = lastCompletionDates[t.id];
                            // const isOutdated = historyDate && historyDate < getServiceYearRange(getServiceYear()).start;

                            return (
                                <div
                                    key={t.id}
                                    className={`group bg-surface rounded-lg p-3 border border-surface-border shadow-sm hover:shadow-md transition-all relative ${isSelected ? 'ring-2 ring-primary bg-primary-light/10' : ''}`}
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
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.status === 'OCUPADO' ? 'bg-primary-light/50 dark:bg-primary-dark/20 text-primary dark:text-primary-light' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}>
                                                    <MapIcon className="w-4.5 h-4.5" />
                                                </div>
                                                <div className="min-w-0 flex-1 pt-0.5">
                                                    <h3 className="font-bold text-main text-base leading-tight truncate pr-1">{t.name}</h3>
                                                    <p className="text-xs text-muted font-medium line-clamp-2 mt-0.5 leading-snug">{t.notes || 'Sem descrição'}</p>
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
                                                        <div className="absolute right-0 mt-2 w-48 bg-surface rounded-lg shadow-xl border border-surface-border z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
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
                                                                    setEditDescription(t.notes || '');
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
                    <div className="fixed bottom-24 left-6 right-6 z-40 bg-gray-900 text-white rounded-lg p-4 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-3">
                            <span className="bg-primary px-3 py-1 rounded-lg text-xs font-bold">{selectedIds.size}</span>
                            <span className="text-sm">selecionados</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleConfirmShare} // Call handler directly for now
                                className="bg-white text-gray-900 px-4 py-2 rounded-lg text-xs font-bold flex gap-2 active:scale-95 transition-transform"
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
                        <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-transparent dark:border-slate-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Plus className="w-6 h-6 text-primary" />
                                Novo Território
                            </h2>
                            <form onSubmit={handleCreateTerritory} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Número do Mapa</label>
                                    <input
                                        type="text"
                                        value={newTerritoryName}
                                        onChange={(e) => setNewTerritoryName(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 font-bold text-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-gray-400"
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
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none resize-none placeholder:text-gray-400"
                                        placeholder="Ex: Centro, perto da praça..."
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 rounded-lg font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 hover:bg-primary-dark transition-colors">Criar</button>
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
                        <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-transparent dark:border-slate-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <List className="w-6 h-6 text-primary" />
                                Editar Território
                            </h2>
                            <form onSubmit={handleUpdateTerritory} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Número do Mapa</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 font-bold text-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-gray-400"
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
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none resize-none placeholder:text-gray-400"
                                        placeholder="Ex: Centro, perto da praça..."
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 rounded-lg font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 hover:bg-primary-dark transition-colors">Salvar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Modal */}
            {
                territoryToDelete && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-transparent dark:border-slate-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Trash2 className="w-6 h-6 text-red-500" />
                                Excluir Território
                            </h2>
                            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
                                Tem certeza que deseja excluir o território <span className="font-bold text-gray-900 dark:text-white">{territoryToDelete.name}</span>? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setTerritoryToDelete(null)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 rounded-lg font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                                <button type="button" onClick={confirmDeleteTerritory} className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold shadow-lg shadow-red-500/20 hover:bg-red-700 transition-colors">Excluir</button>
                            </div>
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
