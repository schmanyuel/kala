import PDFDocument from 'pdfkit';
import type { RequestHandler } from './$types';
import { loadExportRows, parseExportParams } from '$lib/server/export';
import { formatCents, formatDuration } from '$lib/format';

const time = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export const GET: RequestHandler = async ({ url }) => {
	const { fromRaw, toRaw, from, to, jobIds } = parseExportParams(url);
	const data = await loadExportRows(from, to, jobIds);
	const { totalSeconds, totalGrossCents } = data;
	const rows = data.rows.map((row) => ({
		date: row.start.toLocaleDateString('de-DE'),
		job: row.entry.job.name,
		start: time(row.start),
		end: row.running ? 'läuft' : time(row.end),
		duration: formatDuration(row.seconds),
		note: row.entry.note ?? '',
		activities: row.entry.activities,
		grossCents: row.grossCents
	}));

	const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
		const doc = new PDFDocument({ size: 'A4', margin: 50 });
		const chunks: Buffer[] = [];
		doc.on('data', (chunk) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		doc.fontSize(18).text('Stundennachweis', { continued: false });
		doc
			.fontSize(10)
			.fillColor('#666666')
			.text(`${from.toLocaleDateString('de-DE')} – ${to.toLocaleDateString('de-DE')}`);
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
			if (row.activities.length) {
				doc
					.fontSize(8)
					.fillColor('#666666')
					.text(row.activities.map((a) => `– ${a}`).join('\n'), colX.job, doc.y + 1, { width: 430 })
					.fontSize(9)
					.fillColor('#333333');
			}
			doc.moveDown(0.4);
		}

		if (rows.length === 0) {
			doc.text('Keine Einträge in diesem Zeitraum.');
		}

		doc.moveDown(1);
		doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
		doc.moveDown(0.5);
		if (data.perJob.length > 1) {
			doc.fontSize(9).fillColor('#666666');
			for (const job of data.perJob) {
				doc.text(
					`${job.name}: ${formatDuration(job.seconds)}   ·   ${formatCents(job.grossCents)}`,
					50,
					doc.y,
					{
						width: 495,
						align: 'right'
					}
				);
			}
			doc.moveDown(0.3);
		}
		doc
			.fontSize(11)
			.fillColor('#000000')
			.text(
				`Gesamt: ${formatDuration(totalSeconds)}   ·   ${formatCents(totalGrossCents)} brutto`,
				50,
				doc.y,
				{
					width: 495,
					align: 'right'
				}
			);

		doc.end();
	});

	return new Response(new Uint8Array(pdfBuffer), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="tracky-export-${fromRaw ?? 'export'}_${toRaw ?? ''}.pdf"`
		}
	});
};
