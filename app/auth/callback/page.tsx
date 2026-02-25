// app/auth/callback/page.tsx
// Página de callback de autenticação
// Com Firebase + signInWithPopup, não há mais necessidade de callback de rota.
// Esta página é um redirecionador de segurança caso o usuário caia aqui.

"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        // Aguarda o estado de autenticação do Firebase e redireciona para o dashboard
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                router.push('/dashboard');
            } else {
                router.push('/login');
            }
        });

        return () => unsubscribe();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-main font-bold animate-pulse">Autenticando...</p>
            </div>
        </div>
    );
}
