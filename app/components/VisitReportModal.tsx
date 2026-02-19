"use client";

import { useState } from 'react';
import {
    X,
    ThumbsUp,
    ThumbsDown,
    Home,
    Hand,
    Ear,
    Baby,
    GraduationCap,
    Navigation,
    Loader2,
    History,
    Brain,
    AlertTriangle,
    Mic,
    MicOff,
    CheckCircle,
    CheckCircle2,
    Square,
    User
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';


interface VisitReportModalProps {
    address: any;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    onViewHistory: () => void;
    congregationType?: 'TRADITIONAL' | 'SIGN_LANGUAGE' | 'FOREIGN_LANGUAGE';
    forcedCongregationType?: 'TRADITIONAL' | 'SIGN_LANGUAGE' | 'FOREIGN_LANGUAGE'; // Backward compat
}

export default function VisitReportModal({ address, onClose, onSave, onViewHistory, congregationType: propType, forcedCongregationType }: VisitReportModalProps) {
    const { congregationType: authType } = useAuth();
    // Resolve type: Prop > Forced > Auth > Default
    const congregationType = propType || forcedCongregationType || authType || 'TRADITIONAL';

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'contacted' | 'not_contacted' | 'moved' | 'do_not_visit' | 'contested' | ''>('');
    const [isDeaf, setIsDeaf] = useState(address.isDeaf || false);
    const [isMinor, setIsMinor] = useState(address.isMinor || false);
    const [isStudent, setIsStudent] = useState(address.isStudent || false);
    const [isNeurodivergent, setIsNeurodivergent] = useState(address.isNeurodivergent || false);
    const [gender, setGender] = useState<'HOMEM' | 'MULHER' | 'CASAL' | ''>(address.gender || '');
    const [observations, setObservations] = useState(address.observations || '');
    const [isListening, setIsListening] = useState(false);

    const toggleListening = () => {
        if (isListening) {
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Seu navegador não suporta reconhecimento de voz.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            if (event.error === 'no-speech') {
                toast.error("Nenhuma voz detectada. Tente falar novamente.");
            } else {
                console.error("Erro no reconhecimento de voz:", event.error);
                toast.error("Erro ao acessar microfone.");
            }
            setIsListening(false);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setObservations((prev: string) => (prev ? `${prev} ${transcript}` : transcript));
        };

        recognition.start();
    };

    const handleSave = async () => {
        // If status is not selected, but we are editing other fields (tags/notes), we preserve the original status
        const finalStatus = status || address.visitStatus;

        if (!finalStatus) {
            alert("Selecione um resultado para a visita.");
            return;
        }

        if (status === 'contested' && !observations.trim()) {
            alert("Para contestar a inatividade, é necessário informar o motivo nas observações.");
            return;
        }

        setLoading(true);
        try {
            await onSave({
                status: finalStatus,
                isDeaf,
                isMinor,
                isStudent,
                isNeurodivergent,
                gender,
                observations
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar visita.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="bg-surface rounded-lg w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Registrar Visita</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Address Info */}
                        <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                                {address.street}
                                {!address.street?.includes(address.number || '') && address.number !== 'S/N' ? `, ${address.number}` : ''}
                            </h3>
                            {address.residentName && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{address.residentName}</p>}
                        </div>

                        {/* Status Controls */}
                        {congregationType === 'TRADITIONAL' ? (
                            <button
                                onClick={() => setStatus(status === 'contacted' ? '' : 'contacted')}
                                className={`col-span-2 w-full p-6 rounded-lg flex flex-col items-center gap-3 transition-all border-2
                                    ${status === 'contacted'
                                        ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-500/30'
                                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 hover:border-blue-300 dark:hover:border-blue-700'}`}
                            >
                                {status === 'contacted' ? (
                                    <>
                                        <CheckCircle2 className="w-12 h-12" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-lg font-black uppercase tracking-widest">Concluído</span>
                                            <span className="text-xs font-medium opacity-90">Visita realizada com sucesso</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-12 h-12" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-lg font-black uppercase tracking-widest">Concluído</span>
                                            <span className="text-xs font-medium opacity-60">Marcar rua como trabalhada</span>
                                        </div>
                                    </>
                                )}
                            </button>
                        ) : (
                            /* Sign/Foreign: Full Status Buttons */
                            <div className="grid grid-cols-2 gap-3">
                                {address.isActive === false ? (
                                    <button
                                        onClick={() => setStatus('contacted')}
                                        className={`col-span-2 p-4 rounded-xl flex flex-col items-center gap-2 transition-all border-2
                                        ${status === 'contacted' ? 'bg-green-50 dark:bg-green-900/30 border-green-500 dark:border-green-600 text-green-700 dark:text-green-400' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-green-200 dark:hover:border-green-800 text-gray-500 dark:text-gray-400'}`}
                                    >
                                        <ThumbsUp className={`w-8 h-8 ${status === 'contacted' ? 'fill-green-500' : ''}`} />
                                        <span className="text-xs font-bold uppercase">Contestar Inatividade</span>
                                        <span className="text-[10px] normal-case text-gray-500 dark:text-gray-400">Consegui entrar em contato com esse morador</span>
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setStatus('contacted')}
                                            className={`p-4 rounded-lg flex flex-col items-center gap-2 transition-all border-2
                                            ${status === 'contacted' ? 'bg-green-50 dark:bg-green-900/30 border-green-500 dark:border-green-600 text-green-700 dark:text-green-400' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 text-gray-500 dark:text-gray-400'}`}
                                        >
                                            <ThumbsUp className={`w-8 h-8 ${status === 'contacted' ? 'fill-green-500' : ''}`} />
                                            <span className="text-xs font-bold uppercase">Contatado</span>
                                        </button>

                                        <button
                                            onClick={() => setStatus('not_contacted')}
                                            className={`p-4 rounded-lg flex flex-col items-center gap-2 transition-all border-2
                                            ${status === 'not_contacted' ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-500 dark:border-orange-600 text-orange-700 dark:text-orange-400' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 text-gray-500 dark:text-gray-400'}`}
                                        >
                                            <ThumbsDown className={`w-8 h-8 ${status === 'not_contacted' ? 'fill-orange-500' : ''}`} />
                                            <span className="text-xs font-bold uppercase">Não Contatado</span>
                                        </button>

                                        <button
                                            onClick={() => setStatus('moved')}
                                            className={`p-4 rounded-lg flex flex-col items-center gap-2 transition-all border-2
                                            ${status === 'moved' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 text-gray-500 dark:text-gray-400'}`}
                                        >
                                            <Home className={`w-8 h-8 ${status === 'moved' ? 'fill-blue-500' : ''}`} />
                                            <span className="text-xs font-bold uppercase">Mudou-se</span>
                                        </button>

                                        <button
                                            onClick={() => setStatus('do_not_visit')}
                                            className={`p-4 rounded-lg flex flex-col items-center gap-2 transition-all border-2
                                            ${status === 'do_not_visit' ? 'bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-600 text-red-700 dark:text-red-400' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 text-gray-500 dark:text-gray-400'}`}
                                        >
                                            <Hand className={`w-8 h-8 ${status === 'do_not_visit' ? 'fill-red-500' : ''}`} />
                                            <span className="text-xs font-bold uppercase">Não Visitar</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Gender Selection */}
                        {(congregationType === 'SIGN_LANGUAGE' || congregationType === 'FOREIGN_LANGUAGE') && address.isActive !== false && (
                            <div className="flex gap-2">
                                {[
                                    { id: 'HOMEM', label: 'Homem' },
                                    { id: 'MULHER', label: 'Mulher' },
                                    { id: 'CASAL', label: 'Casal' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setGender(opt.id as any)}
                                        className={`flex-1 py-3.5 rounded-lg text-xs font-bold uppercase transition-all border-2 flex flex-col items-center gap-1 ${gender === opt.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-slate-600'}`}
                                    >
                                        {opt.id === 'HOMEM' && <User className="w-5 h-5 fill-current" />}
                                        {opt.id === 'MULHER' && <User className="w-5 h-5 fill-current" />}
                                        {opt.id === 'CASAL' && (
                                            <div className="flex -space-x-1">
                                                <User className="w-4 h-4 fill-current" />
                                                <User className="w-4 h-4 fill-current" />
                                            </div>
                                        )}
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Tags */}
                        {(congregationType === 'SIGN_LANGUAGE' || congregationType === 'FOREIGN_LANGUAGE') && address.isActive !== false && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setIsDeaf(!isDeaf)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors border
                                ${isDeaf ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/40' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700'}`}
                                >
                                    <Ear className="w-4 h-4" /> Surdo
                                </button>
                                <button
                                    onClick={() => setIsMinor(!isMinor)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors border
                                ${isMinor ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-900/40' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700'}`}
                                >
                                    <Baby className="w-4 h-4" /> Menor
                                </button>
                                <button
                                    onClick={() => setIsStudent(!isStudent)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors border
                                ${isStudent ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-900/40' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700'}`}
                                >
                                    <GraduationCap className="w-4 h-4" /> Estudante
                                </button>
                                <button
                                    onClick={() => setIsNeurodivergent(!isNeurodivergent)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors border
                                ${isNeurodivergent ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400 border-teal-200 dark:border-teal-900/40' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700'}`}
                                >
                                    <Brain className="w-4 h-4" /> Neurodivergente
                                </button>
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Observações {status === 'contested' && <span className="text-red-500">*</span>}</label>
                                <button
                                    onClick={toggleListening}
                                    className={`p-1.5 rounded-full transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400'}`}
                                    title={isListening ? "Parar ditado" : "Ditar observação"}
                                >
                                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                            </div>
                            <textarea
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                                className={`w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:outline-none min-h-[80px] ${status === 'contested' && !observations.trim() ? 'ring-2 ring-orange-200 bg-orange-50 dark:bg-orange-900/20' : ''}`}
                                placeholder={status === 'contested' ? "Por que este endereço deve ser considerado ativo?" : isListening ? "Ouvindo..." : "Alguma observação importante?"}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={onViewHistory}
                                className="bg-white hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white py-3.5 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-gray-200 dark:border-slate-700"
                                title="Ver Histórico"
                            >
                                <History className="w-5 h-5" />
                            </button>

                            {(address.googleMapsLink || (address.lat && address.lng)) && (
                                <a
                                    href={address.googleMapsLink || `https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 bg-white hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-gray-200 dark:border-slate-700"
                                >
                                    <Navigation className="w-4 h-4" />
                                    Mapa
                                </a>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex-[2] bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Concluir"}
                            </button>
                        </div>

                        {status && (
                            <button
                                onClick={() => setStatus('')}
                                className="w-full py-3 text-red-500 text-xs font-bold uppercase tracking-wider hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Remover Resposta
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}
