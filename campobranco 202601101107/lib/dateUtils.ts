export const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    // Reset hours to compare just dates for more intuitive "days ago"
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = Math.abs(today.getTime() - target.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const dateString = date.toLocaleDateString('pt-BR');
    let relativeString = '';

    if (diffDays <= 30) {
        relativeString = `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} atrás`;
        if (diffDays === 0) relativeString = 'hoje';
    } else if (diffDays <= 365) {
        // Use simpler month calculation for user friendliness
        let months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
        // Adjust if day of month hasn't passed yet
        if (now.getDate() < date.getDate()) months--;

        if (months < 1) months = 1; // Fallback for edge cases just over 30 days

        relativeString = `${months} ${months === 1 ? 'mês' : 'meses'} atrás`;
    } else {
        let years = now.getFullYear() - date.getFullYear();
        // Adjust if date hasn't passed yet in the current year
        const currentMonth = now.getMonth();
        const targetMonth = date.getMonth();
        if (currentMonth < targetMonth || (currentMonth === targetMonth && now.getDate() < date.getDate())) {
            years--;
        }

        if (years < 1) years = 1; // Should technically be months logic above, but fail-safe

        relativeString = `${years} ${years === 1 ? 'ano' : 'anos'} atrás`;
    }

    return `${dateString} (${relativeString})`;
};
