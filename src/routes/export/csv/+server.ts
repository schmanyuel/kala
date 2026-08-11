import type { RequestHandler } from './$types';
import { listEntriesBetween, getCurrentWageRateCents } from '$lib/server/db/queries';
import { endOfDay, startOfDay } from '$lib/date';

function csvField(value: string): string {
	if (/[;"\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function formatHours(seconds: number): string {
	return (seconds / 3600).toFixed(2).replace('.', ',');
}

function formatEuro(cents: number): string {
	return (cents / 100).toFixed(2).replace('.', ',');
}

export const GET: RequestHandler = async ({ url }) => {
	const fromRaw = url.searchParams.get('from');
	const toRaw = url.searchParams.get('to');
	const from = fromRaw ? startOfDay(new Date(fromRaw)) : startOfDay(new Date());
	const to = toRaw ? endOfDay(new Date(toRaw)) : endOfDay(new Date());

	const entries = await listEntriesBetween(from, to);
	const now = new Date();

	const rows = [['Datum', 'Job', 'Start', 'Ende', 'Dauer (h)', 'Notiz', 'Brutto (EUR)']];

	for (const entry of [...entries].reverse()) {
		const start = new Date(entry.startTime);
		const end = entry.endTime ? new Date(entry.endTime) : now;
		const seconds = Math.max(0, (end.getTime() - start.getTime()) / 1000);
		const rateCents = (await getCurrentWageRateCents(entry.jobId, start)) ?? 0;
		const grossCents = Math.round((seconds / 3600) * rateCents);

		rows.push([
			start.toLocaleDateString('de-DE'),
			entry.job.name,
			start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
			entry.endTime ? end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'läuft',
			formatHours(seconds),
			entry.note ?? '',
			formatEuro(grossCents)
		]);
	}

	const csv = rows.map((row) => row.map(csvField).join(';')).join('\r\n');
	const bom = '﻿'; // so Excel detects UTF-8

	return new Response(bom + csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="tracky-export-${fromRaw ?? 'export'}_${toRaw ?? ''}.csv"`
		}
	});
};
