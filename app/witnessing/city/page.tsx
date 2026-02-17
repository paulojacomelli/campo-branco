"use client";

import { useState, useEffect, Suspense, useCallback } from 'react';
import {
    Plus,
    X,
    Map as MapIcon,
    Search,
    MapPin,
    ArrowRight,
    Loader2,
    Trash2,
    Store,
    List,
    Clock,
    User,
    CheckCircle2,
    Pencil,
    MoreVertical,
    HelpCircle,
    Navigation
} from 'lucide-react';
import HelpModal from '@/app/components/HelpModal';
import MapView from '@/app/components/MapView';
import BottomNav from '@/app/components/BottomNav';
import NewPointModal from '@/app/components/Witnessing/NewPointModal';
import EditPointModal from '@/app/components/Witnessing/EditPointModal';
import UserAvatar from '@/app/components/UserAvatar';
import AssignedUserBadge from '@/app/components/AssignedUserBadge';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useSearchParams } from 'next/navigation';

interface WitnessingPoint {
    id: string;
    name: string;
    address: string;
    city_id: string; // snake_case
    congregation_id: string; // snake_case
    lat?: number;
    lng?: number;
    status: 'AVAILABLE' | 'OCCUPIED';
    schedule?: string;
    current_publishers?: string[]; // snake_case
    // New field for rich data
    active_users?: { uid: string, name: string, timestamp?: number }[]; // snake_case
}

