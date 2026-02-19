export default function MapPlaceholder() {
    return (
        <div className="w-full h-[400px] bg-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden border border-gray-300">
            <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>
            <div className="text-center p-4 bg-white/80 backdrop-blur rounded shadow-sm z-10">
                <p className="font-bold text-gray-700">Google Maps Integration</p>
                <p className="text-xs text-muted mt-1">API Key Required</p>
            </div>
        </div>
    )
}
