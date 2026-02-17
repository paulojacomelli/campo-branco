"use client";

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            // O Supabase Auth Helper para cliente lida automaticamente com o código na URL
            // quando a instância do supabase é inicializada e o estado de auth muda.
            // Mas para garantir o redirecionamento:
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                router.push('/dashboard');
            } else {
                // Se não houver sessão imediata, aguardamos um pouco ou o estado mudar
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_IN' && session) {
                        subscription.unsubscribe();
                        router.push('/dashboard');
                    }
                });
            }
        };

        handleCallback();
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
