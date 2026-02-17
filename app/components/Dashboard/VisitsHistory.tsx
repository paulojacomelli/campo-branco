"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
    History,
    Calendar,
    User,
    MapPin,
    MoreVertical,
    Pencil,
    Trash2,
    X,
    Check,
    Loader2
} from "lucide-react";

import Link from "next/link";

export default function VisitsHistory({ scope = 'all', showViewAll = true }: { scope?: 'mine' | 'all', showViewAll?: boolean }) {
    const { user, congregationId, role, isElder, isServant, profileName, loading: authLoading } = useAuth();
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Edit Form State
    const [editForm, setEditForm] = useState({
        observations: '',
        status: ''
    });

    const fetchVisits = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Get Visits from Supabase
            let query = supabase.from('visits').select('*');

            if (role !== 'SUPER_ADMIN') {
                if (congregationId) {
                    query = query.eq('congregation_id', congregationId);
                } else {
                    setVisits([]);
                    setLoading(false);
                    return;
                }
            }

            query = query.order('visit_date', { ascending: false }).limit(showViewAll ? 10 : 100);

            const { data: rawVisitsData, error } = await query;
            if (error) throw error;
            const rawVisits = rawVisitsData || [];

            // Filter logic for non-admins (Scoped results)
            const filteredVisits = rawVisits.filter(v => {
                if (scope === 'mine' && v.user_id !== user?.id) return false;
                if (scope === 'all' && role !== 'SUPER_ADMIN' && !isElder && !isServant) {
                    if (v.user_id !== user?.id) return false;
                }
                return true;
            });

            // 2. Fetch required addresses and users details
            const addressIds = Array.from(new Set(filteredVisits.map(v => v.address_id).filter(id => id)));
            const userIds = Array.from(new Set(filteredVisits.map(v => v.user_id).filter(id => id)));

            const addressMap = new Map<string, any>();
            const userNamesMap = new Map<string, string>();

            if (addressIds.length > 0) {
                const { data: addrs } = await supabase.from('addresses').select('*').in('id', addressIds);
                if (addrs) addrs.forEach(a => addressMap.set(a.id, a));
            }

            if (userIds.length > 0) {
                const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
                if (users) users.forEach(u => userNamesMap.set(u.id, u.name));
            }

            // 3. Merge
            const mergedVisits = filteredVisits.map(v => {
                const address = v.address_id ? addressMap.get(v.address_id) : null;
                const realUserName = v.user_id ? userNamesMap.get(v.user_id) : null;
                return {
                    ...v,
                    addressStreet: address?.street || 'Localização não identificada',
                    addressNumber: address?.number || '',
                    displayName: realUserName || v.publisher_name || 'Publicador',
                    sortDate: v.visit_date ? new Date(v.visit_date) : new Date(0),
                    observations: v.notes || ''
                };
            });

            // Only slice if we are in "Preview" mode on the dashboard
            if (showViewAll) {
                setVisits(mergedVisits.slice(0, 4));
            } else {
                setVisits(mergedVisits);
            }

        } catch (error) {
            console.error("Error fetching visits:", error);
        } finally {
            setLoading(false);
        }
    }, [congregationId, isElder, isServant, role, user?.id, scope, showViewAll]);

    useEffect(() => {
        // Wait for auth to resolve
        if (authLoading) return;

        if (!user) {
            setLoading(false);
            return;
        }

        // Only fetch if we have a role assigned (meaning profile sync completed)
        if (role) {
            fetchVisits();
        }
    }, [user, congregationId, role, fetchVisits, authLoading]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    const handleDelete = async (visit: any) => {
        if (!confirm("Tem certeza que deseja excluir este registro de visita?")) return;

        try {
            const { error } = await supabase.from('visits').delete().eq('id', visit.id);
            if (error) throw error;

            // Remove from state
            setVisits(prev => prev.filter(v => v.id !== visit.id));
        } catch (error) {
            console.error("Error deleting visit:", error);
            alert("Erro ao excluir visita.");
        }
    };

    const startEdit = (visit: any) => {
        setEditingId(visit.id);
        setEditForm({
            observations: visit.observations || '',
            status: visit.status || ''
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ observations: '', status: '' });
    };

    const saveEdit = async (visit: any) => {
        try {
            const { error } = await supabase.from('visits').update({
                notes: editForm.observations,
                status: editForm.status
            }).eq('id', visit.id);

            if (error) throw error;

            // Update State
            setVisits(prev => prev.map(v => {
                if (v.id === visit.id) {
                    return { ...v, observations: editForm.observations, status: editForm.status };
                }
                return v;
            }));

            setEditingId(null);
        } catch (error) {
            console.error("Error updating visit:", error);
            alert("Erro ao atualizar visita.");
        }
    };

    const formatDate = (date: Date) => {
        if (!date || isNaN(date.getTime())) return 'Data Inválida';
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'contacted': return { label: 'Encontrado', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' };
            case 'not_contacted': return { label: 'Não Enc.', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' };
            case 'moved': return { label: 'Mudou-se', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' };
            case 'do_not_visit': return { label: 'Não Visitar', color: 'bg-red-900 dark:bg-red-950 text-white' };
            default: return { label: status, color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' };
        }
    };

    if (loading) return (
        <div className="bg-surface p-6 rounded-3xl shadow-sm border border-surface-border h-40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary-light/500" />
        </div>
    );

    // if (visits.length === 0) return null; // MOVED: Render empty state inside return

    return (
        <div className="bg-surface p-6 rounded-3xl shadow-sm border border-surface-border">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-bold text-main">Histórico Recente</h3>
                </div>
                <div className="flex items-center gap-4">
                    {visits.length > 0 && showViewAll && (
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Últimas 4</span>
                    )}
                    {showViewAll && (
                        <Link
                            href={`/dashboard/history?scope=${scope}`}
                            className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest hover:text-purple-700 transition-colors bg-purple-50 px-3 py-1.5 rounded-full"
                        >
                            Ver Tudo
                        </Link>
                    )}
                </div>
            </div>

            {visits.length === 0 ? (
                <div className="text-center py-6 opacity-50">
                    <p className="text-sm text-gray-400">
                        {loading ? "Carregando histórico..." : "Nenhuma visita realizada recentemente."}
                    </p>
                    {(role === 'SUPER_ADMIN' || isElder) && !loading && (
                        <p className="text-[10px] text-gray-300 mt-2 uppercase">Verifique se as visitas possuem congregação vinculada</p>
                    )}
                </div>
            ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {visits.map((visit) => (
                        <div key={visit.id} className="p-4 rounded-2xl bg-background border border-surface-border hover:border-purple-200 dark:hover:border-purple-800 transition-colors group">

                            {editingId === visit.id ? (
                                // EDIT MODE
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-main text-sm">Editar Visita</h4>
                                        <button onClick={cancelEdit} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                                            <X className="w-4 h-4 text-muted" />
                                        </button>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase">Resultado</label>
                                        <select
                                            className="w-full mt-1 p-2 rounded-xl border border-surface-border text-sm bg-surface text-main"
                                            value={editForm.status}
                                            onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                        >
                                            <option value="contacted">Encontrado</option>
                                            <option value="not_contacted">Não Encontrado</option>
                                            <option value="moved">Mudou-se</option>
                                            <option value="do_not_visit">Não Visitar</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase">Observações</label>
                                        <input
                                            type="text"
                                            className="w-full mt-1 p-2 rounded-xl border border-surface-border text-sm bg-surface text-main"
                                            value={editForm.observations}
                                            onChange={e => setEditForm({ ...editForm, observations: e.target.value })}
                                        />
                                    </div>

                                    <button
                                        onClick={() => saveEdit(visit)}
                                        className="w-full bg-purple-600 text-white font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-3 h-3" />
                                        Salvar Alterações
                                    </button>
                                </div>
                            ) : (
                                // VIEW MODE
                                <>
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${getStatusLabel(visit.status).color}`}>
                                                    {getStatusLabel(visit.status).label}
                                                </span>
                                                <span className="text-[10px] text-muted font-medium">
                                                    {formatDate(visit.sortDate)}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-main text-sm">{visit.addressStreet}, {visit.addressNumber}</h4>
                                        </div>

                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === visit.id ? null : visit.id);
                                                }}
                                                className="p-1.5 text-muted hover:text-main hover:bg-surface rounded-lg transition-all shadow-sm"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {openMenuId === visit.id && (
                                                <div className="absolute right-0 top-full mt-2 w-32 bg-surface rounded-2xl shadow-xl border border-surface-border py-2 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                                                    <button
                                                        onClick={() => {
                                                            startEdit(visit);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-primary-light/50 dark:hover:bg-blue-900/30 hover:text-primary dark:hover:text-blue-400 flex items-center gap-2 transition-colors border-b border-surface-border"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleDelete(visit);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Excluir
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {visit.observations && (
                                        <p className="text-xs text-muted bg-surface p-2 rounded-lg border border-surface-border italic">
                                            &quot;{visit.observations}&quot;
                                        </p>
                                    )}

                                    <div className="mt-2 flex items-center gap-1">
                                        <User className="w-3 h-3 text-gray-300" />
                                        <span className="text-[10px] text-gray-400 font-bold">
                                            {visit.displayName}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
