import type { PageServerLoad } from './$types';
import { listEntriesBetween, listJobs, summarizeEntries } from '$lib/server/db/queries';
import { addDays, endOfDay, startOfMonth, endOfMonth, startOfWeek } from '$lib/date';

const WEEKS = 8;

export const load: PageServerLoad = async () => {
	const now = new Date();

	// Hours per week, last WEEKS weeks (including the current one).
	const currentWeekStart = startOfWeek(now);
	const rangeStart = addDays(currentWeekStart, -(WEEKS - 1) * 7);
	const rangeEnd = endOfDay(now);
	const rangeEntries = await listEntriesBetween(rangeStart, rangeEnd);

	const weeks = await Promise.all(
		Array.from({ length: WEEKS }, (_, i) => addDays(rangeStart, i * 7)).map(async (weekStart) => {
			const weekEnd = endOfDay(addDays(weekStart, 6));
			const weekEntries = rangeEntries.filter((e) => {
				const start = new Date(e.startTime);
				return start >= weekStart && start <= weekEnd;
			});
			const summary = await summarizeEntries(weekEntries, now);
			return { weekStart, hours: summary.totalSeconds / 3600 };
		})
	);

	// Hours per job, current month.
	const monthStart = startOfMonth(now);
	const monthEnd = endOfMonth(now);
	const [monthEntries, jobs] = await Promise.all([listEntriesBetween(monthStart, monthEnd), listJobs()]);

	const perJob = await Promise.all(
		jobs.map(async (job) => {
			const jobEntries = monthEntries.filter((e) => e.jobId === job.id);
			const summary = await summarizeEntries(jobEntries, now);
			return { job, hours: summary.totalSeconds / 3600, grossCents: summary.totalGrossCents };
		})
	);

	return {
		weeks,
		perJob: perJob.filter((p) => p.hours > 0).sort((a, b) => b.hours - a.hours),
		monthStart,
		monthEnd
	};
};
