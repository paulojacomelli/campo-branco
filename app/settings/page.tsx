"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/app/context/AuthContext';
import { db, auth } from '@/lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
    LogOut,
    User,
    Settings,
    Shield,
    Scale,
    Users,
    Building2,
    Save,
    Loader2,
    BarChart3,
    Map as MapIcon,
    FileText,
    Pencil,
    X,
    Database,
    Eye,
    Bell,
    Minus,
    Plus,
    Type,
    Monitor,
    MoreVertical,
    UserMinus,
    Moon,
    Sun,
    Clock,
    Smartphone,
    Info,
    Mail,
    Github,
    Trash2,
} from 'lucide-react';
import Link from 'next/link';
import NotificationToggle from '@/app/components/NotificationToggle';
import { useTheme, ThemeMode } from '@/app/context/ThemeContext';

import BottomNav from '@/app/components/BottomNav';
import { APP_VERSION } from '@/lib/version';


export default function SettingsPage() {
    const { user, isAdmin, isSuperAdmin, isElder, isServant, congregationId, loading, profileName, role, simulateRole, isSimulating } = useAuth();
    const router = useRouter();
    const { textSize, displayScale, themeMode, updatePreferences } = useTheme();

    const changeTextSize = (delta: number) => {
        const newSize = Math.max(12, Math.min(24, textSize + delta));
        updatePreferences(newSize, displayScale, themeMode);
    };

    const changeScale = (delta: number) => {
        const newScale = Math.max(0.7, Math.min(1.5, Number((displayScale + delta).toFixed(2))));
        updatePreferences(textSize, newScale, themeMode);
    };

    const changeTheme = (mode: ThemeMode) => {
        updatePreferences(textSize, displayScale, mode);
    }

    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [saving, setSaving] = useState(false);

    // Member Management State
    const [members, setMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState('');
    const [inviteToken, setInviteToken] = useState('');
    const [generatingToken, setGeneratingToken] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    // Redirect Unassigned Users
    useEffect(() => {
        if (!loading && user && !congregationId && !isSuperAdmin) {
            router.push('/unassigned');
        }
    }, [user, loading, congregationId, isSuperAdmin, router]);

    useEffect(() => {
        if (typeof window !== 'undefined' && congregationId) {
            // Initially just show loading or default
            // Real update happens when we fetch the token
        }
    }, [congregationId]);

    useEffect(() => {
        if ((isElder || isServant) && congregationId) {
            const fetchCongregationAndMembers = async () => {
                setMembersLoading(true);
                try {
                    const { collection, query, where, getDocs, doc, getDoc, updateDoc } = await import('firebase/firestore');

                    // 1. Fetch Members (Only Elders can manage members, but we can fetch them for display or just skip)
                    // Invite Link is separate from member display management.
                    // Let's fetch members only if Elder, OR if we want to show registries.
                    // User request says "Servant can send invite link".

                    let docs: any[] = [];
                    if (isElder) {
                        const qMembers = query(collection(db, "users"), where("congregationId", "==", congregationId));
                        const snapMembers = await getDocs(qMembers);
                        docs = snapMembers.docs.map(d => ({ id: d.id, ...d.data() }));
                        if (!isSuperAdmin) {
                            docs = docs.filter((d: any) => d.role !== 'SUPER_ADMIN');
                        }
                    }
                    setMembers(docs);

                    // 2. Fetch Congregation for Token
                    const congDocRef = doc(db, "congregations", congregationId);
                    const congSnap = await getDoc(congDocRef);

                    if (congSnap.exists()) {
                        const data = congSnap.data();
                        let token = data.inviteToken;

                        // If no token exists, auto-generate one for backward compatibility/initial setup
                        if (!token) {
                            token = crypto.randomUUID(); // Secure random string
                            await updateDoc(congDocRef, { inviteToken: token });
                        }

                        setInviteToken(token);
                        setInviteLink(`${window.location.origin}/invite?token=${token}`);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setMembersLoading(false);
                }
            };
            fetchCongregationAndMembers();
        }
    }, [isElder, isServant, congregationId, isSuperAdmin]);

    const handleGenerateNewToken = async () => {
        if (!confirm("Isso invalidará o link de convite anterior. Deseja continuar?")) return;

        setGeneratingToken(true);
        try {
            const { updateDoc, doc } = await import('firebase/firestore');
            const newToken = crypto.randomUUID();

            await updateDoc(doc(db, "congregations", congregationId!), {
                inviteToken: newToken
            });

            setInviteToken(newToken);
            setInviteLink(`${window.location.origin}/invite?token=${newToken}`);
            alert("Novo link gerado com sucesso!");
        } catch (e) {
            console.error(e);
            alert("Erro ao gerar novo link.");
        } finally {
            setGeneratingToken(false);
        }
    };

    const handlePromote = async (uid: string, currentRole: string) => {
        if (!confirm("Confirmar alteração de função?")) return;
        try {
            const { updateDoc, doc } = await import('firebase/firestore');
            const newRole = currentRole === 'SERVO' ? 'PUBLICADOR' : 'SERVO';
            await updateDoc(doc(db, "users", uid), { role: newRole });
            setMembers(prev => prev.map(m => m.id === uid ? { ...m, role: newRole } : m));
        } catch (e) {
            alert("Erro ao alterar função");
        }
    };

    const handleRemove = async (uid: string) => {
        if (!confirm("Remover este usuário da congregação? Ele perderá acesso aos dados.")) return;
        try {
            const { updateDoc, doc } = await import('firebase/firestore');
            await updateDoc(doc(db, "users", uid), { congregationId: null, role: 'PUBLICADOR' });
            setMembers(prev => prev.filter(m => m.id !== uid));
        } catch (e) {
            alert("Erro ao remover usuário");
        }
    };



    const handleSaveProfile = async () => {
        // ... (existing code)
        // (keeping existing logic - truncated for brevity in replacement if not modifying inner)
        if (!user || !user.email) return;
        setSaving(true);
        try {
            // Import firestore functions
            const { collection, getDocs, doc, setDoc } = await import('firebase/firestore');

            // 1. Find user by email (Query instead of List All to satisfy security rules)
            // Note: This matches exact email. If we need case-insensitive, we rely on the implementation plan
            // or we accept that non-admins can only find their exact email match.
            const { query, where } = await import('firebase/firestore');
            const userEmail = user.email;

            // Query for the specific email. This is allowed by the security rule:
            // resource.data.email == request.auth.token.email
            const q = query(collection(db, 'users'), where('email', '==', userEmail));
            const querySnapshot = await getDocs(q);

            const matchedDocs = querySnapshot.docs; // Should be just one, or zero if casing differs significantly

            if (matchedDocs.length > 0) {
                // Update ALL matching documents found
                const updates = matchedDocs.map(d =>
                    setDoc(d.ref, {
                        name: editName,
                        email: editEmail
                    }, { merge: true })
                );
                await Promise.all(updates);
            } else {
                // If really not found, create/update by Auth UID
                await setDoc(doc(db, 'users', user.uid), {
                    name: editName,
                    email: editEmail,
                    // Ensure role is preserved if merging, otherwise defaults
                }, { merge: true });
            }

            // 2. Update Firebase Auth Profile
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: editName
                });
            }

            setShowEditModal(false);
            window.location.reload();
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Erro ao atualizar perfil.");
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        if (!confirm("O download do backup será iniciado. Isso pode levar alguns segundos dependendo da quantidade de dados. Continuar?")) return;

        try {
            // Trigger download via direct navigation or hidden iframe
            // Or fetch blob and download
            const response = await fetch('/api/admin/export');
            if (!response.ok) throw new Error('Falha no export');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Filename is in header, but we can default
            const disposition = response.headers.get('content-disposition');
            let filename = `backup-${new Date().toISOString()}.json`;
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            console.error(e);
            alert("Erro ao exportar dados.");
        }
    };


    const handleSignOut = async () => {
        try {
            await auth.signOut();
            await fetch('/api/auth/session', { method: 'DELETE' });
            document.cookie = "__session=; path=/; max-age=0";
            document.cookie = "auth_token=; path=/; max-age=0";
            document.cookie = "role=; path=/; max-age=0";
            document.cookie = "congregationId=; path=/; max-age=0";
            router.push('/login');
        } catch (error) {
            console.error("Logout error:", error);
            window.location.href = '/login';
        }
    };

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24 font-sans text-main">
            {/* Header */}
            <header className="bg-surface border-b border-surface-border sticky top-0 z-30 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center gap-3">
                    <div className="bg-primary p-2 rounded-xl text-white shadow-lg shadow-primary-light/30">
                        <Settings className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-main tracking-tight">Configurações</h1>
                        <p className="text-xs text-muted font-medium">Gerencie sua conta e o sistema</p>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

                {/* General Section (All Users) */}
                <section className="space-y-4">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1">Minha Conta</h2>
                    <div className="bg-surface p-6 rounded-3xl shadow-sm border border-surface-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-background dark:bg-surface-highlight rounded-full flex items-center justify-center text-muted text-xl font-bold border-2 border-surface dark:border-surface shadow-sm ring-1 ring-surface-border">
                                {user.photoURL ? (
                                    <Image src={user.photoURL} alt="Avatar" width={64} height={64} className="rounded-full object-cover" />
                                ) : (
                                    <User className="w-8 h-8" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-main">{profileName || user.displayName || 'Usuário'}</h3>
                                <p className="text-muted text-sm">{user.email}</p>
                                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-primary-light/50 text-primary-dark dark:bg-primary-dark/30 dark:text-primary-light">
                                    <Shield className="w-3 h-3" />
                                    {(() => {
                                        switch (role) {
                                            case 'SUPER_ADMIN': return 'Super Admin';
                                            case 'ANCIAO': return 'Superintendente de Serviço';
                                            case 'SERVO': return 'Servo de Territórios';
                                            default: return 'Publicador';
                                        }
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full md:w-auto">
                            <button
                                onClick={() => {
                                    setEditName(profileName || user.displayName || '');
                                    setEditEmail(user.email || '');
                                    setShowEditModal(true);
                                }}
                                className="bg-surface hover:bg-background text-main border border-surface-border font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors justify-center"
                            >
                                <Pencil className="w-5 h-5" />
                                Editar Perfil
                            </button>
                            <button
                                onClick={handleSignOut}
                                className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors justify-center"
                            >
                                <LogOut className="w-5 h-5" />
                                Sair da Conta
                            </button>
                        </div>
                    </div>
                </section>

                {/* Appearance Settings */}
                <section className="space-y-4">
                    <h2 className="text-sm font-bold text-muted uppercase tracking-widest pl-1">Aparência</h2>
                    <div className="bg-surface p-6 rounded-3xl shadow-sm border border-surface-border space-y-6">

                        {/* Theme Selection */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-light/50 text-primary dark:bg-primary-dark/30 dark:text-primary-light rounded-xl">
                                    {themeMode === 'light' ? <Sun className="w-6 h-6" /> :
                                        themeMode === 'dark' ? <Moon className="w-6 h-6" /> :
                                            themeMode === 'auto' ? <Clock className="w-6 h-6" /> :
                                                <Smartphone className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-main">Tema do Sistema</h3>
                                    <p className="text-sm text-muted">Claro, Escuro, Automático (Horário) ou Sistema.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-background rounded-xl p-1 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => changeTheme('light')}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${themeMode === 'light' ? 'bg-surface text-main shadow-sm' : 'text-muted hover:text-main'}`}
                                >
                                    <Sun className="w-4 h-4" />
                                    Claro
                                </button>
                                <button
                                    type="button"
                                    onClick={() => changeTheme('dark')}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${themeMode === 'dark' ? 'bg-surface text-main shadow-sm' : 'text-muted hover:text-main'}`}
                                >
                                    <Moon className="w-4 h-4" />
                                    Escuro
                                </button>
                                <button
                                    type="button"
                                    onClick={() => changeTheme('auto')}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${themeMode === 'auto' ? 'bg-surface text-main shadow-sm' : 'text-muted hover:text-main'}`}
                                >
                                    <Clock className="w-4 h-4" />
                                    Auto
                                </button>
                                <button
                                    type="button"
                                    onClick={() => changeTheme('system')}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${themeMode === 'system' ? 'bg-surface text-main shadow-sm' : 'text-muted hover:text-main'}`}
                                >
                                    <Smartphone className="w-4 h-4" />
                                    Sistema
                                </button>
                            </div>
                        </div>

                        <hr className="border-surface-border" />

                        {/* Text Size */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-light/50 text-primary dark:bg-primary-dark/30 dark:text-primary-light rounded-xl">
                                    <Type className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-main">Tamanho do Texto</h3>
                                    <p className="text-sm text-muted">Ajuste o tamanho da fonte (12px - 24px).</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-background rounded-xl p-1 self-end sm:self-auto">
                                <button onClick={() => changeTextSize(-1)} className="p-2 hover:bg-surface rounded-lg shadow-sm transition-all text-muted hover:text-main" title="Diminuir"><Minus className="w-4 h-4" /></button>
                                <span className="font-bold w-12 text-center select-none text-main">{textSize}px</span>
                                <button onClick={() => changeTextSize(1)} className="p-2 hover:bg-surface rounded-lg shadow-sm transition-all text-muted hover:text-main" title="Aumentar"><Plus className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <hr className="border-surface-border" />

                        {/* Display Scale */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-light/50 text-primary dark:bg-primary-dark/30 dark:text-primary-light rounded-xl">
                                    <Monitor className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-main">Escala da Tela</h3>
                                    <p className="text-sm text-muted">Aumente ou diminua o zoom geral.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-background rounded-xl p-1 self-end sm:self-auto">
                                <button onClick={() => changeScale(-0.05)} className="p-2 hover:bg-surface rounded-lg shadow-sm transition-all text-muted hover:text-main" title="Diminuir"><Minus className="w-4 h-4" /></button>
                                <span className="font-bold w-14 text-center select-none text-main">{Math.round(displayScale * 100)}%</span>
                                <button onClick={() => changeScale(0.05)} className="p-2 hover:bg-surface rounded-lg shadow-sm transition-all text-muted hover:text-main" title="Aumentar"><Plus className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* App Preferences */}
                <section className="space-y-4">
                    <h2 className="text-sm font-bold text-muted uppercase tracking-widest pl-1">Preferências</h2>
                    <div className="bg-surface p-6 rounded-3xl shadow-sm border border-surface-border space-y-6">
                        {/* Notifications */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary-light/50 text-primary dark:bg-primary-dark/30 dark:text-primary-light rounded-xl">
                                        <Bell className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-main">Notificações Push</h3>
                                        <p className="text-sm text-muted">Receba alertas sobre designações.</p>
                                    </div>
                                </div>
                                <NotificationToggle />
                            </div>
                            <button
                                onClick={() => {
                                    if (Notification.permission === 'granted') {
                                        // Local notification check
                                        new Notification("Teste de Notificação", {
                                            body: "Se você viu isso, as notificações estão funcionando!",
                                            icon: "/app-icon.png"
                                        });
                                    } else {
                                        alert("Habilite as notificações primeiro.");
                                    }
                                }}
                                className="text-xs text-primary font-bold hover:underline self-end"
                            >
                                Testar Notificação
                            </button>
                        </div>
                    </div>
                </section>

                {/* Edit Profile Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-surface w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-main tracking-tight">Editar Perfil</h2>
                                    <p className="text-sm text-muted font-medium tracking-tight">Atualize suas informações pessoais.</p>
                                </div>
                                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-background rounded-full transition-colors">
                                    <X className="w-6 h-6 text-muted" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Nome de Exibição</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary text-main transition-all"
                                        placeholder="Seu nome"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">E-mail de Contato</label>
                                    <input
                                        type="email"
                                        value={editEmail}
                                        onChange={(e) => setEditEmail(e.target.value)}
                                        className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary text-main transition-all"
                                        placeholder="seu@email.com"
                                    />
                                    <p className="text-[10px] text-orange-500 font-medium ml-1">
                                        Nota: Isso altera apenas o cadastro, não o login.
                                    </p>
                                </div>

                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary-light/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Servant Section (Invite & Registry) */}
                {(isServant || isElder || isSuperAdmin) && (
                    <>
                        <hr className="border-surface-border" />
                        <section className="space-y-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
                            <div className="flex items-center gap-2 text-primary dark:text-primary-light mb-2">
                                <FileText className="w-5 h-5" />
                                <h2 className="text-sm font-bold uppercase tracking-widest">Registros</h2>
                            </div>


                        </section>

                        <section className="space-y-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
                            {/* Invite Link (Visible to Elders/Servants) */}
                            <div className="bg-surface p-6 rounded-3xl shadow-sm border border-surface-border">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-primary-light/50 rounded-lg text-primary dark:bg-primary-dark/30 dark:text-primary-light">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-main">Convidar Publicadores</h3>
                                        <p className="text-xs text-muted">Envie este link para novos irmãos entrarem na congregação.</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-background p-3 rounded-xl text-xs font-mono text-muted truncate border border-surface-border">
                                        {inviteLink}
                                    </code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteLink);
                                            alert("Link copiado!");
                                        }}
                                        className="bg-primary hover:bg-primary-dark text-white font-bold px-4 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg shadow-primary-light/20"
                                    >
                                        Copiar
                                    </button>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={handleGenerateNewToken}
                                        disabled={generatingToken}
                                        className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider flex items-center gap-1"
                                    >
                                        {generatingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                                        Gerar Nova Chave
                                    </button>
                                </div>
                            </div>

                            {/* Export Button (Elder only) */}
                            {isElder && !isSuperAdmin && (
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={handleExport}
                                        className="flex items-center gap-2 text-xs font-bold text-muted hover:text-primary transition-colors uppercase tracking-wider"
                                    >
                                        <Database className="w-4 h-4" />
                                        Exportar Dados da Congregação
                                    </button>
                                </div>
                            )}
                        </section>
                    </>
                )}

                {/* Admin Section (Elders only) */}
                {isElder && (
                    <>
                        <hr className="border-surface-border" />

                        <section className="space-y-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
                            <div className="flex items-center gap-2 text-primary dark:text-primary-light mb-2">
                                <Shield className="w-5 h-5" />
                                <h2 className="text-sm font-bold uppercase tracking-widest">Painel do Administrador</h2>
                            </div>

                            {/* Member Management */}
                            <div className="bg-surface p-6 rounded-3xl shadow-sm border border-surface-border mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary-light/50 rounded-lg text-primary dark:bg-primary-dark/30 dark:text-primary-light">
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-main">Gestão de Membros</h3>
                                            <p className="text-xs text-muted">{members.length} membros na congregação</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => window.location.reload()} // Lazy refresh
                                        className="p-2 hover:bg-background rounded-full text-muted"
                                    >
                                        <Loader2 className={`w-4 h-4 ${membersLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {members.map(member => (
                                        <div key={member.id} className="flex items-center justify-between p-3 bg-background rounded-2xl border border-surface-border">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-muted font-bold border border-surface-border shadow-sm">
                                                    {member.photoURL ? <Image src={member.photoURL} alt={member.name || 'Avatar'} width={40} height={40} className="rounded-full object-cover" /> : <User className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-main">{member.name || member.email?.split('@')[0]}</h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${member.role === 'ANCIAO' ? 'bg-primary-light/80 text-primary-dark dark:bg-primary-dark/80 dark:text-primary-light' :
                                                            member.role === 'SERVO' ? 'bg-primary-light/50 text-primary-dark dark:bg-primary-dark/50 dark:text-primary-light' :
                                                                'bg-surface-border text-muted dark:bg-surface-border'
                                                            }`}>
                                                            {member.role || 'PUBLICADOR'}
                                                        </span>
                                                        <span className="text-[10px] text-muted truncate max-w-[150px] sm:max-w-none">{member.email}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions - Only Elders can manage */}
                                            {isElder && member.role !== 'SUPER_ADMIN' && member.role !== 'ANCIAO' && (
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === member.id ? null : member.id);
                                                        }}
                                                        className="p-2 text-muted hover:text-main hover:bg-surface rounded-full transition-colors"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    {openMenuId === member.id && (
                                                        <div className="absolute right-0 top-10 bg-surface rounded-xl shadow-xl border border-surface-border p-1 z-50 min-w-[180px] animate-in fade-in zoom-in-95 duration-200">
                                                            <button
                                                                onClick={() => handlePromote(member.id, member.role)}
                                                                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-bold rounded-lg transition-colors w-full text-left ${member.role === 'SERVO' ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'text-primary hover:bg-primary-light/50 dark:hover:bg-primary-dark/30'}`}
                                                            >
                                                                <Shield className="w-4 h-4" />
                                                                {member.role === 'SERVO' ? "Rebaixar a Publicador" : "Promover a Servo"}
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemove(member.id)}
                                                                className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors w-full text-left"
                                                            >
                                                                <UserMinus className="w-4 h-4" />
                                                                Remover da Congregação
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {members.length === 0 && !membersLoading && (
                                        <div className="text-center py-4 text-muted text-sm">Nenhum membro encontrado.</div>
                                    )}
                                </div>
                            </div>

                            {/* Simulation Mode (Super Admin Only) */}
                            {isSuperAdmin && (
                                <div className="bg-gradient-to-br from-primary-light/20 to-surface dark:from-primary-dark/10 dark:to-surface p-6 rounded-3xl shadow-sm border border-primary-light/30 dark:border-primary-dark/30 mb-6 relative overflow-hidden">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-primary-light/50 rounded-lg text-primary dark:bg-primary-dark/50 dark:text-primary-light">
                                            <Eye className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-main">Modo de Simulação</h3>
                                            <p className="text-xs text-muted">Visualize o sistema com outras permissões</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Ancião', role: 'ANCIAO' },
                                            { label: 'Servo', role: 'SERVO' },
                                            { label: 'Publicador', role: 'PUBLICADOR' }
                                        ].map((sim) => (
                                            <button
                                                key={sim.role}
                                                onClick={() => simulateRole(sim.role)}
                                                className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border ${role === sim.role && isSimulating
                                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary-light/30'
                                                    : 'bg-surface text-muted border-surface-border hover:border-primary-light hover:text-primary'
                                                    }`}
                                            >
                                                {sim.label}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => simulateRole(null)}
                                            className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border flex items-center justify-center gap-2 ${!isSimulating
                                                ? 'bg-gray-800 text-white border-gray-800'
                                                : 'bg-surface text-muted border-surface-border hover:bg-background'
                                                }`}
                                        >
                                            <X className="w-4 h-4" />
                                            Original
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Super Admin - All Congregations */}
                            {isSuperAdmin && (
                                <div className="bg-surface p-6 rounded-3xl shadow-sm border border-primary-light dark:border-primary-dark/30 mb-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Building2 className="w-24 h-24 text-primary" />
                                    </div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-primary-light/50 rounded-lg text-primary dark:bg-primary-dark/30 dark:text-primary-light">
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-main">Gestão Global</h3>
                                            <p className="text-xs text-muted">Super Admin (Acesso Total)</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted mb-4">Você tem permissão para gerenciar todas as congregações e usuários do sistema.</p>
                                    <div className="flex flex-wrap gap-3">
                                        <Link
                                            href="/admin/congregations"
                                            className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-xl transition-colors shadow-lg shadow-primary-light/20"
                                        >
                                            Congregações
                                        </Link>
                                        <Link
                                            href="/admin/users"
                                            className="inline-block bg-background hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 text-primary border border-primary-light dark:border-primary-dark/30 font-bold py-2 px-4 rounded-xl transition-colors shadow-sm"
                                        >
                                            Usuários
                                        </Link>
                                        <Link
                                            href="/orphaned-data"
                                            className="inline-block bg-background hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 text-primary border border-primary-light dark:border-primary-dark/30 font-bold py-2 px-4 rounded-xl transition-colors shadow-sm flex items-center gap-2"
                                        >
                                            <Database className="w-4 h-4" />
                                            Dados Órfãos
                                        </Link>
                                        <Link
                                            href="/admin/notifications"
                                            className="inline-block bg-background hover:bg-primary-light/50 dark:hover:bg-primary-dark/30 text-primary border border-primary-light dark:border-primary-dark/30 font-bold py-2 px-4 rounded-xl transition-colors shadow-sm flex items-center gap-2"
                                        >
                                            <Bell className="w-4 h-4" />
                                            Notificações
                                        </Link>
                                        <button
                                            onClick={handleExport}
                                            className="inline-block bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold py-2 px-4 rounded-xl transition-colors shadow-sm flex items-center gap-2"
                                        >
                                            <Database className="w-4 h-4" />
                                            Exportar Backup Completo
                                        </button>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-primary-light/20 dark:border-primary-dark/20">
                                        <h4 className="text-xs font-bold text-primary mb-2 uppercase tracking-wider">Segurança do Sistema</h4>
                                        <button
                                            onClick={async () => {
                                                if (!confirm("Isso irá definir SUA conta como a única Super Admin proprietária da trava de segurança. Continuar?")) return;
                                                try {
                                                    await setDoc(doc(db, 'config', 'security'), {
                                                        superAdminUid: user.uid,
                                                        updatedAt: Timestamp.now()
                                                    });
                                                    alert("Trava de segurança inicializada com sucesso!");
                                                    window.location.reload();
                                                } catch (error: any) {
                                                    console.error(error);
                                                    alert("Erro: " + error.message);
                                                }
                                            }}
                                            className="bg-red-900/10 hover:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-900/20 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition-all"
                                        >
                                            <Shield className="w-4 h-4" />
                                            Inicializar Trava de Segurança (Strict Mode)
                                        </button>
                                        <p className="text-[10px] text-muted mt-1">
                                            Exigido para acesso total ao Dashboard se o documento /config/security estiver ausente.
                                        </p>
                                    </div>
                                </div>
                            )}


                        </section>
                    </>
                )}
                {/* About & Legal Section */}
                <section className="space-y-4">
                    <h2 className="text-sm font-bold text-muted uppercase tracking-widest pl-1">Sobre & Legal</h2>
                    <div className="bg-surface p-2 rounded-3xl shadow-sm border border-surface-border">
                        <Link href="/legal/terms" className="flex items-center justify-between p-4 hover:bg-background rounded-2xl transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-sm text-main">Termos de Uso</span>
                            </div>
                            <Eye className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                        </Link>
                        <Link href="/legal/privacy" className="flex items-center justify-between p-4 hover:bg-background rounded-2xl transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-sm text-main">Política de Privacidade</span>
                            </div>
                            <Eye className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                        </Link>
                        <Link href="/legal/data-usage" className="flex items-center justify-between p-4 hover:bg-background rounded-2xl transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                                    <Database className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-sm text-main">Uso de Dados</span>
                            </div>
                            <Eye className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                        </Link>
                        <Link href="/legal/user-commitment" className="flex items-center justify-between p-4 hover:bg-background rounded-2xl transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                                    <User className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-sm text-main">Compromisso do Usuário</span>
                            </div>
                            <Eye className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                        </Link>

                        <hr className="border-surface-border my-2" />

                        <Link href="/legal/open-source" className="flex items-center justify-between p-4 hover:bg-background rounded-2xl transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                                    <Scale className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-sm text-main">Licença Open-source</span>
                            </div>
                            <Eye className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                        </Link>

                        <Link href="/legal/about" className="flex items-center justify-between p-4 hover:bg-background rounded-2xl transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                                    <Info className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-sm text-main">O que é o Campo Branco</span>
                            </div>
                            <Eye className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                        </Link>
                        <Link href="/legal/contact" className="flex items-center justify-between p-4 hover:bg-background rounded-2xl transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-sm text-main">Contato e Suporte</span>
                            </div>
                            <Eye className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                        </Link>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="space-y-4">
                    <h2 className="text-sm font-bold text-red-500 uppercase tracking-widest pl-1">Zona de Perigo</h2>
                    <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl shadow-sm border border-red-100 dark:border-red-900/30">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                            <div className="space-y-1">
                                <h3 className="font-bold text-red-700 dark:text-red-400">Excluir Conta</h3>
                                <p className="text-xs text-red-600/70 dark:text-red-400/70 max-w-sm">
                                    Essa ação é irreversível. Seus dados de perfil serão apagados permanentemente.
                                    Se você for o único administrador de uma congregação, entre em contato com o suporte antes.
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    if (confirm("TEM CERTEZA? Essa ação não pode ser desfeita e excluirá permanentemente sua conta.")) {
                                        const doubleCheck = prompt("Digite 'DELETAR' para confirmar:");
                                        if (doubleCheck === 'DELETAR') {
                                            try {
                                                const { deleteDoc, doc } = await import('firebase/firestore');
                                                // 1. Delete Firestore Profile
                                                if (user?.uid) {
                                                    await deleteDoc(doc(db, "users", user.uid));
                                                }

                                                // 2. Delete Auth Account
                                                if (auth.currentUser) {
                                                    await auth.currentUser.delete();
                                                }

                                                // Force logout just in case
                                                await handleSignOut();
                                                alert("Conta excluída com sucesso.");
                                            } catch (error: any) {
                                                console.error("Delete account error:", error);
                                                if (error.code === 'auth/requires-recent-login') {
                                                    alert("Por segurança, faça login novamente antes de excluir sua conta.");
                                                    await handleSignOut();
                                                } else {
                                                    alert("Erro ao excluir conta. Tente novamente.");
                                                }
                                            }
                                        }
                                    }
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-red-600/20 whitespace-nowrap"
                            >
                                <Trash2 className="w-4 h-4" />
                                Excluir Minha Conta
                            </button>
                        </div>
                    </div>
                </section>

                {/* Footer Info */}
                <div className="pt-8 pb-12 flex flex-col items-center gap-4">
                    <a
                        href="https://github.com/paulojacomelli/campo-branco"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center gap-2 opacity-60 hover:opacity-100 transition-all duration-300"
                    >
                        <div className="flex items-center gap-1.5 text-main">
                            <Github className="w-4 h-4" />
                            <span className="text-xs font-semibold">Projeto Open Source <span className="text-[10px] opacity-60 font-normal">(MIT)</span></span>
                        </div>

                        <img
                            src="https://img.shields.io/github/stars/paulojacomelli/campo-branco?style=social"
                            alt="GitHub Repo stars"
                            className="h-5 grayscale group-hover:grayscale-0 transition-all duration-300"
                        />
                    </a>

                    <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] opacity-30 hover:opacity-100 transition-opacity">
                        Campo Branco v{APP_VERSION}
                    </p>
                </div>
            </main>

            {/* Bottom Navigation */}
            <BottomNav />
        </div >
    );
}
