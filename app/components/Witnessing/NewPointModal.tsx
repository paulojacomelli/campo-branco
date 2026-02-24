"use client";

import { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface NewPointModalProps {
    isOpen: boolean;
    onClose: () => void;
    cityId: string;
    congregationId: string;
    cityName: string;
}

export default function NewPointModal({ isOpen, onClose, cityId, congregationId, cityName }: NewPointModalProps) {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [schedule, setSchedule] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearchLocation = async () => {
        if (!address.trim()) {
            toast.error("Digite um endereço para buscar.");
            return;
        }

        setLoading(true);
        try {
            const query = `${address}, ${cityName}, Brasil`;
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
                headers: { 'User-Agent': 'CampoBrancoApp/1.0' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    setLat(data[0].lat);
                    setLng(data[0].lon);
                } else {
                    toast.error("Endereço não encontrado no mapa.");
                }
            } else {
                toast.error("Erro ao buscar endereço.");
            }
        } catch (error) {
            console.error("Error fetching location:", error);
            toast.error("Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePoint = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            const { error } = await supabase.from('witnessing_points').insert({
                name: name.trim(),
                address: address.trim(),
                city_id: cityId,
                congregation_id: congregationId,
                lat: lat ? parseFloat(lat) : null,
                lng: lng ? parseFloat(lng) : null,
                schedule: schedule.trim(),
                status: 'AVAILABLE',
                current_publishers: []
            });

            if (error) throw error;

            setName('');
            setAddress('');
            setLat('');
            setLng('');
            setSchedule('');
            onClose();
        } catch (error) {
            console.error("Error creating point:", error);
            toast.error("Erro ao criar ponto.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-lg w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Plus className="w-6 h-6 text-amber-600" />
                        Novo Ponto
                    </h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                <form onSubmit={handleCreatePoint} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nome do Local</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-lg p-4 font-bold text-gray-900 focus:ring-2 focus:ring-amber-500/20 outline-none"
                            placeholder="Ex: Praça Central"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Endereço</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full bg-gray-50 border-none rounded-lg p-4 font-medium text-gray-900 focus:ring-2 focus:ring-amber-500/20 outline-none"
                                placeholder="Rua..."
                            />
                            <button
                                type="button"
                                onClick={handleSearchLocation}
                                className="bg-amber-100 text-amber-700 p-3 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-amber-200 transition-colors"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mapa'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Horário (Opcional)</label>
                        <input
                            type="text"
                            value={schedule}
                            onChange={(e) => setSchedule(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-medium text-gray-900 focus:ring-2 focus:ring-amber-500/20 outline-none"
                            placeholder="Ex: Segundas, 08:00 - 12:00"
                        />
                    </div>

                    <button type="submit" className="w-full py-3.5 bg-gray-900 text-white rounded-lg font-bold shadow-lg mt-2 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Ponto'}
                    </button>
                </form>
            </div>
        </div>
    );
}
