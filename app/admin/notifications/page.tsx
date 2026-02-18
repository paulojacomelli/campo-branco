"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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
    is_active: boolean;
    slug?: string; // System trigger identifier
    created_at?: string;
}

export default function NotificationManagementPage() {
    const { user, isSuperAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notification_templates')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !isSuperAdmin) {
            router.push('/dashboard');
            return;
        }

        if (isSuperAdmin) {
            fetchTemplates();

            const channel = supabase
                .channel('public:notification_templates')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_templates' }, () => {
                    fetchTemplates();
                })
                .subscribe();

            return () => {
                setTimeout(() => {
                    supabase.removeChannel(channel);
                }, 100);
            };
        }
    }, [isSuperAdmin, authLoading, router]);

    const handleToggleActive = async (template: NotificationTemplate) => {
        try {
            const { error } = await supabase
                .from('notification_templates')
                .update({ is_active: !template.is_active })
                .eq('id', template.id);
            if (error) throw error;
        } catch (e) {
            alert("Erro ao atualizar status.");
        }
    };

    const handleTestNotification = async (template: NotificationTemplate) => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(template.title, {
                    body: template.body,
                    icon: "/app-icon.png"
                });
                alert("Teste enviado!");
            } else {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    new Notification(template.title, {
                        body: template.body,
                        icon: "/app-icon.png"
                    });
                } else {
                    alert("Acesso negado.");
                }
            }
        }
    };

    // Auto-seed/Update system templates because the user requested "just update them"
    // We check if the required slugs exist, and if so, we ensure they are active and have the correct text.
    // If not, we create them.
    useEffect(() => {
        if (!isSuperAdmin || loading || templates.length === 0) return;

        const ensureSystemTemplates = async () => {
            const defaults = [
                { title: "🗺️ Novo Mapa Atribuído", body: "Você agora é o responsável por este território. Bom trabalho!", type: "system", slug: "map_assigned", is_active: true },
                { title: "📝 Não esqueça de anotar", body: "Ao encontrar alguém, não se esqueça de anotar como foi a visita no aplicativo.", type: "reminder", slug: "visit_note_reminder", is_active: true },
                { title: "📍 Endereços Pendentes", body: "Ainda tem alguns endereços pendentes neste mapa. Você já fez eles?", type: "alert", slug: "pending_addresses", is_active: true }
            ];

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
                    await supabase
                        .from('notification_templates')
                        .update({ title: def.title, body: def.body, type: def.type })
                        .eq('id', existing.id);
                } else {
                    await supabase
                        .from('notification_templates')
                        .insert([def]);
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
                            <div key={template.id} className={`group bg-surface rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md ${template.is_active ? 'border-surface-border' : 'border-surface-border opacity-75 grayscale-[0.5]'}`}>
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
                                            className={`transition-colors ${template.is_active ? 'text-green-500 hover:text-green-600' : 'text-muted hover:text-main'}`}
                                            title={template.is_active ? "Desativar" : "Ativar"}
                                        >
                                            {template.is_active ? (
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
