"use client";

import Link from 'next/link';
import { MapPinOff, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="relative bg-white dark:bg-slate-900 p-8 rounded-full shadow-2xl border border-primary-light/20 dark:border-primary-dark/20">
                    <MapPinOff className="w-20 h-20 text-primary animate-bounce" />
                </div>
            </div>

            <h1 className="text-4xl font-black text-main mb-4 tracking-tight">
                Página não encontrada
            </h1>

            <p className="text-muted text-lg max-w-md mx-auto mb-10 leading-relaxed">
                Parece que o território que você está procurando não existe ou foi movido para outra área.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-md mx-auto">
                <Link
                    href="/dashboard"
                    className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <Home className="w-5 h-5" />
                    Ir para o Início
                </Link>

                <button
                    onClick={() => window.history.back()}
                    className="flex-1 bg-surface border border-surface-border text-main font-bold py-4 px-8 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Voltar
                </button>
            </div>

            <div className="mt-20 opacity-20 pointer-events-none">
                <p className="text-[10px] font-mono tracking-widest uppercase">Erro 404 • Campo Branco</p>
            </div>
        </div>
    );
}
