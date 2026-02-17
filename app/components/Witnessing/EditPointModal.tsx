"use client";

import { useState, useEffect } from 'react';
import { X, Pencil, Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface WitnessingPoint {
    id: string;
    name: string;
    address: string;
    city_id: string;
    congregation_id: string;
    lat?: number;
    lng?: number;
    status: 'AVAILABLE' | 'OCCUPIED';
    schedule?: string;
    current_publishers?: string[];
}

interface EditPointModalProps {
    isOpen: boolean;
    onClose: () => void;
    point: WitnessingPoint | null;
    cityName: string;
}

export default function EditPointModal({ isOpen, onClose, point, cityName }: EditPointModalProps) {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [schedule, setSchedule] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (point) {
            setName(point.name || '');
            setAddress(point.address || '');
            setLat(point.lat?.toString() || '');
            setLng(point.lng?.toString() || '');
            setSchedule(point.schedule || '');
        }
    }, [point, isOpen]);

    const handleSearchLocation = async () => {
        if (!address.trim()) {
            alert("Digite um endereço para buscar.");
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
                    alert("Endereço não encontrado no mapa.");
                }
            } else {
                alert("Erro ao buscar endereço.");
            }
        } catch (error) {
            console.error("Error fetching location:", error);
            alert("Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePoint = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!point || !name.trim()) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('witnessing_points')
                .update({
                    name: name.trim(),
                    address: address.trim(),
                    lat: lat ? parseFloat(lat) : null,
                    lng: lng ? parseFloat(lng) : null,
                    schedule: schedule.trim()
                })
                .eq('id', point.id);

            if (error) throw error;
            onClose();
        } catch (error) {
            console.error("Error updating point:", error);
            alert("Erro ao atualizar ponto.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !point) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Pencil className="w-6 h-6 text-primary" />
                        Editar Ponto
                    </h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                <form onSubmit={handleUpdatePoint} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nome do Local</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-bold text-gray-900 focus:ring-2 focus:ring-primary-light/500/20 outline-none"
                            placeholder="Ex: Praça Central"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Endereço</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full bg-gray-50 border-none rounded-xl p-4 font-medium text-gray-900 focus:ring-2 focus:ring-primary-light/500/20 outline-none"
                                placeholder="Rua..."
                            />
                            <button
                                type="button"
                                onClick={handleSearchLocation}
                                className="bg-primary-light/50 text-primary p-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary-light transition-colors"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Horário (Opcional)</label>
                        <input
                            type="text"
                            value={schedule}
                            onChange={(e) => setSchedule(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-medium text-gray-900 focus:ring-2 focus:ring-primary-light/500/20 outline-none"
                            placeholder="Ex: Segundas, 08:00 - 12:00"
                        />
                    </div>

                    <button type="submit" className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold shadow-lg mt-2 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
                    </button>
                </form>
            </div>
        </div>
    );
}
