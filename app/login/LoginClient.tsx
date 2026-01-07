"use client";

import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

export default function LoginClient() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect');

    useEffect(() => {
        const forceLogout = async () => {
            try {
                await auth.signOut();
                await fetch('/api/auth/logout', { method: 'POST' });
                document.cookie = "__session=; path=/; max-age=0";
                document.cookie = "auth_token=; path=/; max-age=0";
                document.cookie = "role=; path=/; max-age=0";
                document.cookie = "congregationId=; path=/; max-age=0";
            } catch (e) {
                console.warn("Silent logout fail", e);
            }
        };
        forceLogout();
    }, []);

    const processLoginResult = async (user: any, provider: string) => {
        let targetUid = user.uid;
        let needsCreation = false;

        try {
            if (user.email) {
                try {
                    const q = query(collection(db, 'users'), where('email', '==', user.email));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        targetUid = querySnapshot.docs[0].id;
                    } else {
                        needsCreation = true;
                    }
                } catch (e) {
                    console.warn("Login: Email check failed, skipping", e);
                    needsCreation = true; // Assume new or let create fail if exists
                }
            } else {
                try {
                    const userRef = doc(db, "users", user.uid);
                    const userSnap = await getDoc(userRef);
                    if (!userSnap.exists()) needsCreation = true;
                } catch (e) {
                    console.warn("Login: UID check failed, skipping", e);
                    needsCreation = true;
                }
            }

            if (needsCreation) {
                // Try create, if fails (e.g. exists and create rule blocks), ignore
                try {
                    await setDoc(doc(db, "users", targetUid), {
                        name: user.displayName || user.email?.split('@')[0] || 'Novo Usuário',
                        email: user.email,
                        photoURL: user.photoURL,
                        role: "PUBLICADOR",
                        congregationId: "",
                        createdAt: serverTimestamp(),
                        provider: provider
                    }, { merge: true }); // Merge true allows update-like behavior if exists
                } catch (e) {
                    console.warn("Login: Creation/Update failed", e);
                }
            }
        } catch (err) {
            console.error("Login Process Error (Non-Fatal):", err);
        }

        // --- ADMIN LOCK LOGIC (STATIC EXPORT SECURE STRATEGY) ---
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

        if (adminEmail && user.email === adminEmail) {
            try {
                // 1. Check if the lock exists
                const securityRef = doc(db, 'config', 'security');
                const snap = await getDoc(securityRef);

                // 2. If NO lock exists, claim the throne
                if (!snap.exists()) {
                    console.log("🔒 Creating Security Lock for Super Admin...");
                    // Create Lock
                    await setDoc(securityRef, {
                        superAdminUid: targetUid,
                        locked: true,
                        createdAt: serverTimestamp()
                    });

                    // Grant Role
                    console.log("👑 Promoting User to SUPER_ADMIN...");
                    await setDoc(doc(db, 'users', targetUid), {
                        role: 'SUPER_ADMIN'
                    }, { merge: true });
                }
            } catch (lockError) {
                console.error("Failed to execute Admin Lock:", lockError);
            }
        }
        // ----------------------------------------------------

        if (targetUid !== user.uid) {
            try {
                const sourceDoc = await getDoc(doc(db, "users", targetUid));
                if (sourceDoc.exists()) {
                    const sourceData = sourceDoc.data();
                    await setDoc(doc(db, "users", user.uid), {
                        role: sourceData.role,
                        congregationId: sourceData.congregationId,
                        email: user.email,
                        isShadowAuthDoc: true,
                        linkedProfileId: targetUid,
                        updatedAt: serverTimestamp()
                    }, { merge: true });
                }
            } catch (syncErr) {
                console.error("Failed to sync Auth Doc permissions:", syncErr);
            }
        }

        let hasAcceptedTerms = false;
        try {
            const userDocRef = doc(db, "users", targetUid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                hasAcceptedTerms = !!userDocSnap.data().termsAcceptedAt;
            }
        } catch (e) {
            console.warn("Login: Failed to check terms", e);
            // Default to false, users will just accept again if needed
        }

        // Static Export: No Server Session Creation
        // We rely on Client Auth (onAuthStateChanged)

        if (!hasAcceptedTerms) {
            window.location.href = '/legal-consent';
        } else {
            window.location.href = redirectUrl || '/dashboard';
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');

        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            await processLoginResult(result.user, 'google.com');
        } catch (error: any) {
            console.error("Google Login Error:", error);
            setError(error.message?.includes('Firebase Admin') ? "Erro de Configuração Local." : "Erro ao conectar com Google.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-primary dark:bg-background flex flex-col items-center justify-center p-6 font-sans transition-colors duration-300">
            <div className="w-full max-w-sm">
                <div className="bg-white dark:bg-surface rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-12 fade-in duration-1000 border border-transparent dark:border-surface-border transition-colors">
                    <div className="text-center mb-8">
                        <div className="w-24 h-24 flex items-center justify-center mx-auto mb-2">
                            <img src="/app-icon.svg" alt="Campo Branco" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">Campo Branco</h1>
                        <p className="text-primary dark:text-primary-light text-[10px] font-bold opacity-80 uppercase tracking-widest">Acesso Restrito</p>
                    </div>

                    <div className="mb-8 text-center">
                        <p className="text-gray-500 dark:text-gray-300 text-sm font-medium">Clique no botão abaixo para entrar.</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-xs font-bold rounded-2xl flex items-center gap-3 border border-red-100 dark:border-red-900/30 animate-in shake duration-500">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-gray-800 dark:text-white font-extrabold py-4 px-6 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/80 hover:border-gray-200 dark:hover:border-gray-600 flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-70 shadow-sm"
                        >
                            <svg className="w-6 h-6" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            <span>Entrar com Google</span>
                        </button>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-gray-300 dark:text-gray-500 font-bold uppercase tracking-[0.2em]">Exclusivo para membros autorizados</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
