"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Link from 'next/link';
import BottomNav from "@/app/components/BottomNav";
import {
    ArrowLeft,
    Loader2,
    History,
    Map as MapIcon,
    User,
    Calendar,
    Clock,
    MoreVertical,
    ExternalLink,
    Copy,
    Share2,
    UserMinus,
    Trash2
} from 'lucide-react';

function CardsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const scope = (searchParams.get('scope') as 'mine' | 'managed') || 'mine';

    const { user, role, isElder, isServant, congregationId, profileName, isSuperAdmin, loading: authLoading } = useAuth();
    const [lists, setLists] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    const fetchLists = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            let query = supabase.from("shared_lists").select("*");

            // SCOPE: MINE
            if (scope === 'mine') {
                query = query.eq("assigned_to", user.id);
            }
            // SCOPE: MANAGED (Sent/All)
            else if (scope === 'managed') {
                if (role !== 'SUPER_ADMIN' && congregationId) {
                    query = query.eq("congregation_id", congregationId);
                } else if (role !== 'SUPER_ADMIN') {
                    setLists([]);
                    setLoading(false);
                    return;
                }
                // Super admin sees all, limited for safety
                if (role === 'SUPER_ADMIN') {
                    query = query.limit(100);
                }
            } else {
                setLists([]);
                setLoading(false);
                return;
            }

            const { data, error } = await query;
            if (error) throw error;

            let rawLists: any[] = (data || []).map(item => ({
                ...item,
                assignedTo: item.assigned_to,
                assignedName: item.assigned_name,
                congregationId: item.congregation_id,
                createdAt: item.created_at,
                expiresAt: item.expires_at,
                // MINE: responsible is 'Você'
                // MANAGED: use assignedName or 'Não atribuído'
                responsibleName: scope === 'mine' ? 'Você' : (item.assigned_name || (item.assigned_to ? 'Usuário' : 'Não atribuído'))
            }));

            // Filter for Publisher in Managed View
            if (scope === 'managed' && !isElder && !isServant && !isSuperAdmin) {
                const userName = profileName || user?.user_metadata?.full_name || user?.email?.split('@')[0];
                rawLists = rawLists.filter(l => l.assignedName === userName || l.assignedTo === user.id);
            }

            // Only show active active ones for 'mine'
            if (scope === 'mine') {
                rawLists = rawLists.filter(l => l.status !== 'completed' && l.status !== 'archived');
            }

            // Sort
            rawLists.sort((a, b) => {
                // Active first
                const isAActive = a.status !== 'completed';
                const isBActive = b.status !== 'completed';
                if (isAActive && !isBActive) return -1;
                if (!isAActive && isBActive) return 1;

                // Then Date Newest
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });

            setLists(rawLists);

        } catch (e) {
            console.error("Error fetching lists:", e);
        } finally {
            setLoading(false);
        }
    }, [user, scope, role, isElder, isServant, congregationId, profileName, isSuperAdmin]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchLists();
        }
    }, [authLoading, user, fetchLists]);


    // Handlers
    const handleCopyLink = async (id: string) => {
        const shareUrl = window.location.origin + "/share?id=" + id;
        try {
            await navigator.clipboard.writeText(shareUrl);
            alert("Link copiado!");
        } catch (err) {
            console.error("Error copying link:", err);
        }
    };

    const handleShareLink = async (id: string, title?: string) => {
        const shareUrl = window.location.origin + "/share?id=" + id;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title || 'Campo Branco - Cartão de Território',
                    text: 'Acesse o cartão de território do Campo Branco:',
                    url: shareUrl
                });
            } catch (err) {
                console.error("Error sharing:", err);
            }
        } else {
            handleCopyLink(id);
        }
    };

    const handleOpenLink = (id: string) => {
        window.open(window.location.origin + "/share?id=" + id, "_blank");
    };

    const handleDeleteShare = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este cartão? O link deixará de funcionar.")) return;
        try {
            const { error } = await supabase.from("shared_lists").delete().eq("id", id);
            if (error) throw error;
            setLists(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            console.error("Error deleting share:", err);
            alert("Erro ao excluir.");
        }
    };

    const handleRemoveResponsible = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover o responsável?")) return;
        try {
            const { error } = await supabase.from("shared_lists").update({
                assigned_to: null,
                assigned_name: null
            }).eq("id", id);
            if (error) throw error;
            fetchLists();
            alert("Responsável removido.");
        } catch (err) {
            console.error("Error removing responsible:", err);
            alert("Erro ao remover responsável.");
        }
    };

    const formatDate = (dateValue: any) => {
        if (!dateValue) return 'N/A';
        const date = new Date(dateValue);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    const formatExpirationTime = (expiresAtValue: any) => {
        if (!expiresAtValue) return "Por tempo indeterminado";
        const expiresAt = new Date(expiresAtValue);
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        if (diffMs <= 0) return "Vencido";
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = Math.ceil(diffHours / 24);
        if (diffDays > 1000) return "Por tempo indeterminado";
        if (diffHours < 1) return "Vence em menos de uma hora";
        if (diffHours < 24) return `Vence em ${Math.floor(diffHours)} horas`;
        return `Faltam ${diffDays} dias`;
    };

    return (
        <div className="bg-background min-h-screen font-sans pb-24 transition-colors duration-300">
            {/* Header */}
            <header className="px-6 py-4 bg-surface border-b border-surface-border flex items-center gap-4 sticky top-0 z-20">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </Link>
                <div className="flex flex-col">
                    <h1 className="font-bold text-lg text-main leading-tight">
                        {scope === 'mine' ? 'Meus Cartões' : 'Cartões Enviados'}
                    </h1>
                    <span className="text-[10px] text-primary dark:text-blue-400 font-bold uppercase tracking-widest">
                        {scope === 'mine' ? 'Designações Pessoais' : 'Gestão de Territórios'}
                    </span>
                </div>
            </header>

            <main className="max-w-xl mx-auto px-6 py-8">
                {/* Icon Banner */}
                <div className="mb-6 bg-surface p-4 rounded-lg border border-surface-border flex items-center gap-3 shadow-sm">
                    <div className={`
                        p-2 rounded-lg
                        ${scope === 'mine' ? 'bg-primary-light dark:bg-blue-900/30 text-primary' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'}
                    `}>
                        {scope === 'mine' ? <User className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-muted font-medium leading-tight">
                        {scope === 'mine'
                            ? "Abaixo estão listado os cartões que você está trabalhando no momento."
                            : "Abaixo estão todos os cartões de território que foram enviados para os publicadores."
                        }
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : lists.length === 0 ? (
                    <div className="text-center py-12 opacity-50 bg-surface rounded-lg border border-dashed border-surface-border">
                        <p className="text-sm text-muted">Nenhum cartão encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {lists.map((list) => (
                            <div key={list.id} className="p-4 rounded-lg bg-surface border border-surface-border hover:border-blue-200 dark:hover:border-blue-800 transition-colors group relative shadow-sm">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-main text-sm truncate">
                                            {list.context?.territoryName ? `${list.context.territoryName} - ${list.context.featuredDetails || 'Mapa'}` : (list.title || "Cartão de Território")}
                                        </h4>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <User className="w-3 h-3 text-muted" />
                                            <span className="text-[10px] font-bold text-muted truncate">{list.responsibleName}</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 pt-1 flex items-center gap-2">
                                        {list.status === 'completed' ? (
                                            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider">Concluído</span>
                                        ) : (
                                            <span className="bg-primary-light dark:bg-blue-900/30 text-primary-dark dark:text-blue-400 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider">Ativo</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-surface-border/50">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-muted" />
                                            <span className="text-[10px] text-muted font-medium">Início: {formatDate(list.createdAt)}</span>
                                        </div>
                                        {list.status !== 'completed' && list.expiresAt && formatExpirationTime(list.expiresAt) && (
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-orange-400" />
                                                <span className={`text-[10px] font-bold ${(list.expiresAt && (list.expiresAt.seconds * 1000 - Date.now()) < 5 * 24 * 60 * 60 * 1000)
                                                    ? 'text-red-500 dark:text-red-400'
                                                    : 'text-orange-500 dark:text-orange-400'
                                                    }`}>
                                                    {formatExpirationTime(list.expiresAt)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === list.id ? null : list.id);
                                            }}
                                            className="p-1.5 text-muted hover:text-main hover:bg-surface rounded-lg transition-all shadow-sm"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {openMenuId === list.id && (
                                            <div className="absolute right-0 top-8 w-48 bg-surface rounded-lg shadow-xl border border-surface-border py-2 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                                                <button
                                                    onClick={() => {
                                                        handleOpenLink(list.id);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-main hover:bg-primary-light/50 dark:hover:bg-blue-900/30 hover:text-primary dark:hover:text-blue-400 flex items-center gap-2 transition-colors border-b border-surface-border"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                    Abrir Link
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleCopyLink(list.id);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-main hover:bg-primary-light/50 dark:hover:bg-blue-900/30 hover:text-primary dark:hover:text-blue-400 flex items-center gap-2 transition-colors border-b border-surface-border"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                    Copiar Link
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleShareLink(list.id, list.title);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-main hover:bg-primary-light/50 dark:hover:bg-blue-900/30 hover:text-primary dark:hover:text-blue-400 flex items-center gap-2 transition-colors border-b border-surface-border"
                                                >
                                                    <Share2 className="w-3.5 h-3.5" />
                                                    Enviar Link
                                                </button>
                                                {(isElder || isServant || role === 'SUPER_ADMIN') && (
                                                    <button
                                                        onClick={() => {
                                                            handleRemoveResponsible(list.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 flex items-center gap-2 transition-colors border-b border-surface-border"
                                                    >
                                                        <UserMinus className="w-3.5 h-3.5" />
                                                        Remover Responsável
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        if (confirm("Tem certeza que deseja excluir?")) {
                                                            handleDeleteShare(list.id);
                                                        }
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Excluir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}

export default function CardsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        }>
            <CardsContent />
        </Suspense>
    );
}
