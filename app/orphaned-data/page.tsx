"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, getDoc, where } from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, Trash2, Link as LinkIcon, AlertTriangle, Check, Loader2, Pencil } from 'lucide-react';
import Link from 'next/link';

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
            const congsSnap = await getDocs(collection(db, "congregations"));
            const validCongIds = new Set(congsSnap.docs.map(d => d.id));

            // Fetch Valid Cities first
            const citySnap = await getDocs(collection(db, "cities"));
            const validCityIds = new Set(citySnap.docs.map(d => d.id));

            // Fetch Valid Territories first
            const terrSnap = await getDocs(collection(db, "territories"));
            const validTerritoryIds = new Set(terrSnap.docs.map(d => d.id));

            // 1. Scan Addresses (and build validAddressIds)
            const addrSnap = await getDocs(collection(db, "addresses"));
            const validAddressIds = new Set<string>();

            addrSnap.forEach(d => {
                validAddressIds.add(d.id);
                const data = d.data();
                const missing = [];
                if (!data.congregationId) missing.push('Congregação');
                else if (!validCongIds.has(data.congregationId)) missing.push('Congregação Inválida (' + data.congregationId.substring(0, 4) + '...)');

                if (!data.cityId) missing.push('Cidade');
                else if (!validCityIds.has(data.cityId)) missing.push('Cidade Inválida');

                if (!data.territoryId) missing.push('Território');
                else if (!validTerritoryIds.has(data.territoryId)) missing.push('Território Inválido');

                if (missing.length > 0) {
                    newOrphans.push({
                        id: d.id,
                        type: 'address',
                        name: data.street || 'Sem Rua',
                        details: data.number || 'S/N',
                        missing,
                        data
                    });
                }
            });

            // 2. Scan Territories (Already fetched)
            terrSnap.forEach(d => {
                const data = d.data();
                const missing = [];
                if (!data.cityId) missing.push('Cidade');
                else if (!validCityIds.has(data.cityId)) missing.push('Cidade Inválida');

                if (data.congregationId && !validCongIds.has(data.congregationId)) missing.push('Congregação Inválida (' + data.congregationId.substring(0, 4) + '...)');

                if (missing.length > 0) {
                    newOrphans.push({
                        id: d.id,
                        type: 'territory',
                        name: data.name || 'Sem Nome',
                        details: 'Mapa',
                        missing,
                        data
                    });
                }
            });

            // 3. Scan Witnessing Points
            const witnessingSnap = await getDocs(collection(db, "witnessing_points"));
            witnessingSnap.forEach(d => {
                const data = d.data();
                const missing = [];
                if (!data.congregationId) missing.push('Congregação');
                else if (!validCongIds.has(data.congregationId)) missing.push('Congregação Inválida (' + data.congregationId.substring(0, 4) + '...)');

                if (!data.cityId) missing.push('Cidade');
                else if (!validCityIds.has(data.cityId)) missing.push('Cidade Inválida');

                if (missing.length > 0) {
                    newOrphans.push({
                        id: d.id,
                        type: 'witnessing',
                        name: data.name || 'Ponto sem Nome',
                        details: 'T. Público',
                        missing,
                        data
                    });
                }
            });

            // 4. Scan Cities
            citySnap.forEach(d => {
                const data = d.data();
                const missing = [];
                if (!data.congregationId) missing.push('Congregação');
                else if (!validCongIds.has(data.congregationId)) missing.push('Congregação Inválida (' + data.congregationId.substring(0, 4) + '...)');

                if (missing.length > 0) {
                    newOrphans.push({
                        id: d.id,
                        type: 'city',
                        name: data.name || 'Sem Nome',
                        details: 'Cidade',
                        missing,
                        data
                    });
                }
            });

            // 5. Scan Visits (Subcollections)
            try {
                const { collectionGroup } = await import('firebase/firestore');
                const visitsSnap = await getDocs(collectionGroup(db, 'visits'));
                visitsSnap.forEach(d => {
                    const data = d.data();
                    const missing = [];

                    // Check Congregation
                    if (data.congregationId && !validCongIds.has(data.congregationId)) {
                        missing.push('Congregação Inválida');
                    }

                    // Check Parent Address
                    const parentAddressId = d.ref.parent.parent?.id;
                    if (!parentAddressId) missing.push('Sem Endereço Pai'); // Should be impossible for subcollection
                    else if (!validAddressIds.has(parentAddressId)) missing.push('Endereço Pai Excluído');

                    if (missing.length > 0) {
                        newOrphans.push({
                            id: d.id,
                            type: 'visit',
                            name: 'Visita de ' + (data.userName || 'Desconhecido'),
                            details: data.date ? new Date(data.date.seconds * 1000).toLocaleDateString() : 'Sem Data',
                            missing,
                            data,
                            path: d.ref.path
                        });
                    }
                });
            } catch (err) {
                console.error("Error scanning visits:", err);
            }

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
            getDocs(collection(db, "congregations")).then(snap => {
                setCongs(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
            });

            // Pre-fill if exists
            setSelCong(fixingItem.data.congregationId || '');
            setSelCity(fixingItem.data.cityId || '');
            setSelTerr(fixingItem.data.territoryId || '');
        }
    }, [fixingItem]);

    // Cascading selects
    useEffect(() => {
        if (selCong) {
            const q = query(collection(db, "cities"), where("congregationId", "==", selCong));
            getDocs(q).then(snap => {
                setCities(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
            });
        } else {
            setCities([]);
        }
    }, [selCong]);

    useEffect(() => {
        if (selCity) {
            const q = query(
                collection(db, "territories"),
                where("congregationId", "==", selCong),
                where("cityId", "==", selCity)
            );
            getDocs(q).then(snap => {
                setTerritories(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
            });
        } else {
            setTerritories([]);
        }
    }, [selCity, selCong]);


    const handleSaveFix = async () => {
        if (!fixingItem) return;

        try {
            const updates: any = {};

            if (fixingItem.type === 'address') {
                if (!selCong || !selCity || !selTerr) {
                    alert("Para endereços, selecione Congregação, Cidade e Território.");
                    return;
                }
                updates.congregationId = selCong;
                updates.cityId = selCity;
                updates.territoryId = selTerr;
            }
            else if (fixingItem.type === 'territory') {
                if (!selCity) {
                    alert("Selecione a Cidade.");
                    return;
                }
                updates.cityId = selCity;
                // If fixing territory, we define cong based on selected city (or just update cong if we have it?)
                // Actually the API expects updates object directly.
                // Assuming we want to fix congregationId too if missing/invalid?
                // The UI doesn't explicitly Select Cong for territory fix unless we add logic, 
                // but checking the modal code: checking `fixingItem.type === 'address' || fixingItem.type === 'territory'`?
                // Ah, the modal has Cong select for ALL types.
                if (selCong) updates.congregationId = selCong;
            }
            else if (fixingItem.type === 'witnessing') {
                if (!selCong || !selCity) {
                    alert("Selecione Congregação e Cidade.");
                    return;
                }
                updates.congregationId = selCong;
                updates.cityId = selCity;
            }
            else if (fixingItem.type === 'city') {
                if (!selCong) {
                    alert("Selecione a Congregação.");
                    return;
                }
                updates.congregationId = selCong;
            }

            // Call Admin API
            const collectionName = fixingItem.type === 'address' ? 'addresses' :
                fixingItem.type === 'territory' ? 'territories' :
                    fixingItem.type === 'witnessing' ? 'witnessing_points' : 'cities';

            const response = await fetch('/api/admin/fix-orphan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionName,
                    id: fixingItem.id,
                    action: 'update',
                    updates
                })
            });

            if (!response.ok) throw new Error('Falha ao atualizar via API');

            setFixItem(null);
            fetchOrphans(); // Refresh
        } catch (error) {
            console.error("Error fixing:", error);
            alert("Erro ao salvar.");
        }
    };

    const handleDelete = async (id: string, collectionName: string, path?: string) => {
        if (!confirm("Tem certeza que deseja excluir este item permanentemente?")) return;
        try {
            const response = await fetch('/api/admin/fix-orphan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionName,
                    id,
                    action: 'delete',
                    path
                })
            });

            if (!response.ok) throw new Error('Falha ao excluir via API');

            setOrphans(prev => prev.filter(o => o.id !== id));
        } catch (error) {
            console.error("Error deleting:", error);
            alert("Erro ao excluir.");
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
                    <div className="text-center py-20 bg-surface rounded-3xl border-2 border-dashed border-surface-border">
                        <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-main">Tudo limpo!</h3>
                        <p className="text-muted">Nenhum dado órfão encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded-xl text-sm border border-orange-100 dark:border-orange-800">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <p>Foram encontrados <b>{orphans.length}</b> itens com vínculos quebrados.</p>
                        </div>

                        {orphans.map(item => (
                            <div key={item.id} className="bg-surface p-5 rounded-2xl shadow-sm border border-surface-border flex flex-col gap-4">
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
                                            onClick={() => handleDelete(item.id, item.type === 'address' ? 'addresses' : item.type === 'territory' ? 'territories' : item.type === 'witnessing' ? 'witnessing_points' : item.type === 'visit' ? 'visits' : 'cities', item.path)}
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
                        <div className="bg-surface rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border">
                            <h2 className="text-xl font-bold text-main mb-6 flex items-center gap-2">
                                <LinkIcon className="w-6 h-6 text-primary" />
                                Vincular Dados
                            </h2>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted uppercase">Congregação</label>
                                    <select
                                        className="w-full bg-background border border-surface-border text-main rounded-xl p-3 font-bold text-sm focus:border-primary-light/500 transition-colors"
                                        value={selCong}
                                        onChange={(e) => setSelCong(e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        {congs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                {(fixingItem.type === 'address' || fixingItem.type === 'territory') && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-muted uppercase">Cidade</label>
                                        <select
                                            className="w-full bg-background border border-surface-border text-main rounded-xl p-3 font-bold text-sm focus:border-primary-light/500 transition-colors"
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
                                            className="w-full bg-background border border-surface-border text-main rounded-xl p-3 font-bold text-sm focus:border-primary-light/500 transition-colors"
                                            value={selTerr}
                                            onChange={(e) => setSelTerr(e.target.value)}
                                            disabled={!selCity && territories.length === 0}
                                        >
                                            <option value="">Selecione...</option>
                                            {territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setFixItem(null)}
                                    className="flex-1 py-3 bg-background border border-surface-border rounded-xl font-bold text-muted hover:text-main hover:bg-surface-highlight"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveFix}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary-light/500/30 hover:bg-primary-dark"
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
