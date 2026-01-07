"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Plus,
    Pencil,
    Trash2,
    Bell,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';

interface NotificationTemplate {
    id: string;
    title: string;
    body: string;
    type: 'system' | 'reminder' | 'alert';
    isActive: boolean;
    slug?: string; // System trigger identifier
    createdAt?: any;
}

export default function NotificationManagementPage() {
    const { user, isSuperAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !isSuperAdmin) {
            router.push('/dashboard');
            return;
        }

        if (isSuperAdmin) {
            const q = query(collection(db, 'notification_templates'), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as NotificationTemplate[];
                setTemplates(data);
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, [isSuperAdmin, authLoading, router]);

    const handleToggleActive = async (template: NotificationTemplate) => {
        try {
            await updateDoc(doc(db, 'notification_templates', template.id), {
                isActive: !template.isActive
            });
        } catch (e) {
            alert("Erro ao atualizar status.");
        }
    };

    const handleTestNotification = async (template: NotificationTemplate) => {
        if (Notification.permission === 'granted') {
            new Notification(template.title, {
                body: template.body,
                icon: "/app-icon.png"
            });
            alert("Notificação de teste enviada para este dispositivo.");
        } else {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                new Notification(template.title, {
                    body: template.body,
                    icon: "/app-icon.png"
                });
            } else {
                alert("Permissão de notificação negada.");
            }
        }
    };

    // Auto-seed/Update system templates because the user requested "just update them"
    // We check if the required slugs exist, and if so, we ensure they are active and have the correct text.
    // If not, we create them.
    useEffect(() => {
        if (!isSuperAdmin || loading) return;

        const ensureSystemTemplates = async () => {
            const defaults = [
                {
                    title: "🗺️ Novo Mapa Atribuído",
                    body: "Você agora é o responsável por este território. Bom trabalho!",
                    type: "system",
                    slug: "map_assigned",
                    isActive: true
                },
                {
                    title: "📝 Não esqueça de anotar",
                    body: "Ao encontrar alguém, não se esqueça de anotar como foi a visita no aplicativo.",
                    type: "reminder",
                    slug: "visit_note_reminder",
                    isActive: true
                },
                {
                    title: "📍 Endereços Pendentes",
                    body: "Ainda tem alguns endereços pendentes neste mapa. Você já fez eles?",
                    type: "alert",
                    slug: "pending_addresses",
                    isActive: true
                },
                {
                    title: "🚀 Meta do Dia",
                    body: "Falta pouco para fechar seu mapa! Que tal tentar concluir os endereços restantes hoje?",
                    type: "reminder",
                    slug: "encourage_finish",
                    isActive: true
                },
                {
                    title: "📅 Uma Semana de Mapa",
                    body: "Faz uma semana que você designou este mapa. Tente concluir até o fim de semana!",
                    type: "reminder",
                    slug: "encourage_1week",
                    isActive: true
                },
                {
                    title: "⏳ Duas Semanas - Precisa de Ajuda?",
                    body: "Este mapa está em aberto há 15 dias. Se precisar de ajuda para concluir, fale com o superintendente.",
                    type: "alert",
                    slug: "encourage_2weeks",
                    isActive: true
                },
                {
                    title: "⚠️ Link Vencendo",
                    body: "Seu link compartilhado vai vencer em breve. Acesse o painel para renovar.",
                    type: "system",
                    slug: "link_expiration",
                    isActive: true
                }
            ];

            // We only run this once per session to avoid heavy writes? 
            // Better: Check local state "templates" against defaults.
            // Since we subscribe to "templates", we can check if they are missing.

            // Note: This logic runs whenever "templates" changes, which is fine as long as we guard it.
            // But "templates" updates after we write, causing loop if we are not careful.
            // Let's use a flag or just check if MATCHING exists.

            // Actually, we can just do a one-off check on mount (or when loading finishes) 
            // but we need the current DB state.
            // The onSnapshot above gives us the state.

            if (templates.length === 0 && loading) return; // Wait for load

            // Diffing
            const missingOrOutdated = defaults.filter(def => {
                const existing = templates.find(t => t.slug === def.slug);
                if (!existing) return true; // Missing
                // Optional: Force update text? User said "update available notifications".
                // Let's assumes yes.
                return existing.title !== def.title || existing.body !== def.body;
            });

            if (missingOrOutdated.length === 0) return;

            console.log("Updating system templates...", missingOrOutdated);

            for (const def of missingOrOutdated) {
                const existing = templates.find(t => t.slug === def.slug);
                if (existing) {
                    await updateDoc(doc(db, 'notification_templates', existing.id), {
                        title: def.title,
                        body: def.body,
                        type: def.type,
                        // isActive: true // Don't force active if user disabled it? 
                        // User said "update available", implies making them available.
                        // I'll leave isActive alone if it exists, to respect user choice.
                    });
                } else {
                    await addDoc(collection(db, 'notification_templates'), {
                        ...def,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                }
            }
        };

        // Debounce slightly to ensure templates state is clean
        const timer = setTimeout(ensureSystemTemplates, 1000);
        return () => clearTimeout(timer);

    }, [isSuperAdmin, loading, templates]); // dependent on templates to detect diffs



    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-main">
            <header className="bg-surface border-b border-surface-border px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/settings" className="p-2 -ml-2 text-muted hover:text-main hover:bg-background rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-main tracking-tight">Notificações</h1>
                        <p className="text-sm text-muted">Gerencie e teste os alertas do sistema.</p>
                    </div>
                </div>

            </header>

            <main className="max-w-3xl mx-auto p-6 space-y-6">
                {templates.length === 0 ? (
                    <div className="text-center py-20 bg-surface rounded-3xl border border-surface-border shadow-sm">
                        <Bell className="w-12 h-12 text-muted mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-main">Nenhum modelo encontrado</h3>
                        <p className="text-muted text-sm max-w-xs mx-auto mt-1 mb-6">Sincronizando modelos do sistema...</p>
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary-light/500" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {templates.map(template => (
                            <div key={template.id} className={`group bg-surface rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md ${template.isActive ? 'border-surface-border' : 'border-surface-border opacity-75 grayscale-[0.5]'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${template.type === 'alert' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                                            template.type === 'reminder' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
                                                'bg-primary-light/50 dark:bg-blue-900/20 text-primary dark:text-blue-400'
                                            }`}>
                                            {template.type === 'system' ? 'Sistema' : template.type === 'reminder' ? 'Lembrete' : 'Alerta'}
                                        </div>
                                        {template.slug === 'link_expiration' && (
                                            <div className="bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                                Auto: Expiração
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleTestNotification(template)}
                                            className="text-xs font-bold text-primary dark:text-blue-400 hover:text-primary-dark dark:hover:text-blue-300 hover:bg-primary-light/50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                            title="Enviar teste para mim agora"
                                        >
                                            <Bell className="w-3.5 h-3.5" /> Testar
                                        </button>

                                        <div className="h-4 w-px bg-surface-border mx-1" />

                                        <button
                                            onClick={() => handleToggleActive(template)}
                                            className={`transition-colors ${template.isActive ? 'text-green-500 hover:text-green-600' : 'text-muted hover:text-main'}`}
                                            title={template.isActive ? "Desativar" : "Ativar"}
                                        >
                                            {template.isActive ? (
                                                <ToggleRight className="w-8 h-8" />
                                            ) : (
                                                <ToggleLeft className="w-8 h-8" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-main text-lg mb-1">{template.title}</h3>
                                    <p className="text-muted text-sm leading-relaxed">{template.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
