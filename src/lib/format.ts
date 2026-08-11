export function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function formatCents(cents: number): string {
	return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function formatTime(date: Date): string {
	return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: Date): string {
	return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/** Formats a Date as a value for <input type="datetime-local">, in local time. */
export function toDatetimeLocal(date: Date): string {
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
