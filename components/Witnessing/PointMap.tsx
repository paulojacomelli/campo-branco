"use client";

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface WitnessingPoint {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    status: string;
}

interface PointMapProps {
    points: WitnessingPoint[];
}

export default function PointMap({ points }: PointMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<google.maps.Map | null>(null);

    useEffect(() => {
        const initMap = async () => {
            const loader = new (window as any).google.maps.plugins.loader.Loader({
                apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
                version: "weekly",
            });

            await loader.load();
            const { Map } = await (window as any).google.maps.importLibrary("maps");
            const { AdvancedMarkerElement, PinElement } = await (window as any).google.maps.importLibrary("marker");

            if (mapRef.current && !googleMapRef.current) {
                // Determine center (average or first point)
                const center = points.length > 0
                    ? { lat: points[0].latitude, lng: points[0].longitude }
                    : { lat: -23.5505, lng: -46.6333 }; // Default SP

                googleMapRef.current = new Map(mapRef.current, {
                    center,
                    zoom: 14,
                    mapId: "DEMO_MAP_ID", // Required for AdvancedMarkerElement
                    disableDefaultUI: true,
                });
            }

            // Add Markers
            if (googleMapRef.current) {
                points.forEach(point => {
                    const isOccupied = point.status === 'OCCUPIED';

                    const pin = new PinElement({
                        background: isOccupied ? "#fbbf24" : "#34d399", // Amber or Emerald
                        borderColor: isOccupied ? "#d97706" : "#059669",
                        glyphColor: "#ffffff",
                    });

                    new AdvancedMarkerElement({
                        map: googleMapRef.current,
                        position: { lat: point.latitude, lng: point.longitude },
                        title: point.name,
                        content: pin.element
                    });
                });
            }
        };

        if ((window as any).google) {
            initMap();
        }
    }, [points]);

    return (
        <div className="w-full h-full rounded-3xl overflow-hidden shadow-inner relative bg-gray-100">
            <div ref={mapRef} className="w-full h-full" />
            {/* Overlay for "Google Maps" attribution if needed, though Maps API handles it */}
        </div>
    );
}
