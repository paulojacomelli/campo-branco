"use client";

import { useAuth } from '@/app/context/AuthContext';
import { LogOut, User, Shield, Link as LinkIcon, Users, MapPin, Plus, Loader2, Building2, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function UnassignedPage() {
    const { user, logout, loading } = useAuth();
    const router = useRouter();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCity, setNewCity] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [customId, setCustomId] = useState('');
    const [newTermType, setNewTermType] = useState<'city' | 'neighborhood'>('city');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const handleCreateCongregation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newName.trim()) return;

        setCreating(true);
        try {
            // 1. Create Congregation
            const congData: any = {
                name: newName.trim(),
                city: newCity.trim(),
                category: newCategory.trim() || null,
                termType: newTermType,
                createdAt: serverTimestamp(),
                createdBy: user.uid
            };

            let congId;
            if (customId.trim()) {
                const id = customId.trim().toLowerCase().replace(/\s+/g, '-');
                await setDoc(doc(db, "congregations", id), congData);
                congId = id;
            } else {
                const congRef = await addDoc(collection(db, "congregations"), congData);
                congId = congRef.id;
            }

            // 2. Update User Profile to ANCIAO of this congregation
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                congregationId: congId,
                role: 'ANCIAO',
                updatedAt: serverTimestamp()
            });

            // 3. Force reload to update context and redirect
            window.location.href = '/dashboard';
        } catch (error: any) {
            console.error("Error creating congregation:", error);
            alert("Erro ao criar congregação: " + (error.message || "Erro desconhecido"));
            setCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans">
            <div className="bg-white max-w-md w-full rounded-[2.5rem] p-8 shadow-xl shadow-primary-light/500/5 space-y-8 text-center relative overflow-hidden">

                {/* Decoration */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500" />

                <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-orange-500 shadow-sm border border-orange-100">
                    <Shield className="w-10 h-10" />
                </div>

                <div className="space-y-4">
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Acesso Restrito</h1>
                    <p className="text-gray-500 font-medium text-sm leading-relaxed">
                        Olá, <strong>{user?.displayName || 'visitante'}</strong>. Sua conta foi criada, mas você ainda não pertence a nenhuma congregação.
                    </p>
                </div>

                <div className="space-y-4 bg-gray-50 p-6 rounded-3xl border border-gray-100 text-left">
                    <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary-light/500" />
                        Como liberar meu a cesso?
                    </h3>

                    <ul className="space-y-4 text-sm text-gray-600">

                        <li className="flex gap-3">
                            <div className="bg-white p-2 rounded-lg shadow-sm h-fit">
                                <LinkIcon className="w-4 h-4 text-primary-light/500" />
                            </div>
                            <div>
                                <span className="font-bold text-gray-800">Peça um Convite</span>
                                <p className="text-xs mt-1">Solicite ao ancião ou servo de territórios o <span className="font-mono bg-primary-light/50 text-primary px-1 rounded">Link de Convite</span> da congregação.</p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <div className="bg-white p-2 rounded-lg shadow-sm h-fit">
                                <MapPin className="w-4 h-4 text-green-500" />
                            </div>
                            <div>
                                <span className="font-bold text-gray-800">Aceite um Território</span>
                                <p className="text-xs mt-1">Se você abrir um link de território compartilhado e clicar em &quot;Aceitar&quot;, você será vinculado automaticamente.</p>
                            </div>
                        </li>
                    </ul>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full bg-white hover:bg-red-50 text-red-600 font-bold py-4 rounded-2xl border-2 border-transparent hover:border-red-100 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                >
                    <LogOut className="w-5 h-5" />
                    Sair da Conta
                </button>
            </div>

            {/* Create Congregation Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-surface w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-main tracking-tight uppercase">Nova Congregação</h2>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-background rounded-full transition-colors">
                                <X className="w-6 h-6 text-muted" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCongregation} className="space-y-4">
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Nome</label>
                                <input
                                    required
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-main placeholder-muted"
                                    placeholder="Ex: Congregação Central"
                                />
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Cidade (Opcional)</label>
                                <input
                                    type="text"
                                    value={newCity}
                                    onChange={(e) => setNewCity(e.target.value)}
                                    className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-main placeholder-muted"
                                    placeholder="Ex: São Paulo"
                                />
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Tipo de congregação</label>
                                <select
                                    required
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-main appearance-none"
                                >
                                    <option value="" disabled>Selecione o tipo...</option>
                                    <option value="Tradicional">Tradicional</option>
                                    <option value="Língua de sinais">Língua de sinais</option>
                                    <option value="Idiomas estrangeiros">Idiomas estrangeiros</option>
                                </select>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Modo de Organização</label>
                                <div className="flex gap-2 p-1 bg-background border border-surface-border rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => setNewTermType('city')}
                                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${newTermType === 'city' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-main'}`}
                                    >
                                        Cidades
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewTermType('neighborhood')}
                                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${newTermType === 'neighborhood' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-main'}`}
                                    >
                                        Bairros
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">ID Personalizado (Opcional)</label>
                                <input
                                    type="text"
                                    value={customId}
                                    onChange={(e) => setCustomId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                    className="w-full bg-background border border-surface-border rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-main placeholder-muted"
                                    placeholder="ex: sao-paulo-central"
                                />
                                <p className="text-[10px] text-muted italic">Isso definirá a URL da congregação.</p>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 bg-background hover:bg-surface-highlight text-muted hover:text-main border border-surface-border font-bold py-3.5 rounded-2xl transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                                    {creating ? 'Criando...' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
