import type { PageServerLoad } from './$types';
import { toDatetimeLocal } from '$lib/format';
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from '$lib/date';
import { listArchivedJobs, listJobs } from '$lib/server/db/queries';
import { loadExportRows } from '$lib/server/export';

const isoDate = (d: Date) => toDatetimeLocal(d).slice(0, 10);

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const from = url.searchParams.get('from') ?? isoDate(startOfMonth(now));
	const to = url.searchParams.get('to') ?? isoDate(endOfMonth(now));
	const jobsRaw = url.searchParams.get('jobs');

	const [active, archived] = await Promise.all([listJobs(), listArchivedJobs()]);
	const jobs = [...active, ...archived];
	const selectedJobIds =
		jobsRaw === null ? jobs.map((j) => j.id) : jobsRaw.split(',').map(Number).filter(Boolean);

	const result = await loadExportRows(
		startOfDay(new Date(`${from}T00:00`)),
		endOfDay(new Date(`${to}T00:00`)),
		selectedJobIds
	);

	return {
		from,
		to,
		today: isoDate(now),
		jobs: jobs.map((j) => ({ id: j.id, name: j.name, color: j.color, archived: j.archived })),
		selectedJobIds,
		rows: result.rows.map((r) => ({
			id: r.entry.id,
			start: r.start,
			end: r.end,
			running: r.running,
			jobName: r.entry.job.name,
			note: r.entry.note,
			activities: r.entry.activities,
			seconds: r.seconds,
			grossCents: r.grossCents
		})),
		perJob: result.perJob,
		totalSeconds: result.totalSeconds,
		totalGrossCents: result.totalGrossCents
	};
};
