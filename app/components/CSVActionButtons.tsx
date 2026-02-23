
"use client";

import { useState, useEffect } from 'react';
import {
    MoreHorizontal,
    Download,
    Upload,
    FileSpreadsheet,
    ChevronDown
} from 'lucide-react';
import CSVImportModal from './CSVImportModal';
import { toast } from 'sonner';

interface CSVActionButtonsProps {
    congregationId: string;
    cityId?: string;
    territoryId?: string;
    onImportSuccess?: () => void;
    className?: string;
}

export default function CSVActionButtons({
    congregationId,
    cityId,
    territoryId,
    onImportSuccess,
    className = ''
}: CSVActionButtonsProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setIsMenuOpen(false);
        if (isMenuOpen) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isMenuOpen]);

    const handleExport = async () => {
        const params = new URLSearchParams({ congregationId });
        if (cityId) params.append('cityId', cityId);
        if (territoryId) params.append('territoryId', territoryId);

        window.location.href = `/api/data/export?${params.toString()}`;
        toast.success("Exportação iniciada...");
    };

    const downloadTemplate = () => {
        const header = "Nome da cidade,UF,Número do Mapa,Descrição,Status,Endereço Completo,Link do Google Maps,Link do Waze,Número de Residentes,Nome,Gênero,Tags,Observação";
        const example = "Catanduva,SP,01,Centro,Ativo,\"Rua Álamo, 225\",https://maps.google.com/...,https://waze.com/...,1,João Silva,Homem,Estudante,Exemplo de observação";
        const csvContent = "\ufeff" + [header, example].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `template_importacao_campo_branco.csv`;
        link.click();
        toast.info("Template baixado.");
    };

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                }}
                className="p-2.5 bg-surface border border-surface-border text-muted hover:text-primary hover:border-primary-light rounded-xl shadow-sm transition-all flex items-center justify-center group"
                title="Ações de Dados"
            >
                <MoreHorizontal className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>

            {isMenuOpen && (
                <div
                    className="absolute right-0 top-full mt-2 w-52 bg-surface border border-surface-border rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-4 py-2 border-b border-surface-border mb-1">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Manutenção CSV</p>
                    </div>

                    <button
                        onClick={() => {
                            setIsImportModalOpen(true);
                            setIsMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-main hover:bg-primary/5 hover:text-primary flex items-center gap-3 transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        Importar Dados
                    </button>

                    <button
                        onClick={() => {
                            handleExport();
                            setIsMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-main hover:bg-primary/5 hover:text-primary flex items-center gap-3 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Dados
                    </button>

                    <button
                        onClick={() => {
                            downloadTemplate();
                            setIsMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-main hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-3 transition-colors"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Baixar Template
                    </button>
                </div>
            )}

            <CSVImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                congregationId={congregationId}
                cityId={cityId}
                territoryId={territoryId}
                onSuccess={onImportSuccess}
            />
        </div>
    );
}
