"use client";

import { useState, useEffect, Suspense } from 'react';
import {
    Plus,
    Link as LinkIcon,
    Map as MapIcon,
    Search,
    MapPin,
    ArrowRight,
    Loader2,
    Trash2,
    LogOut,
    Link2,
    X,
    List,
    MoreVertical,
    Pencil,
    CheckCircle,
    HelpCircle,
    Navigation,
    MousePointer2
} from 'lucide-react';
import HelpModal from '@/app/components/HelpModal';
import MapView from '@/app/components/MapView';
import CongregationSelector from '@/app/components/CongregationSelector';
import BottomNav from '@/app/components/BottomNav';
import { db, auth } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp, addDoc, deleteDoc, doc, where, serverTimestamp, updateDoc, getDocs, collectionGroup } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { getServiceYear, getServiceYearLabel, getServiceYearRange } from '@/lib/serviceYearUtils';

interface City {
    id: string;
    name: string;
    uf: string;
    createdAt?: Timestamp;
    congregationId: string;
    lat?: number;
    lng?: number;
    parentCity?: string;
}

function CityListContent() {
    const searchParams = useSearchParams();
    const congregationId = searchParams.get('congregationId');
    const { user, isAdmin, isSuperAdmin, isElder, isServant, loading: authLoading } = useAuth();
    const router = useRouter();
    const [cities, setCities] = useState<City[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newCityName, setNewCityName] = useState('');
    const [newCityUF, setNewCityUF] = useState('SP');
    const [newCityLat, setNewCityLat] = useState('');
    const [newCityLng, setNewCityLng] = useState('');
    const [newParentCity, setNewParentCity] = useState('');
    const [localTermType, setLocalTermType] = useState<'city' | 'neighborhood'>('city');
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(true);
    const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number } | null>(null);

    // Stats State - Hybrid: Unique for base coverage, Volume for efficiency > 100%
    const [coverageStats, setCoverageStats] = useState<Record<string, {
        total: number,
        completedUnique: number,
        completedVolume: number,
        statusBreakdown: { contacted: number, not_contacted: number, moved: number, do_not_visit: number, total_visits: number }
    }>>({});

    // Edit State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCity, setEditingCity] = useState<City | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    useEffect(() => {
        if (!congregationId) return;

        const q = query(
            collection(db, "cities"),
            where("congregationId", "==", congregationId)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const citiesData: City[] = [];
            querySnapshot.forEach((doc) => {
                citiesData.push({ id: doc.id, ...doc.data() } as City);
            });
            // Sort alphabetically
            citiesData.sort((a, b) => a.name.localeCompare(b.name));
            setCities(citiesData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [congregationId]);

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

    // Fetch Coverage Stats
    useEffect(() => {
        if (!congregationId) return;

        const fetchStats = async () => {
            try {
                const currentYear = getServiceYear();
                const { start, end } = getServiceYearRange(currentYear);

                // 1. Fetch all territories for this congregation to get totals per city
                const terrQuery = query(collection(db, "territories"), where("congregationId", "==", congregationId));
                const terrSnap = await getDocs(terrQuery);

                const cityTotals: Record<string, number> = {}; // cityId -> total count
                const territoryCityMap: Record<string, string> = {}; // territoryId -> cityId

                terrSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.cityId) {
                        cityTotals[data.cityId] = (cityTotals[data.cityId] || 0) + 1;
                        territoryCityMap[doc.id] = data.cityId;
                    }
                });

                // 2. Fetch completed assignments AND build Share->City Map
                const listQuery = query(collection(db, "shared_lists"), where("congregationId", "==", congregationId));
                const listSnap = await getDocs(listQuery);

                const completedUniqueByCity: Record<string, Set<string>> = {};
                const completedVolumeByCity: Record<string, number> = {};
                const shareMap: Record<string, string> = {}; // shareId -> cityId

                listSnap.forEach(doc => {
                    const data = doc.data();

                    // Map Share to City (if applicable)
                    let cityId: string | null = null;
                    if (data.cityId) {
                        cityId = data.cityId;
                    } else if (data.items && data.items.length > 0) {
                        // Use the city of the first item as proxy
                        cityId = territoryCityMap[data.items[0]];
                    }

                    if (cityId) {
                        shareMap[doc.id] = cityId;
                    }

                    if (data.type !== 'territory' || !data.items || data.items.length === 0) return;

                    let completionDate: Date | null = null;
                    if (data.returnedAt?.toDate) completionDate = data.returnedAt.toDate();
                    else if (data.completedAt?.toDate) completionDate = data.completedAt.toDate();

                    if (!completionDate) return;

                    if (completionDate >= start && completionDate <= end) {
                        data.items.forEach((tId: string) => {
                            const cId = territoryCityMap[tId];
                            if (cId) {
                                if (!completedUniqueByCity[cId]) completedUniqueByCity[cId] = new Set();
                                completedUniqueByCity[cId].add(tId);
                                completedVolumeByCity[cId] = (completedVolumeByCity[cId] || 0) + 1;
                            }
                        });
                    }
                });

                // 2.5 Fetch Address Status for Breakdown Colors
                // We use addresses instead of visits because it's more reliable (already has cityId/territoryId)
                const addrQuery = query(
                    collection(db, "addresses"),
                    where("congregationId", "==", congregationId)
                );

                const statusByCity: Record<string, { contacted: number, not_contacted: number, moved: number, do_not_visit: number, total_visits: number }> = {};

                try {
                    const addrSnap = await getDocs(addrQuery);
                    addrSnap.forEach(doc => {
                        const aData = doc.data();
                        if (aData.isActive === false) return; // Ignore inactive

                        const cId = aData.cityId || (aData.territoryId ? territoryCityMap[aData.territoryId] : null);
                        if (!cId) return;

                        // Only count if visited in current service year
                        let lastVisit: Date | null = null;
                        if (aData.lastVisitedAt?.toDate) lastVisit = aData.lastVisitedAt.toDate();
                        else if (aData.lastVisitedAt?.seconds) lastVisit = new Date(aData.lastVisitedAt.seconds * 1000);

                        if (lastVisit && lastVisit >= start && lastVisit <= end) {
                            if (!statusByCity[cId]) statusByCity[cId] = { contacted: 0, not_contacted: 0, moved: 0, do_not_visit: 0, total_visits: 0 };

                            const status = aData.visitStatus;
                            if (status) {
                                statusByCity[cId].total_visits++;
                                if (status === 'contacted') statusByCity[cId].contacted++;
                                else if (status === 'not_contacted') statusByCity[cId].not_contacted++;
                                else if (status === 'moved') statusByCity[cId].moved++;
                                else if (status === 'do_not_visit') statusByCity[cId].do_not_visit++;
                            }
                        }
                    });
                } catch (err) {
                    console.error("Error fetching addresses for breakdown:", err);
                }

                // 3. Compile Result
                const stats: Record<string, {
                    total: number,
                    completedUnique: number,
                    completedVolume: number,
                    statusBreakdown: { contacted: number, not_contacted: number, moved: number, do_not_visit: number, total_visits: number }
                }> = {};

                Object.keys(cityTotals).forEach(cityId => {
                    stats[cityId] = {
                        total: cityTotals[cityId],
                        completedUnique: completedUniqueByCity[cityId]?.size || 0,
                        completedVolume: completedVolumeByCity[cityId] || 0,
                        statusBreakdown: statusByCity[cityId] || { contacted: 0, not_contacted: 0, moved: 0, do_not_visit: 0, total_visits: 0 }
                    };
                });

                setCoverageStats(stats);

            } catch (error) {
                console.error("Error fetching coverage stats:", error);
            }
        };

        fetchStats();
    }, [congregationId]);


    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    const handleCreateCity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCityName.trim() || !congregationId) return;

        try {
            await addDoc(collection(db, "cities"), {
                name: newCityName.trim(),
                uf: newCityUF,
                congregationId: congregationId,
                parentCity: localTermType === 'neighborhood' ? newParentCity.trim() : null,
                lat: newCityLat ? parseFloat(newCityLat) : null,
                lng: newCityLng ? parseFloat(newCityLng) : null,
                createdAt: Timestamp.now()
            });
            setNewCityName('');
            setNewParentCity('');
            setNewCityLat('');
            setNewCityLng('');
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error("Error creating city:", error);
            alert(`Erro ao criar ${localTermType === 'neighborhood' ? 'bairro' : 'cidade'}.`);
        }
    };

    const handleUpdateCity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCity || !editingCity.name.trim()) return;

        try {
            const res = await fetch('/api/city/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cityId: editingCity.id,
                    name: editingCity.name,
                    uf: editingCity.uf,
                    parentCity: editingCity.parentCity,
                    lat: editingCity.lat,
                    lng: editingCity.lng
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao atualizar dados.");
            }

            setIsEditModalOpen(false);
            setEditingCity(null);
        } catch (error: any) {
            console.error("Error updating city:", error);
            alert(`Erro ao atualizar ${localTermType === 'neighborhood' ? 'bairro' : 'cidade'}: ${error.message}`);
        }
    };

    const handleDeleteCity = async (id: string, name: string) => {
        if (!confirm("Tem certeza que deseja excluir " + name + "?")) return;

        try {
            await deleteDoc(doc(db, "cities", id));
            setOpenMenuId(null);
        } catch (error) {
            console.error("Error deleting city:", error);
            alert(`Erro ao excluir ${localTermType === 'neighborhood' ? 'bairro' : 'cidade'}.`);
        }
    };

    const handleSignOut = async () => {
        try {
            await auth.signOut();
            await fetch('/api/auth/session', { method: 'DELETE' });
            document.cookie = "__session=; path=/; max-age=0";
            document.cookie = "auth_token=; path=/; max-age=0";
            document.cookie = "role=; path=/; max-age=0";
            document.cookie = "congregationId=; path=/; max-age=0";
            window.location.href = '/login';
        } catch (error) {
            console.error("Logout error:", error);
            window.location.href = '/login';
        }
    };

    const filteredCities = cities.filter(city =>
        city.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!congregationId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-muted">
                Congregação não encontrada.
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main">
            {/* Header */}
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-none">
                <div className="flex items-center gap-3">
                    <div className="bg-primary p-2 rounded-xl text-white shadow-primary-light/20 dark:shadow-primary-dark/20 shadow-md hidden sm:block">
                        <MapIcon className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                        <span className="font-bold text-lg text-main tracking-tight block leading-tight">
                            {localTermType === 'neighborhood' ? 'Bairros' : 'Cidades'}
                        </span>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-widest hidden sm:inline-block">Territórios</span>
                    </div>
                </div>

                {/* Center - Congregation Selector (Visible ONLY for Super Admin) */}
                {isSuperAdmin && (
                    <div className="flex-1 max-w-xs mx-4">
                        <CongregationSelector currentId={congregationId} />
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSignOut}
                        className="p-2 text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        title="Sair"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>

                    {(isAdmin || isServant) && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-gray-900 dark:bg-surface-highlight hover:bg-black dark:hover:bg-slate-800 text-white dark:text-main p-2 rounded-xl shadow-lg transition-all active:scale-95 border border-transparent dark:border-surface-border"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="p-1.5 text-muted hover:text-primary hover:bg-primary-light/50 dark:hover:bg-primary-dark/20 rounded-full transition-colors"
                        title="Ajuda"
                    >
                        <HelpCircle className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <HelpModal
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
                title={localTermType === 'neighborhood' ? 'Bairros da Congregação' : 'Cidades da Congregação'}
                description={localTermType === 'neighborhood' ? 'Gerencie os bairros atendidos pela sua congregação.' : 'Gerencie as cidades atendidas pela sua congregação.'}
                steps={[
                    { title: "Navegação", text: `Clique em um(a) ${localTermType === 'neighborhood' ? 'bairro' : 'cidade'} para gerenciar seus territórios e endereços.` },
                    { title: "Gestão", text: `Use o ícone '+' para adicionar novos(as) ${localTermType === 'neighborhood' ? 'bairros' : 'cidades'} ou o menu de três pontos para editar/excluir.` }
                ]}
                tips={[
                    `Você pode ver a distribuição dos(as) ${localTermType === 'neighborhood' ? 'bairros' : 'cidades'} no mapa alternando a visualização no topo.`,
                    `Lembre-se de definir as coordenadas (lat/lng) para visualizar o(a) ${localTermType === 'neighborhood' ? 'bairro' : 'cidade'} corretamente no mapa global.`
                ]}
            />

            {/* Main Content */}
            <div className="flex flex-col">
                {/* Top: City List */}
                <div className="flex-1 bg-surface">
                    {/* Search */}
                    <div className="px-6 pt-6 pb-2 sticky top-0 bg-surface z-10 transition-colors">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder={localTermType === 'neighborhood' ? 'Buscar bairro...' : 'Buscar cidade...'}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-surface border border-transparent dark:border-surface-border text-main text-sm font-medium rounded-2xl py-4 pl-12 pr-4 shadow-[0_4px_30px_rgba(0,0,0,0.03)] dark:shadow-none dark:bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-muted"
                            />
                        </div>

                        {/* Legend removed by simplified view */}
                    </div>

                    <main className="px-6 py-4 space-y-3">
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : filteredCities.length === 0 ? (
                            <div className="text-center py-12 opacity-50">
                                <MapPin className="w-16 h-16 mx-auto mb-4 text-muted" />
                                <p className="text-muted font-medium">Nenhum(a) {localTermType === 'neighborhood' ? 'bairro' : 'cidade'} encontrado(a).</p>
                            </div>
                        ) : (
                            filteredCities.map(city => {
                                const stats = coverageStats[city.id];
                                let coverageLabel = "0%";
                                let coveragePercent = 0; // For bar width (visual modulus)
                                let displayPercent = 0;  // For text label
                                let isGreen = false;



                                if (stats && stats.total > 0) {
                                    // Hybrid Logic:
                                    // 1. Calculate Unique Coverage Ratio
                                    const uniqueRatio = stats.completedUnique / stats.total;

                                    // 2. Base Calculation
                                    let finalRatio = 0;

                                    if (uniqueRatio < 1) {
                                        // Case A: Not all maps touched yet (< 100% Unique)
                                        // Use Unique Ratio strictly.
                                        finalRatio = uniqueRatio;
                                    } else {
                                        // Case B: All maps touched at least once (>= 100% Unique)
                                        // Use Volume Ratio to show > 100% efficiency.
                                        const volumeRatio = stats.completedVolume / stats.total;
                                        finalRatio = volumeRatio;
                                    }

                                    // 3. Formatting
                                    // Round down to simple integer (1%)
                                    const rawPercent = finalRatio * 100;
                                    displayPercent = Math.floor(rawPercent);
                                    coverageLabel = `${displayPercent}%`;



                                    // Bar Total Width Logic
                                    if (displayPercent >= 100) {
                                        isGreen = true;
                                        coveragePercent = 100; // Full bar
                                    } else {
                                        coveragePercent = displayPercent;
                                    }
                                }

                                return (
                                    <div
                                        key={city.id}
                                        className="group bg-background rounded-2xl p-4 border border-surface-border shadow-sm hover:shadow-md hover:border-primary-light/50 dark:hover:border-primary-light/20 transition-all flex items-center gap-4"
                                    >

                                        <Link href={`/my-maps/territory?congregationId=${congregationId}&cityId=${city.id}`} prefetch={false} className="flex-1 flex items-center gap-4 min-w-0">
                                            <div className="w-10 h-10 bg-surface dark:bg-surface-highlight rounded-xl flex items-center justify-center text-muted shrink-0 shadow-sm border border-surface-border">
                                                <MapIcon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div>
                                                        <h3 className="font-bold text-main text-base truncate leading-tight">{city.name}</h3>
                                                        {city.parentCity && (
                                                            <p className="text-[10px] text-muted font-black uppercase tracking-wider">{city.parentCity}</p>
                                                        )}
                                                    </div>
                                                    {(stats && stats.total > 0) && (
                                                        <span className={`md:hidden text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap ${isGreen ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-primary-light/50 text-primary dark:bg-primary-dark/30 dark:text-primary-light'}`}>
                                                            {coverageLabel}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">VER MAPAS</p>
                                                </div>

                                                {/* Mobile-only Progress Bar */}
                                                <div className="md:hidden space-y-2">
                                                    <div className="w-full bg-primary-light/20 dark:bg-primary-dark/40 rounded-full h-1.5 overflow-hidden flex relative" title="Verde: Concluído | Azul: Falta Concluir">
                                                        <div className="h-full bg-green-500 transition-all duration-500 rounded-full" style={{ width: `${coveragePercent}%` }} />
                                                    </div>
                                                    <div className="flex justify-between items-center px-0.5">
                                                        <span className="text-[9px] text-muted">
                                                            {stats?.completedUnique || 0}/{stats?.total || 0} mapas
                                                        </span>
                                                        {stats?.completedVolume > stats?.completedUnique && (
                                                            <span className="text-[9px] text-green-600 font-bold">
                                                                +{stats.completedVolume - stats.completedUnique}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>

                                        {/* Desktop-only Coverage Stats */}
                                        <div className="flex-1 flex flex-col justify-center gap-1.5 ml-4 mr-4 max-w-[200px] hidden md:flex">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Cobertura</span>
                                                <span className="text-[10px] font-bold text-main">
                                                    {coverageLabel}
                                                </span>
                                            </div>
                                            <div className="w-full bg-primary-light/20 dark:bg-primary-dark/40 rounded-full h-1.5 overflow-hidden flex relative">
                                                <div className="h-full bg-green-500 transition-all duration-500 rounded-full" style={{ width: `${coveragePercent}%` }} />
                                            </div>
                                            <span className="text-[9px] text-muted text-right">
                                                {stats?.completedUnique || 0}/{stats?.total || 0} mapas
                                                {stats?.completedVolume > stats?.completedUnique && ` (+${stats.completedVolume - stats.completedUnique} repetições)`}
                                            </span>
                                        </div>



                                        <div className="flex items-center gap-2">
                                            {(isElder || isServant) && (
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === city.id ? null : city.id);
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary-light/50 rounded-lg transition-colors"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    {openMenuId === city.id && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-10"
                                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                                                            />
                                                            <div className="absolute right-0 mt-2 w-32 bg-surface rounded-xl shadow-xl border border-surface-border z-20 py-1 animation-fade-in origin-top-right">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingCity(city);
                                                                        setIsEditModalOpen(true);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm font-medium text-main hover:bg-background flex items-center gap-2"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" /> Editar
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteCity(city.id, city.name);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            <Link href={`/my-maps/territory?congregationId=${congregationId}&cityId=${city.id}`} prefetch={false} className="p-2">
                                                <ArrowRight className="w-4 h-4 text-gray-300" />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })
                        )}


                    </main>
                </div>

                {/* Bottom: Map View */}
                <div className="w-full h-96 border-t border-surface-border relative z-0">
                    <MapView
                        items={filteredCities.map((c, idx) => ({
                            id: c.id,
                            lat: c.lat,
                            lng: c.lng,
                            title: c.name,
                            subtitle: `UF: ${c.uf}`,
                            status: 'LIVRE',
                            fullAddress: `${c.name}, ${c.uf}, Brasil`,
                            variant: 'city' as const
                        }))}
                        showLegend={false}
                    />
                </div>
            </div>



            {/* Bottom Nav */}
            <BottomNav />

            {/* Create City Modal (Admin/Elder/Servant) */}
            {
                isCreateModalOpen && (isElder || isServant) && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200 border border-transparent dark:border-slate-800">
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="absolute top-4 right-4 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="mb-6">
                                <h1 className="text-xl font-bold text-main tracking-tight">
                                    {localTermType === 'neighborhood' ? 'Bairros' : 'Cidades'}
                                </h1>
                                <p className="text-xs text-muted font-medium">Mapas do território</p>
                            </div>

                            <form onSubmit={handleCreateCity} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">{localTermType === 'neighborhood' ? 'Nome do Bairro' : 'Nome da Cidade'}</label>
                                    <input
                                        required
                                        type="text"
                                        value={newCityName}
                                        onChange={(e) => setNewCityName(e.target.value)}
                                        className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-main placeholder-muted"
                                        placeholder={localTermType === 'neighborhood' ? 'Ex: Jardim Paulista' : 'Ex: São Paulo'}
                                        autoFocus
                                    />
                                </div>

                                {localTermType === 'neighborhood' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Cidade do Bairro</label>
                                        <input
                                            required
                                            type="text"
                                            value={newParentCity}
                                            onChange={(e) => setNewParentCity(e.target.value)}
                                            className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-main placeholder-muted"
                                            placeholder="Ex: São Paulo"
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">UF</label>
                                    <input
                                        type="text"
                                        value={newCityUF}
                                        onChange={e => setNewCityUF(e.target.value.toUpperCase())}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-gray-400"
                                        placeholder="UF"
                                        maxLength={2}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Localização</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsMapPickerOpen(true)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border font-bold transition-all ${newCityLat && newCityLng
                                            ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                                            : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-400'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <MapIcon className="w-4 h-4" />
                                            <span>{newCityLat && newCityLng ? 'Localização Definida' : 'Selecionar no Mapa'}</span>
                                        </div>
                                        {newCityLat && newCityLng && <div className="text-[10px] opacity-70">{parseFloat(newCityLat).toFixed(4)}, {parseFloat(newCityLng).toFixed(4)}</div>}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-colors mt-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    {localTermType === 'neighborhood' ? 'Novo Bairro' : 'Nova Cidade'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Edit City Modal */}
            {
                isEditModalOpen && editingCity && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200 border border-transparent dark:border-slate-800">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="absolute top-4 right-4 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {localTermType === 'neighborhood' ? 'Editar Bairro' : 'Editar Cidade'}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {localTermType === 'neighborhood' ? 'Atualize as informações do bairro.' : 'Atualize as informações da cidade.'}
                                </p>
                            </div>

                            <form onSubmit={handleUpdateCity} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {localTermType === 'neighborhood' ? 'Nome do Bairro' : 'Nome da Cidade'}
                                    </label>
                                    <input
                                        type="text"
                                        value={editingCity.name || ''}
                                        onChange={e => setEditingCity({ ...editingCity, name: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-gray-400"
                                        placeholder="Nome"
                                        required
                                        autoFocus
                                    />
                                </div>
                                {localTermType === 'neighborhood' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cidade do Bairro</label>
                                        <input
                                            type="text"
                                            value={editingCity.parentCity || ''}
                                            onChange={e => setEditingCity({ ...editingCity, parentCity: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-gray-400"
                                            placeholder="Cidade"
                                            required
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">UF</label>
                                    <input
                                        type="text"
                                        value={editingCity.uf || ''}
                                        onChange={e => setEditingCity({ ...editingCity, uf: e.target.value.toUpperCase() })}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-gray-400"
                                        placeholder="UF"
                                        maxLength={2}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Localização</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsMapPickerOpen(true)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border font-bold transition-all ${editingCity.lat && editingCity.lng
                                            ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                                            : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-400'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <MapIcon className="w-4 h-4" />
                                            <span>{editingCity.lat && editingCity.lng ? 'Localização Definida' : 'Selecionar no Mapa'}</span>
                                        </div>
                                        {editingCity.lat && editingCity.lng && <div className="text-[10px] opacity-70">{parseFloat(editingCity.lat.toString()).toFixed(4)}, {parseFloat(editingCity.lng.toString()).toFixed(4)}</div>}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-colors mt-2"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Salvar Alterações
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Map Picker Modal */}
            {isMapPickerOpen && (
                <div className="fixed inset-0 z-[1100] bg-black/80 flex flex-col animate-in fade-in duration-200">
                    <div className="bg-surface p-4 flex justify-between items-center shadow-lg relative z-10 shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-main">Selecionar Localização</h2>
                            <p className="text-xs text-muted font-medium">Clique no mapa para marcar</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (tempCoords) {
                                        if (editingCity) {
                                            setEditingCity({ ...editingCity, lat: tempCoords.lat, lng: tempCoords.lng });
                                        } else {
                                            setNewCityLat(tempCoords.lat.toString());
                                            setNewCityLng(tempCoords.lng.toString());
                                        }
                                        setIsMapPickerOpen(false);
                                        setTempCoords(null);
                                    }
                                }}
                                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!tempCoords}
                            >
                                Confirmar
                            </button>
                            <button
                                onClick={() => setIsMapPickerOpen(false)}
                                className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 relative cursor-crosshair h-full">
                        <MapView
                            items={[]}
                            onMapClick={(e) => {
                                setTempCoords({ lat: e.lat, lng: e.lng });
                            }}
                            initialCenter={
                                (editingCity?.lat && editingCity?.lng)
                                    ? { lat: editingCity.lat, lng: editingCity.lng }
                                    : (newCityLat && newCityLng)
                                        ? { lat: parseFloat(newCityLat), lng: parseFloat(newCityLng) }
                                        : undefined
                            }
                            selectedLocation={tempCoords ? tempCoords : (
                                (editingCity?.lat && editingCity?.lng)
                                    ? { lat: editingCity.lat, lng: editingCity.lng }
                                    : (newCityLat && newCityLng)
                                        ? { lat: parseFloat(newCityLat), lng: parseFloat(newCityLng) }
                                        : undefined
                            )}
                        />
                        {/* Center Marker Help */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold pointer-events-none shadow-xl border border-white/10 z-10 whitespace-nowrap">
                            {tempCoords ? 'Localização marcada! Clique em Confirmar.' : 'Clique no mapa para definir a localização exata'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CityListPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <CityListContent />
        </Suspense>
    );
}
