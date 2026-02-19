import { Suspense } from 'react';
import LoginClient from './LoginClient';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-primary dark:bg-background flex flex-col items-center justify-center p-6 font-sans">
                <div className="w-full max-w-sm bg-white dark:bg-surface rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-gray-500 dark:text-muted font-bold uppercase tracking-widest text-[10px]">Verificando...</p>
                </div>
            </div>
        }>
            <LoginClient />
        </Suspense>
    );
}
