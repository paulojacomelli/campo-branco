"use client";

import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Bug, CheckCircle2, Clock, MapPin, Monitor } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import Link from 'next/link';

interface Report {
    id: string;
    description: string;
    screenshot: string;
    userId: string;
    userName: string;
    url: string;
    userAgent: string;
    createdAt: any;
    status: 'open' | 'resolved';
}

export default function AdminReportsPage() {
    const { isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isSuperAdmin) return;

        const fetchReports = async () => {
            try {
                const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
                setReports(data);
            } catch (error) {
                console.error("Error fetching reports:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [isSuperAdmin]);

    const handleResolve = async (id: string) => {
        try {
            await updateDoc(doc(db, "reports", id), { status: 'resolved' });
            setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
        } catch (error) {
            console.error("Error resolving report:", error);
            alert("Erro ao resolver relatório.");
        }
    };

    if (authLoading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    if (!isSuperAdmin) return <div className="p-8 text-center">Acesso Negado</div>;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 bg-background min-h-screen text-main">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Bug className="w-8 h-8 text-red-500" />
                        Relatórios de Erros
                    </h1>
                    <p className="text-muted mt-1">Gerencie os bugs reportados pelos usuários.</p>
                </div>
                <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-surface border border-surface-border text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    Voltar
                </Link>
            </header>

            {loading ? (
                <div className="text-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary-light/500" />
                    <p className="mt-4 text-muted">Carregando relatórios...</p>
                </div>
            ) : reports.length === 0 ? (
                <div className="text-center py-20 bg-surface rounded-3xl border border-surface-border">
                    <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Tudo Limpo!</h2>
                    <p className="text-muted">Nenhum relatório de erro encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {reports.map((report) => (
                        <div key={report.id} className={`bg-surface rounded-3xl border ${report.status === 'resolved' ? 'border-green-200 dark:border-green-900/30 opacity-70' : 'border-red-100 dark:border-red-900/30 shadow-sm'} overflow-hidden transition-all`}>
                            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                                {/* Screenshot Preview */}
                                <div className="md:w-1/3 shrink-0">
                                    <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-gray-700 relative group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={report.screenshot} alt="Screenshot" className="w-full h-full object-contain" />
                                        <a
                                            href={report.screenshot}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-white text-sm"
                                        >
                                            Ver Imagem Original
                                        </a>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${report.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'}`}>
                                                    {report.status === 'resolved' ? 'Resolvido' : 'Aberto'}
                                                </span>
                                                <span className="text-xs text-muted flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString() : new Date(report.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-lg leading-snug">{report.description}</h3>
                                        </div>
                                        {report.status !== 'resolved' && (
                                            <button
                                                onClick={() => handleResolve(report.id)}
                                                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center gap-2"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                Resolver
                                            </button>
                                        )}
                                    </div>

                                    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 text-xs space-y-2 font-mono text-muted">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span className="truncate max-w-md" title={report.url}>{report.url}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Monitor className="w-3.5 h-3.5" />
                                            <span className="truncate max-w-md" title={report.userAgent}>{report.userAgent}</span>
                                        </div>
                                        <div className="flex items-center gap-2 border-t border-gray-200 dark:border-slate-700 pt-2 mt-2">
                                            <span className="font-bold text-main">Reportado por:</span>
                                            {report.userName} (ID: {report.userId})
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
