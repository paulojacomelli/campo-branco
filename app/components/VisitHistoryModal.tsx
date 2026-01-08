"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
<<<<<<< HEAD
import { collection, query, orderBy, getDocs, where, documentId, limit } from 'firebase/firestore';
=======
import { collection, query, orderBy, getDocs, where, documentId } from 'firebase/firestore';
>>>>>>> fb656bc073aeaf628b0d3527464291e268349b02
import { useAuth } from '@/app/context/AuthContext';
import {
    X,
    ThumbsUp,
    ThumbsDown,
    Home,
    Hand,
    Loader2,
    Calendar,
    User,
    Ear,
    Baby,
    GraduationCap,
    Brain
} from 'lucide-react';

interface VisitHistoryModalProps {
    addressId: string;
    onClose: () => void;
    address?: string;
    isSharedView?: boolean;
    shareId?: string;
}

export default function VisitHistoryModal({ addressId, onClose, address, isSharedView = false, shareId }: VisitHistoryModalProps) {
    if (!addressId) return null;

    const [loading, setLoading] = useState(true);
    const [visits, setVisits] = useState<any[]>([]);
    const { user, congregationId } = useAuth();

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                if (isSharedView) {
                    // Client-side fetch for shared view (Direct Firestore)
                    // We rely on Firestore Security Rules to validate the shareId and allow read.
                    // Ideally we should filter by valid visits or limit fields, but for now matching the API behavior.

                    const q = query(
                        collection(db, "addresses", addressId, "visits"),
                        orderBy("date", "desc"),
                        limit(50)
                    );

                    const snapshot = await getDocs(q);
                    const rawVisits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // Anonymize or format names for shared view
                    const enrichedVisits = rawVisits.map((v: any) => ({
                        ...v,
                        displayName: v.userName || 'Publicador'
                    }));

                    setVisits(enrichedVisits);
                } else {
                    // Client-side Firestore fetch for logged-in users
                    if (!user || !congregationId) return;

                    const q = query(
                        collection(db, "addresses", addressId, "visits"),
                        where("congregationId", "==", congregationId),
                        orderBy("date", "desc")
                    );
                    const snapshot = await getDocs(q);
                    const rawVisits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // Fetch real names for users
                    const userIds = Array.from(new Set(rawVisits.map((v: any) => v.userId).filter(id => id && id !== 'anon')));
                    const userNamesMap = new Map<string, string>();

                    if (userIds.length > 0) {
                        const userQ = query(collection(db, "users"), where(documentId(), "in", userIds.slice(0, 30)));
                        const userSnap = await getDocs(userQ);
                        userSnap.docs.forEach(d => {
                            const data = d.data();
                            userNamesMap.set(d.id, data.profileName || data.name || data.displayName);
                        });
                    }

                    const mergedVisits = rawVisits.map((v: any) => ({
                        ...v,
                        displayName: userNamesMap.get(v.userId) || v.userName || 'Publicador'
                    }));

                    setVisits(mergedVisits);
                }
            } catch (error) {
                console.error("Error fetching history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [addressId, isSharedView]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'contacted': return <ThumbsUp className="w-4 h-4 text-green-600" />;
            case 'not_contacted': return <ThumbsDown className="w-4 h-4 text-red-600" />;
            case 'moved': return <Home className="w-4 h-4 text-orange-600" />;
            case 'do_not_visit': return <Hand className="w-4 h-4 text-purple-600" />;
            default: return <div className="w-4 h-4 bg-gray-200 rounded-full" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'contacted': return 'Contatado';
            case 'not_contacted': return 'Não Contatado';
            case 'moved': return 'Mudou-se';
            case 'do_not_visit': return 'Não Visitar';
            default: return status;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Histórico</h2>
                        {address && <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate max-w-[200px]">{address}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary-light/500" /></div>
                    ) : visits.length === 0 ? (
                        <div className="text-center py-8 opacity-50">
                            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum registro encontrado.</p>
                        </div>
                    ) : (
                        visits.map((visit) => (
                            <div key={visit.id} className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700`}>
                                            {getStatusIcon(visit.status)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white text-sm">{getStatusLabel(visit.status)}</p>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                                                    {visit.date?.seconds ? new Date(visit.date.seconds * 1000).toLocaleDateString() : 'Data desconhecida'}
                                                </p>
                                                {/* Tags Snapshot Display */}
                                                {visit.tagsSnapshot?.isDeaf && <span title="Surdo"><Ear className="w-3 h-3 text-yellow-600 dark:text-yellow-400" /></span>}
                                                {visit.tagsSnapshot?.isMinor && <span title="Menor"><Baby className="w-3 h-3 text-primary dark:text-blue-400" /></span>}
                                                {visit.tagsSnapshot?.isStudent && <span title="Estudante"><GraduationCap className="w-3 h-3 text-purple-600 dark:text-purple-400" /></span>}
                                                {visit.tagsSnapshot?.isNeurodivergent && <span title="Neurodivergente"><Brain className="w-3 h-3 text-teal-600 dark:text-teal-400" /></span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] bg-white dark:bg-slate-800 px-2 py-1 rounded-full text-gray-500 dark:text-gray-400 font-bold border border-gray-200 dark:border-slate-700">
                                        <User className="w-3 h-3" />
                                        <span className="truncate max-w-[80px] uppercase tracking-wider">{visit.displayName}</span>
                                    </div>
                                </div>
                                {visit.notes && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 p-2 rounded-lg border border-gray-200 dark:border-slate-700 mt-2 italic">
                                        "{visit.notes}"
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
