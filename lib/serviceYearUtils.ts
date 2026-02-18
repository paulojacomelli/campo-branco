import { startOfMonth, endOfMonth, subMonths, getYear, getMonth } from 'date-fns';

export function getServiceYear(date: Date = new Date()): number {
    // Service Year 2026: Sept 1, 2025 to Aug 31, 2026
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();

    if (month >= 8) { // September (8) to December (11)
        // Belongs to NEXT calendar year's service year
        // Ex: Sept 2025 -> Service Year 2026
        return year + 1;
    } else {
        // January (0) to August (7)
        // Belongs to CURRENT calendar year's service year
        // Ex: Feb 2026 -> Service Year 2026
        return year;
    }
}

export function getServiceYearLabel(serviceYear: number): string {
    return `${serviceYear - 1}-${serviceYear}`;
}

export function getServiceYearRange(serviceYear: number) {
    // Service Year 2026 starts in Sept 2025
    const startYear = serviceYear - 1;
    const start = new Date(startYear, 8, 1); // Sept 1st
    start.setHours(0, 0, 0, 0);

    const end = new Date(serviceYear, 7, 31); // Aug 31st
    end.setHours(23, 59, 59, 999);

    return { start, end };
}
