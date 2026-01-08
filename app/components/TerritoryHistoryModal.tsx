"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import {
    X,
    History,
    User,
    Calendar,
    Clock,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

interface TerritoryHistoryModalProps {
    territoryId: string;
    territoryName: string;
    onClose: () => void;
}

interface HistoryEntry {
    id: string;
    createdBy: string;
    userName?: string;
    createdAt: any;
    returnedAt: any;
    status: string;
}

export default function TerritoryHistoryModal({ territoryId, territoryName, onClose }: TerritoryHistoryModalProps) {
    const { congregationId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                if (!congregationId) return;

                // Query shared_lists where the items array contains this territoryId
                // AND it belongs to the user's congregation
                const q = query(
                    collection(db, "shared_lists"),
                    where("items", "array-contains", territoryId),
                    where("congregationId", "==", congregationId)
                );

                const snapshot = await getDocs(q);
                console.log(`[History] Found ${snapshot.size} records for territory ${territoryId}`);

                const entries: HistoryEntry[] = [];

                // Fetch user names for each entry
                const userCache: Record<string, string> = {};

                for (const d of snapshot.docs) {
                    const data = d.data();
                    const assignedId = data.assignedTo;
                    const assignedNameVal = data.assignedName;

                    let userName = 'Não atribuído';

                    // Priority 1: assignedName directly from data (snapshot of time)
                    if (assignedNameVal) {
                        userName = assignedNameVal;
                    }
                    // Priority 2: resolve assignedTo ID
                    else if (assignedId) {
                        if (userCache[assignedId]) {
                            userName = userCache[assignedId];
                        } else {
                            try {
                                const userDoc = await getDoc(doc(db, "users", assignedId));
                                if (userDoc.exists()) {
                                    userName = userDoc.data().name || 'Usuário Sem Nome';
                                    userCache[assignedId] = userName;
                                }
                            } catch (e) {
                                console.warn("Error fetching user", assignedId);
                            }
                        }
                    }

                    entries.push({
                        id: d.id,
                        createdBy: data.createdBy,
                        userName,
                        createdAt: data.createdAt,
                        returnedAt: data.returnedAt,
                        status: data.status || 'active'
                    });
                }

                // Sort in memory by createdAt descending
                entries.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });

                setHistory(entries);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching territory history:", error);
                setLoading(false);
            }
        };

        fetchHistory();
    }, [territoryId, congregationId]);

    const formatDate = (ts: any) => {
        if (!ts) return 'N/A';
        const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-main">Histórico do Território</h2>
                        <p className="text-sm text-muted font-medium">{territoryName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-background rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-light/500" />
                            <p className="text-sm text-muted font-medium">Carregando histórico...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12 opacity-50 bg-background rounded-2xl border-2 border-dashed border-surface-border">
                            <History className="w-12 h-12 mx-auto mb-3 text-muted" />
                            <p className="text-muted font-medium">Nenhum registro de fechamento encontrado.</p>
                        </div>
                    ) : (
                        history.map((entry) => (
                            <div key={entry.id} className="bg-background p-5 rounded-2xl border border-surface-border shadow-sm hover:border-primary-light/500/30 transition-all">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-primary-light/50 dark:bg-primary-light/500/10 rounded-xl flex items-center justify-center text-primary dark:text-blue-400 shadow-sm">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none mb-1">Responsável</p>
                                        <p className="font-bold text-main truncate">{entry.userName}</p>
                                    </div>
                                    <div className="ml-auto">
                                        {entry.status === 'completed' ? (
                                            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">Concluído</span>
                                        ) : (
                                            <span className="bg-primary-light dark:bg-blue-900/30 text-primary-dark dark:text-blue-400 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">Em andamento</span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-border">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-muted">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Início</span>
                                        </div>
                                        <p className="text-sm font-bold text-main pl-5">{formatDate(entry.createdAt)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-muted">
                                            <CheckCircle2 className={`w-3.5 h-3.5 ${entry.status === 'completed' ? 'text-green-500' : 'text-muted'}`} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Devolução</span>
                                        </div>
                                        <p className="text-sm font-bold text-main pl-5">{entry.status === 'completed' ? formatDate(entry.returnedAt) : 'Pendente'}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-surface-border shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full bg-gray-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-gray-200 dark:shadow-none"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
