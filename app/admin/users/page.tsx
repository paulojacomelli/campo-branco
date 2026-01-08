"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
    Shield,
    User,
    Loader2,
    Search,
    Settings2,
    Building2,
    Mail,
    MoreVertical,
    ChevronLeft,
    Plus,
    Trash2,
    X,
    Pencil,
    Users,
    CheckCircle2,
    HelpCircle,
    Wand2,
    RefreshCw
} from 'lucide-react';
import HelpModal from '@/app/components/HelpModal';
import Link from 'next/link';
import BottomNav from '@/app/components/BottomNav';

interface UserProfile {
    id: string;
    email: string;
    role: string;
    roles?: string[];
    name?: string;
    provider?: string;
    congregationId?: string;
}

interface Congregation {
    id: string;
    name: string;
}

const ROLE_DEFINITIONS = [
    { label: 'Publicador', value: 'PUBLICADOR', color: 'bg-green-100 text-green-700' },
    { label: 'Servo (Servo de territórios)', value: 'SERVO', color: 'bg-primary-light text-primary-dark' },
    { label: 'Ancião (Superintendente de Serviço)', value: 'ANCIAO', color: 'bg-purple-100 text-purple-700' },
    { label: 'Superadmin', value: 'SUPER_ADMIN', color: 'bg-red-100 text-red-700' },
];

