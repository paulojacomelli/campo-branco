"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Search,
    Building2,
    Loader2,
    Trash2,
    ArrowRight,
    MapPin,
    Users,
    MoreVertical,
    Pencil,
    X,
    Database,
    ChevronLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import BottomNav from '@/app/components/BottomNav';
import RoleBasedSwitcher from '@/app/components/RoleBasedSwitcher';

interface Congregation {
    id: string;
    name: string;
    city?: string;
    term_type?: 'city' | 'neighborhood';
    category?: string;
    created_at?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    'SIGN_LANGUAGE': 'Língua de sinais',
    'FOREIGN_LANGUAGE': 'Língua estrangeira',
    'Tradicional': 'Tradicional',
    'Língua de Sinais': 'Língua de sinais',
    'Língua Estrangeira': 'Língua estrangeira'
};

export default function CongregationsPage() {
    const { user, isSuperAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [congregations, setCongregations] = useState<Congregation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editingCongregation, setEditingCongregation] = useState<Congregation | null>(null);

    // New Congregation Form
    const [newName, setNewName] = useState('');
    const [newCity, setNewCity] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newTermType, setNewTermType] = useState<'city' | 'neighborhood'>('city');
    const [customId, setCustomId] = useState(''); // Optional custom ID
    const [categoryFilter, setCategoryFilter] = useState('Todas');

    // View state
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const currentView = searchParams.get('view') || 'grid';

    const fetchCongregations = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('congregations')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setCongregations(data || []);
        } catch (error) {
            console.error("Error fetching congregations:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading) return;

        if (!isSuperAdmin) {
            router.push('/dashboard');
            return;
        }

        fetchCongregations();

        // Supabase Realtime
        const channel = supabase
            .channel('public:congregations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'congregations' }, () => {
                fetchCongregations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // Add fetchCongregations to dependency array is dangerous if fetchCongregations changes on every render.
        // We will keep it out for now or memoize it. Since it's defined inside the component and not memoized, it changes every render.
        // Better to not include it or wrap it in useCallback. For now simple fix is to ignore lint warning.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isSuperAdmin, router]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    const handleCreateCongregation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        try {
            const data: any = {
                name: newName.trim(),
                city: newCity.trim() || null,
                category: newCategory.trim() || null,
                term_type: newTermType,
            };

            if (editingCongregation) {
                const oldId = editingCongregation.id;
                const newId = customId.trim();

                if (newId && newId !== oldId) {
                    const proceed = confirm(`⚠️ MUDANÇA DE ID DETECTADA\n\nO sistema irá migrar AUTOMATICAMENTE todos os dados vinculados para o novo ID.\nContinuar?`);
                    if (!proceed) return;

                    setLoading(true);
                    const response = await fetch('/api/admin/migrate-congregation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ oldId, newId })
                    });

                    const result = await response.json();
                    setLoading(false);

                    if (!response.ok) throw new Error(result.error || 'Falha na migração');
                    toast.success(`Migração concluída!`);
                } else {
                    // Use the secure API route to update, bypassing client-side RLS issues
                    const response = await fetch('/api/admin/congregations/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: oldId, ...data }) // oldId is the current UUID in the database
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || 'Falha ao atualizar via API');
                    }

                    // If successful, result.data contains the updated row
                    // toast.success("Atualizado via Admin API!"); // Optional debug success
                }
            } else {
                if (customId.trim()) {
                    data.id = customId.trim();
                }
                const { error } = await supabase
                    .from('congregations')
                    .insert(data);
                if (error) throw error;
            }

            setNewName('');
            setNewCity('');
            setNewCategory('');
            setNewTermType('city');
            setCustomId('');
            setIsCreateModalOpen(false);
            setEditingCongregation(null);
            toast.success('Congregação salva com sucesso!');
            await fetchCongregations(); // Ensure strict await here
        } catch (error: any) {
            console.error("Error saving congregation:", error);
            toast.error(`Erro: ${error.message || "Erro ao salvar."}`);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja apagar a congregação "${name}"?`)) return;
        try {
            const { error } = await supabase
                .from('congregations')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error("Error deleting:", error);
        }
    };

    const categories = Array.from(new Set(congregations.map(c => c.category).filter(Boolean))) as string[];

    const filtered = congregations.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.category?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'Todas' || c.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    if (authLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="min-h-screen bg-background pb-32 font-sans text-main">
            {/* Header */}
            <header className="bg-surface border-b border-surface-border sticky top-0 z-40 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/settings" className="p-2 hover:bg-background rounded-xl transition-colors text-muted hover:text-main">
                            <ChevronLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-main tracking-tight">Gerenciar Congregações</h1>
                            <p className="text-xs text-muted font-medium">Controle de unidades</p>
                        </div>
                    </div>




                    <div className="flex items-center gap-2">
                        <RoleBasedSwitcher />
                        <button
                            onClick={() => {
                                setEditingCongregation(null);
                                setNewName('');
                                setNewCity('');
                                setNewCategory('');
                                setNewTermType('city');
                                setCustomId('');
                                setIsCreateModalOpen(true);
                            }}
                            className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 shadow-lg shadow-primary-light/500/30 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            Nova Congregação
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                {/* Search */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5 group-focus-within:text-primary-light/500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar congregação..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-surface-border text-main text-sm font-medium rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-primary-light/500/20 focus:outline-none transition-all placeholder:text-muted"
                    />
                </div>

                {/* Categories Filter */}
                {!loading && categories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                        <button
                            onClick={() => setCategoryFilter('Todas')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${categoryFilter === 'Todas' ? 'bg-primary text-white border-primary shadow-md shadow-primary-light/500/20' : 'bg-surface text-muted border-surface-border hover:border-primary-light/500'}`}
                        >
                            Todos os Tipos
                        </button>
                        {categories.sort().map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${categoryFilter === cat ? 'bg-primary text-white border-primary shadow-md shadow-primary-light/500/20' : 'bg-surface text-muted border-surface-border hover:border-primary-light/500'}`}
                            >
                                {CATEGORY_LABELS[cat] || cat}
                            </button>
                        ))}
                    </div>
                )}




                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-muted font-bold animate-pulse uppercase tracking-widest text-[10px]">Carregando...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <Building2 className="w-16 h-16 mx-auto mb-4 text-muted" />
                        <p className="text-muted font-medium">Nenhuma congregação encontrada.</p>
                    </div>
                ) : currentView === 'table' ? (
                    <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-surface-highlight border-b border-surface-border text-muted uppercase tracking-wider text-[10px] font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Nome</th>
                                        <th className="px-6 py-4">Cidade</th>
                                        <th className="px-6 py-4">Tipo</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-border">
                                    {filtered.map((cong) => (
                                        <tr key={cong.id} className="hover:bg-surface-highlight/50 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-main">
                                                <Link href={`/my-maps/${cong.id}`} className="hover:text-primary transition-colors block">
                                                    {cong.name}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-muted">{cong.city || '-'} ({cong.term_type === 'neighborhood' ? 'Bairros' : 'Cidades'})</td>
                                            <td className="px-6 py-4">
                                                {cong.category && (
                                                    <span className="px-2 py-1 bg-primary-light/50 dark:bg-blue-900/20 text-primary dark:text-blue-400 rounded-md text-[10px] font-black uppercase tracking-tighter border border-primary-light dark:border-blue-800/30">
                                                        {CATEGORY_LABELS[cong.category] || cong.category}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditingCongregation(cong);
                                                            setNewName(cong.name);
                                                            setNewCity(cong.city || '');
                                                            let cat = cong.category || '';
                                                            const lowerCat = cat.toLowerCase();
                                                            if (lowerCat.includes('sinais') || lowerCat.includes('sign')) cat = 'SIGN_LANGUAGE';
                                                            else if (lowerCat.includes('estrangeira') || lowerCat.includes('foreign')) cat = 'FOREIGN_LANGUAGE';
                                                            setNewCategory(cat);
                                                            setNewTermType(cong.term_type || 'city');
                                                            setCustomId(cong.id);
                                                            setIsCreateModalOpen(true);
                                                        }}
                                                        className="p-2 text-muted hover:text-main hover:bg-background rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(cong.id, cong.name)}
                                                        className="p-2 text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                        {filtered.map((cong) => (
                            <div key={cong.id} className="bg-surface rounded-2xl p-5 border border-surface-border shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                                <Link href={`/my-maps/${cong.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="w-12 h-12 rounded-2xl bg-primary-light/50 dark:bg-blue-900/20 flex items-center justify-center text-primary dark:text-blue-400 group-hover:scale-110 transition-transform">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-main truncate">{cong.name}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] text-muted truncate">
                                                {cong.city ? `${cong.city} • ` : ''}Modo: {cong.term_type === 'neighborhood' ? 'Bairros' : 'Cidades'}
                                            </p>
                                            {cong.category && (
                                                <span className="px-1.5 py-0.5 bg-primary-light/50 dark:bg-blue-900/20 text-primary dark:text-blue-400 rounded-md text-[8px] font-black uppercase tracking-tighter border border-primary-light dark:border-blue-800/30">
                                                    {CATEGORY_LABELS[cong.category] || cong.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setEditingCongregation(cong);
                                            setNewName(cong.name);
                                            setNewCity(cong.city || '');
                                            // Handle existing data normalization while editing
                                            let cat = cong.category || '';
                                            const lowerCat = cat.toLowerCase();
                                            if (lowerCat.includes('sinais') || lowerCat.includes('sign')) cat = 'SIGN_LANGUAGE';
                                            else if (lowerCat.includes('estrangeira') || lowerCat.includes('foreign')) cat = 'FOREIGN_LANGUAGE';

                                            setNewCategory(cat);
                                            setNewTermType(cong.term_type || 'city');
                                            setCustomId(cong.id);
                                            setIsCreateModalOpen(true);
                                        }}
                                        className="p-2 text-muted hover:text-main hover:bg-background rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cong.id, cong.name)}
                                        className="p-2 text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {
                isCreateModalOpen && (
                    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="flex min-h-full items-center justify-center p-4 pb-24 text-center sm:p-6">
                            <div className="relative w-full max-w-md transform rounded-[2.5rem] bg-surface p-8 text-left shadow-2xl transition-all border border-surface-border animate-in zoom-in-95 duration-300">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-main tracking-tight">{editingCongregation ? 'Editar Congregação' : 'Nova Congregação'}</h2>
                                    </div>
                                    <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-background rounded-full transition-colors">
                                        <X className="w-6 h-6 text-muted" />
                                    </button>
                                </div>

                                <form onSubmit={handleCreateCongregation} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Nome</label>
                                        <input
                                            required
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all text-main placeholder-muted"
                                            placeholder="Ex: Congregação Central"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Cidade (Opcional)</label>
                                        <input
                                            type="text"
                                            value={newCity}
                                            onChange={(e) => setNewCity(e.target.value)}
                                            className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all text-main placeholder-muted"
                                            placeholder="Ex: São Paulo"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Tipo de congregação</label>
                                        <select
                                            required
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value)}
                                            className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all text-main appearance-none"
                                        >
                                            <option value="" disabled>Selecione o tipo...</option>
                                            <option value="Tradicional">Tradicional</option>
                                            <option value="SIGN_LANGUAGE">Língua de Sinais</option>
                                            <option value="FOREIGN_LANGUAGE">Língua Estrangeira</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Modo de Organização</label>
                                        <div className="flex gap-2 p-1 bg-background border border-surface-border rounded-2xl">
                                            <button
                                                type="button"
                                                onClick={() => setNewTermType('city')}
                                                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${newTermType === 'city' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-main'}`}
                                            >
                                                Cidades
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewTermType('neighborhood')}
                                                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${newTermType === 'neighborhood' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-main'}`}
                                            >
                                                Bairros
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">ID Personalizado (opcional)</label>
                                        <input
                                            type="text"
                                            value={customId}
                                            onChange={e => setCustomId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                            className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all text-main placeholder-muted"
                                            placeholder="ex: sao-paulo-central"
                                        />
                                        <p className="text-[10px] text-muted italic">Isso definirá a URL da congregação.</p>
                                        {editingCongregation && (
                                            <p className="text-[10px] text-orange-500 font-bold mt-1">
                                                ⚠️ Alterar o ID pode quebrar links existentes se houver dados vinculados!
                                            </p>
                                        )}
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateModalOpen(false)}
                                            className="flex-1 bg-background hover:bg-surface-highlight text-muted hover:text-main border border-surface-border font-bold py-3.5 rounded-2xl transition-all active:scale-95"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-primary-light/500/30 transition-all active:scale-95"
                                        >
                                            {editingCongregation ? 'Salvar' : 'Criar'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }
            <BottomNav />
        </div >
    );
}
