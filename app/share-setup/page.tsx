"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs, setDoc } from 'firebase/firestore';
import {
    Loader2,
    ArrowLeft,
    Link as LinkIcon,
    Copy,
    ExternalLink,
    Share2,
    Calendar,
    Map as MapIcon,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

function ShareSetupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [territories, setTerritories] = useState<any[]>([]);
    const [cityName, setCityName] = useState<string>('');
    const [expiration, setExpiration] = useState('14d');
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    const territoryIdsParam = searchParams.get('ids');
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    useEffect(() => {
        const fetchTerritories = async () => {
            if (!territoryIdsParam) {
                setError("Nenhum território selecionado.");
                setLoading(false);
                return;
            }

            const ids = territoryIdsParam.split(',').filter(Boolean);
            if (ids.length === 0) {
                setError("IDs inválidos.");
                setLoading(false);
                return;
            }

            try {
                const chunks = [];
                for (let i = 0; i < ids.length; i += 10) {
                    chunks.push(ids.slice(i, i + 10));
                }

                const fetched: any[] = [];
                for (const chunk of chunks) {
                    const q = query(collection(db, "territories"), where("__name__", "in", chunk));
                    const snap = await getDocs(q);
                    snap.forEach(d => fetched.push({ id: d.id, ...d.data() }));
                }

                setTerritories(fetched);

                // Fetch City Name if possible (assuming all from same city or taking first)
                if (fetched.length > 0 && fetched[0].cityId) {
                    const cityDoc = await getDoc(doc(db, "cities", fetched[0].cityId));
                    if (cityDoc.exists()) {
                        setCityName(cityDoc.data().name);
                    }
                }
            } catch (err) {
                console.error("Error fetching territories:", err);
                setError("Erro ao carregar detalhes dos territórios.");
            } finally {
                setLoading(false);
            }
        };

        fetchTerritories();
    }, [territoryIdsParam]);

    const getOrCreateLink = async () => {
        if (generatedLink) return generatedLink;
        if (territories.length === 0) return null;

        setGenerating(true);
        try {
            const now = new Date();
            let expiresAt = new Date();

            switch (expiration) {
                case '7d': expiresAt.setDate(now.getDate() + 7); break;
                case '14d': expiresAt.setDate(now.getDate() + 14); break;
                case '30d': expiresAt.setDate(now.getDate() + 30); break;
            }

            let title = "Territórios Compartilhados";
            if (territories.length === 1) {
                title = `${territories[0].name} - ${cityName || territories[0].city || 'Mapa'}`;
            } else {
                title = `${territories.length} Territórios - ${cityName || territories[0].city || 'Vários'}`;
            }

            let shareDoc;
            try {
                shareDoc = await addDoc(collection(db, "shared_lists"), {
                    type: 'territory',
                    items: territories.map(t => t.id),
                    createdBy: user?.uid,
                    congregationId: territories[0].congregationId,
                    cityId: territories[0].cityId,
                    createdAt: serverTimestamp(),
                    expiresAt: expiration === 'never' ? null : Timestamp.fromDate(expiresAt),
                    status: 'active',
                    title: title,
                    assignedTo: null,
                    assignedName: null,
                    context: territories.length === 1 ? {
                        territoryId: territories[0].id,
                        cityId: territories[0].cityId,
                        territoryName: territories[0].name || '',
                        cityName: cityName || territories[0].city || '',
                        featuredDetails: cityName || territories[0].city || ''
                    } : {}
                });
            } catch (createError) {
                console.error("Error creating shared list:", createError);
                throw createError;
            }


            // START SNAPSHOT LOGIC
            // 1. Snapshot Territories into 'items' subcollection
            const batch = null; // We'll do parallel promises for simplicity to avoid batch limits logic complexity for now
            const snapshotPromises = [];

            // Snapshot Territories
            for (const t of territories) {
                const itemRef = doc(db, "shared_lists", shareDoc.id, "items", t.id);
                snapshotPromises.push(setDoc(itemRef, {
                    ...t,
                    congregationId: territories[0].congregationId,
                    createdBy: user?.uid
                }));
            }

            // Snapshot Addresses
            // We need to fetch all addresses for these territories
            const territoryIds = territories.map(t => t.id);
            // Chunk address queries
            const addressChunks = [];
            for (let i = 0; i < territoryIds.length; i += 10) {
                addressChunks.push(territoryIds.slice(i, i + 10));
            }

            for (const chunk of addressChunks) {
                const qAddr = query(collection(db, "addresses"), where("territoryId", "in", chunk));
                const snapAddr = await getDocs(qAddr);

                snapAddr.forEach(aDoc => {
                    const addrRef = doc(db, "shared_lists", shareDoc.id, "territory_addresses", aDoc.id);
                    snapshotPromises.push(setDoc(addrRef, {
                        ...aDoc.data(),
                        congregationId: territories[0].congregationId,
                        createdBy: user?.uid
                    }));
                });
            }


            try {
                console.log(`[SNAPSHOT] Starting ${snapshotPromises.length} write operations...`);
                await Promise.all(snapshotPromises);
                console.log("[SNAPSHOT] All writes completed successfully!");
            } catch (snapshotError) {
                console.error("[SNAPSHOT] Failed during batch write:", snapshotError);
                throw snapshotError;
            }
            // END SNAPSHOT LOGIC

            const link = `${window.location.origin}/share?id=${shareDoc.id}`;
            setGeneratedLink(link);
            return link;
        } catch (error) {
            console.error("Error generating link:", error);
            alert("Erro ao gerar link.");
            return null;
        } finally {
            setGenerating(false);
        }
    };

    const handleOpen = async () => {
        const link = await getOrCreateLink();
        if (link) window.open(link, '_blank');
    };

    const handleCopy = async () => {
        const link = await getOrCreateLink();
        if (link) {
            try {
                await navigator.clipboard.writeText(link);
                alert("Link copiado!");
            } catch (err) {
                console.error(err);
                alert("Erro ao copiar link.");
            }
        }
    };

    const handleShare = async () => {
        const link = await getOrCreateLink();
        if (link) {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Território para Trabalhar',
                        text: 'Acesse o link para visualizar o território designado:',
                        url: link
                    });
                } catch (err) {
                    console.error(err);
                }
            } else {
                await handleCopy();
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <h1 className="text-xl font-bold text-main">Erro</h1>
                <p className="text-muted">{error}</p>
                <button onClick={() => router.push(returnUrl)} className="text-primary hover:underline">
                    Voltar
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background font-sans text-main pb-20">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-surface border-b border-surface-border px-6 py-4 flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-muted" />
                </button>
                <h1 className="font-bold text-lg text-main">Configurar Link</h1>
            </header>

            <main className="max-w-xl mx-auto px-6 py-8 space-y-8">

                {/* Summary Section */}
                <section className="space-y-4">
                    <h2 className="text-sm font-bold text-muted uppercase tracking-wider">Resumo da Seleção</h2>
                    <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
                        {territories.map((t, index) => (
                            <div key={t.id} className={`p-4 flex items-center gap-4 ${index !== territories.length - 1 ? 'border-b border-surface-border' : ''}`}>
                                <div className="w-10 h-10 bg-primary-light/50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
                                    <MapIcon className="w-5 h-5 text-primary dark:text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-main truncate">{t.name}</h3>
                                    <p className="text-xs text-muted truncate">{t.description || (cityName || t.city ? (cityName || t.city) : 'Sem descrição')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Configuration & Actions */}
                <section className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Validado do Link
                        </label>
                        <p className="text-xs text-muted">Defina por quanto tempo este link ficará acessível.</p>
                        <select
                            value={expiration}
                            onChange={(e) => setExpiration(e.target.value)}
                            disabled={!!generatedLink} // Disable changes after link is created to avoid confusion
                            className="w-full bg-surface border border-surface-border rounded-xl p-4 text-main font-semibold focus:ring-2 focus:ring-primary-light/500/20 outline-none transition-all disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        >
                            <option value="7d">7 Dias</option>
                            <option value="14d">14 Dias (Padrão)</option>
                            <option value="30d">30 Dias</option>
                        </select>
                    </div>

                    <div className="space-y-3 pt-2">
                        {/* Open Button */}
                        <button
                            onClick={handleOpen}
                            disabled={generating}
                            className={`w-full bg-surface border-2 ${generatedLink ? 'border-green-500 bg-green-50 dark:bg-green-900/10 dark:border-green-800' : 'border-surface-border'} hover:bg-gray-50 dark:hover:bg-gray-800 text-main font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors`}
                        >
                            {generating ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <ExternalLink className={`w-5 h-5 ${generatedLink ? 'text-green-600' : 'text-primary'}`} />}
                            {generatedLink ? 'Link Aberto (Reabrir)' : 'Abrir Link'}
                        </button>

                        {/* Copy Button */}
                        <button
                            onClick={handleCopy}
                            disabled={generating}
                            className={`w-full bg-surface border-2 ${generatedLink ? 'border-green-500 bg-green-50 dark:bg-green-900/10 dark:border-green-800' : 'border-surface-border'} hover:bg-gray-50 dark:hover:bg-gray-800 text-main font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors`}
                        >
                            <Copy className={`w-5 h-5 ${generatedLink ? 'text-green-600' : 'text-orange-500'}`} />
                            {generatedLink ? 'Link Copiado (Copiar Novamente)' : 'Copiar Link'}
                        </button>

                        {/* Share Button */}
                        <button
                            onClick={handleShare}
                            disabled={generating}
                            className={`w-full bg-surface border-2 ${generatedLink ? 'border-green-500 bg-green-50 dark:bg-green-900/10 dark:border-green-800' : 'border-surface-border'} hover:bg-gray-50 dark:hover:bg-gray-800 text-main font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors`}
                        >
                            <Share2 className={`w-5 h-5 ${generatedLink ? 'text-green-600' : 'text-purple-600'}`} />
                            Compartilhar
                        </button>
                    </div>

                    {generatedLink && (
                        <div className="text-center animate-in fade-in duration-300">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-bold text-sm">
                                <CheckCircle2 className="w-4 h-4" /> Link Gerado
                            </div>
                        </div>
                    )}
                </section>

                <button
                    onClick={() => router.push(returnUrl)}
                    className="w-full text-muted hover:text-main text-sm font-medium py-2"
                >
                    Voltar sem gerar novo link
                </button>

            </main>
        </div>
    );
}

export default function ShareSetupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <ShareSetupContent />
        </Suspense>
    );
}
