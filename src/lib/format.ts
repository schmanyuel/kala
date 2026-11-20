import { locale, type Lang } from './i18n';

export function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function formatSignedDuration(totalSeconds: number): string {
	const sign = totalSeconds < 0 ? '−' : '+';
	return `${sign}${formatDuration(Math.abs(totalSeconds))}`;
}

export function formatCents(cents: number, lang?: Lang): string {
	return (cents / 100).toLocaleString(locale(lang), { style: 'currency', currency: 'EUR' });
}

export function formatTime(date: Date, lang?: Lang): string {
	return date.toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });
}

/** Formats a Date as a value for <input type="datetime-local">, in local time. */
export function toDatetimeLocal(date: Date): string {
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
