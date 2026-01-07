"use client";

import { useAuth } from "@/app/context/AuthContext";
import { Eye, X } from "lucide-react";

export default function SimulationBanner() {
    const { isSimulating, role, simulateRole, actualRole } = useAuth();

    if (!isSimulating) return null;

    const stopSimulation = () => {
        simulateRole(null);
    };

    const getRoleLabel = (r: string | null) => {
        switch (r) {
            case 'SUPER_ADMIN': return 'Super Admin';
            case 'ANCIAO': return 'Ancião';
            case 'SERVO': return 'Servo Ministerial';
            case 'PUBLICADOR': return 'Publicador';
            default: return r;
        }
    };

    return (
        <div className="fixed bottom-[88px] left-4 right-4 z-[100] bg-indigo-600 text-white shadow-xl rounded-2xl animate-in slide-in-from-bottom-5 border border-indigo-400/30">
            <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-full animate-pulse">
                        <Eye className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Modo de Simulação Ativo</p>
                        <p className="font-bold text-sm">
                            Visualizando como: <span className="underline decoration-indigo-300 underline-offset-2">{getRoleLabel(role)}</span>
                        </p>
                    </div>
                </div>

                <button
                    onClick={stopSimulation}
                    className="flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-50 font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
                >
                    <X className="w-4 h-4" />
                    Sair da Simulação
                </button>
            </div>
        </div>
    );
}
