import type { RequestHandler } from './$types';
import { loadExportRows, parseExportParams } from '$lib/server/export';
import { getLang } from '$lib/server/db/queries';
import { LOCALES, translate, type Lang } from '$lib/i18n';

// German Excel expects ';' and a decimal comma; English Excel ',' and a decimal point.
const delimiter = (lang: Lang) => (lang === 'de' ? ';' : ',');
const decimal = (n: number, lang: Lang) => n.toFixed(2).replace('.', lang === 'de' ? ',' : '.');

function csvField(value: string, sep: string): string {
	if (value.includes(sep) || /["\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

export const GET: RequestHandler = async ({ url }) => {
	const { fromRaw, toRaw, from, to, jobIds } = parseExportParams(url);
	const { rows } = await loadExportRows(from, to, jobIds);
	const lang = await getLang();
	const t = (key: string) => translate(lang, key);
	const sep = delimiter(lang);
	const time = (d: Date) =>
		d.toLocaleTimeString(LOCALES[lang], { hour: '2-digit', minute: '2-digit' });

	const lines = [
		[
			t('Date'),
			t('Job'),
			t('Start'),
			t('End'),
			t('Duration (h)'),
			t('Note'),
			t('Activities'),
			t('Gross (EUR)')
		]
	];
	for (const row of rows) {
		lines.push([
			row.start.toLocaleDateString(LOCALES[lang]),
			row.entry.job.name,
			time(row.start),
			row.running ? t('running') : time(row.end),
			decimal(row.seconds / 3600, lang),
			row.entry.note ?? '',
			row.entry.activities.join(' · '),
			decimal(row.grossCents / 100, lang)
		]);
	}

	const csv = lines.map((line) => line.map((f) => csvField(f, sep)).join(sep)).join('\r\n');
	const bom = '﻿'; // so Excel detects UTF-8

	return new Response(bom + csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="kala-export-${fromRaw ?? 'export'}_${toRaw ?? ''}.csv"`
		}
	});
};
