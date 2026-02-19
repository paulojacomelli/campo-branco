"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { Loader2, Shield, Save } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

interface UserProfile {
    id: string;
    email: string;
    roles?: string[]; // Array support
    role?: string; // Legacy support
    name?: string;
    provider?: string;
}

const ROLE_DEFINITIONS = [
    { label: 'Publicador', value: 'PUBLICADOR', weight: 1 },
    { label: 'Servo de Territórios', value: 'SERVO', weight: 2 },
    { label: 'Superintendente de Serviço', value: 'ANCIAO', weight: 3 },
    { label: 'SUPER_ADMIN', value: 'SUPER_ADMIN', weight: 4 },
];

export default function UserManagementList({ congregationId }: { congregationId?: string | null }) {
    const { user: currentUser, isSuperAdmin, isElder } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Staging changes: { userId: Set<string> }
    const [pendingChanges, setPendingChanges] = useState<Record<string, Set<string>>>({});

    useEffect(() => {
        let q;
        if (congregationId) {
            q = query(collection(db, 'users'), where('congregationId', '==', congregationId), orderBy('name'));
        } else {
            q = query(collection(db, 'users'), orderBy('name'));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => {
                const d = doc.data();
                // Normalize roles on fetch for consistent UI
                let normalizedRoles: string[] = [];
                if (Array.isArray(d.roles)) normalizedRoles = d.roles;
                else if (d.role) normalizedRoles = [d.role];
                else normalizedRoles = ['PUBLICADOR'];

                return {
                    id: doc.id,
                    ...d,
                    roles: normalizedRoles
                };
            }) as UserProfile[];
            setUsers(usersData);
            setLoadingData(false);
        }, (error) => {
            console.error("Error fetching users: ", error);
            setLoadingData(false);
        });
        return () => unsubscribe();
    }, [congregationId]);

    const canAssignRole = (targetRole: string): boolean => {
        if (isSuperAdmin) return true;
        if (isElder) {
            // Elders can assign Publicador and Servo, but NOT Anciao or Super Admin
            return ['PUBLICADOR', 'SERVO'].includes(targetRole);
        }
        return false;
    };

    const toggleRole = (userId: string, currentRoles: string[], roleToToggle: string) => {
        // Initialize pending state if not exists
        const userPending = pendingChanges[userId]
            ? new Set(pendingChanges[userId])
            : new Set(currentRoles);

        if (userPending.has(roleToToggle)) {
            userPending.delete(roleToToggle);
            // Ensure at least PUBLICADOR remains if logic dictates, though Firestore allows empty.
            // Let's enforce implicit PUBLICADOR usually, but flexibility is key.
        } else {
            userPending.add(roleToToggle);
        }

        setPendingChanges(prev => ({ ...prev, [userId]: userPending }));
    };

    const handleSaveChanges = async (userId: string) => {
        const newRoles = Array.from(pendingChanges[userId]);
        setUpdatingId(userId);

        try {
            const userRef = doc(db, 'users', userId);

            // Calculate legacy 'role' string (highest weight) for backward compat
            let highestRole = 'PUBLICADOR';
            let maxWeight = 0;

            newRoles.forEach(r => {
                const def = ROLE_DEFINITIONS.find(d => d.value === r);
                if (def && def.weight > maxWeight) {
                    maxWeight = def.weight;
                    highestRole = r;
                }
            });

            await updateDoc(userRef, {
                roles: newRoles,
                role: highestRole // Keep syncing legacy field
            });

            // Clear pending
            setPendingChanges(prev => {
                const newState = { ...prev };
                delete newState[userId];
                return newState;
            });

        } catch (error) {
            console.error("Error updating roles:", error);
            alert("Erro ao salvar permissões.");
        } finally {
            setUpdatingId(null);
        }
    };

    if (loadingData) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Usuário</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/2">Funções (Multisseleção)</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map((u) => {
                            const currentRoles = u.roles || [];
                            const pendingForUser = pendingChanges[u.id];
                            const displayRoles = pendingForUser ? Array.from(pendingForUser) : currentRoles;
                            const hasChanges = !!pendingForUser;

                            return (
                                <tr key={u.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary-light/50 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                                {u.email ? u.email.substring(0, 2).toUpperCase() : '??'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm whitespace-nowrap">{u.name || 'Sem nome'}</p>
                                                <p className="text-xs text-gray-500 truncate max-w-[150px]">{u.email}</p>
                                                {/* Labels */}
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {displayRoles.map(r => (
                                                        <span key={r} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase
                                                            ${r === 'SUPER_ADMIN' ? 'bg-red-100 text-red-700' :
                                                                r === 'ANCIAO' ? 'bg-purple-100 text-purple-700' :
                                                                    r === 'SERVO' ? 'bg-primary-light text-primary-dark' :
                                                                        'bg-green-100 text-green-700'}
                                                        `}>
                                                            {ROLE_DEFINITIONS.find(def => def.value === r)?.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="grid grid-cols-2 gap-2">
                                            {ROLE_DEFINITIONS.filter(d => ['PUBLICADOR', 'SERVO'].includes(d.value)).map((def) => {
                                                const isAssigned = displayRoles.includes(def.value);
                                                const allowed = canAssignRole(def.value);

                                                return (
                                                    <label
                                                        key={def.value}
                                                        className={`flex items-center p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer
                                                            ${isAssigned ? 'bg-primary-light/50 border-blue-200 text-primary-dark' : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'}
                                                            ${!allowed ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''}
                                                        `}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isAssigned}
                                                            onChange={() => toggleRole(u.id, currentRoles, def.value)}
                                                            disabled={!allowed}
                                                            className="w-4 h-4 rounded text-primary focus:ring-primary-light/500 border-gray-300 mr-2"
                                                        />
                                                        {def.label}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-middle text-center">
                                        {updatingId === u.id ? (
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                                        ) : (
                                            hasChanges && (
                                                <button
                                                    onClick={() => handleSaveChanges(u.id)}
                                                    className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-xl shadow-lg shadow-green-500/20 transition-all active:scale-95 mx-auto flex"
                                                    title="Salvar Alterações"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                            )
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
