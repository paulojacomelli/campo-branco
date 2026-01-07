"use client";

import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, getDocs, query, collection, where, setDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

function InviteContent() {
    const searchParams = useSearchParams();
    const [token, setToken] = useState<string | null>(searchParams.get('token'));

    useEffect(() => {
        if (!token) {
            // Fallback: Check path for legacy /invite/TOKEN format
            const pathParts = window.location.pathname.split('/');
            if (pathParts.length > 2 && pathParts[1] === 'invite') {
                setToken(pathParts[2]);
            }
        }
    }, []);

    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [congregationName, setCongregationName] = useState('Carregando...');
    const [congregationId, setCongregationId] = useState<string | null>(null);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        const checkInvite = async () => {
            if (authLoading) return;

            if (!token) {
                setError("Token de convite não fornecido.");
                setCongregationName("Convite Inválido");
                setLoading(false);
                return;
            }

            try {
                // 1. Validate Token & Get Congregation
                // Use list query because we don't know the ID
                const q = query(collection(db, "congregations"), where("inviteToken", "==", token));
                const snap = await getDocs(q);

                if (snap.empty) {
                    setError("Link de convite inválido ou expirado.");
                    setCongregationName("Convite Inválido");
                    setLoading(false);
                    return;
                }

                const congDoc = snap.docs[0];
                const data = congDoc.data();

                setCongregationId(congDoc.id);
                setCongregationName(data.name || "Congregação sem nome");
                setLoading(false);

            } catch (err) {
                console.error("Error fetching invite:", err);
                if (!user) {
                    setCongregationName("Faça login para aceitar");
                } else {
                    setError("Erro ao carregar convite.");
                }
                setLoading(false);
            }
        };

        checkInvite();
    }, [token, user, authLoading]);

    const handleAccept = async () => {
        if (!user) {
            router.push(`/login?redirect=/invite?token=${token}`);
            return;
        }

        if (!congregationId) {
            alert("Congregação não identificada.");
            return;
        }

        setAccepting(true);
        try {
            // Check if user already has a congregation
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists() && userDoc.data().congregationId) {
                // Already bound logic
                if (userDoc.data().congregationId === congregationId) {
                    setSuccess(true);
                    setTimeout(() => router.push('/dashboard'), 2000);
                    return;
                } else {
                    if (!confirm("Você já pertence a outra congregação. Deseja mudar para esta?")) {
                        setAccepting(false);
                        return;
                    }
                }
            }

            // Update User
            await setDoc(userRef, {
                congregationId: congregationId,
                role: 'PUBLICADOR',
                updatedAt: serverTimestamp(),
                email: user.email,
                name: user.displayName
            }, { merge: true });

            setSuccess(true);
            setTimeout(() => router.push('/dashboard'), 2000);

        } catch (e) {
            console.error("Error accepting invite:", e);
            alert("Erro ao aceitar convite.");
            setAccepting(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-surface max-w-md w-full rounded-[2.5rem] p-8 shadow-xl shadow-primary/5 space-y-8 text-center relative overflow-hidden border border-surface-border">

            {/* Decoration */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-primary-dark" />

            <div className="w-24 h-24 bg-primary-light/50 dark:bg-primary-dark/20 rounded-full flex items-center justify-center mx-auto text-primary dark:text-primary-light shadow-sm border border-primary-light dark:border-primary-dark/30">
                <Users className="w-10 h-10" />
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-black text-main tracking-tight">Convite para Congregação</h1>
                <p className="text-muted font-medium">Você foi convidado para se juntar à:</p>
                <div className="text-xl font-bold text-primary dark:text-primary-light py-2">{congregationName}</div>
            </div>

            {error ? (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold justify-center">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            ) : success ? (
                <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold justify-center animate-in zoom-in">
                    <CheckCircle className="w-5 h-5" />
                    Entrou com sucesso! Redirecionando...
                </div>
            ) : (
                <div className="space-y-4">
                    <button
                        onClick={handleAccept}
                        disabled={accepting}
                        className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                    >
                        {accepting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                        {user ? 'Aceitar Convite' : 'Fazer Login para Aceitar'}
                    </button>

                    {!user && (
                        <p className="text-xs text-muted">Você será redirecionado para login google</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function InvitePage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 font-sans text-main">
            <Suspense fallback={<Loader2 className="w-8 h-8 text-primary animate-spin" />}>
                <InviteContent />
            </Suspense>
        </div>
    );
}
