import { X, Calendar } from 'lucide-react';
import UserAvatar from './UserAvatar';
import AssignedUserBadge from './AssignedUserBadge';

interface Assignment {
    id: string;
    listTitle: string;
    assignedName: string;
    assignedTo: string;
    assignedAt?: any;
}

interface TerritoryAssignmentsModalProps {
    territoryName: string;
    assignments: Assignment[];
    onClose: () => void;
}

export default function TerritoryAssignmentsModal({ territoryName, assignments, onClose }: TerritoryAssignmentsModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-surface rounded-lg w-full max-w-sm p-6 shadow-2xl border border-surface-border animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-main">
                        Responsáveis
                        <span className="block text-sm font-medium text-muted mt-1">{territoryName}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 text-muted hover:text-main hover:bg-background rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {assignments.map((assign) => (
                        <div key={assign.id} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-surface-border">
                            <UserAvatar
                                userId={assign.assignedTo}
                                name={assign.assignedName}
                                className="w-10 h-10 shrink-0 text-xs"
                            />
                            <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-main truncate text-sm">
                                    <AssignedUserBadge
                                        userId={assign.assignedTo}
                                        fallbackName={assign.assignedName}
                                    />
                                </h4>
                                <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-[10px] text-muted bg-surface px-2 py-0.5 rounded-md border border-surface-border truncate max-w-fit font-bold">
                                        {assign.listTitle || 'Link Compartilhado'}
                                    </span>
                                    {assign.assignedAt && (
                                        <div className="flex items-center gap-1.5 text-[9px] text-muted font-bold px-1 uppercase tracking-tight">
                                            <Calendar className="w-3 h-3 text-primary-light/500" />
                                            Início: {(() => {
                                                try {
                                                    const d = typeof assign.assignedAt === 'string'
                                                        ? new Date(assign.assignedAt)
                                                        : (assign.assignedAt.toDate ? assign.assignedAt.toDate() : new Date(assign.assignedAt.seconds ? assign.assignedAt.seconds * 1000 : assign.assignedAt));
                                                    return d.toLocaleDateString('pt-BR');
                                                } catch (e) {
                                                    return 'Data inválida';
                                                }
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
