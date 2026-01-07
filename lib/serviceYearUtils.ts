
import { startOfMonth, endOfMonth, subMonths, getYear, getMonth } from 'date-fns';

export function getServiceYear(date: Date = new Date()): number {
    // Service Year starts in September.
    // If Month is Jan(0) to Aug(7), Service Year started previous year.
    // If Month is Sept(8) to Dec(11), Service Year started current year.
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();

    if (month >= 8) { // September or later
        return year;
    } else {
        return year - 1;
    }
}

export function getServiceYearLabel(startYear: number): string {
    return `${startYear}-${startYear + 1}`;
}

export function getServiceYearRange(startYear: number) {
    const start = new Date(startYear, 8, 1); // Sept 1st
    const end = new Date(startYear + 1, 7, 31, 23, 59, 59); // Aug 31st
    return { start, end };
}
