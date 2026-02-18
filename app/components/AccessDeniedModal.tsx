"use client";

import { X, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AccessDeniedModalProps {
    resourceName: string;
    onClose: () => void;
}

export default function AccessDeniedModal({ resourceName, onClose }: AccessDeniedModalProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 200);
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200 ${isVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent pointer-events-none'}`}>
            <div className={`bg-white dark:bg-surface rounded-lg w-full max-w-sm p-6 shadow-2xl transition-all duration-200 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-500">
                        <Lock className="w-8 h-8" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-main">Acesso Negado</h2>
                        <p className="text-sm text-gray-500 dark:text-muted">
                            Você não tem permissão para acessar {resourceName}.
                        </p>
                    </div>

                    <button
                        onClick={handleClose}
                        className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-main font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        Entendi
                    </button>
                </div>
            </div>
        </div>
    );
}
