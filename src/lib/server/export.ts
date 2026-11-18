import { getCurrentWageRateCents, listEntriesBetween } from '$lib/server/db/queries';
import { endOfDay, startOfDay } from '$lib/date';

/** Reads `from`, `to` (YYYY-MM-DD) and optional `jobs` (comma-separated ids) from the URL. */
export function parseExportParams(url: URL) {
	const fromRaw = url.searchParams.get('from');
	const toRaw = url.searchParams.get('to');
	const jobsRaw = url.searchParams.get('jobs');
	const jobIds = jobsRaw
		? jobsRaw
				.split(',')
				.map(Number)
				.filter((id) => Number.isInteger(id) && id > 0)
		: undefined;
	return {
		fromRaw,
		toRaw,
		// Parse YYYY-MM-DD as local dates (plain `new Date('2026-11-01')` would be UTC midnight).
		from: startOfDay(fromRaw ? new Date(`${fromRaw}T00:00`) : new Date()),
		to: endOfDay(toRaw ? new Date(`${toRaw}T00:00`) : new Date()),
		jobIds
	};
}

/** Entries in the range, oldest first, with duration and gross pay resolved. */
export async function loadExportRows(from: Date, to: Date, jobIds?: number[]) {
	const entries = [...(await listEntriesBetween(from, to, jobIds))].reverse();
	const now = new Date();
	const rows = [];
	for (const entry of entries) {
		const start = new Date(entry.startTime);
		const end = entry.endTime ? new Date(entry.endTime) : now;
		const seconds = Math.max(0, (end.getTime() - start.getTime()) / 1000);
		const rateCents = (await getCurrentWageRateCents(entry.jobId, start)) ?? 0;
		rows.push({
			entry,
			start,
			end,
			running: !entry.endTime,
			seconds,
			grossCents: Math.round((seconds / 3600) * rateCents)
		});
	}

	const perJob = new Map<
		number,
		{ name: string; color: string; seconds: number; grossCents: number }
	>();
	for (const row of rows) {
		const slot = perJob.get(row.entry.jobId) ?? {
			name: row.entry.job.name,
			color: row.entry.job.color,
			seconds: 0,
			grossCents: 0
		};
		slot.seconds += row.seconds;
		slot.grossCents += row.grossCents;
		perJob.set(row.entry.jobId, slot);
	}

	return {
		rows,
		perJob: [...perJob.values()],
		totalSeconds: rows.reduce((sum, r) => sum + r.seconds, 0),
		totalGrossCents: rows.reduce((sum, r) => sum + r.grossCents, 0)
	};
}
