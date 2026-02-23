"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, Trash2, Link as LinkIcon, AlertTriangle, Check, Loader2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface OrphanedItem {
    id: string;
    type: 'address' | 'territory' | 'city' | 'witnessing' | 'visit';
    name: string; // Street or Name
    details: string; // Number or other info
    missing: string[]; // ['congregation', 'city', 'territory']
    data: any;
    path?: string;
}

export default function OrphanedDataPage() {
    const { isSuperAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orphans, setOrphans] = useState<OrphanedItem[]>([]);

    // Fix Modal State
    const [fixingItem, setFixItem] = useState<OrphanedItem | null>(null);
    const [congs, setCongs] = useState<{ id: string, name: string }[]>([]);
    const [cities, setCities] = useState<{ id: string, name: string }[]>([]);
    const [territories, setTerritories] = useState<{ id: string, name: string }[]>([]);

    const [selCong, setSelCong] = useState('');
    const [selCity, setSelCity] = useState('');
    const [selTerr, setSelTerr] = useState('');

    const [saving, setSaving] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDetails, setEditDetails] = useState('');
    const [editNumber, setEditNumber] = useState('');
    const [editBlock, setEditBlock] = useState('');
    const [editObservation, setEditObservation] = useState('');
    const [editSchedule, setEditSchedule] = useState('');
    const [editState, setEditState] = useState('');

    useEffect(() => {
        if (!authLoading && !isSuperAdmin) {
            router.push('/');
        }
    }, [isSuperAdmin, authLoading, router]);

    const fetchOrphans = async () => {
        setLoading(true);
        const newOrphans: OrphanedItem[] = [];

        try {
            // Fetch Valid Congregations first
            const { data: congs } = await supabase.from('congregations').select('id');
            const validCongIds = new Set(congs?.map(d => d.id) || []);

            // Fetch Valid Cities first
            const { data: cities } = await supabase.from('cities').select('id');
            const validCityIds = new Set(cities?.map(d => d.id) || []);

            // Fetch Valid Territories first
            const { data: territories } = await supabase.from('territories').select('id');
            const validTerritoryIds = new Set(territories?.map(d => d.id) || []);

            // 1. Scan Addresses
            const { data: addresses } = await supabase.from('addresses').select('*');
            const validAddressIds = new Set<string>();

            addresses?.forEach(data => {
                validAddressIds.add(data.id);
                const missing = [];
                if (!data.congregation_id) missing.push('Congregação');
                else if (!validCongIds.has(data.congregation_id)) missing.push('Congregação Inválida');

                if (!data.city_id) missing.push('Cidade');
                else if (!validCityIds.has(data.city_id)) missing.push('Cidade Inválida');

                if (!data.territory_id) missing.push('Território');
                else if (!validTerritoryIds.has(data.territory_id)) missing.push('Território Inválido');

                if (missing.length > 0) {
                    newOrphans.push({
                        id: data.id,
                        type: 'address',
                        name: data.street || 'Sem Rua',
                        details: data.number || 'S/N',
                        missing,
                        data
                    });
                }
            });

            // 2. Scan Territories
            const { data: allTerritories } = await supabase.from('territories').select('*');
            allTerritories?.forEach(data => {
                const missing = [];
                if (!data.city_id) missing.push('Cidade');
                else if (!validCityIds.has(data.city_id)) missing.push('Cidade Inválida');

                if (data.congregation_id && !validCongIds.has(data.congregation_id)) missing.push('Congregação Inválida');

                if (missing.length > 0) {
                    newOrphans.push({
                        id: data.id,
                        type: 'territory',
                        name: data.name || 'Sem Nome',
                        details: 'Mapa',
                        missing,
                        data
                    });
                }
            });

            // 3. Scan Witnessing Points
            const { data: witnessingPoints } = await supabase.from('witnessing_points').select('*');
            witnessingPoints?.forEach(data => {
                const missing = [];
                if (!data.congregation_id) missing.push('Congregação');
                else if (!validCongIds.has(data.congregation_id)) missing.push('Congregação Inválida');

                if (!data.city_id) missing.push('Cidade');
                else if (!validCityIds.has(data.city_id)) missing.push('Cidade Inválida');

                if (missing.length > 0) {
                    newOrphans.push({
                        id: data.id,
                        type: 'witnessing',
                        name: data.name || 'Ponto sem Nome',
                        details: data.address || 'Sem Endereço',
                        missing,
                        data
                    });
                }
            });

            // 4. Scan Cities
            const { data: allCities } = await supabase.from('cities').select('*');
            allCities?.forEach(data => {
                const missing = [];
                if (!data.congregation_id) missing.push('Congregação');
                else if (!validCongIds.has(data.congregation_id)) missing.push('Congregação Inválida');

                if (missing.length > 0) {
                    newOrphans.push({
                        id: data.id,
                        type: 'city',
                        name: data.name || 'Sem Nome',
                        details: 'Cidade',
                        missing,
                        data
                    });
                }
            });

            // 5. Scan Visits
            const { data: visits } = await supabase.from('visits').select('*');
            visits?.forEach(data => {
                const missing = [];
                if (data.congregation_id && !validCongIds.has(data.congregation_id)) {
                    missing.push('Congregação Inválida');
                }
                if (data.address_id && !validAddressIds.has(data.address_id)) {
                    missing.push('Endereço Pai Excluído');
                }

                if (missing.length > 0) {
                    newOrphans.push({
                        id: data.id,
                        type: 'visit',
                        name: 'Visita de ' + (data.user_name || 'Desconhecido'),
                        details: data.date ? new Date(data.date).toLocaleDateString() : 'Sem Data',
                        missing,
                        data
                    });
                }
            });

        } catch (error) {
            console.error("Error scanning orphans:", error);
        } finally {
            setOrphans(newOrphans);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) fetchOrphans();
    }, [isSuperAdmin]);

    // Fetch Context Options when modal opens
    useEffect(() => {
        if (fixingItem) {
            // Load Congregations
            supabase.from('congregations').select('id, name').then(({ data }) => {
                if (data) setCongs(data);
            });

            // Pre-fill if exists (only if not marked as invalid)
            const isCongInvalid = fixingItem.missing.some(m => m.includes('Congregação'));
            const isCityInvalid = fixingItem.missing.some(m => m.includes('Cidade'));
            const isTerrInvalid = fixingItem.missing.some(m => m.includes('Território'));

            setSelCong(isCongInvalid ? '' : (fixingItem.data.congregation_id || ''));
            setSelCity(isCityInvalid ? '' : (fixingItem.data.city_id || ''));
            setSelTerr(isTerrInvalid ? '' : (fixingItem.data.territory_id || ''));

            setEditName(fixingItem.name || '');
            setEditDetails(fixingItem.details || '');
            setEditNumber('');
            setEditBlock('');
            setEditObservation(fixingItem.data.observation || fixingItem.data.notes || '');
            setEditSchedule(fixingItem.data.schedule || '');
            setEditState(fixingItem.data.state || 'SP');
        }
    }, [fixingItem]);

    // Cascading selects
    useEffect(() => {
        if (selCong) {
            supabase.from('cities').select('id, name').eq('congregation_id', selCong).then(({ data }) => {
                if (data) setCities(data);
            });
        } else {
            setCities([]);
        }
    }, [selCong]);

    useEffect(() => {
        if (selCity) {
            supabase.from('territories')
                .select('id, name')
                .eq('congregation_id', selCong)
                .eq('city_id', selCity)
                .then(({ data }) => {
                    if (data) setTerritories(data);
                });
        } else {
            setTerritories([]);
        }
    }, [selCity, selCong]);


    const handleSaveFix = async () => {
        if (!fixingItem) return;

        setSaving(true);
        try {
            const updates: any = {};

            if (fixingItem.type === 'address') {
                if (!selCong || !selCity || !selTerr) {
                    toast.info("Para endereços, selecione Congregação, Cidade e Território.");
                    setSaving(false);
                    return;
                }
                updates.congregation_id = selCong;
                updates.city_id = selCity;
                updates.territory_id = selTerr;
            }
            else if (fixingItem.type === 'territory') {
                if (!selCity) {
                    toast.info("Selecione a Cidade.");
                    setSaving(false);
                    return;
                }
                updates.city_id = selCity;
                if (selCong) updates.congregation_id = selCong;
            }
            else if (fixingItem.type === 'witnessing') {
                if (!selCong || !selCity) {
                    toast.info("Selecione Congregação e Cidade.");
                    setSaving(false);
                    return;
                }
                updates.congregation_id = selCong;
                updates.city_id = selCity;
            }
            else if (fixingItem.type === 'city') {
                if (!selCong) {
                    toast.info("Selecione a Congregação.");
                    setSaving(false);
                    return;
                }
                updates.congregation_id = selCong;
                updates.state = editState;
            }

            // Common field updates based on type
            if (fixingItem.type === 'address') {
                updates.street = editName;
                updates.observations = editObservation;
            } else if (fixingItem.type === 'territory' || fixingItem.type === 'witnessing' || fixingItem.type === 'city') {
                updates.name = editName;
                if (fixingItem.type === 'territory') updates.notes = editObservation;
                if (fixingItem.type === 'witnessing') {
                    updates.address = editDetails;
                    updates.schedule = editSchedule;
                }
            }

            // Remover campos nulos ou indefinidos de updates
            Object.keys(updates).forEach(key => (updates[key] === undefined) && delete updates[key]);

            if (Object.keys(updates).length === 0) {
                toast.info("Nenhuma alteração para salvar.");
                setSaving(false);
                return;
            }

            // Chamada para a API administrativa para contornar restrições de RLS
            const response = await fetch('/api/admin/repair-orphan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: fixingItem.id,
                    type: fixingItem.type,
                    updates
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Falha ao processar reparo');
            }

            toast.success("Dados restaurados e vinculados com sucesso!");
            setFixItem(null);

            // Pequeno delay para consistência do banco antes do refresh
            setTimeout(() => {
                fetchOrphans();
            }, 500);
        } catch (error: any) {
            console.error("DEBUG - Repair Error:", error);
            toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, type: string) => {
        if (!confirm("Tem certeza que deseja excluir este item permanentemente?")) return;
        try {
            const tableName = type === 'address' ? 'addresses' :
                type === 'territory' ? 'territories' :
                    type === 'witnessing' ? 'witnessing_points' :
                        type === 'visit' ? 'visits' : 'cities';

            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', id);

            if (error) throw error;

            setOrphans(prev => prev.filter(o => o.id !== id));
        } catch (error) {
            console.error("Error deleting:", error);
            toast.error("Erro ao excluir.");
        }
    };

    if (authLoading || !isSuperAdmin) return null;

    return (
        <div className="min-h-screen bg-background pb-10 font-sans text-main">
            <header className="bg-surface px-6 py-4 border-b border-surface-border flex items-center gap-3 sticky top-0 z-10">
                <Link href="/settings" className="p-2 hover:bg-background rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-muted" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-main">
                        <Database className="w-5 h-5 text-orange-500" />
                        Dados Órfãos
                    </h1>
                    <p className="text-xs text-muted">Itens sem vínculo detectados</p>
                </div>
            </header>

            <main className="px-6 py-8 max-w-2xl mx-auto">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : orphans.length === 0 ? (
                    <div className="text-center py-20 bg-surface rounded-xl border-2 border-dashed border-surface-border">
                        <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-main">Tudo limpo!</h3>
                        <p className="text-muted">Nenhum dado órfão encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded-lg text-sm border border-orange-100 dark:border-orange-800">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <p>Foram encontrados <b>{orphans.length}</b> itens com vínculos quebrados.</p>
                        </div>

                        {orphans.map(item => (
                            <div key={item.id} className="bg-surface p-5 rounded-lg shadow-sm border border-surface-border flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
                                                ${item.type === 'address' ? 'bg-primary-light dark:bg-blue-900/30 text-primary-dark dark:text-blue-300' :
                                                    item.type === 'territory' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                                        item.type === 'witnessing' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                                            item.type === 'visit' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}
                                            `}>
                                                {item.type === 'address' ? 'Endereço' : item.type === 'territory' ? 'Mapa' : item.type === 'witnessing' ? 'T. Público' : item.type === 'visit' ? 'Visita' : 'Cidade'}
                                            </span>
                                            <span className="text-xs text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                                Falta: {item.missing.join(', ')}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-main text-lg">{item.name}</h3>
                                        <p className="text-sm text-muted">{item.details}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDelete(item.id, item.type)}
                                            className="p-2 text-red-600 hover:text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setFixItem(item)}
                                            className="p-2 text-primary hover:text-primary-light/500 bg-primary-light/50 hover:bg-primary-light dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                                            title="Editar/Vincular"
                                        >
                                            <Pencil className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Fix Modal */}
            {
                fixingItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-surface rounded-xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border">
                            <h2 className="text-xl font-bold text-main mb-6 flex items-center gap-2">
                                <LinkIcon className="w-6 h-6 text-primary" />
                                Vincular Dados
                            </h2>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted uppercase">Congregação</label>
                                    <select
                                        className="w-full bg-background border border-surface-border text-main rounded-md p-3 font-bold text-sm focus:border-primary-light/500 transition-colors"
                                        value={selCong}
                                        onChange={(e) => setSelCong(e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        {congs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                {(fixingItem.type === 'address' || fixingItem.type === 'territory' || fixingItem.type === 'witnessing') && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-muted uppercase">Cidade</label>
                                        <select
                                            className="w-full bg-background border border-surface-border text-main rounded-md p-3 font-bold text-sm focus:border-primary-light/500 transition-colors"
                                            value={selCity}
                                            onChange={(e) => setSelCity(e.target.value)}
                                            disabled={!selCong && cities.length === 0}
                                        >
                                            <option value="">Selecione...</option>
                                            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {fixingItem.type === 'address' && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-muted uppercase">Território (Mapa)</label>
                                        <select
                                            className="w-full bg-background border border-surface-border text-main rounded-md p-3 font-bold text-sm focus:border-primary-light/500 transition-colors"
                                            value={selTerr}
                                            onChange={(e) => setSelTerr(e.target.value)}
                                            disabled={!selCity && territories.length === 0}
                                        >
                                            <option value="">Selecione...</option>
                                            {territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="border-t border-surface-border pt-4 mt-4 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-muted uppercase tracking-wider">
                                            {fixingItem.type === 'address' ? 'Rua / Logradouro' :
                                                fixingItem.type === 'territory' ? 'Número do Mapa' : 'Nome'}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-background border border-surface-border text-main rounded-md p-3 font-bold text-sm focus:border-primary-light/500 transition-colors"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                        />
                                    </div>

                                    {fixingItem.type === 'witnessing' && (
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-muted uppercase">Endereço Completo</label>
                                                <textarea
                                                    className="w-full bg-background border border-surface-border text-main rounded-md p-3 font-bold text-sm focus:border-primary-light/500 transition-colors min-h-[80px]"
                                                    value={editDetails}
                                                    onChange={(e) => setEditDetails(e.target.value)}
                                                    placeholder="Rua, número, bairro..."
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-muted uppercase">Horário (Opcional)</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-background border border-surface-border text-main rounded-md p-3 font-bold text-sm focus:border-primary-light/500 transition-colors"
                                                    value={editSchedule}
                                                    onChange={(e) => setEditSchedule(e.target.value)}
                                                    placeholder="Ex: Segundas, 08:00 - 12:00"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {(fixingItem.type === 'address' || fixingItem.type === 'territory') && (
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted uppercase">
                                                {fixingItem.type === 'territory' ? 'Descrição' : 'Observações'}
                                            </label>
                                            <textarea
                                                className="w-full bg-background border border-surface-border text-main rounded-md p-3 font-bold text-sm focus:border-primary-light/500 transition-colors min-h-[80px]"
                                                value={editObservation}
                                                onChange={(e) => setEditObservation(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setFixItem(null)}
                                    className="flex-1 py-3 bg-background border border-surface-border rounded-md font-bold text-muted hover:text-main hover:bg-surface-highlight"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveFix}
                                    className="flex-1 py-3 bg-primary text-white rounded-md font-bold shadow-lg shadow-primary-light/500/30 hover:bg-primary-dark"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