function WitnessingPointListContent() {
    const searchParams = useSearchParams();
    const congregationId = searchParams.get('congregationId');
    const cityId = searchParams.get('cityId');
    const { user, isAdmin, isSuperAdmin, isElder, isServant, loading: authLoading, profileName } = useAuth();
    const canEdit = isElder || isServant;
    const [points, setPoints] = useState<WitnessingPoint[]>([]);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [cityName, setCityName] = useState('');

    // Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPoint, setEditingPoint] = useState<WitnessingPoint | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    // Check-In Logic State
    const [pendingCheckInPoint, setPendingCheckInPoint] = useState<WitnessingPoint | null>(null);
    const [conflictingPoint, setConflictingPoint] = useState<WitnessingPoint | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Fetch City Name
    useEffect(() => {
        if (cityId) {
            supabase.from('cities').select('name').eq('id', cityId).single()
                .then(({ data }) => {
                    if (data) setCityName(data.name);
                });
        }
    }, [cityId]);

    // Fetch Points & Subscription
    const fetchPoints = useCallback(async () => {
        if (!congregationId || !cityId) return;

        const { data, error } = await supabase
            .from('witnessing_points')
            .select('*')
            .eq('congregation_id', congregationId)
            .eq('city_id', cityId)
            .order('name');

        if (data) setPoints(data);
        if (error) console.error("Error fetching points:", error);
        setLoading(false);
    }, [congregationId, cityId]);

    useEffect(() => {
        if (!congregationId || !cityId) {
            setLoading(false);
            return;
        }

        fetchPoints();

        const subscription = supabase
            .channel(`points:city=${cityId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'witnessing_points',
                filter: `city_id=eq.${cityId}`
            }, () => {
                fetchPoints();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [congregationId, cityId, fetchPoints]);

    // Cleanup Expired Check-ins
    useEffect(() => {
        const checkExpired = async () => {
            const now = Date.now();
            const FIVE_HOURS = 5 * 60 * 60 * 1000;
            let needsUpdate = false;

            for (const point of points) {
                if (!point.active_users) continue;

                const validUsers = point.active_users.filter(u => {
                    if (!u.timestamp) return true;
                    return (now - u.timestamp) < FIVE_HOURS;
                });

                if (validUsers.length !== point.active_users.length) {
                    const newStatus = (validUsers.length > 0 || (point.current_publishers && point.current_publishers.length > 0))
                        ? 'OCCUPIED'
                        : 'AVAILABLE';

                    try {
                        await supabase
                            .from('witnessing_points')
                            .update({
                                active_users: validUsers,
                                status: newStatus
                            })
                            .eq('id', point.id);

                        console.log(`Cleaned up expired users for point: ${point.name}`);
                    } catch (error) {
                        console.error("Error cleaning up expired point:", error);
                    }
                }
            }
        };

        if (points.length > 0) {
            // Run once per load/update to check integrity
            // Ideally this should be a scheduled function on the backend, but client-side lazy cleanup works for now.
            checkExpired();
        }
    }, [points]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    const handleDeletePoint = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja excluir o ponto "${name}"?`)) return;
        try {
            const { error } = await supabase.from('witnessing_points').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error("Error deleting point:", error);
            alert("Erro ao excluir ponto.");
        }
    };

    const handleOpenPointMap = (point: WitnessingPoint) => {
        const query = point.address;
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);

        let url = '';
        if (isIOS) {
            url = `maps://?q=${encodeURIComponent(query)}`;
        } else if (isAndroid) {
            url = `geo:0,0?q=${encodeURIComponent(query)}`;
        } else {
            url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        }

        window.open(url, '_blank');
    };

    const handleEditClick = (point: WitnessingPoint) => {
        setEditingPoint(point);
        setIsEditModalOpen(true);
    };

    // 1. Initial Check
    const handleCheckInClick = (point: WitnessingPoint) => {
        if (!user) return;
        const userName = profileName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Publicador';
        const userId = user.id;

        // Is user checked in HERE?
        const legacyIndex = (point.current_publishers || []).indexOf(userName);
        const activeIndex = (point.active_users || []).findIndex(u => u.uid === userId);
        const activeByNameIndex = (point.active_users || []).findIndex(u => u.name === userName);
        const isCheckedInHere = legacyIndex >= 0 || activeIndex >= 0 || activeByNameIndex >= 0;

        if (isCheckedInHere) {
            // If already here, just toggle out (no confirmation needed)
            executeCheckInOut(point, true); // true = checkout
        } else {
            // Check collision
            const otherPoint = points.find(p =>
                p.id !== point.id && (
                    p.active_users?.some(u => u.uid === userId || u.name === userName) ||
                    p.current_publishers?.includes(userName)
                )
            );

            if (otherPoint) {
                // Collision detected! Open modal
                setPendingCheckInPoint(point);
                setConflictingPoint(otherPoint);
                setIsConfirmModalOpen(true);
            } else {
                // No collision, just proceed
                executeCheckInOut(point, false); // false = checkin
            }
        }
    };

    // 2. Execution Logic
    const executeCheckInOut = async (point: WitnessingPoint, isCheckingOut: boolean) => {
        if (!user) return;
        const userName = profileName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Publicador';
        const userId = user.id;

        let newPublishers = [...(point.current_publishers || [])];
        let newActiveUsers = [...(point.active_users || [])];

        if (isCheckingOut) {
            newPublishers = newPublishers.filter(n => n !== userName);
            newActiveUsers = newActiveUsers.filter(u => u.uid !== userId && u.name !== userName);
        } else {
            if (!newActiveUsers.some(u => u.uid === userId)) {
                newActiveUsers.push({ uid: userId, name: userName, timestamp: Date.now() });
            }
            if (!newPublishers.includes(userName)) {
                newPublishers.push(userName);
            }
        }

        const newStatus = (newPublishers.length > 0 || newActiveUsers.length > 0) ? 'OCCUPIED' : 'AVAILABLE';

        try {
            const { error } = await supabase
                .from('witnessing_points')
                .update({
                    current_publishers: newPublishers,
                    active_users: newActiveUsers,
                    status: newStatus
                })
                .eq('id', point.id);

            if (error) throw error;
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Erro ao atualizar status.");
        }
    };

    // 3. Confirm Switch
    const handleConfirmSwitch = async () => {
        if (!conflictingPoint || !pendingCheckInPoint || !user) return;
        const userName = profileName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Publicador';
        const userId = user.id;

        try {
            // Checkout from old
            const otherActive = (conflictingPoint.active_users || []).filter(u => u.uid !== userId && u.name !== userName);
            const otherLegacy = (conflictingPoint.current_publishers || []).filter(n => n !== userName);
            const otherStatus = (otherActive.length > 0 || otherLegacy.length > 0) ? 'OCCUPIED' : 'AVAILABLE';

            await supabase.from('witnessing_points').update({
                active_users: otherActive,
                current_publishers: otherLegacy,
                status: otherStatus
            }).eq('id', conflictingPoint.id);

            // Checkin to new
            await executeCheckInOut(pendingCheckInPoint, false);
            setIsConfirmModalOpen(false);
        } catch (err) {
            console.error("Error auto-checking out:", err);
            alert("Erro ao sair do ponto anterior.");
        }
    };

    const filteredPoints = points.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.address.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;

    if (!congregationId || !cityId) {
        return <div className="p-8 text-center text-muted">Parâmetros inválidos.</div>;
    }

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main">
            {/* Header */}
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <Link href={`/witnessing/congregation?congregationId=${congregationId}`} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-xl text-muted hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </Link>
                    <div>
                        <h1 className="font-bold text-lg text-main tracking-tight leading-tight">Pontos</h1>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{cityName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-primary hover:bg-primary-dark dark:bg-primary dark:hover:bg-primary-dark text-white p-2 rounded-xl shadow-lg transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="p-1.5 text-muted hover:text-primary hover:text-primary-dark hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 rounded-full transition-colors"
                        title="Ajuda"
                    >
                        <HelpCircle className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <HelpModal
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
                title="Testemunho Público"
                description="Central de gestão de pontos de testemunho com carrinhos."
                steps={[
                    { title: "Check-in", text: "Clique no ponto que você vai trabalhar para avisar aos outros que está ocupado." },
                    { title: "Sair", text: "IMPORTANTE: Ao terminar seu turno, clique em 'Sair' para liberar o ponto para outros." },
                    { title: "Mapa", text: "Visualize a localização exata de cada carrinho no mapa abaixo." }
                ]}
                tips={[
                    "O sistema evita que você faça check-in em dois lugares ao mesmo tempo.",
                    "Seja amoroso: libere o ponto assim que recolher o carrinho para não atrapalhar outros irmãos."
                ]}
            />

            {/* Scrollable Content */}
            <div className="pb-20">
                {/* Search & List */}
                <div className="px-6 pt-6 space-y-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-amber-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar ponto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border-0 text-main text-sm font-medium rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all placeholder:text-muted"
                        />
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
                    ) : filteredPoints.length === 0 ? (
                        <div className="text-center py-12 opacity-50">
                            <Store className="w-12 h-12 mx-auto mb-3 text-muted" />
                            <p className="text-muted font-medium">Nenhum ponto encontrado</p>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-6">
                            {filteredPoints.map(point => {
                                const isOccupied = point.status === 'OCCUPIED';

                                // Determine checked-in status
                                const userIsCheckedIn =
                                    point.active_users?.some(u => u.uid === user?.id) ||
                                    point.current_publishers?.includes(user?.user_metadata?.full_name || user?.email || '');

                                return (
                                    <div
                                        key={point.id}
                                        className={`bg-surface rounded-2xl p-4 border border-surface-border shadow-sm transition-all`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-start gap-3 w-full pr-2">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-1 ${isOccupied ? 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/30 text-green-500 dark:text-green-400'}`}>
                                                    <Store className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-main text-base break-words leading-tight mb-1">{point.name}</h3>
                                                    <p className="text-xs text-muted flex items-start gap-1 break-words leading-relaxed text-wrap">
                                                        <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                                        <span className="break-words">{point.address}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Navigation Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenPointMap(point);
                                                }}
                                                className="p-2 text-primary hover:text-primary-dark hover:bg-primary-light/50 dark:hover:bg-primary-dark/20 rounded-xl transition-all mr-1"
                                                title="Navegar"
                                            >
                                                <Navigation className="w-5 h-5" />
                                            </button>

                                            {canEdit && (
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === point.id ? null : point.id);
                                                        }}
                                                        className="p-2 text-muted hover:text-main hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    {openMenuId === point.id && (
                                                        <div className="absolute right-0 top-full mt-2 w-32 bg-surface rounded-2xl shadow-xl border border-surface-border py-2 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                                                            <button
                                                                onClick={() => {
                                                                    handleEditClick(point);
                                                                    setOpenMenuId(null);
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-xs font-bold text-main hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 hover:text-primary dark:hover:text-primary-light flex items-center gap-2 transition-colors border-b border-surface-border"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleDeletePoint(point.id, point.name);
                                                                    setOpenMenuId(null);
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                Excluir
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {point.schedule && (
                                            <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                                                <Clock className="w-3.5 h-3.5" />
                                                {point.schedule}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-border">
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {(point.active_users && point.active_users.length > 0) || (point.current_publishers && point.current_publishers.length > 0) ? (
                                                    <>
                                                        {/* Active Users */}
                                                        {point.active_users && point.active_users.length > 0 ? (
                                                            point.active_users.map((pub, i) => (
                                                                <div key={`active-${i}`} className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                                                                    <span className="text-xs font-bold text-main uppercase tracking-wide">
                                                                        {pub.uid ? (
                                                                            <AssignedUserBadge userId={pub.uid} fallbackName={pub.name} />
                                                                        ) : (
                                                                            pub.name ? pub.name.split(' ')[0] : 'Publicador'
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            /* Legacy */
                                                            point.current_publishers?.map((name, i) => (
                                                                <div key={`legacy-${i}`} className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                                                                    <span className="text-xs font-bold text-main uppercase tracking-wide">
                                                                        {name}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-muted italic">Disponível</span>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => handleCheckInClick(point)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${userIsCheckedIn
                                                    ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                                                    : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
                                                    }`}
                                            >
                                                {userIsCheckedIn ? (
                                                    <>Sair</>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Check-in
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Map View */}
                <div className="h-96 w-full relative border-t border-surface-border">
                    <MapView
                        items={filteredPoints.map(p => ({
                            id: p.id,
                            lat: p.lat || 0,
                            lng: p.lng || 0,
                            title: p.name,
                            number: p.name,
                            subtitle: p.current_publishers && p.current_publishers.length > 0
                                ? `Ocupado por: ${p.current_publishers.join(', ')}`
                                : 'Livre',
                            status: p.status === 'OCCUPIED' ? 'OCUPADO' : 'LIVRE',
                            color: p.status === 'OCCUPIED' ? 'red' : 'green',
                            fullAddress: `${p.address}, ${cityName}`
                        }))}
                    />
                </div>
            </div>

            <BottomNav />

            {/* Create Modal */}
            <NewPointModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                cityId={cityId || ''}
                congregationId={congregationId || ''}
                cityName={cityName}
            />

            {/* Edit Modal */}
            <EditPointModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingPoint(null);
                }}
                point={editingPoint}
                cityName={cityName}
            />

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmSwitch}
                title="Trocar de Ponto"
                message={`Você já está no ponto "${conflictingPoint?.name}". Deseja sair dele e marcar entrada em "${pendingCheckInPoint?.name}"?`}
                confirmText="Sim, trocar"
                cancelText="Cancelar"
                variant="info"
            />
        </div>
    );
}

export default function WitnessingPointList() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <WitnessingPointListContent />
        </Suspense>
    );
}
