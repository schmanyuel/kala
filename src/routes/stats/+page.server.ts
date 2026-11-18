import type { PageServerLoad } from './$types';
import {
	getSettings,
	listEntriesBetween,
	listJobs,
	summarizeEntries
} from '$lib/server/db/queries';
import { addDays, endOfDay, endOfMonth, isoWeek, startOfMonth, startOfWeek } from '$lib/date';
import { MINIJOB_LIMIT_CENTS } from '$lib/jobs';

const RANGES = { '12w': 12, '6m': 26, '1y': 52 } as const;
type Range = keyof typeof RANGES;

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const rangeParam = url.searchParams.get('range');
	const range: Range = rangeParam && rangeParam in RANGES ? (rangeParam as Range) : '12w';
	const weekCount = RANGES[range];

	// Hours per week over the range (including the current, unfinished week).
	const currentWeekStart = startOfWeek(now);
	const rangeStart = addDays(currentWeekStart, -(weekCount - 1) * 7);
	const monthStart = startOfMonth(now);
	const [rangeEntries, monthEntries, jobs, settings] = await Promise.all([
		listEntriesBetween(rangeStart, endOfDay(now)),
		listEntriesBetween(monthStart, endOfMonth(now)),
		listJobs(),
		getSettings()
	]);

	const weeks = await Promise.all(
		Array.from({ length: weekCount }, (_, i) => addDays(rangeStart, i * 7)).map(
			async (weekStart) => {
				const weekEnd = endOfDay(addDays(weekStart, 6));
				const weekEntries = rangeEntries.filter(
					(e) => e.startTime >= weekStart && e.startTime <= weekEnd
				);
				const summary = await summarizeEntries(weekEntries, now);
				return {
					weekStart,
					kw: isoWeek(weekStart),
					hours: summary.totalSeconds / 3600,
					grossCents: summary.totalGrossCents
				};
			}
		)
	);

	// Key figures use completed weeks only, so the running week doesn't drag the average down,
	// and start at the first week with any entry, so weeks before tracking began don't count.
	const weeklyTargetHours = Number(settings.weeklyTargetHours);
	const firstActive = weeks.findIndex((w) => w.hours > 0);
	const completed = firstActive === -1 ? [] : weeks.slice(firstActive, -1);
	const completedHours = completed.reduce((sum, w) => sum + w.hours, 0);
	const totalHours = weeks.reduce((sum, w) => sum + w.hours, 0);
	const totalGrossCents = weeks.reduce((sum, w) => sum + w.grossCents, 0);

	// Hours per job, current month.
	const perJob = await Promise.all(
		jobs.map(async (job) => {
			const summary = await summarizeEntries(
				monthEntries.filter((e) => e.jobId === job.id),
				now
			);
			return { job, hours: summary.totalSeconds / 3600, grossCents: summary.totalGrossCents };
		})
	);

	const minijobJobs = perJob.filter((p) => p.job.isMinijob);

	return {
		range,
		weeks,
		weeklyTargetHours,
		avgWeekHours: completed.length ? completedHours / completed.length : 0,
		weeksOverTarget: completed.filter((w) => w.hours >= weeklyTargetHours).length,
		completedWeeks: completed.length,
		balanceHours: completedHours - completed.length * weeklyTargetHours,
		balanceSince: completed[0]?.weekStart ?? currentWeekStart,
		avgRateCents: totalHours > 0 ? totalGrossCents / totalHours : 0,
		perJob: perJob.filter((p) => p.hours > 0).sort((a, b) => b.hours - a.hours),
		monthStart,
		minijob: minijobJobs.length
			? {
					grossCents: minijobJobs.reduce((sum, p) => sum + p.grossCents, 0),
					limitCents: MINIJOB_LIMIT_CENTS
				}
			: null
	};
};
