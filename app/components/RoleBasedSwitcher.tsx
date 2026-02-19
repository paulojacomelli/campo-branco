"use client";

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { LayoutGrid, Table2 } from 'lucide-react';
import { Suspense } from 'react';

function SwitcherContent() {
    const { isSuperAdmin, isElder, isServant } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Show only for specific roles - REMOVED to fix visibility issue
    // Access control is handled by the parent pages
    // if (!isSuperAdmin && !isElder && !isServant) return null;


    const currentView = searchParams.get('view') === 'table' ? 'TABLE' : 'GRID';

    const handleSwitch = (view: 'GRID' | 'TABLE') => {
        const params = new URLSearchParams(searchParams.toString());
        if (view === 'TABLE') {
            params.set('view', 'table');
        } else {
            params.delete('view');
        }
        router.replace(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-lg flex items-center border border-gray-200 dark:border-slate-700">
            <button
                onClick={() => handleSwitch('GRID')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${currentView === 'GRID' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                title="Visualização em Grade"
            >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grade</span>
            </button>
            <button
                onClick={() => handleSwitch('TABLE')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${currentView === 'TABLE' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                title="Visualização em Lista"
            >
                <Table2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabela</span>
            </button>
        </div>
    );
}

export default function RoleBasedSwitcher() {
    return (
        <Suspense fallback={null}>
            <SwitcherContent />
        </Suspense>
    );
}
