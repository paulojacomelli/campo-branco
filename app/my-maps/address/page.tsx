"use client";

import { useState, useEffect, Suspense } from 'react';
import { toast } from 'sonner';
import RoleBasedSwitcher from '@/app/components/RoleBasedSwitcher';
import {
    Link as LinkIcon,
    Link2,
    X,
    Plus,
    MapPin,
    ArrowRight,
    Loader2,
    Trash2,
    Navigation,
    Home,
    Search,
    List,
    Map,
    Pencil,
    User,
    Users,
    Ear,
    Baby,
    GraduationCap,
    Brain,
    FileText,
    MoreVertical,
    History as HistoryIcon,
    ChevronDown,
    ChevronUp,
    ArrowLeft,
    CheckCircle,
    MousePointer2,
    GripVertical,
    Truck
} from 'lucide-react';
import VisitHistoryModal from '@/app/components/VisitHistoryModal';
import BottomNav from '@/app/components/BottomNav';
import MapView, { MapItem } from '@/app/components/MapView';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { getServiceYear, getServiceYearRange } from '@/lib/serviceYearUtils';
import { useRouter, useSearchParams } from 'next/navigation';

interface Address {
    id: string;
    street: string;
    number: string;
    complement?: string;
    territory_id: string; // Changed from territoryId
    congregation_id: string; // Changed from congregationId
    city_id: string; // Changed from cityId
    completed?: boolean;
    visited_at?: string; // Changed from visitedAt (Timestamp)
    lat?: number;
    lng?: number;
    is_active?: boolean; // Changed from isActive
    google_maps_link?: string; // Changed from googleMapsLink
    waze_link?: string;
    people_count?: number; // Changed from peopleCount
    resident_name?: string; // Changed from residentName
    is_deaf?: boolean; // Changed from isDeaf
    is_minor?: boolean; // Changed from isMinor
    is_student?: boolean; // Changed from isStudent
    observations?: string;
    gender?: 'HOMEM' | 'MULHER' | 'CASAL';
    is_neurodivergent?: boolean; // Changed from isNeurodivergent
    visit_status?: 'contacted' | 'not_contacted' | 'moved' | 'do_not_visit' | 'none'; // Changed from visitStatus
    last_visited_at?: string; // Changed from lastVisitedAt (Timestamp)
    sort_order?: number; // Changed from sortOrder
}

function AddressListContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const congregationId = searchParams.get('congregationId') || '';
    const cityId = searchParams.get('cityId') || '';
    const territoryId = searchParams.get('territoryId') || '';
    const currentView = searchParams.get('view') || 'grid';

    const { user, isAdmin, isElder, isServant, loading: authLoading, congregationType: authCongregationType, termType } = useAuth();
    const [localCongregationType, setLocalCongregationType] = useState<'TRADITIONAL' | 'SIGN_LANGUAGE' | 'FOREIGN_LANGUAGE' | null>(null);
    const isTraditional = (localCongregationType || authCongregationType) === 'TRADITIONAL';
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [historyAddressId, setHistoryAddressId] = useState<string | null>(null);
    const [localTermType, setLocalTermType] = useState<'city' | 'neighborhood'>('city');
    const [parentCity, setParentCity] = useState<string | null>(null);

    const serviceYearRange = useState(() => getServiceYearRange(getServiceYear()))[0];

    // Form State
    const [combinedAddress, setCombinedAddress] = useState(''); // Single input for "Street, Number"
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    // New Fields
    const [isActive, setIsActive] = useState(true);
    const [googleMapsLink, setGoogleMapsLink] = useState('');
    const [wazeLink, setWazeLink] = useState('');
    const [peopleCount, setPeopleCount] = useState('1');
    // Gender Stats State: territoryId -> { men: number, women: number, couples: number }
    const [genderStats, setGenderStats] = useState<Record<string, { men: number, women: number, couples: number }>>({});
    const [residentName, setResidentName] = useState('');
    const [gender, setGender] = useState<'HOMEM' | 'MULHER' | 'CASAL' | ''>('');
    const [isDeaf, setIsDeaf] = useState(false);
    const [isMinor, setIsMinor] = useState(false);
    const [isStudent, setIsStudent] = useState(false);
    const [isNeurodivergent, setIsNeurodivergent] = useState(false);
    const [observations, setObservations] = useState('');

    // Context Selection State
    const [selectedCongregationId, setSelectedCongregationId] = useState(congregationId);
    const [selectedCityId, setSelectedCityId] = useState(cityId);
    const [selectedTerritoryId, setSelectedTerritoryId] = useState(territoryId);

    // UI State
    const [isInactiveExpanded, setIsInactiveExpanded] = useState(false);
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
    const [isMapSelectionMode, setIsMapSelectionMode] = useState(true);
    const [pickerTempCoords, setPickerTempCoords] = useState<{ lat: number; lng: number } | null>(null);

    // View Mode
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareExpiration, setShareExpiration] = useState('24h');

    // Map Picker State
    const [isPickingLocation, setIsPickingLocation] = useState(false);

    const [availableCongregations, setAvailableCongregations] = useState<{ id: string, name: string }[]>([]);
    const [availableCities, setAvailableCities] = useState<{ id: string, name: string }[]>([]);
    const [availableTerritories, setAvailableTerritories] = useState<{ id: string, name: string }[]>([]);

    // Context Names State
    const [contextNames, setContextNames] = useState({
        congregation: '',
        city: '',
        territory: ''
    });

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    // Fetch Context Names & Options
    useEffect(() => {
        if (!congregationId || !cityId || !territoryId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch context over bypass RLS API to avoid 404 block for cities and territories selection
                const response = await fetch(`/api/maps/context?congregationId=${congregationId}&cityId=${cityId}&territoryId=${territoryId}`);
                const resData = await response.json();

                if (!resData.success) {
                    throw new Error(resData.error || 'Erro ao buscar contexto superior');
                }

                const congResData = resData.congregation;
                const cityResData = resData.city;
                const terrResData = resData.territory;

                // Concatenando o numero com descricao para exibir no cabeçalho
                let territoryDisplayName = 'Não encontrada';
                if (terrResData) {
                    territoryDisplayName = terrResData.name;
                    if (terrResData.notes) {
                        territoryDisplayName += ` - ${terrResData.notes}`;
                    }
                }

                setContextNames({
                    congregation: congResData?.name || 'Não encontrada',
                    city: cityResData?.name || 'Não encontrada',
                    territory: territoryDisplayName
                });

                if (congResData) {
                    setLocalTermType(congResData.term_type as any || 'city');
                    const cat = (congResData.category || '').toLowerCase();
                    if (cat.includes('sinais') || cat.includes('sign')) setLocalCongregationType('SIGN_LANGUAGE');
                    else if (cat.includes('estrangeir') || cat.includes('foreign')) setLocalCongregationType('FOREIGN_LANGUAGE');
                    else setLocalCongregationType('TRADITIONAL');
                }
                if (cityResData) {
                    setParentCity(cityResData.parent_city || null);
                }

            } catch (error) {
                console.error("Error fetching context:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [congregationId, cityId, territoryId]);


    // Fetch Addresses
    const fetchAddresses = async () => {
        if (!congregationId || !territoryId) return;

        try {
            const response = await fetch(`/api/addresses/list?congregationId=${congregationId}&territoryId=${territoryId}`);
            const resData = await response.json();

            if (!response.ok) {
                throw new Error(resData.error || 'Erro ao buscar endereços');
            }

            const data = resData.addresses.map((addr: any) => ({
                ...addr,
                people_count: addr.phone ? parseInt(addr.phone) : 1
            }));

            const sorted = (data || []).sort((a: any, b: any) => {
                const orderA = a.sort_order ?? 999999;
                const orderB = b.sort_order ?? 999999;
                if (orderA !== orderB) return orderA - orderB;
                if (a.street === b.street) {
                    return a.number.localeCompare(b.number, undefined, { numeric: true });
                }
                return a.street.localeCompare(b.street);
            });

            setAddresses(sorted);
        } catch (error) {
            console.error("Error fetching addresses:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAddresses();

        const subscription = supabase
            .channel('addresses_list')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'addresses',
                filter: `territory_id=eq.${territoryId}`
            }, () => {
                fetchAddresses();
            })
            .subscribe();

        return () => {
            setTimeout(() => {
                subscription.unsubscribe();
            }, 100);
        };
    }, [congregationId, territoryId]);

    // Fetch Available Options for Edit Modal
    useEffect(() => {
        if (!isCreateModalOpen) return;

        const fetchOptions = async () => {
            const { data: cities } = await supabase.from('cities').select('id, name').eq('congregation_id', selectedCongregationId);
            if (cities) setAvailableCities(cities);

            const { data: territories } = await supabase
                .from('territories')
                .select('id, name')
                .eq('congregation_id', selectedCongregationId)
                .eq('city_id', selectedCityId)
                .order('name');

            if (territories) {
                const sortedT = territories.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                setAvailableTerritories(sortedT);
            }

            if (congregationId) {
                const { data: cong } = await supabase.from('congregations').select('id, name').eq('id', congregationId).single();
                if (cong) setAvailableCongregations([{ id: cong.id, name: cong.name }]);
            }
        };

        fetchOptions();
    }, [isCreateModalOpen, selectedCongregationId, selectedCityId, congregationId]);


    // Init form
    useEffect(() => {
        if (!editingId && congregationId && cityId && territoryId) {
            setSelectedCongregationId(congregationId);
            setSelectedCityId(cityId);
            setSelectedTerritoryId(territoryId);
        }
    }, [isCreateModalOpen, editingId, congregationId, cityId, territoryId]);


    const generateMapsLink = () => {
        if (combinedAddress) {
            setGoogleMapsLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(combinedAddress)}`);
        }
    };

    const generateWazeLink = () => {
        if (lat && lng) {
            setWazeLink(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
        } else if (combinedAddress) {
            setWazeLink(`https://waze.com/ul?q=${encodeURIComponent(combinedAddress)}&navigate=yes`);
        }
    };

    // Actions
    const handleCreateAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!combinedAddress.trim()) {
            toast.error("Preencha o Endereço Completo para salvar.");
            return;
        }

        let finalNumber = 'S/N';
        const numberMatch = combinedAddress.match(/,\s*(\d+)/) || combinedAddress.match(/\s(\d+)(?:\s|$)/);
        if (numberMatch) finalNumber = numberMatch[1];

        const finalStreet = combinedAddress.trim();
        const finalLat = lat ? parseFloat(lat) : null;
        const finalLng = lng ? parseFloat(lng) : null;

        try {
            const addressData = {
                id: editingId || undefined,
                street: finalStreet,
                number: finalNumber,
                complement: '',
                territory_id: selectedTerritoryId,
                congregation_id: selectedCongregationId,
                city_id: selectedCityId,
                lat: finalLat,
                lng: finalLng,
                is_active: isActive,
                google_maps_link: googleMapsLink,
                waze_link: wazeLink,
                resident_name: residentName,
                gender: gender || null,
                is_deaf: isDeaf,
                is_minor: isMinor,
                is_student: isStudent,
                is_neurodivergent: isNeurodivergent,
                observations,
                people_count: peopleCount ? parseInt(peopleCount) : 0
            };

            const response = await fetch('/api/addresses/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addressData)
            });

            const resData = await response.json();
            if (!response.ok) {
                throw new Error(resData.error || 'Erro ao salvar via API');
            }

            toast.success(editingId ? "Endereço atualizado com sucesso!" : "Endereço cadastrado com sucesso!");

            fetchAddresses();

            resetForm();
        } catch (error) {
            console.error("Error saving address:", error);
            toast.error("Erro ao salvar endereço.");
        }
    };

    const resetForm = () => {
        setCombinedAddress('');
        setLat('');
        setLng('');
        setIsActive(true);
        setGoogleMapsLink('');
        setWazeLink('');
        setPeopleCount('1');
        setResidentName('');
        setGender('');
        setIsDeaf(false);
        setIsMinor(false);
        setIsStudent(false);
        setIsNeurodivergent(false);
        setObservations('');
        setEditingId(null);
        setIsCreateModalOpen(false);
    };

    const handleEditAddress = (addr: Address) => {
        setEditingId(addr.id);
        setCombinedAddress(addr.street.includes(addr.number) ? addr.street : `${addr.street}, ${addr.number}`);
        setLat(addr.lat?.toString() || '');
        setLng(addr.lng?.toString() || '');
        setSelectedCongregationId(addr.congregation_id);
        setSelectedCityId(addr.city_id);
        setSelectedTerritoryId(addr.territory_id);
        setIsActive(addr.is_active ?? true);
        setGoogleMapsLink(addr.google_maps_link || '');
        setWazeLink(addr.waze_link || '');
        setPeopleCount(addr.people_count?.toString() || (addr as any).phone || '1');
        setResidentName(addr.resident_name || '');
        setGender(addr.gender || '');
        setIsDeaf(addr.is_deaf || false);
        setIsMinor(addr.is_minor || false);
        setIsStudent(addr.is_student || false);
        setIsNeurodivergent(addr.is_neurodivergent || false);
        setObservations(addr.observations || '');
        setIsCreateModalOpen(true);
    };

    const handleDeleteAddress = async (id: string) => {
        if (!confirm("Excluir endereço?")) return;
        try {
            const { error } = await supabase.from('addresses').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error("Error deleting address:", error);
        }
    };

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
        setIsSelectionMode(newSelected.size > 0);
    };

    const handleConfirmShare = async () => {
        if (selectedIds.size === 0) return;
        toast.info("Compartilhamento em desenvolvimento.");
        setIsShareModalOpen(false);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (id === draggedId) return;
        const overIndex = addresses.findIndex(a => a.id === id);
        const dragIndex = addresses.findIndex(a => a.id === draggedId);
        if (dragIndex === -1 || overIndex === -1) return;

        const newAddresses = [...addresses];
        const [removed] = newAddresses.splice(dragIndex, 1);
        newAddresses.splice(overIndex, 0, removed);
        setAddresses(newAddresses);
    };

    const handleDragEnd = async () => {
        if (!draggedId) return;
        setDraggedId(null);

        try {
            const updates = addresses.map((addr, index) =>
                supabase.from('addresses').update({ sort_order: index }).eq('id', addr.id)
            );
            await Promise.all(updates);
        } catch (error) {
            console.error("Error updating sort order:", error);
        }
    };

    const filteredAddresses = addresses.filter(a =>
        a.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeAddresses = filteredAddresses.filter(a => a.is_active !== false);
    const inactiveAddresses = filteredAddresses.filter(a => a.is_active === false);

    const handleGeocodeSuccess = async (id: string, lat: number, lng: number) => {
        try {
            await supabase.from('addresses').update({ lat, lng }).eq('id', id);
        } catch (error) {
            console.error("Error syncing geocoded coords:", error);
        }
    };

    const handleOpenMap = (item: any) => {
        const query = `${item.street}, ${item.number}`;
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);
        let url = '';
        if (isIOS) url = `maps://?q=${encodeURIComponent(query)}`;
        else if (isAndroid) url = `geo:0,0?q=${encodeURIComponent(query)}`;
        else url = item.google_maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        window.open(url, '_blank');
    };

    const handleMapClick = (clickLat: number, clickLng: number) => {
        if (isMapPickerOpen && isMapSelectionMode) {
            setPickerTempCoords({ lat: clickLat, lng: clickLng });
        }
    };

    // --- RENDER HELPERS ---
    const renderAddressCard = (addr: Address, index: number) => (
        <div
            key={addr.id}
            draggable={!isSelectionMode}
            onDragStart={(e) => handleDragStart(e, addr.id)}
            onDragOver={(e) => handleDragOver(e, addr.id)}
            onDragEnd={handleDragEnd}
            className={`group bg-surface rounded-lg p-4 border border-surface-border shadow-sm hover:shadow-md transition-all ${draggedId === addr.id ? 'opacity-20 transition-none scale-95' : ''} ${openMenuId === addr.id ? 'relative z-20 ring-1 ring-primary-100 dark:ring-primary-900' : ''}`}
        >
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-3 flex-1 min-w-0 ${!addr.is_active ? 'opacity-60 grayscale' : ''}`}>
                    {/* Drag Handle */}
                    {!isSelectionMode && (
                        <div className="cursor-grab active:cursor-grabbing text-muted hover:text-primary-500 transition-colors">
                            <GripVertical className="w-5 h-5" />
                        </div>
                    )}

                    {/* Checkbox for selection */}
                    {isSelectionMode && (
                        <div onClick={(e) => e.stopPropagation()}>
                            <input
                                type="checkbox"
                                checked={selectedIds.has(addr.id)}
                                onChange={() => toggleSelection(addr.id)}
                                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 bg-gray-50 dark:bg-gray-800"
                            />
                        </div>
                    )}

                    {/* Gender/Number Badge */}
                    {(() => {
                        let lastVisitFormatted = "Sem visitas este ano";
                        if (addr.last_visited_at) {
                            const lvDate = new Date(addr.last_visited_at);
                            lastVisitFormatted = `Última visita: ${lvDate.toLocaleDateString()}`;
                        }

                        // Gender Mode (Sign Language / Foreign)
                        if (!isTraditional && addr.gender) {
                            let badgeStyles = "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
                            if (addr.gender === 'HOMEM') {
                                badgeStyles = "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
                            } else if (addr.gender === 'MULHER') {
                                badgeStyles = "bg-pink-100 text-pink-600 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800";
                            } else if (addr.gender === 'CASAL') {
                                badgeStyles = "bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800";
                            }

                            return (
                                <div
                                    title={lastVisitFormatted}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm border transition-colors ${badgeStyles}`}
                                >
                                    {addr.gender === 'CASAL' ? (
                                        <div className="flex -space-x-1.5">
                                            <User className="w-4 h-4 fill-current" />
                                            <User className="w-4 h-4 fill-current" />
                                        </div>
                                    ) : (
                                        <User className="w-5 h-5 fill-current" />
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div
                                title={lastVisitFormatted}
                                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border bg-primary-50 dark:bg-primary-900/10 text-primary-700 dark:text-primary-400 border-primary-100 dark:border-primary-900/20 transition-colors"
                            >
                                <span className="text-sm font-bold">{index + 1}</span>
                            </div>
                        );
                    })()}

                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-main text-base truncate">
                            {addr.street}
                            {!isTraditional && !addr.street.includes(addr.number) && addr.number !== 'S/N' ? `, ${addr.number}` : ''}
                        </h3>

                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted">
                            {addr.people_count ? (
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md" title="Número de Pessoas">
                                    <Users className="w-3 h-3" />
                                    <span className="font-bold">{addr.people_count}</span>
                                </div>
                            ) : null}
                            {!isTraditional && addr.resident_name && <span className="font-semibold text-gray-700 dark:text-gray-300">{addr.resident_name}</span>}

                            {!isTraditional && (
                                <>
                                    {addr.gender && (
                                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase ${addr.gender === 'HOMEM' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            addr.gender === 'MULHER' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                                                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                            }`}>
                                            {addr.gender === 'HOMEM' && <User className="w-3 h-3 fill-current" />}
                                            {addr.gender === 'MULHER' && <User className="w-3 h-3 fill-current" />}
                                            {addr.gender === 'CASAL' && (
                                                <div className="flex -space-x-1">
                                                    <User className="w-2.5 h-2.5 fill-current" />
                                                    <User className="w-2.5 h-2.5 fill-current" />
                                                </div>
                                            )}
                                            {addr.gender === 'HOMEM' ? 'Homem' : addr.gender === 'MULHER' ? 'Mulher' : 'Casal'}
                                        </span>
                                    )}
                                    {addr.is_deaf && (
                                        <span className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                            <Ear className="w-3 h-3" /> Surdo
                                        </span>
                                    )}
                                    {addr.is_minor && (
                                        <span className="flex items-center gap-1 bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                            <Baby className="w-3 h-3" /> Menor
                                        </span>
                                    )}
                                    {addr.is_student && (
                                        <span className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                            <GraduationCap className="w-3 h-3" /> Estudante
                                        </span>
                                    )}
                                    {addr.is_neurodivergent && (
                                        <span className="flex items-center gap-1 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                            <Brain className="w-3 h-3" /> Neurodivergente
                                        </span>
                                    )}
                                </>
                            )}
                            {addr.visit_status === 'moved' && (
                                <span className="flex items-center gap-1 bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-400 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                    <Truck className="w-3 h-3" /> Mudou-se
                                </span>
                            )}
                        </div>

                        {addr.observations && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted">
                                <FileText className="w-3 h-3 shrink-0" />
                                <p className="truncate">{addr.observations}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative">
                    {(isElder || isServant) ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === addr.id ? null : addr.id);
                            }}
                            className={`p-2 rounded-full transition-colors ${openMenuId === addr.id ? 'bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setHistoryAddressId(addr.id);
                            }}
                            className="p-2 rounded-full text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                        >
                            <HistoryIcon className="w-5 h-5" />
                        </button>
                    )}

                    {openMenuId === addr.id && (
                        <div className="absolute right-0 top-10 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-surface-border dark:border-slate-700 p-1 z-20 min-w-[160px] animate-in fade-in zoom-in-95 duration-200">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMap(addr);
                                    setOpenMenuId(null);
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors w-full text-left"
                            >
                                <Navigation className="w-4 h-4" />
                                Abrir no Mapa
                            </button>

                            <button
                                onClick={() => {
                                    setHistoryAddressId(addr.id);
                                    setOpenMenuId(null);
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg transition-colors w-full text-left"
                            >
                                <HistoryIcon className="w-4 h-4" />
                                Abrir Histórico
                            </button>

                            {isServant && (
                                <button
                                    onClick={() => {
                                        handleEditAddress(addr);
                                        setOpenMenuId(null);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors w-full text-left"
                                >
                                    <Pencil className="w-4 h-4" />
                                    Editar
                                </button>
                            )}

                            {(isElder || isServant) && (
                                <button
                                    onClick={() => {
                                        handleDeleteAddress(addr.id);
                                        setOpenMenuId(null);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors w-full text-left"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Excluir
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main">
            {/* Header */}
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/my-maps/territory?congregationId=${congregationId}&cityId=${cityId}&territoryId=${territoryId}`}
                        className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg text-main tracking-tight leading-none">{contextNames.territory}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted font-bold uppercase tracking-wider">{localTermType === 'neighborhood' ? 'Bairro' : 'Cidade'}: {contextNames.city}</span>
                            {parentCity && (
                                <>
                                    <span className="text-[8px] text-gray-300 dark:text-gray-600">•</span>
                                    <span className="text-[10px] text-blue-500 font-black tracking-tight uppercase">{parentCity}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">

                    {(isElder || isServant) && (
                        <>
                            <button
                                onClick={() => {
                                    const currentPath = window.location.pathname + window.location.search;
                                    router.push(`/share-setup?ids=${territoryId}&returnUrl=${encodeURIComponent(currentPath)}`);
                                }}
                                className="bg-green-600 border border-green-600 text-white hover:bg-green-700 px-3 py-2 rounded-lg shadow-md transition-all active:scale-95 mr-2 flex items-center gap-2 font-bold text-xs uppercase tracking-wider"
                                title="Gerar Link de Compartilhamento"
                            >
                                <LinkIcon className="w-4 h-4" />
                                Criar Link
                            </button>
                            <button
                                onClick={() => {
                                    resetForm();
                                    setIsCreateModalOpen(true);
                                }}
                                className="bg-gray-900 border-gray-900 border hover:bg-black dark:bg-surface-highlight dark:hover:bg-slate-800 text-white dark:text-main dark:border-surface-border p-2 rounded-lg shadow-lg transition-all active:scale-95"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </header>


            {/* Main Content */}
            <div className="flex flex-col">
                {/* Top: Address List */}
                <div className="flex-1 bg-background">
                    {/* Search */}
                    <div className="px-6 pt-6 pb-2 sticky top-0 bg-background z-10 transition-colors">
                        <div className="relative group max-w-6xl mx-auto">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar rua ou número..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-surface border-0 text-main text-sm font-medium rounded-lg py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-muted"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                    ) : filteredAddresses.length === 0 ? (
                        <div className="text-center py-12 opacity-50">
                            <Home className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-gray-400 font-medium">Nenhum endereço cadastrado</p>
                        </div>
                    ) : currentView === 'table' ? (
                        <div className="px-6 pb-6 max-w-6xl mx-auto overflow-hidden">
                            <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-surface-highlight border-b border-surface-border text-muted uppercase tracking-wider text-[10px] font-bold">
                                            <tr>
                                                <th className="px-4 py-4 w-12 text-center">#</th>
                                                <th className="px-4 py-4">Endereço</th>
                                                <th className="px-4 py-4">Morador</th>
                                                <th className="px-4 py-4">Status</th>
                                                <th className="px-4 py-4 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-border">
                                            {activeAddresses.map((addr, idx) => (
                                                <tr key={addr.id} className="hover:bg-surface-highlight/50 transition-colors group">
                                                    <td className="px-4 py-4 text-center font-bold text-muted">{idx + 1}</td>
                                                    <td className="px-4 py-4">
                                                        <div className="font-bold text-main">{addr.street}{!isTraditional && !addr.street.includes(addr.number) && addr.number !== 'S/N' ? `, ${addr.number}` : ''}</div>
                                                        {addr.observations && <div className="text-[10px] text-muted truncate max-w-[150px]">{addr.observations}</div>}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            {addr.resident_name && <span className="font-semibold text-xs text-main">{addr.resident_name}</span>}
                                                            <div className="flex flex-wrap gap-1">
                                                                {addr.gender && (
                                                                    <span className={`px-1 rounded text-[8px] font-black uppercase ${addr.gender === 'HOMEM' ? 'bg-blue-100 text-blue-700' : addr.gender === 'MULHER' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'}`}>
                                                                        {addr.gender.substring(0, 1)}
                                                                    </span>
                                                                )}
                                                                {addr.is_deaf && <span className="px-1 bg-yellow-100 text-yellow-800 rounded text-[8px] font-black uppercase">S</span>}
                                                                {addr.is_minor && <span className="px-1 bg-primary-light/50 text-primary-dark rounded text-[8px] font-black uppercase">M</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {addr.visit_status && (
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${addr.visit_status === 'contacted' ? 'bg-green-100 text-green-700' :
                                                                addr.visit_status === 'moved' ? 'bg-sky-100 text-sky-700' :
                                                                    addr.visit_status === 'do_not_visit' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                {addr.visit_status === 'contacted' ? 'Visitado' :
                                                                    addr.visit_status === 'moved' ? 'Mudou' :
                                                                        addr.visit_status === 'do_not_visit' ? 'Não Visitar' : 'Pendente'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleOpenMap(addr)} className="p-1.5 text-muted hover:text-primary hover:bg-primary-light/50 rounded-lg"><Navigation className="w-4 h-4" /></button>
                                                            {(isElder || isServant) && (
                                                                <>
                                                                    <button onClick={() => handleEditAddress(addr)} className="p-1.5 text-muted hover:text-main hover:bg-background rounded-lg"><Pencil className="w-4 h-4" /></button>
                                                                    <button onClick={() => handleDeleteAddress(addr.id)} className="p-1.5 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-6 pb-6 space-y-3 max-w-6xl mx-auto">
                            {activeAddresses.map((addr, idx) => renderAddressCard(addr, idx))}

                            {inactiveAddresses.length > 0 && (
                                <>
                                    <button
                                        onClick={() => setIsInactiveExpanded(!isInactiveExpanded)}
                                        className="w-full pt-8 pb-4 flex items-center gap-4 group cursor-pointer focus:outline-none"
                                    >
                                        <div className="h-px bg-gray-200 flex-1 group-hover:bg-gray-300 transition-colors"></div>
                                        <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-600 transition-colors">
                                            <span className="text-xs font-bold uppercase tracking-widest">Desativados ({inactiveAddresses.length})</span>
                                            {isInactiveExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        </div>
                                        <div className="h-px bg-gray-200 flex-1 group-hover:bg-gray-300 transition-colors"></div>
                                    </button>

                                    {isInactiveExpanded && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                                            {inactiveAddresses.map((addr, idx) => renderAddressCard(addr, activeAddresses.length + idx))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Bottom: Map View */}
                <div className="w-full h-96 border-t border-gray-200 relative z-0">
                    <MapView
                        onGeocodeSuccess={handleGeocodeSuccess}
                        onMapClick={handleMapClick}
                        disableGeocoding={true}
                        items={[
                            ...activeAddresses.map((a, idx) => ({
                                id: a.id,
                                lat: a.lat,
                                lng: a.lng,
                                title: `${a.street}, ${a.number}`,
                                subtitle: a.complement || '',
                                variant: 'numbered' as const,
                                index: idx + 1,
                                number: a.number,
                                residentName: a.resident_name,
                                gender: a.gender,
                                status: ((a as any).visit_status === 'contacted' ? 'OCUPADO' :
                                    (a as any).visit_status === 'do_not_visit' ? 'NAO_VISITAR' :
                                        (a as any).visit_status === 'moved' ? 'MUDOU' :
                                            (a as any).visit_status === 'not_contacted' ? 'NAO_CONTATADO' : 'LIVRE') as MapItem['status'],
                                lastVisit: a.last_visited_at && new Date(a.last_visited_at).toLocaleDateString(),
                                isDeaf: a.is_deaf,
                                isMinor: a.is_minor,
                                isStudent: a.is_student,
                                isNeurodivergent: a.is_neurodivergent
                            })),
                            ...(isInactiveExpanded ? inactiveAddresses.map((a, idx) => ({
                                id: a.id,
                                lat: a.lat,
                                lng: a.lng,
                                title: `${a.street}, ${a.number}`,
                                subtitle: a.complement || '',
                                variant: 'numbered' as const,
                                index: activeAddresses.length + idx + 1,
                                number: a.number,
                                residentName: a.resident_name,
                                gender: a.gender,
                                status: ((a as any).visit_status === 'contacted' ? 'OCUPADO' :
                                    (a as any).visit_status === 'do_not_visit' ? 'NAO_VISITAR' :
                                        (a as any).visit_status === 'moved' ? 'MUDOU' :
                                            (a as any).visit_status === 'not_contacted' ? 'NAO_CONTATADO' : 'LIVRE') as MapItem['status'],
                                lastVisit: a.last_visited_at && new Date(a.last_visited_at).toLocaleDateString(),
                                isDeaf: a.is_deaf,
                                isMinor: a.is_minor,
                                isStudent: a.is_student,
                                isNeurodivergent: a.is_neurodivergent
                            })) : [])
                        ]}
                        showLegend={false}
                    />
                </div>
            </div>

            {/* History Modal - Fixed: Only renders if historyAddressId is set */}
            {historyAddressId && (
                <VisitHistoryModal
                    onClose={() => setHistoryAddressId(null)}
                    addressId={historyAddressId}
                    address={(() => {
                        const addr = addresses.find(a => a.id === historyAddressId);
                        if (!addr) return '';
                        if (addr.street.includes(addr.number)) return addr.street;
                        return `${addr.street}, ${addr.number}`;
                    })()}
                />
            )}


            {/* Create Modal */}
            {
                isCreateModalOpen && (
                    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-transparent dark:border-slate-800 my-8">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    {editingId ? <Pencil className="w-6 h-6 text-blue-600" /> : <Plus className="w-6 h-6 text-blue-600" />}
                                    {editingId ? 'Editar Endereço' : 'Novo Endereço'}
                                </h2>
                                <form onSubmit={handleCreateAddress} className="space-y-4">
                                    {/* Status Header */}
                                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <span className="font-bold text-sm text-gray-700 dark:text-gray-300">Status do Endereço</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsActive(!isActive)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {/* Context Info (Read Only) */}
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-100 dark:border-gray-700">
                                        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
                                            <span className="text-xs font-bold text-muted uppercase tracking-wider">Congregação</span>
                                            <span className="text-sm font-bold text-main text-right max-w-[60%] truncate" title={contextNames.congregation}>{contextNames.congregation}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
                                            <span className="text-xs font-bold text-muted uppercase tracking-wider">{localTermType === 'neighborhood' ? 'Bairro' : 'Cidade'}</span>
                                            <span className="text-sm font-bold text-main text-right max-w-[60%] truncate" title={contextNames.city}>{contextNames.city}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-muted uppercase tracking-wider">Território</span>
                                            <span className="text-sm font-bold text-main text-right max-w-[60%] truncate" title={contextNames.territory}>{contextNames.territory}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Endereço Completo</label>
                                            <textarea
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 font-bold text-sm text-main mb-2 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
                                                rows={2}
                                                value={combinedAddress}
                                                onChange={e => setCombinedAddress(e.target.value)}
                                                placeholder="Ex: Rua das Flores, 123"
                                                required
                                            />
                                        </div>

                                        {/* Google Maps Link */}
                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Link Google Maps</label>
                                            <div className="flex gap-2">
                                                <input
                                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 font-bold text-sm text-main"
                                                    value={googleMapsLink}
                                                    onChange={e => setGoogleMapsLink(e.target.value)}
                                                    placeholder="https://maps.google.com..."
                                                />
                                                <button
                                                    type="button"
                                                    onClick={generateMapsLink}
                                                    className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-3 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors shrink-0"
                                                    title="Gerar Link Automático"
                                                >
                                                    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
                                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4285F4" />
                                                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Waze Link */}
                                            <div className="mt-4">
                                                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Link Waze</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 font-bold text-sm text-main"
                                                        value={wazeLink}
                                                        onChange={e => setWazeLink(e.target.value)}
                                                        placeholder="https://waze.com/ul..."
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={generateWazeLink}
                                                        className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-3 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors shrink-0"
                                                        title="Gerar Link Waze"
                                                    >
                                                        <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
                                                            <path fill="#33CCFF" d="M19.333 11.667a6.666 6.666 0 0 0-13.333 0c0 .35.03.7.078 1.045a3.167 3.167 0 0 0-2.745 3.122 3.167 3.167 0 0 0 3.167 3.166h.165a2.833 2.833 0 0 0 5.667 0h1.333a2.833 2.833 0 0 0 5.667 0h.165a3.167 3.167 0 0 0 3.167-3.166 3.167 3.167 0 0 0-2.745-3.122 6.666 6.666 0 0 0 .078-1.045z" />
                                                            <circle cx="15.5" cy="11.5" r="1" fill="#fff" />
                                                            <circle cx="9.5" cy="11.5" r="1" fill="#fff" />
                                                            <path d="M10 14.5s1 1 2 0" stroke="#fff" strokeWidth="1" fill="none" strokeLinecap="round" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 mt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPickerTempCoords(lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null);
                                                        setIsMapPickerOpen(true);
                                                    }}
                                                    className="w-full py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <MapPin className="w-4 h-4" /> Selecionar Pino no Mapa
                                                </button>
                                            </div>
                                            {/* Debug/Verify Coords */}
                                            {lat && lng && (
                                                <div className="mt-1 text-center text-[10px] text-muted">
                                                    Lat: {lat.slice(0, 8)} | Lng: {lng.slice(0, 8)}
                                                </div>
                                            )}
                                        </div>

                                        {!isTraditional && (
                                            <div className="flex gap-3">
                                                <div className="flex-1">
                                                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Residentes</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 font-bold text-sm text-main"
                                                        value={peopleCount}
                                                        onChange={e => setPeopleCount(e.target.value)}
                                                        onBlur={() => {
                                                            if (!peopleCount || parseInt(peopleCount) < 1) setPeopleCount('1');
                                                        }}
                                                        placeholder="Qtd."
                                                    />
                                                </div>
                                                <div className="flex-[2]">
                                                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Nome</label>
                                                    <input
                                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 font-bold text-sm text-main"
                                                        value={residentName}
                                                        onChange={e => setResidentName(e.target.value)}
                                                        placeholder="Nome do morador"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Gender Selection */}
                                        {!isTraditional && (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Gênero</label>
                                                    <div className="flex gap-2">
                                                        {[
                                                            { id: 'HOMEM', label: 'Homem' },
                                                            { id: 'MULHER', label: 'Mulher' },
                                                            { id: 'CASAL', label: 'Casal' }
                                                        ].map(opt => {
                                                            const isSelected = gender === opt.id;
                                                            let activeClass = '';

                                                            if (opt.id === 'HOMEM') activeClass = 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
                                                            else if (opt.id === 'MULHER') activeClass = 'border-pink-500 bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400';
                                                            else activeClass = 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';

                                                            return (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() => setGender(opt.id as any)}
                                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all border-2 ${isSelected ? activeClass : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:border-gray-200 dark:hover:border-gray-600'}`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Checkboxes */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer ${isDeaf ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200'}`}>
                                                        <input type="checkbox" className="hidden" checked={isDeaf} onChange={() => setIsDeaf(!isDeaf)} />
                                                        <Ear className="w-4 h-4" />
                                                        <span className="text-xs font-bold uppercase">Surdo</span>
                                                    </label>
                                                    <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer ${isMinor ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200'}`}>
                                                        <input type="checkbox" className="hidden" checked={isMinor} onChange={() => setIsMinor(!isMinor)} />
                                                        <Baby className="w-4 h-4" />
                                                        <span className="text-xs font-bold uppercase">Menor</span>
                                                    </label>
                                                    <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer ${isStudent ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200'}`}>
                                                        <input type="checkbox" className="hidden" checked={isStudent} onChange={() => setIsStudent(!isStudent)} />
                                                        <GraduationCap className="w-4 h-4" />
                                                        <span className="text-xs font-bold uppercase">Estudante</span>
                                                    </label>
                                                    <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer ${isNeurodivergent ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200'}`}>
                                                        <input type="checkbox" className="hidden" checked={isNeurodivergent} onChange={() => setIsNeurodivergent(!isNeurodivergent)} />
                                                        <Brain className="w-4 h-4" />
                                                        <span className="text-xs font-bold uppercase">Neurodivergente</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Observações</label>
                                            <textarea
                                                className="w-full bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 rounded-lg p-3 font-medium text-sm min-h-[80px] text-main"
                                                value={observations}
                                                onChange={e => setObservations(e.target.value)}
                                                placeholder="Detalhes adicionais..."
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <button type="button" onClick={resetForm} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
                                        <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors">
                                            {editingId ? 'Salvar Endereço' : 'Salvar Endereço'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Map Picker Modal */}
            {isMapPickerOpen && (
                <div className="fixed inset-0 z-[2000] bg-background flex flex-col animate-in fade-in duration-300">
                    <header className="bg-surface border-b border-surface-border px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-main tracking-tight">Selecionar Localização</h2>
                            <p className="text-xs text-muted font-bold uppercase tracking-widest">
                                {isMapSelectionMode ? 'Clique para marcar o ponto' : 'Arraste para navegar'}
                            </p>
                        </div>
                        <button
                            onClick={() => setIsMapPickerOpen(false)}
                            className="p-2 hover:bg-background rounded-full transition-colors"
                        >
                            <X className="w-6 h-6 text-muted" />
                        </button>
                    </header>

                    <div className="flex-1 relative">
                        <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                            <button
                                onClick={() => setIsMapSelectionMode(true)}
                                className={`p-3 rounded-2xl shadow-xl transition-all ${isMapSelectionMode ? 'bg-blue-600 text-white scale-110' : 'bg-surface text-muted hover:text-main border border-surface-border'}`}
                                title="Modo Seleção"
                            >
                                <MousePointer2 className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => setIsMapSelectionMode(false)}
                                className={`p-3 rounded-2xl shadow-xl transition-all ${!isMapSelectionMode ? 'bg-blue-600 text-white scale-110' : 'bg-surface text-muted hover:text-main border border-surface-border'}`}
                                title="Modo Navegação"
                            >
                                <Navigation className="w-6 h-6" />
                            </button>
                        </div>

                        <MapView
                            onMapClick={handleMapClick}
                            items={pickerTempCoords ? [{
                                id: 'temp',
                                lat: pickerTempCoords.lat,
                                lng: pickerTempCoords.lng,
                                title: combinedAddress || 'Novo Ponto',
                                status: 'LIVRE'
                            }] : []}
                            disableGeocoding={true}
                            showLegend={false}
                        />

                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-6">
                            <button
                                onClick={() => {
                                    if (pickerTempCoords) {
                                        setLat(pickerTempCoords.lat.toString());
                                        setLng(pickerTempCoords.lng.toString());
                                        setIsMapPickerOpen(false);
                                    }
                                }}
                                disabled={!pickerTempCoords || !isMapSelectionMode}
                                className={`w-full py-4 rounded-3xl font-bold flex items-center justify-center gap-2 shadow-2xl transition-all active:scale-95 ${(!pickerTempCoords || !isMapSelectionMode) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            >
                                <CheckCircle className="w-5 h-5" />
                                CONFIRMAR LOCAL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BottomNav />
        </div >
    );
}

export default function AddressListPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <AddressListContent />
        </Suspense>
    );
}
