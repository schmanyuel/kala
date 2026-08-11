import PDFDocument from 'pdfkit';
import type { RequestHandler } from './$types';
import { getCurrentWageRateCents, listEntriesBetween } from '$lib/server/db/queries';
import { endOfDay, startOfDay } from '$lib/date';
import { formatCents, formatDuration } from '$lib/format';

export const GET: RequestHandler = async ({ url }) => {
	const fromRaw = url.searchParams.get('from');
	const toRaw = url.searchParams.get('to');
	const from = fromRaw ? startOfDay(new Date(fromRaw)) : startOfDay(new Date());
	const to = toRaw ? endOfDay(new Date(toRaw)) : endOfDay(new Date());

	const entries = [...(await listEntriesBetween(from, to))].reverse();
	const now = new Date();

	type Row = { date: string; job: string; start: string; end: string; duration: string; note: string; grossCents: number };
	const rows: Row[] = [];
	let totalSeconds = 0;
	let totalGrossCents = 0;

	for (const entry of entries) {
		const start = new Date(entry.startTime);
		const end = entry.endTime ? new Date(entry.endTime) : now;
		const seconds = Math.max(0, (end.getTime() - start.getTime()) / 1000);
		const rateCents = (await getCurrentWageRateCents(entry.jobId, start)) ?? 0;
		const grossCents = Math.round((seconds / 3600) * rateCents);
		totalSeconds += seconds;
		totalGrossCents += grossCents;

		rows.push({
			date: start.toLocaleDateString('de-DE'),
			job: entry.job.name,
			start: start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
			end: entry.endTime ? end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'läuft',
			duration: formatDuration(seconds),
			note: entry.note ?? '',
			grossCents
		});
	}

	const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
		const doc = new PDFDocument({ size: 'A4', margin: 50 });
		const chunks: Buffer[] = [];
		doc.on('data', (chunk) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		doc.fontSize(18).text('Zeitbericht', { continued: false });
		doc.fontSize(10).fillColor('#666666').text(`${from.toLocaleDateString('de-DE')} – ${to.toLocaleDateString('de-DE')}`);
		doc.moveDown(1.5);

		const colX = { date: 50, job: 115, start: 220, end: 265, duration: 310, note: 365, gross: 480 };
		const headerY = doc.y;
		doc
			.fontSize(9)
			.fillColor('#000000')
			.text('Datum', colX.date, headerY, { width: 60 })
			.text('Job', colX.job, headerY, { width: 100 })
			.text('Start', colX.start, headerY, { width: 40 })
			.text('Ende', colX.end, headerY, { width: 40 })
			.text('Dauer', colX.duration, headerY, { width: 50 })
			.text('Notiz', colX.note, headerY, { width: 110 })
			.text('Brutto', colX.gross, headerY, { width: 65, align: 'right' });
		doc
			.moveTo(50, doc.y + 2)
			.lineTo(545, doc.y + 2)
			.strokeColor('#cccccc')
			.stroke();
		doc.moveDown(0.5);

		doc.fontSize(9).fillColor('#333333');
		for (const row of rows) {
			if (doc.y > 760) doc.addPage();
			const y = doc.y;
			doc
				.text(row.date, colX.date, y, { width: 60 })
				.text(row.job, colX.job, y, { width: 100 })
				.text(row.start, colX.start, y, { width: 40 })
				.text(row.end, colX.end, y, { width: 40 })
				.text(row.duration, colX.duration, y, { width: 50 })
				.text(row.note, colX.note, y, { width: 110 })
				.text(formatCents(row.grossCents), colX.gross, y, { width: 65, align: 'right' });
			doc.moveDown(0.4);
		}

		if (rows.length === 0) {
			doc.text('Keine Einträge in diesem Zeitraum.');
		}

		doc.moveDown(1);
		doc
			.moveTo(50, doc.y)
			.lineTo(545, doc.y)
			.strokeColor('#cccccc')
			.stroke();
		doc.moveDown(0.5);
		doc
			.fontSize(11)
			.fillColor('#000000')
			.text(`Gesamt: ${formatDuration(totalSeconds)}   ·   ${formatCents(totalGrossCents)} brutto`, 50, doc.y, {
				width: 495,
				align: 'right'
			});

		doc.end();
	});

	return new Response(new Uint8Array(pdfBuffer), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="tracky-export-${fromRaw ?? 'export'}_${toRaw ?? ''}.pdf"`
		}
	});
};
