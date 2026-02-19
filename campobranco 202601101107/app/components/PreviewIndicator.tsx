'use client';

import React, { useEffect, useState } from 'react';

export default function PreviewIndicator() {
    const [isDev, setIsDev] = useState(false);

    useEffect(() => {
        // Only show in development mode
        if (process.env.NODE_ENV === 'development') {
            setIsDev(true);
        }
    }, []);

    if (!isDev) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-600 text-white text-[10px] font-bold text-center py-1 uppercase tracking-widest shadow-md">
            🔧 Ambiente de Preview (Localhost) - ⚠️ CUIDADO: DADOS SÃO REAIS (Conectado ao Banco de Produção)
        </div>
    );
}
