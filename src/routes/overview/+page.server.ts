import type { PageServerLoad } from './$types';
import {
	getCurrentWageRateCents,
	getSettings,
	listEntriesBetween,
	summarizeEntries
} from '$lib/server/db/queries';
import { addDays, endOfDay, startOfDay, startOfWeek } from '$lib/date';

export const load: PageServerLoad = async ({ url }) => {
	const offset = Number(url.searchParams.get('offset') ?? '0') || 0;
	const now = new Date();
	const weekStart = addDays(startOfWeek(now), offset * 7);
	const weekEnd = endOfDay(addDays(weekStart, 6));

	const [entries, settings] = await Promise.all([
		listEntriesBetween(weekStart, weekEnd),
		getSettings()
	]);

	const days = await Promise.all(
		Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map(async (dayStart) => {
			const dayEnd = endOfDay(dayStart);
			const dayEntries = entries
				.filter((e) => e.startTime >= dayStart && e.startTime <= dayEnd)
				.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
			const summary = await summarizeEntries(dayEntries, now);
			return { date: dayStart, entries: dayEntries, summary };
		})
	);

	const weekSummary = await summarizeEntries(entries, now);

	// Seconds per job this week, plus each job's current rate for the legend.
	const perJobMap = new Map<number, { name: string; color: string; seconds: number }>();
	for (const e of entries) {
		const seconds = Math.max(0, ((e.endTime ?? now).getTime() - e.startTime.getTime()) / 1000);
		const slot = perJobMap.get(e.jobId) ?? { name: e.job.name, color: e.job.color, seconds: 0 };
		slot.seconds += seconds;
		perJobMap.set(e.jobId, slot);
	}
	const perJob = await Promise.all(
		[...perJobMap.entries()].map(async ([jobId, slot]) => ({
			...slot,
			rateCents: await getCurrentWageRateCents(jobId)
		}))
	);
	perJob.sort((a, b) => b.seconds - a.seconds);

	return {
		weekStart,
		weekEnd,
		offset,
		today: startOfDay(now),
		days,
		weekSummary,
		perJob,
		weeklyTargetHours: Number(settings.weeklyTargetHours)
	};
};
