"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import {
    Loader2,
    Search,
    Building2,
    ArrowRight,
    Pencil,
    Trash2,
    X,
    LogOut,
    Check,
    Map,
    MoreVertical
} from 'lucide-react';
import BottomNav from '@/app/components/BottomNav';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { toast } from 'sonner';
import ConfirmationModal from '@/app/components/ConfirmationModal';

interface Congregation {
    id: string;
    name: string;
    category?: string;
    created_at?: string;
}

export default function CongregationListPage() {
    const { user, isSuperAdmin, loading: authLoading, congregationId, logout } = useAuth(); // Added congregationId and logout from useAuth
    const router = useRouter();

    const CATEGORY_LABELS: Record<string, string> = {
        'SIGN_LANGUAGE': 'Língua de sinais',
        'FOREIGN_LANGUAGE': 'Língua estrangeira',
        'Tradicional': 'Tradicional',
        'Língua de Sinais': 'Língua de sinais',
        'Língua Estrangeira': 'Língua estrangeira'
    };

    // State
    const [congregations, setCongregations] = useState<Congregation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');



    // Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentCongregation, setCurrentCongregation] = useState<Congregation | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; id: string | null; name: string }>({ isOpen: false, id: null, name: '' });
    const [isDeleting, setIsDeleting] = useState(false); // Add Loading state for deletion

    // Form State
    const [congregationName, setCongregationName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Redirect Unassigned Users
    useEffect(() => {
        if (!authLoading && user && !congregationId && !isSuperAdmin) {
            router.push('/unassigned');
        }
    }, [user, authLoading, congregationId, isSuperAdmin, router]);

    // Redirect Assigned Users (Non-Super Admin) to their city list
    useEffect(() => {
        if (!authLoading && user && congregationId && !isSuperAdmin) {
            router.replace(`/my-maps/city?congregationId=${congregationId}`);
        }
    }, [user, authLoading, congregationId, isSuperAdmin, router]);

    const fetchCongregations = async () => {
        if (!isSuperAdmin) return;
        try {
            const { data, error } = await supabase
                .from('congregations')
                .select('*')
                .order('name');
            if (error) throw error;
            setCongregations(data || []);
        } catch (error) {
            console.error("Error fetching congregations:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isSuperAdmin) return;

        fetchCongregations();

        const channel = supabase
            .channel('public:congregations_list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'congregations' }, () => {
                fetchCongregations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isSuperAdmin]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);


    const handleUpdateCongregation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCongregation || !congregationName.trim()) return;

        try {
            const { error } = await supabase
                .from('congregations')
                .update({ name: congregationName.trim() })
                .eq('id', currentCongregation.id);

            if (error) throw error;

            setCongregationName('');
            setCurrentCongregation(null);
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Error updating congregation:", error);
            toast.error("Erro ao atualizar congregação.");
        }
    };

    const handleDeleteCongregation = (id: string, name: string) => {
        setDeleteConfirmation({ isOpen: true, id, name });
        setOpenMenuId(null);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation.id) return;
        setIsDeleting(true);

        try {
            const { data, error } = await supabase
                .from('congregations')
                .delete()
                .eq('id', deleteConfirmation.id)
                .select(); // Check returned data

            if (error) throw error;

            if (!data || data.length === 0) {
                throw new Error("Não foi possível excluir. Verifique se você tem permissão ou se o item já foi removido.");
            }

            // Update local state to remove the deleted congregation
            setCongregations(prev => prev.filter(c => c.id !== deleteConfirmation.id));

            toast.success("Congregação excluída com sucesso.");
            setDeleteConfirmation({ isOpen: false, id: null, name: '' });
        } catch (error: any) {
            console.error("Error deleting congregation:", error);
            toast.error(error.message || "Erro ao excluir congregação.");
        } finally {
            setIsDeleting(false);
        }
    };

    const prepareEdit = (cong: Congregation) => {
        setCurrentCongregation(cong);
        setCongregationName(cong.name);
        setIsEditModalOpen(true);
    };

    const handleSignOut = async () => {
        try {
            await logout();
            window.location.href = '/login';
        } catch (error) {
            console.error("Logout error:", error);
            window.location.href = '/login';
        }
    };

    const categories = Array.from(new Set(congregations.map(c => c.category).filter(Boolean))) as string[];

    const filteredCongregations = congregations.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.category?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Todas' || c.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen pb-32 font-sans text-main">
            {/* Header */}
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-3">
                    <div className="bg-primary p-2 rounded-xl text-white shadow-md shadow-primary-light/20 dark:shadow-none">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="font-bold text-lg text-main tracking-tight block leading-tight">Congregações</span>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-widest hidden sm:inline-block">Gerenciamento</span>
                    </div>
                </div>

            </header>


            {/* Search */}
            <div className="px-6 pt-6 pb-2">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar congregação..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border-0 text-main text-sm font-medium rounded-lg py-4 pl-12 pr-4 shadow-[0_4px_30px_rgba(0,0,0,0.03)] focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-muted"
                    />
                </div>
            </div>

            {/* Categories Filter (Super Admin Only) */}
            {isSuperAdmin && !loading && categories.length > 0 && (
                <div className="px-6 pb-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                        <button
                            onClick={() => setSelectedCategory('Todas')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${selectedCategory === 'Todas' ? 'bg-primary text-white border-primary shadow-md shadow-primary/10' : 'bg-surface text-muted border-surface-border hover:border-primary-light/50'}`}
                        >
                            Todas
                        </button>
                        {categories.sort().map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${selectedCategory === cat ? 'bg-primary text-white border-primary shadow-md shadow-primary/10' : 'bg-surface text-muted border-surface-border hover:border-primary-light/50'}`}
                            >
                                {CATEGORY_LABELS[cat] || cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* List */}
            <main className="px-6 py-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {loading && isSuperAdmin ? ( // Only show loading here if super admin, as others are redirecting
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : !isSuperAdmin && loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : filteredCongregations.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-400 font-medium">Nenhuma congregação encontrada</p>
                    </div>
                ) : (
                    filteredCongregations.map(cong => (
                        <div
                            key={cong.id}
                            className="group bg-surface rounded-lg p-4 border border-surface-border shadow-sm hover:shadow-md transition-all flex items-center gap-4 relative"
                        >
                            <Link href={`/my-maps/city?congregationId=${cong.id}`} prefetch={false} className="flex-1 flex items-center gap-4 min-w-0">
                                <div className="w-10 h-10 bg-primary-light/50 dark:bg-primary-dark/30 text-primary dark:text-primary-light rounded-lg flex items-center justify-center shrink-0">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-main text-base truncate">{cong.name}</h3>
                                        {cong.category && (
                                            <span className="px-1.5 py-0.5 bg-primary-light/50 dark:bg-primary-dark/20 text-primary dark:text-primary-light rounded-md text-[8px] font-black uppercase tracking-tighter border border-primary-light/30 dark:border-primary-dark/30 shrink-0">
                                                {CATEGORY_LABELS[cong.category] || cong.category}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">ACESSAR MAPAS</p>
                                </div>
                            </Link>

                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(openMenuId === cong.id ? null : cong.id);
                                    }}
                                    className="p-2 text-muted hover:text-main hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>

                                {openMenuId === cong.id && (
                                    <div className="absolute right-0 top-full mt-2 w-40 bg-surface rounded-2xl shadow-xl border border-surface-border py-2 z-[100] animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                                        <Link
                                            href={`/my-maps/city?congregationId=${cong.id}`}
                                            prefetch={false}
                                            className="w-full px-4 py-2 text-left text-xs font-bold text-main hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 hover:text-primary dark:hover:text-primary-light flex items-center gap-2 transition-colors border-b border-surface-border"
                                        >
                                            <ArrowRight className="w-3.5 h-3.5" />
                                            Abrir
                                        </Link>
                                        {isSuperAdmin && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        prepareEdit(cong);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-xs font-bold text-main hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 hover:text-primary dark:hover:text-primary-light flex items-center gap-2 transition-colors border-b border-surface-border"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleDeleteCongregation(cong.id, cong.name);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Excluir
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </main>

            <BottomNav />


            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsEditModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-main">Editar Congregação</h2>
                        </div>
                        <form onSubmit={handleUpdateCongregation} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Nome</label>
                                <input
                                    autoFocus
                                    className="w-full bg-background border-none rounded-xl p-3 font-bold text-main focus:ring-2 focus:ring-primary/20"
                                    value={congregationName}
                                    onChange={e => setCongregationName(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!congregationName.trim()}
                                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-5 h-5" />
                                SALVAR ALTERAÇÕES
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={deleteConfirmation.isOpen}
                onClose={() => setDeleteConfirmation({ ...deleteConfirmation, isOpen: false })}
                onConfirm={confirmDelete}
                title="Excluir Congregação"
                description={`Tem certeza que deseja excluir a congregação "${deleteConfirmation.name}"? Isso pode deixar cidades e territórios órfãos permanentemente.`}
                confirmText="Sim, Excluir"
                cancelText="Cancelar"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
