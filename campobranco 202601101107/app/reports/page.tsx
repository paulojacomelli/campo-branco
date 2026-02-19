"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/app/components/BottomNav";
import { useAuth } from "@/app/context/AuthContext";
import {
    FileText,
    Lock,
    Send,
    Users,
    BarChart3,
    TrendingUp,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    Map as MapIcon,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Building2,
    AlertCircle,
    Lightbulb,
} from "lucide-react";
import { getServiceYear, getServiceYearLabel, getServiceYearRange } from "@/lib/serviceYearUtils";
import { collection, query, where, getDocs, orderBy, Timestamp, collectionGroup } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ReportsPage() {
    const { role, isElder, isServant, congregationId } = useAuth();
    const [loading, setLoading] = useState(true);

    const [selectedServiceYear, setSelectedServiceYear] = useState<number>(getServiceYear());

    // Stats State
    const [kpis, setKpis] = useState({
        totalMaps: 0,
        coveredPercentage: 0,
        avgRotationDays: 0,
        stuckMapsCount: 0
    });

    const [chartData, setChartData] = useState<{ month: string, count: number, height: number }[]>([]);
    const [insights, setInsights] = useState<{ type: 'warning' | 'info' | 'success', message: string, detail?: string }[]>([]);
    const [stuckMapsList, setStuckMapsList] = useState<any[]>([]);

    // Visit Periods State
    // Visit Periods State
    const [visitPeriods, setVisitPeriods] = useState({
        morning: { total: 0, found: 0 },
        afternoon: { total: 0, found: 0 },
        night: { total: 0, found: 0 }
    });

    useEffect(() => {
        if (!congregationId || (!isElder && !isServant)) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                // 1. Fetch Territories (Maps)
                const mapsQ = query(collection(db, "territories"), where("congregationId", "==", congregationId));
                const mapsSnap = await getDocs(mapsQ);
                const territories = mapsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 2. Fetch Shared History (Completed Maps)
                const historyQ = query(collection(db, "shared_lists"), where("congregationId", "==", congregationId));
                const historySnap = await getDocs(historyQ);
                const history = historySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // --- CALCULATE KPIS ---

                // A. Total Maps
                const totalMaps = territories.length;

                // B. Coverage (Selected Service Year)
                const { start, end } = getServiceYearRange(selectedServiceYear);

                const workedMapIds = new Set<string>();

                // 1. From History
                history.forEach((h: any) => {
                    let d = h.returnedAt ? h.returnedAt.toDate() : (h.completedAt ? h.completedAt.toDate() : null);

                    if (!d && h.status === 'completed') {
                        d = new Date();
                    }

                    if (d && d >= start && d <= end) {
                        if (h.territoryId) workedMapIds.add(h.territoryId);
                        if (h.context?.territoryId) workedMapIds.add(h.context?.territoryId);
                        if (h.items && Array.isArray(h.items)) {
                            h.items.forEach((itemId: string) => workedMapIds.add(itemId));
                        }
                    }
                });

                // 2. From Manual Dates (Territories)
                territories.forEach((t: any) => {
                    if (t.manualLastCompletedDate) {
                        const d = t.manualLastCompletedDate.toDate();
                        if (d >= start && d <= end) {
                            workedMapIds.add(t.id);
                        }
                    }
                });

                const coveredPercentage = totalMaps > 0 ? Math.floor((workedMapIds.size / totalMaps) * 100) : 0;

                // C. Rotation (Avg days to complete)
                let totalDays = 0;
                let completedCount = 0;
                history.forEach((h: any) => {
                    if (h.createdAt && h.returnedAt) {
                        const start = h.createdAt.toDate();
                        const end = h.returnedAt.toDate();
                        const diffTime = Math.abs(end.getTime() - start.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        totalDays += diffDays;
                        completedCount++;
                    }
                });
                const avgRotationDays = completedCount > 0 ? Math.round(totalDays / completedCount) : 0;

                // --- CHARTS (Monthly History) ---
                const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                // Generate months for the selected Service Year (Sep -> Aug)
                // Filter up to "now" if it's the current service year
                const chartLabels: string[] = [];
                const monthCounts: Record<string, number> = {};

                const syStart = new Date(selectedServiceYear, 8, 1);     // Sept 1st (Start Year)
                const syEnd = new Date(selectedServiceYear + 1, 7, 31);  // Aug 31st (Start Year + 1)
                const now = new Date();

                // Loop month by month
                let current = new Date(syStart);
                while (current <= syEnd) {
                    // Stop if we pass "now" and we are strictly viewing the 'current' unfinished year?
                    // Actually user said "até o momento", implying we stop at current month.
                    if (current > now && selectedServiceYear === getServiceYear()) break;

                    const mName = months[current.getMonth()];
                    monthCounts[mName] = 0;
                    chartLabels.push(mName);

                    // Next month
                    current.setMonth(current.getMonth() + 1);
                }

                history.forEach((h: any) => {
                    if (h.returnedAt) { // Use returnedAt for completion
                        const date = h.returnedAt.toDate();
                        // Only count if within our generated range
                        if (date >= syStart && date <= (current > now ? now : syEnd)) {
                            const key = months[date.getMonth()];
                            if (monthCounts[key] !== undefined) {
                                monthCounts[key]++;
                            }
                        }
                    }
                });

                const maxVal = Math.max(...Object.values(monthCounts), 1); // Avoid div by 0
                const chart = chartLabels.map(month => ({
                    month,
                    count: monthCounts[month],
                    height: Math.round((monthCounts[month] / maxVal) * 100)
                }));

                // --- INSIGHTS ---
                const newInsights: any[] = [];
                const stuckMaps: any[] = [];

                // 1. Stuck Maps (Assigned > 4 months / 120 days)
                // We need to check CURRENTLY ACTIVE shared lists
                const activeAssignments = history.filter((h: any) => h.status !== 'completed');
                activeAssignments.forEach((h: any) => {
                    if (h.createdAt) {
                        const start = h.createdAt.toDate();
                        const diffTime = Math.abs(new Date().getTime() - start.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays > 120) {
                            stuckMaps.push({
                                name: h.title || 'Mapa Sem Nome',
                                days: diffDays,
                                assignee: h.assignedName || 'Desconhecido'
                            });
                        }
                    }
                });

                if (stuckMaps.length > 0) {
                    newInsights.push({
                        type: 'warning',
                        message: `${stuckMaps.length} mapas parados há mais de 4 meses`,
                        detail: 'Verifique a lista abaixo e considere redesignar.'
                    });
                } else if (activeAssignments.length > 0) {
                    newInsights.push({
                        type: 'success',
                        message: 'Nenhum mapa parado!',
                        detail: 'O giro do território está saudável.'
                    });
                }

                // 2. Unvisited Territory Alert
                if (coveredPercentage < 20 && totalMaps > 0) {
                    newInsights.push({
                        type: 'info',
                        message: 'Baixa cobertura do território',
                        detail: `Apenas ${coveredPercentage}% do território foi trabalhado neste ano de serviço.`
                    });
                }

                setKpis({
                    totalMaps,
                    coveredPercentage,
                    avgRotationDays,
                    stuckMapsCount: stuckMaps.length
                });

                setChartData(chart);
                setInsights(newInsights);
                setStuckMapsList(stuckMaps);

                // --- VISITS BY PERIOD (Optimized) ---
                // 1. Get Cities for Congregation
                const citiesQ = query(collection(db, "cities"), where("congregationId", "==", congregationId));
                const citiesSnap = await getDocs(citiesQ);
                const cityIds = citiesSnap.docs.map(d => d.id);

                // 2. Get Addresses in those Cities (With Congregation Filter)
                let addressIds = new Set<string>();
                if (cityIds.length > 0) {
                    const chunks = [];
                    for (let i = 0; i < cityIds.length; i += 30) {
                        chunks.push(cityIds.slice(i, i + 30));
                    }
                    for (const chunk of chunks) {
                        const addrQ = query(
                            collection(db, "addresses"),
                            where("congregationId", "==", congregationId), // Fix: Missing congregation filter
                            where("cityId", "in", chunk)
                        );
                        const addrSnap = await getDocs(addrQ);
                        addrSnap.docs.forEach(d => addressIds.add(d.id));
                    }
                }

                // 3. Get Visits & Filter (Secure query)
                const visitsSnap = await getDocs(query(
                    collectionGroup(db, "visits"),
                    where("congregationId", "==", congregationId)
                ));
                let morning = { total: 0, found: 0 };
                let afternoon = { total: 0, found: 0 };
                let night = { total: 0, found: 0 };

                // Re-calculate dates for this scope
                const visStart = new Date(selectedServiceYear, 8, 1);
                const visEnd = new Date(selectedServiceYear + 1, 7, 31, 23, 59, 59);

                visitsSnap.docs.forEach(doc => {
                    const parentId = doc.ref.parent.parent?.id;
                    if (parentId && addressIds.has(parentId)) {
                        const data = doc.data();
                        const timestamp = data.createdAt || data.date;
                        const isFound = data.status === 'contacted';

                        if (timestamp) {
                            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                            if (date >= visStart && date <= visEnd) {
                                const hour = date.getHours();
                                const minute = date.getMinutes();
                                const totalMinutes = hour * 60 + minute;

                                if (totalMinutes < 720) {
                                    morning.total++;
                                    if (isFound) morning.found++;
                                } else if (totalMinutes <= 1110) {
                                    afternoon.total++;
                                    if (isFound) afternoon.found++;
                                } else {
                                    night.total++;
                                    if (isFound) night.found++;
                                }
                            }
                        }
                    }
                });

                setVisitPeriods({ morning, afternoon, night });

            } catch (error) {
                console.error("Error fetching reports:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [congregationId, isElder, isServant, selectedServiceYear]);

    // Role Guard
    if (!loading && !isElder && !isServant && role !== 'SUPER_ADMIN') {
        return (
            <div className="bg-background min-h-screen pb-24 font-sans text-main flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                    <Lock className="w-8 h-8 text-muted" />
                </div>
                <h1 className="font-bold text-lg text-main">Acesso Restrito</h1>
                <p className="text-muted text-sm mt-2 max-w-xs">
                    Esta área contém relatórios gerenciais disponíveis apenas para Superintendentes de Serviço e Servos de Territórios.
                </p>
                <BottomNav />
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen pb-24 font-sans text-main">
            <header className="bg-surface sticky top-0 z-30 px-6 py-4 border-b border-surface-border flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-600 p-2 rounded-xl text-white shadow-lg shadow-purple-500/20">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-main tracking-tight leading-tight">Relatórios</h1>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Inteligência de Território</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-transparent dark:border-gray-800">
                    <button
                        onClick={() => setSelectedServiceYear(prev => prev - 1)}
                        className="p-1 hover:bg-white dark:hover:bg-gray-800 rounded-md shadow-sm transition-all text-main"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold min-w-[90px] text-center text-main">
                        {getServiceYearLabel(selectedServiceYear)}
                    </span>
                    <button
                        onClick={() => setSelectedServiceYear(prev => prev + 1)}
                        className="p-1 hover:bg-white dark:hover:bg-gray-800 rounded-md shadow-sm transition-all text-main"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <main className="p-6 space-y-8 max-w-xl mx-auto">

                {/* KPI Cards Row */}
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x hide-scrollbar">
                    {/* Card 1: Total Maps */}
                    <div className="min-w-[140px] bg-surface p-5 rounded-3xl shadow-sm border border-surface-border snap-center">
                        <div className="flex items-center gap-2 mb-3 text-primary dark:text-primary-light font-bold">
                            <MapIcon className="w-5 h-5" />
                        </div>
                        <p className="text-3xl font-black text-main mb-1">{kpis.totalMaps}</p>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Mapas Totais</p>
                    </div>

                    {/* Card 2: Coverage */}
                    <div className="min-w-[140px] bg-surface p-5 rounded-3xl shadow-sm border border-surface-border snap-center">
                        <div className="flex items-center gap-2 mb-3 text-primary dark:text-primary-light">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <p className="text-3xl font-black text-main mb-1">{kpis.coveredPercentage}%</p>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Cobertura</p>
                    </div>

                    {/* Card 3: Rotation (Alert if high) */}
                    <div className={`min-w-[140px] p-5 rounded-3xl shadow-sm border snap-center ${kpis.avgRotationDays > 120 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30' : 'bg-surface border-surface-border'}`}>
                        <div className={`flex items-center gap-2 mb-3 ${kpis.avgRotationDays > 120 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            <Clock className="w-5 h-5" />
                            {kpis.avgRotationDays > 120 && <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <p className={`text-3xl font-black mb-1 ${kpis.avgRotationDays > 120 ? 'text-red-900 dark:text-red-100' : 'text-main'}`}>{kpis.avgRotationDays}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${kpis.avgRotationDays > 120 ? 'text-red-400 dark:text-red-300' : 'text-muted'}`}>Giro Médio (Dias)</p>
                    </div>
                </div>

                {/* Visits by Period */}
                <div className="bg-surface p-6 rounded-3xl shadow-sm border border-surface-border mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-main">Visitas por Período</h2>
                        <Clock className="w-5 h-5 text-muted" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-orange-500/5 dark:bg-orange-500/10 p-4 rounded-2xl border border-surface-border flex flex-col items-center">
                            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Manhã</span>
                            <span className="text-2xl font-black text-orange-500">{visitPeriods.morning.total}</span>
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] text-orange-400 font-bold">
                                    {visitPeriods.morning.total > 0
                                        ? Math.round((visitPeriods.morning.found / visitPeriods.morning.total) * 100)
                                        : 0}%
                                </span>
                                <span className="text-[10px] text-orange-300 dark:text-orange-500/70">Aprov.</span>
                            </div>
                        </div>
                        <div className="bg-primary-light/10 dark:bg-primary-dark/10 p-4 rounded-2xl border border-surface-border flex flex-col items-center">
                            <span className="text-[10px] font-bold text-primary dark:text-primary-light uppercase tracking-widest mb-1">Tarde</span>
                            <span className="text-2xl font-black text-primary dark:text-primary-light">{visitPeriods.afternoon.total}</span>
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] text-primary font-bold dark:text-primary-light">
                                    {visitPeriods.afternoon.total > 0
                                        ? Math.round((visitPeriods.afternoon.found / visitPeriods.afternoon.total) * 100)
                                        : 0}%
                                </span>
                                <span className="text-[10px] text-primary-light/70">Aprov.</span>
                            </div>
                        </div>
                        <div className="bg-blue-500/5 dark:bg-blue-500/10 p-4 rounded-2xl border border-surface-border flex flex-col items-center">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Noite</span>
                            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{visitPeriods.night.total}</span>
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] text-blue-400 font-bold">
                                    {visitPeriods.night.total > 0
                                        ? Math.round((visitPeriods.night.found / visitPeriods.night.total) * 100)
                                        : 0}%
                                </span>
                                <span className="text-[10px] text-blue-300 dark:text-blue-500/70">Aprov.</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-surface p-6 rounded-3xl shadow-sm border border-surface-border">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-main">Histórico de Trabalho</h2>
                        <span className="text-xs font-bold text-muted bg-surface-border text-primary dark:text-primary-light px-2 py-1 rounded-full">Ano de Serviço {getServiceYearLabel(selectedServiceYear)}</span>
                    </div>

                    <div className="h-40 grid grid-cols-12 items-end gap-1 sm:gap-2">
                        {chartData.map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2 w-full group cursor-pointer">
                                <div className="w-full relative h-32 bg-gray-50 dark:bg-gray-800 rounded-t-xl flex items-end">
                                    <div
                                        style={{ height: `${item.height}%` }}
                                        className={`w-full transition-all duration-700 ease-out rounded-t-xl relative group-hover:opacity-90
                                            ${idx === chartData.length - 1 ? 'bg-purple-600' : 'bg-purple-200'}
                                        `}
                                    >
                                        {/* Tooltip */}
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            {item.count} Mapas
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-muted uppercase">{item.month}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Insights Section */}
                <div>
                    <h2 className="font-bold text-main text-lg mb-4 px-1">Insights Inteligentes</h2>
                    <div className="space-y-4">
                        {insights.map((insight, idx) => (
                            <div key={idx} className={`p-5 rounded-3xl border flex gap-4 ${insight.type === 'warning' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30' :
                                insight.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30' :
                                    'bg-primary-light/50 dark:bg-primary-dark/20 border-primary-light dark:border-primary-dark/30'
                                }`}>
                                <div className={`p-2 rounded-xl h-fit shrink-0 ${insight.type === 'warning' ? 'bg-surface text-red-500 shadow-sm' :
                                    insight.type === 'success' ? 'bg-surface text-green-500 shadow-sm' :
                                        'bg-surface text-primary shadow-sm'
                                    }`}>
                                    {insight.type === 'warning' ? <AlertCircle className="w-5 h-5" /> :
                                        insight.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                                            <Lightbulb className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className={`font-bold text-sm mb-1 ${insight.type === 'warning' ? 'text-red-900 dark:text-red-100' :
                                        insight.type === 'success' ? 'text-green-900 dark:text-green-100' :
                                            'text-primary-dark dark:text-primary-light'
                                        }`}>{insight.message}</h3>
                                    <p className={`text-xs leading-relaxed ${insight.type === 'warning' ? 'text-red-700 dark:text-red-300' :
                                        insight.type === 'success' ? 'text-green-700 dark:text-green-300' :
                                            'text-primary-dark dark:text-primary-light'
                                        }`}>{insight.detail}</p>
                                </div>
                            </div>
                        ))}

                        {/* Stuck Maps List Detail */}
                        {stuckMapsList.length > 0 && (
                            <div className="bg-surface rounded-3xl border border-surface-border overflow-hidden shadow-sm">
                                <div className="bg-red-50 dark:bg-red-900/20 px-5 py-3 border-b border-red-100 dark:border-red-900/30 flex justify-between items-center">
                                    <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-widest">Mapas Parados</span>
                                    <span className="text-xs font-bold bg-surface text-red-600 px-2 py-0.5 rounded-full">{stuckMapsList.length}</span>
                                </div>
                                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {stuckMapsList.slice(0, 5).map((map, idx) => (
                                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <div>
                                                <p className="font-bold text-main text-sm">{map.name}</p>
                                                <p className="text-xs text-muted mt-0.5">Com: {map.assignee}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-red-600 dark:text-red-400 text-sm">{map.days} dias</p>
                                                <p className="text-[10px] text-muted font-bold uppercase">Parado</p>
                                            </div>
                                        </div>
                                    ))}
                                    {stuckMapsList.length > 5 && (
                                        <div className="p-3 text-center border-t border-gray-50 dark:border-gray-800">
                                            <button className="text-xs font-bold text-primary dark:text-primary-light hover:text-primary-dark flex items-center justify-center gap-1 mx-auto">
                                                Ver Todos <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Registry Section */}
                <div>
                    <h2 className="font-bold text-main text-lg mb-4 px-1">Registros</h2>
                    <a href="/reports/registry" className="block bg-surface p-6 rounded-3xl shadow-sm border border-surface-border hover:border-primary-light dark:hover:border-primary-dark transition-all group">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-light/50 rounded-lg text-primary dark:bg-primary-dark/30 dark:text-primary-light group-hover:scale-110 transition-transform">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-main group-hover:text-primary dark:group-hover:text-primary-light transition-colors">Registro de Designação de Território</h3>
                                    <p className="text-xs text-muted">Acesse o formulário S-13 com histórico de designações.</p>
                                </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full">
                                <ArrowRight className="w-5 h-5 text-gray-400" />
                            </div>
                        </div>
                    </a>
                </div>

            </main>
            <BottomNav />
        </div>
    );
}
