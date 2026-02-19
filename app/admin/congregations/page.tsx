"use client";

import { useState, useEffect } from 'react';
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

    const fetchCongregations = async () => {
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
    };

    useEffect(() => {
        if (!authLoading && !isSuperAdmin) {
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
            setTimeout(() => {
                supabase.removeChannel(channel);
            }, 100);
        };
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
                city_id: null, // We need to handle city mapping separately if needed, but the UI used 'city' as text
                category: newCategory.trim() || null,
                term_type: newTermType,
            };

            // In Supabase, if we want a custom ID, we should provide it on insert
            // Note: congregates table 'city_id' is a UUID in the new schema, but the old UI used 'city' as string.
            // For now, let's stick to the current UI logic or adapt to schema.
            // Based on full_db_setup.sql: congregations has (id, name, city_id, category, term_type)

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
                    const { error } = await supabase
                        .from('congregations')
                        .update(data)
                        .eq('id', oldId);
                    if (error) throw error;
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
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                            setNewCategory(cong.category || '');
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
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-surface w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border">
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
                                    <option value="Língua de Sinais">Língua de Sinais</option>
                                    <option value="Língua Estrangeira">Língua Estrangeira</option>
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
            )}
        </div>
    );
}
