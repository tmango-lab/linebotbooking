export const formatDate = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return '-';
    try {
        let parsedString = dateInput;
        if (typeof dateInput === 'string') {
            if (dateInput.includes(' ')) {
                parsedString = dateInput.replace(' ', 'T');
            } else if (!dateInput.includes('T')) {
                parsedString = `${dateInput}T00:00:00`;
            }
        }
        const d = typeof dateInput === 'string'
            ? new Date(parsedString)
            : dateInput;

        // Check for invalid date
        if (isNaN(d.getTime())) return '-';

        // "จ. 23 ก.พ. 2026"
        const formatter = new Intl.DateTimeFormat('th-TH', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });

        const parts = formatter.formatToParts(d);
        let weekday = '';
        let day = '';
        let month = '';

        for (const part of parts) {
            if (part.type === 'weekday') weekday = part.value;
            else if (part.type === 'day') day = part.value;
            else if (part.type === 'month') month = part.value;
        }

        const yearAD = d.getFullYear(); // AD year (e.g. 2026)

        return `${weekday} ${day} ${month} ${yearAD}`.replace(/\s+/g, ' ').trim();
    } catch (e) {
        return '-';
    }
};

export const formatTime = (timeInput: string | Date | null | undefined): string => {
    if (!timeInput) return '-';
    try {
        let parsedString = timeInput;
        if (typeof timeInput === 'string') {
            if (timeInput.includes(' ')) {
                parsedString = timeInput.replace(' ', 'T');
            } else if (!timeInput.includes('T')) {
                if (timeInput.includes(':') && !timeInput.includes('-')) {
                    parsedString = `1970-01-01T${timeInput}`;
                } else if (!timeInput.includes(':') && timeInput.includes('-')) {
                    parsedString = `${timeInput}T00:00:00`;
                }
            }
        }
        const d = typeof timeInput === 'string'
            ? new Date(parsedString)
            : timeInput;

        if (isNaN(d.getTime())) return '-';

        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '-';
    }
};

export const formatDateTime = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return '-';
    const dateStr = formatDate(dateInput);
    if (dateStr === '-') return '-';

    try {
        let parsedString = dateInput;
        if (typeof dateInput === 'string') {
            if (dateInput.includes(' ')) {
                parsedString = dateInput.replace(' ', 'T');
            } else if (!dateInput.includes('T')) {
                parsedString = `${dateInput}T00:00:00`;
            }
        }
        const d = typeof dateInput === 'string'
            ? new Date(parsedString)
            : dateInput;
        const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} ${timeStr}`;
    } catch (e) {
        return dateStr;
    }
};
