"use client";

import { useEffect, useState, Suspense, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Map as MapIcon,
    Loader2,
    MapPin,
    Building2,
    ChevronRight,
    Share2,
    ThumbsUp,
    ThumbsDown,
    ArrowLeft,
    User,
    Users,
    Ear,
    Baby,
    GraduationCap,
    FileText,
    History as HistoryIcon,
    Navigation,
    Lock,
    Brain,
    ChevronUp,
    ChevronDown,
    MoreVertical
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import VisitReportModal from '@/app/components/VisitReportModal';
import VisitHistoryModal from '@/app/components/VisitHistoryModal';
import LoginRequestModal from '@/app/components/LoginRequestModal';
import AccessDeniedModal from '@/app/components/AccessDeniedModal';
import MapView from '@/app/components/MapView';
import BottomNav from '@/app/components/BottomNav';
import { toast } from 'sonner';

interface PreviewItem {
    id: string;
    name?: string;
    street?: string;
    number?: string;
    status?: string;
    residentName?: string;
    googleMapsLink?: string;
    lat?: number;
    lng?: number;
    completed?: boolean;
    complement?: string;
    peopleCount?: number;
    gender?: 'HOMEM' | 'MULHER' | 'CASAL';
    isDeaf?: boolean;
    isMinor?: boolean;
    isStudent?: boolean;
    isNeurodivergent?: boolean;
    visitStatus?: string;
    territoryId?: string;
    cityId?: string;
    isActive?: boolean;
    observations?: string;
    lastVisitedAt?: any; // Firestore Timestamp or serialized object
}

function SharedPreviewContent() {
    const searchParams = useSearchParams();
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const shareId = searchParams.get('shareId');
    const { user, profileName } = useAuth();

    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [items, setItems] = useState<PreviewItem[]>([]);
    const [pageCongregationId, setPageCongregationId] = useState<string | null>(null);
    const [error, setError] = useState('');

    // Modals State
    const [selectedAddressForReport, setSelectedAddressForReport] = useState<PreviewItem | null>(null);
    const [selectedAddressForHistory, setSelectedAddressForHistory] = useState<string | null>(null);
    const [showLoginRequest, setShowLoginRequest] = useState(false);
    const [showAccessDenied, setShowAccessDenied] = useState(false);
    const [deniedResource, setDeniedResource] = useState('');
    const [isInactiveExpanded, setIsInactiveExpanded] = useState(false);
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
    const [congregationType, setCongregationType] = useState<'TRADITIONAL' | 'SIGN_LANGUAGE' | 'FOREIGN_LANGUAGE' | null>(null);
    const isTraditional = congregationType === 'TRADITIONAL';

    const fetchData = useCallback(async () => {
        setLoading(true);
        if (!shareId || !id) {
            setError("Link incompleto.");
            setLoading(false);
            return;
        }

        try {
            // 1. Fetch Shared List Metadata & Validation
            const { data: listData, error: listError } = await supabase
                .from('shared_lists')
                .select('*')
                .eq('id', shareId)
                .single();

            if (listError || !listData) {
                setError("Lista compartilhada não encontrada.");
                setLoading(false);
                return;
            }

            // Check Expiration
            if (listData.expires_at) {
                const now = new Date();
                const expires = new Date(listData.expires_at);
                if (now > expires) {
                    setError("Link expirado.");
                    setLoading(false);
                    return;
                }
            }

            // 2. Fetch Item Data (Territory or City)
            const table = type === 'city' ? 'cities' : 'territories';
            const { data: mainData, error: mainError } = await supabase
                .from(table)
                .select('*')
                .eq('id', id)
                .single();

            if (mainError || !mainData) {
                setError("Item não encontrado.");
                setLoading(false);
                return;
            }

            const currentCongregationId = mainData.congregation_id || listData.congregation_id;
            setPageCongregationId(currentCongregationId || null);

            // Fetch Congregation Category
            if (currentCongregationId) {
                const { data: congData } = await supabase
                    .from('congregations')
                    .select('category')
                    .eq('id', currentCongregationId)
                    .single();
                if (congData) setCongregationType(congData.category as any);
            }

            // 3. Fetch Addresses (Try Snapshots first)
            let addresses: PreviewItem[] = [];

            // Try to get address snapshots for this list
            const { data: addrSnapshots } = await supabase
                .from('shared_list_snapshots')
                .select('data')
                .eq('shared_list_id', shareId);

            if (addrSnapshots && addrSnapshots.length > 0) {
                // Filter snapshots to get only relevant addresses for this territory/city
                const allData = addrSnapshots.map(s => s.data);
                const filteredData = type === 'city'
                    ? allData.filter(d => d.city_id === id)
                    : allData.filter(d => d.territory_id === id);

                if (filteredData.length > 0) {
                    addresses = filteredData.map(a => ({
                        id: a.id,
                        street: a.street,
                        number: a.number,
                        complement: a.complement,
                        residentName: a.resident_name,
                        googleMapsLink: a.google_maps_link,
                        lat: a.lat,
                        lng: a.lng,
                        isActive: a.is_active,
                        gender: a.gender,
                        isDeaf: a.is_deaf,
                        isMinor: a.is_minor,
                        isStudent: a.is_student,
                        isNeurodivergent: a.is_neurodivergent,
                        observations: a.observations,
                        visitStatus: a.visit_status,
                        territoryId: a.territory_id,
                        cityId: a.city_id
                    }));
                }
            }

            // Fallback to table if no snapshots found or empty
            if (addresses.length === 0) {
                const { data: addrData, error: addrError } = await supabase
                    .from('addresses')
                    .select('*')
                    .eq(type === 'city' ? 'city_id' : 'territory_id', id);

                if (!addrError && addrData) {
                    addresses = addrData.map(a => ({
                        id: a.id,
                        street: a.street,
                        number: a.number,
                        complement: a.complement,
                        residentName: a.resident_name,
                        googleMapsLink: a.google_maps_link,
                        lat: a.lat,
                        lng: a.lng,
                        isActive: a.is_active,
                        gender: a.gender,
                        isDeaf: a.is_deaf,
                        isMinor: a.is_minor,
                        isStudent: a.is_student,
                        isNeurodivergent: a.is_neurodivergent,
                        observations: a.observations,
                        visitStatus: a.visit_status,
                        territoryId: a.territory_id,
                        cityId: a.city_id
                    }));
                }
            }

            // 4. Fetch Results (visits linked to this shared list)
            const { data: visitsData } = await supabase
                .from('visits')
                .select('address_id, status')
                .eq('shared_list_id', shareId);

            const linkResults: Record<string, string> = {};
            visitsData?.forEach(v => {
                linkResults[v.address_id] = v.status;
            });

            // Merge
            const mergedItems = addresses.map(addr => {
                const statusFromVisit = linkResults[addr.id];
                const finalStatus = statusFromVisit || addr.visitStatus;
                return {
                    ...addr,
                    visitStatus: finalStatus,
                    completed: finalStatus === 'contacted'
                };
            });

            // Sort merged items
            mergedItems.sort((a, b) => {
                const streetA = a.street || '';
                const streetB = b.street || '';
                if (streetA !== streetB) return streetA.localeCompare(streetB);
                const numA = parseInt(a.number || '0');
                const numB = parseInt(b.number || '0');
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return (a.number || '').localeCompare(b.number || '');
            });

            setTitle(mainData.name);
            setSubtitle(mainData.description || (type === 'territory' ? "Território" : "Cidade"));
            setItems(mergedItems);
            setLoading(false);

        } catch (err) {
            console.error(err);
            setError("Erro ao carregar dados.");
            setLoading(false);
        }
    }, [shareId, id, type]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Close dropdown when complying with effect
    useEffect(() => {
        const handleClickOutside = () => setActiveDropdownId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleSaveVisit = async (data: any) => {
        if (!selectedAddressForReport || !shareId) return;

        try {
            const visit_date = new Date().toISOString();

            // Insert visit record into Supabase
            const { error: visitError } = await supabase
                .from('visits')
                .insert({
                    address_id: selectedAddressForReport.id,
                    territory_id: selectedAddressForReport.territoryId,
                    shared_list_id: shareId,
                    congregation_id: pageCongregationId,
                    user_id: user?.id || null,
                    publisher_name: profileName || 'Publicador (Link)',
                    status: data.status,
                    notes: data.observations || '',
                    visit_date: visit_date,
                    tags_snapshot: {
                        is_deaf: data.isDeaf,
                        is_minor: data.isMinor,
                        is_student: data.isStudent,
                        is_neurodivergent: data.isNeurodivergent,
                        gender: data.gender
                    }
                });

            if (visitError) throw visitError;

            // If it's a "contacted" status, we might want to update the address status too
            // However, shared links usually don't have full permission to update 'addresses' table directly
            // unless RLS allows it. Assuming the 'visits' record is enough for the shared view.

            // Refresh Local State
            fetchData();
            setSelectedAddressForReport(null);

        } catch (error) {
            console.error("Error saving visit:", error);
            toast.error("Erro ao salvar visita. Tente novamente.");
        }
    };
    // The code uses `shareId || null`.

    // If we have a shareId, we use it.


    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-muted text-sm font-bold animate-pulse">Carregando...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-6">
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-red-400">
                        <MapIcon className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-bold text-main">Ops!</h1>
                    <p className="text-muted">{error}</p>
                </div>
            </div>
        );
    }



    // Group items
    const activeItems = items.filter(i => i.isActive !== false);
    const inactiveItems = items.filter(i => i.isActive === false);

    const renderItem = (item: PreviewItem, index: number) => {
        let href = '#';
        let isExternal = false;

        if (type === 'city') {
            href = `/share/preview?type=territory&id=${item.id}&shareId=${shareId || ''}`;
        } else if (type === 'territory') {
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

        // Handler for clicking the whole card (Report Action)
        const handleCardClick = (e: React.MouseEvent) => {
            // If it's a city, let the link handle it.
            if (type === 'city') return;

            // For territory (addresses):
            e.preventDefault(); // Stop default navigation (if any)

            if (user) {
                setSelectedAddressForReport(item);
            } else {
                setShowLoginRequest(true);
            }
        };

        const handleHistoryClick = (e: React.MouseEvent, itemId: string) => {
            e.stopPropagation();
            setSelectedAddressForHistory(itemId);
            setActiveDropdownId(null);
        };

        const toggleDropdown = (e: React.MouseEvent, itemId: string) => {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            setActiveDropdownId(activeDropdownId === itemId ? null : itemId);
        };

        // Conditionally render wrapper: Link for City, Div for Territory (Address)
        const Wrapper = type === 'city' ? Link : 'div';
        // Add 'block' to ensure it takes width, but for Territory acts as div
        const wrapperProps = type === 'city' ? { href, className: 'block group' } : { className: 'block group cursor-pointer', onClick: handleCardClick };

        return (
            <Wrapper key={item.id} {...(wrapperProps as any)}>
                {/* Main Card Container - Matching Address List padding and styles */}
                <div className={`bg-surface rounded-2xl p-4 border border-surface-border shadow-sm hover:shadow-md transition-all relative ${item.isActive === false ? 'opacity-60 grayscale' : ''} ${activeDropdownId === item.id ? 'relative z-20 ring-1 ring-primary-100 dark:ring-primary-900' : ''}`}>

                    <div className="flex items-center gap-3">

                        {/* 1. Icon / Badge Section */}
                        {type === 'city' ? (
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border transition-colors bg-gray-50 dark:bg-gray-800 text-muted group-hover:bg-primary-light/50 dark:group-hover:bg-primary-dark/30 group-hover:text-primary dark:group-hover:text-primary-light">
                                <MapIcon className="w-6 h-6" />
                            </div>
                        ) : (
                            // Address List Logic for Badge
                            (() => {
                                // Gender Mode (Sign Language / Foreign)
                                if (!isTraditional && item.gender) {
                                    let badgeStyles = "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
                                    if (item.gender === 'HOMEM') {
                                        badgeStyles = "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
                                    } else if (item.gender === 'MULHER') {
                                        badgeStyles = "bg-pink-100 text-pink-600 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800";
                                    } else if (item.gender === 'CASAL') {
                                        badgeStyles = "bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800";
                                    }

                                    return (
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border transition-colors ${badgeStyles}`}>
                                            {item.gender === 'CASAL' ? (
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

                                // Traditional Numeric Badge
                                return (
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border bg-primary-50 dark:bg-primary-900/10 text-primary-700 dark:text-primary-400 border-primary-100 dark:border-primary-900/20 transition-colors">
                                        <span className="text-sm font-bold">{index + 1}</span>
                                    </div>
                                );
                            })()
                        )}

                        {/* 2. Content Section */}
                        <div className="flex-1 min-w-0">
                            {type === 'city' ? (
                                <>
                                    <h3 className="font-bold text-main truncate group-hover:text-primary-dark dark:group-hover:text-primary-light transition-colors">{item.name}</h3>
                                    <p className="text-xs text-muted mt-0.5 group-hover:text-blue-400/80">Ver Endereços</p>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-main text-base truncate">
                                            {item.street}
                                            {!isTraditional && !item.street?.includes(item.number || '') && item.number !== 'S/N' ? `, ${item.number}` : ''}
                                            {item.complement ? ` - ${item.complement}` : ''}
                                        </h3>
                                        {!user && <Lock className="w-3 h-3 text-muted" />}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted">
                                        {item.peopleCount ? (
                                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md" title="Número de Pessoas">
                                                <Users className="w-3 h-3" />
                                                <span className="font-bold">{item.peopleCount}</span>
                                            </div>
                                        ) : null}

                                        {!isTraditional && item.residentName && <span className="font-semibold text-gray-700 dark:text-gray-300">{item.residentName}</span>}

                                        {!isTraditional && (
                                            <>
                                                {item.gender && (
                                                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase ${item.gender === 'HOMEM' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        item.gender === 'MULHER' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                                                            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
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
                                                    <span className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                        <Ear className="w-3 h-3" /> Surdo
                                                    </span>
                                                )}
                                                {item.isMinor && (
                                                    <span className="flex items-center gap-1 bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                        <Baby className="w-3 h-3" /> Menor
                                                    </span>
                                                )}
                                                {item.isStudent && (
                                                    <span className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                        <GraduationCap className="w-3 h-3" /> Estudante
                                                    </span>
                                                )}
                                                {item.isNeurodivergent && (
                                                    <span className="flex items-center gap-1 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                        <Brain className="w-3 h-3" /> Neurodivergente
                                                    </span>
                                                )}
                                            </>
                                        )}

                                        {item.visitStatus === 'moved' && (
                                            <span className="flex items-center gap-1 bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-400 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                                Mudou-se
                                            </span>
                                        )}

                                        {item.observations && (
                                            <div className="flex items-center gap-1 mt-1 text-xs text-muted w-full">
                                                <FileText className="w-3 h-3 shrink-0" />
                                                <p className="truncate">{item.observations}</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 3. Actions Section */}
                        {type === 'territory' && (
                            <div className="relative">
                                <button
                                    onClick={(e) => toggleDropdown(e, item.id)}
                                    className={`p-2 rounded-full transition-colors ${activeDropdownId === item.id ? 'bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>

                                {activeDropdownId === item.id && (
                                    <div className="absolute right-0 top-10 bg-surface rounded-xl shadow-xl border border-surface-border p-1 z-20 min-w-[160px] animate-in fade-in zoom-in-95 duration-200">

                                        {/* Dropdown Options */}
                                        {href !== '#' && (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveDropdownId(null);
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors w-full text-left"
                                            >
                                                <Navigation className="w-4 h-4" />
                                                Abrir no Mapa
                                            </a>
                                        )}

                                        <button
                                            onClick={(e) => handleHistoryClick(e, item.id)}
                                            className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg transition-colors w-full text-left"
                                        >
                                            <HistoryIcon className="w-4 h-4" />
                                            Abrir Histórico
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Arrow for City */}
                        {type === 'city' && (
                            <div className="p-1">
                                <ChevronRight className="w-5 h-5 text-muted group-hover:text-primary dark:group-hover:text-primary-light transition-colors" />
                            </div>
                        )}

                    </div>
                </div>
            </Wrapper>
        );
    };

    return (
        <div className="bg-background min-h-screen font-sans pb-10 text-main">
            {/* Header */}
            <header className="px-6 py-6 bg-surface border-b border-surface-border flex items-center gap-4 sticky top-0 z-20">
                <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-muted hover:text-main" />
                </button>
                <div className="flex flex-col">
                    <h1 className="font-bold text-lg text-main leading-tight">{title}</h1>
                    <span className="text-xs text-primary dark:text-primary-light font-bold uppercase tracking-wider">{subtitle}</span>
                </div>
            </header>

            <main className="max-w-xl mx-auto px-5 py-8 space-y-4">
                {items.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <MapIcon className="w-12 h-12 mx-auto mb-3 text-muted" />
                        <p className="text-muted font-medium">Nenhum item encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activeItems.map((item, idx) => renderItem(item, idx))}

                        {inactiveItems.length > 0 && (
                            <>
                                <button
                                    onClick={() => setIsInactiveExpanded(!isInactiveExpanded)}
                                    className="w-full pt-8 pb-4 flex items-center gap-4 group cursor-pointer focus:outline-none"
                                >
                                    <div className="h-px bg-surface-border flex-1 group-hover:bg-gray-300 transition-colors"></div>
                                    <div className="flex items-center gap-2 text-muted group-hover:text-main transition-colors">
                                        <span className="text-xs font-bold uppercase tracking-widest">Desativados ({inactiveItems.length})</span>
                                        {isInactiveExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </div>
                                    <div className="h-px bg-surface-border flex-1 group-hover:bg-gray-300 transition-colors"></div>
                                </button>

                                {isInactiveExpanded && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                                        {inactiveItems.map((item, idx) => renderItem(item, activeItems.length + idx))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>

            {/* Map View for Territory */}
            {type === 'territory' && items.length > 0 && (
                <div className="h-[40vh] w-full relative border-t border-surface-border mt-4">
                    <MapView
                        items={items.filter(i => i.isActive !== false).map(a => {
                            let streetClean = a.street?.split('-')[0].trim() || '';
                            if (a.number && a.number !== 'S/N') {
                                const numberRegex = new RegExp(`[\\s,]+${a.number}$`);
                                streetClean = streetClean.replace(numberRegex, '').trim();
                            }

                            // Map shared-list specific status to MapView status
                            let mapStatus: any = 'AGUARDANDO'; // Default Gray for shared links
                            if (a.visitStatus === 'contacted') mapStatus = 'OCUPADO';
                            else if (a.visitStatus === 'not_contacted') mapStatus = 'NAO_CONTATADO';
                            else if (a.visitStatus === 'moved') mapStatus = 'MUDOU';
                            else if (a.visitStatus === 'do_not_visit') mapStatus = 'NAO_VISITAR';

                            return {
                                id: a.id,
                                lat: a.lat,
                                lng: a.lng,
                                title: `${streetClean}, ${a.number}`,
                                subtitle: a.complement || '',
                                status: mapStatus,
                                number: a.number,
                                residentName: a.residentName, // Pass resident name for display
                                fullAddress: `${streetClean}, ${a.number}, Brasil`,
                                googleMapsLink: a.googleMapsLink,
                                gender: a.gender,
                                lastVisit: a.lastVisitedAt ? (() => {
                                    try {
                                        // Handle FireStore Timestamp (seconds) or String
                                        if (typeof a.lastVisitedAt === 'string') return new Date(a.lastVisitedAt).toLocaleDateString();
                                        // @ts-ignore
                                        if (a.lastVisitedAt.seconds) return new Date(a.lastVisitedAt.seconds * 1000).toLocaleDateString();
                                        return '';
                                    } catch (e) { return ''; }
                                })() : undefined,
                                isDeaf: a.isDeaf,
                                isMinor: a.isMinor,
                                isStudent: a.isStudent,
                                isNeurodivergent: a.isNeurodivergent
                            };
                        })}
                    />
                </div>
            )}


            {/* Modals */}
            {selectedAddressForReport && (
                <VisitReportModal
                    address={selectedAddressForReport}
                    onClose={() => setSelectedAddressForReport(null)}
                    onSave={handleSaveVisit}
                    forcedCongregationType={congregationType || undefined}
                    onViewHistory={() => {
                        setSelectedAddressForReport(null);
                        setSelectedAddressForHistory(selectedAddressForReport.id);
                    }}
                />
            )}

            {selectedAddressForHistory && (
                <VisitHistoryModal
                    addressId={selectedAddressForHistory}
                    onClose={() => setSelectedAddressForHistory(null)}
                    isSharedView={true}
                />
            )}

            {showLoginRequest && (
                <LoginRequestModal
                    onClose={() => setShowLoginRequest(false)}
                />
            )}

            {showAccessDenied && (
                <AccessDeniedModal
                    resourceName={deniedResource}
                    onClose={() => setShowAccessDenied(false)}
                />
            )}

            {/* Bottom Nav for Authenticated Users */}
            {user && <BottomNav />}
        </div>
    );
}

export default function SharedPreviewPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-muted text-sm font-bold animate-pulse">Carregando...</p>
                </div>
            </div>
        }>
            <SharedPreviewContent />
        </Suspense>
    );
}
