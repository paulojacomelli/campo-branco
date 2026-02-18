"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
    const [loading, setLoading] = useState(true);
    const [visits, setVisits] = useState<any[]>([]);
    const { user, congregationId } = useAuth();


    useEffect(() => {
        if (!addressId) return;
        const fetchHistory = async () => {
            setLoading(true);
            try {
                // Fetch visits from Supabase 'visits' table
                let { data: rawVisits, error } = await supabase
                    .from('visits')
                    .select('*')
                    .eq('address_id', addressId)
                    .order('visit_date', { ascending: false })
                    .limit(50);

                if (error) throw error;
                if (!rawVisits) rawVisits = [];

                // Fetch real names for users
                const userIds = Array.from(new Set(rawVisits.map((v: any) => v.user_id).filter(id => id)));
                const userNamesMap = new Map<string, string>();

                if (userIds.length > 0) {
                    const { data: usersData } = await supabase
                        .from('users')
                        .select('id, name')
                        .in('id', userIds);

                    if (usersData) {
                        usersData.forEach((u: any) => {
                            userNamesMap.set(u.id, u.name);
                        });
                    }
                }

                const mergedVisits = rawVisits.map((v: any) => ({
                    ...v,
                    displayName: userNamesMap.get(v.user_id) || v.publisher_name || 'Publicador'
                }));

                setVisits(mergedVisits);
            } catch (error) {
                console.error("Error fetching history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [addressId, isSharedView, user, congregationId]);

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

    if (!addressId) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface rounded-lg w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
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
                            <div key={visit.id} className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700`}>
                                            {getStatusIcon(visit.status)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white text-sm">{getStatusLabel(visit.status)}</p>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                                                    {visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'Data desconhecida'}
                                                </p>
                                                {/* Tags Snapshot Display */}
                                                {visit.tags_snapshot?.isDeaf && <span title="Surdo"><Ear className="w-3 h-3 text-yellow-600 dark:text-yellow-400" /></span>}
                                                {visit.tags_snapshot?.isMinor && <span title="Menor"><Baby className="w-3 h-3 text-primary dark:text-blue-400" /></span>}
                                                {visit.tags_snapshot?.isStudent && <span title="Estudante"><GraduationCap className="w-3 h-3 text-purple-600 dark:text-purple-400" /></span>}
                                                {visit.tags_snapshot?.isNeurodivergent && <span title="Neurodivergente"><Brain className="w-3 h-3 text-teal-600 dark:text-teal-400" /></span>}
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
                                        &quot;{visit.notes}&quot;
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