export default function SuperAdminUsersPage() {
    const { user, isSuperAdmin, isElder, congregationId, loading } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [congregations, setCongregations] = useState<Congregation[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [editName, setEditName] = useState<string>('');
    const [editRoles, setEditRoles] = useState<string[]>([]);
    const [editCongId, setEditCongId] = useState<string>('');
    const [newUser, setNewUser] = useState({ name: '', email: '', congregationId: '' });
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (!isElder) { // Allow Elders
                router.push('/dashboard');
            } else {
                // Fetch Congregations
                const qCong = query(collection(db, 'congregations'), orderBy('name'));
                const unsubCong = onSnapshot(qCong, (snapshot) => {
                    const congData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        name: doc.data().name
                    })) as Congregation[];
                    setCongregations(congData);
                });

                // Fetch Users
                // If SuperAdmin, fetch all. If Elder, filter by congregationId (client-side for now or simple query)
                // Note: Ideally complex queries should be indexed. For now let's fetch and filter or use basic where if we had index.
                // Given the small scale, fetching all and filtering in memory is okay, OR using a where clause.
                // However, firestore.rules might block reading ALL users if we strictly enforced it. 
                // Since I allowed read for all auth users in rules, we can fetch all and filter client side or use a query.
                // Let's use a query for better practice if possible, but 'orderBy name' + 'where congregationId' requires index.
                // To avoid index creation hassle for user right now, let's fetch all and filter in memory, 
                // UNLESS the listing is huge. 
                // Update: Let's try to just fetch all for now as per current logic, and filter `filteredUsers`.

                const usersCollection = collection(db, 'users');
                let q = query(usersCollection, orderBy('name'));

                // Apply filter if not Super Admin to match Firestore rules
                if (!isSuperAdmin && congregationId) {
                    q = query(usersCollection, where('congregationId', '==', congregationId), orderBy('name'));
                }

                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const usersData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as UserProfile[];

                    setUsers(usersData);
                    setLoadingData(false);
                }, (error) => {
                    console.error("Error in users snapshot:", error);
                    setLoadingData(false);
                });

                return () => {
                    unsubscribe();
                    unsubCong();
                };
            }
        }
    }, [user, isSuperAdmin, isElder, congregationId, loading, router]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);


    const handleSaveUser = async () => {
        if ((!isSuperAdmin && !isElder) || !editingUser) return;

        // Security Check: Elders can only edit users in their own congregation
        if (!isSuperAdmin && editingUser.congregationId !== congregationId) {
            alert("Você só pode editar usuários da sua própria congregação.");
            return;
        }

        // Security Check: Elders cannot edit Super Admins or promote to Super Admin
        if (!isSuperAdmin) {
            if (editingUser.role === 'SUPER_ADMIN' || editingUser.roles?.includes('SUPER_ADMIN')) {
                alert("Você não pode editar um Super Admin.");
                return;
            }
            if (editRoles.includes('SUPER_ADMIN')) {
                alert("Você não pode promover alguém a Super Admin.");
                return;
            }
        }

        setUpdatingId(editingUser.id);
        try {
            const userRef = doc(db, 'users', editingUser.id);

            const legacyRole = editRoles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' :
                editRoles.includes('ANCIAO') ? 'ANCIAO' :
                    editRoles.includes('SERVO') ? 'SERVO' : 'PUBLICADOR';

            await updateDoc(userRef, {
                name: editName,
                roles: editRoles,
                role: legacyRole,
                congregationId: editCongId || null
            });
            setShowEditModal(false);
        } catch (error) {
            console.error("Error saving user: ", error);
            alert("Erro ao salvar alterações.");
        } finally {
            setUpdatingId(null);
        }
    };

    const selectRoleLocal = (targetRole: string) => {
        setEditRoles([targetRole]);
    };

    const handleDeleteUser = async (userId: string) => {
        if (!isSuperAdmin && !isElder) {
            alert("Você não tem permissão para excluir usuários.");
            return;
        }

        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return;

        // Security Check: Elders can only delete users in their own congregation
        if (!isSuperAdmin && targetUser.congregationId !== congregationId) {
            alert("Você só pode excluir usuários da sua própria congregação.");
            return;
        }

        // Security Check: Elders Cannot delete Super Admins
        if (targetUser.role === 'SUPER_ADMIN' && !isSuperAdmin) {
            alert("Apenas Super Admins podem excluir outros Super Admins.");
            return;
        }

        if (!confirm('Tem certeza que deseja excluir este usuário definitivamente? Esta ação não pode ser desfeita.')) return;

        setUpdatingId(userId);
        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'users', userId));
        } catch (error) {
            console.error("Error deleting user: ", error);
            alert("Erro ao excluir usuário.");
        } finally {
            setUpdatingId(null);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isSuperAdmin && !isElder) return;

        setLoadingData(true);
        try {
            const { setDoc, serverTimestamp } = await import('firebase/firestore');
            // Using email as part of a temporary logic or just a random ID (Firestore will generate if we use addDoc, but let's use a nice pattern if possible)
            // For now, let's use a simple addDoc approach but since we don't have it imported, we use setDoc with a collection-based ID
            const newId = `user_${Date.now()}`;
            await setDoc(doc(db, 'users', newId), {
                name: newUser.name,
                email: newUser.email,
                congregationId: isSuperAdmin ? (newUser.congregationId || null) : congregationId, // Force congregation for Elders
                role: 'PUBLICADOR',
                roles: ['PUBLICADOR'],
                createdAt: serverTimestamp(),
                provider: 'manual'
            });
            setShowCreateModal(false);
            setNewUser({ name: '', email: '', congregationId: '' });
        } catch (error) {
            console.error("Error creating user: ", error);
            alert("Erro ao criar usuário. Verifique se o e-mail é válido.");
        } finally {
            setLoadingData(false);
        }
    };

    const handlePopulateData = async () => {
        if (!isSuperAdmin) return;
        if (!confirm("Isso vai atribuir nomes e congregações fictícios para usuários com dados faltando. Continuar?")) return;

        setLoadingData(true);
        try {
            const { updateDoc, doc } = await import('firebase/firestore');
            const dummyNames = ["João Silva", "Maria Oliveira", "Carlos Santos", "Ana Souza", "Pedro Costa", "Lucas Ferreira", "Juliana Alves", "Marcos Lima", "Fernanda Santos", "Ricardo Almeida"];

            let updatedCount = 0;
            const updates = users.map(async (u, index) => {
                const needsName = !u.name || u.name === 'Sem nome';
                const needsCong = !u.congregationId && congregations.length > 0;

                if (needsName || needsCong) {
                    const updateData: any = {};
                    if (needsName) updateData.name = dummyNames[index % dummyNames.length];
                    if (needsCong) updateData.congregationId = congregations[index % congregations.length].id;
                    if (!u.role) updateData.role = 'PUBLICADOR';

                    await updateDoc(doc(db, 'users', u.id), updateData);
                    updatedCount++;
                }
            });

            await Promise.all(updates);
            if (updatedCount > 0) alert(`${updatedCount} usuários atualizados com dados fictícios!`);
            else alert("Nenhum usuário precisava de dados.");

        } catch (error) {
            console.error("Error populating data:", error);
            alert("Erro ao popular dados.");
        } finally {
            setLoadingData(false);
        }
    };

    // Filter logic
    const filteredUsers = users.filter(u =>
    (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading || (user && !isElder && !loading)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        );
    }

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
                            <h1 className="text-xl font-bold text-main tracking-tight">Gerenciar Usuários</h1>
                            <p className="text-xs text-muted font-medium">{isSuperAdmin ? 'Controle de acesso global' : 'Membros da Congregação'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 shadow-lg shadow-primary-light/500/30 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            Novo Usuário
                        </button>
                        <button
                            onClick={() => setIsHelpOpen(true)}
                            className="p-1.5 text-muted hover:text-primary hover:bg-primary-light/50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                            title="Ajuda"
                        >
                            <HelpCircle className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <HelpModal
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
                title="Lista de Membros"
                description="Gerencie os usuários da sua congregação e seus níveis de acesso."
                steps={[
                    { title: "Funções", text: "Ancião (gerencia usuários), Servo (cuida dos mapas) e Publicador (visualiza e relata)." },
                    { title: "Vincular", text: "Certifique-se de que cada membro esteja na congregação correta para ver os dados certos." },
                    { title: "Edição", text: "Use o menu de três pontos para mudar o nome ou o cargo de um irmão." }
                ]}
                tips={[
                    "Novos usuários que entrarem via Google precisam ter o cargo definido por você para acessar o sistema.",
                    "Somente Anciãos podem gerenciar os membros da própria congregação."
                ]}
            />

            <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

                {/* Search & Summary */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-surface-border rounded-2xl py-3.5 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all text-sm font-medium text-main placeholder-muted"
                        />
                    </div>
                    <div className="flex items-center gap-3 bg-primary-light/50 dark:bg-blue-900/20 px-4 py-2 rounded-xl border border-primary-light dark:border-blue-800">
                        <Users className="w-5 h-5 text-primary dark:text-blue-400" />
                        <span className="text-sm font-bold text-primary-dark dark:text-blue-300">{users.length} usuários</span>
                    </div>
                </div>

                {loadingData ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-muted font-bold animate-pulse uppercase tracking-widest text-[10px]">Carregando Usuários</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredUsers.length === 0 ? (
                            <div className="bg-surface rounded-3xl p-12 text-center border border-dashed border-surface-border">
                                <Search className="w-12 h-12 text-muted mx-auto mb-4" />
                                <p className="text-muted font-bold">Nenhum usuário encontrado</p>
                                <p className="text-xs text-muted mt-1">Tente outro termo de busca</p>
                            </div>
                        ) : (
                            filteredUsers.map((u) => (
                                <div key={u.id} className="bg-surface rounded-2xl p-5 border border-surface-border shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-primary-light/50 dark:bg-blue-900/20 flex items-center justify-center text-primary dark:text-blue-400 shadow-inner group-hover:scale-110 transition-transform">
                                            <User className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-main">{u.name || 'Sem nome'}</h3>
                                                {u.provider === 'google.com' && <span className="text-[10px] bg-primary-light/50 dark:bg-blue-900/30 text-primary dark:text-blue-300 px-1.5 py-0.5 rounded font-bold uppercase">Google</span>}
                                            </div>
                                            <div className="flex flex-col gap-0.5 mt-1">
                                                <div className="flex items-center gap-1.5 text-muted text-[11px]">
                                                    <Mail className="w-3 h-3" />
                                                    <span>{u.email}</span>
                                                </div>
                                                {u.congregationId && (
                                                    <div className="flex items-center gap-1.5 text-primary-light/500/70 dark:text-blue-400/70 text-[11px] font-bold uppercase tracking-wider">
                                                        <Building2 className="w-3 h-3" />
                                                        <span>{congregations.find(c => c.id === u.congregationId)?.name || 'Congregação não encontrada'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                                        {/* Simplified Status Label */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {(u.roles || [u.role]).map(role => (
                                                <span key={role} className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${ROLE_DEFINITIONS.find(r => r.value === role)?.color || 'bg-gray-100 dark:bg-gray-800 text-muted'}`}>
                                                    {ROLE_DEFINITIONS.find(r => r.value === role)?.label || role}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === u.id ? null : u.id);
                                                }}
                                                className="p-2 text-muted hover:text-main hover:bg-background rounded-full transition-all"
                                            >
                                                <MoreVertical className="w-5 h-5" />
                                            </button>

                                            {openMenuId === u.id && (
                                                <div className="absolute right-0 top-10 bg-surface rounded-xl shadow-xl border border-surface-border p-1 z-20 min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
                                                    <button
                                                        onClick={() => {
                                                            setEditingUser(u);
                                                            setEditName(u.name || '');
                                                            setEditRoles(u.roles || [u.role] || ['PUBLICADOR']);
                                                            setEditCongId(u.congregationId || '');
                                                            setShowEditModal(true);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-muted hover:bg-primary-light/50 dark:hover:bg-blue-900/20 hover:text-primary dark:hover:text-blue-400 rounded-lg transition-colors w-full text-left"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleDeleteUser(u.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors w-full text-left"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Excluir
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {updatingId === u.id && (
                                            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[2px] rounded-2xl flex items-center justify-center z-10">
                                                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </main>

            {/* Create User Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-surface w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-main tracking-tight">Novo Usuário</h2>
                                    <p className="text-sm text-muted font-medium tracking-tight">Adicione manualmente um novo membro.</p>
                                </div>
                                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-background rounded-full transition-colors">
                                    <X className="w-6 h-6 text-muted" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Nome</label>
                                    <input
                                        required
                                        type="text"
                                        value={newUser.name}
                                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                        className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all text-main placeholder-muted"
                                        placeholder="Nome do publicador"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">E-mail de Acesso</label>
                                    <input
                                        required
                                        type="email"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all text-main placeholder-muted"
                                        placeholder="exemplo@gmail.com"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Congregação Inicial</label>
                                    <select
                                        value={newUser.congregationId}
                                        onChange={(e) => setNewUser({ ...newUser, congregationId: e.target.value })}
                                        disabled={!isSuperAdmin} // Lock for Elders
                                        className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all disabled:opacity-50 text-main"
                                    >
                                        <option value="">{isSuperAdmin ? "Sem vínculo inicial" : "Minha Congregação"}</option>
                                        {congregations
                                            .filter(c => isSuperAdmin || c.id === congregationId) // Show only relevant
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                    </select>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 bg-background hover:bg-surface-highlight text-muted hover:text-main border border-surface-border font-bold py-3.5 rounded-2xl transition-all active:scale-95"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loadingData}
                                        className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-primary-light/500/30 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {loadingData ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Criar Usuário'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Edit User Modal */}
            {
                showEditModal && editingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-surface w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-main tracking-tight">Editar Usuário</h2>
                                    <p className="text-sm text-muted font-medium tracking-tight">Gerencie as permissões e dados de {editingUser.name || 'usuário'}.</p>
                                </div>
                                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-background rounded-full transition-colors">
                                    <X className="w-6 h-6 text-muted" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Name Section */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Nome</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all text-main"
                                        placeholder="Nome do membro"
                                    />
                                </div>

                                {/* Congregation Section */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5" /> Congregação
                                    </label>
                                    <select
                                        value={editCongId}
                                        onChange={(e) => setEditCongId(e.target.value)}
                                        disabled={!isSuperAdmin} // Lock for Elders
                                        className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary-light/500/20 focus:border-primary-light/500 transition-all disabled:opacity-50 text-main"
                                    >
                                        <option value="">{isSuperAdmin ? "Sem vínculo" : "Minha Congregação"}</option>
                                        {congregations
                                            .filter(c => isSuperAdmin || c.id === congregationId)
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                    </select>
                                </div>

                                {/* Roles Section */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Shield className="w-3.5 h-3.5" /> Função (Nível de Acesso)
                                    </label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {ROLE_DEFINITIONS.map(role => {
                                            const isActive = editRoles.includes(role.value);
                                            return (
                                                <button
                                                    key={role.value}
                                                    onClick={() => selectRoleLocal(role.value)}
                                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-95
                                                    ${isActive ? 'border-primary-light/500 bg-primary-light/50 dark:bg-blue-900/20 text-primary-dark dark:text-blue-300' : 'border-surface-border bg-background text-muted hover:border-gray-300 dark:hover:border-gray-600'}
                                                `}
                                                >
                                                    <span className="text-sm font-bold">{role.label}</span>
                                                    {isActive && <CheckCircle2 className="w-5 h-5 animate-in zoom-in duration-200" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveUser}
                                    disabled={updatingId === editingUser.id}
                                    className="w-full bg-main text-surface-highlight font-bold py-4 rounded-2xl shadow-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {updatingId === editingUser.id ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Concluir Edição'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <BottomNav />
        </div >
    );
}
