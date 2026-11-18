import type { RequestHandler } from './$types';
import { loadExportRows, parseExportParams } from '$lib/server/export';

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

const time = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export const GET: RequestHandler = async ({ url }) => {
	const { fromRaw, toRaw, from, to, jobIds } = parseExportParams(url);
	const { rows } = await loadExportRows(from, to, jobIds);

	const lines = [
		['Datum', 'Job', 'Start', 'Ende', 'Dauer (h)', 'Notiz', 'Tätigkeiten', 'Brutto (EUR)']
	];
	for (const row of rows) {
		lines.push([
			row.start.toLocaleDateString('de-DE'),
			row.entry.job.name,
			time(row.start),
			row.running ? 'läuft' : time(row.end),
			formatHours(row.seconds),
			row.entry.note ?? '',
			row.entry.activities.join(' · '),
			formatEuro(row.grossCents)
		]);
	}

	const csv = lines.map((line) => line.map(csvField).join(';')).join('\r\n');
	const bom = '﻿'; // so Excel detects UTF-8

	return new Response(bom + csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="tracky-export-${fromRaw ?? 'export'}_${toRaw ?? ''}.csv"`
		}
	});
};
