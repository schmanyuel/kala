import type { PageServerLoad } from './$types';
import { getSettings, listEntriesBetween, summarizeEntries } from '$lib/server/db/queries';
import { addDays, endOfDay, startOfWeek } from '$lib/date';

export const load: PageServerLoad = async ({ url }) => {
	const offset = Number(url.searchParams.get('offset') ?? '0') || 0;
	const weekStart = addDays(startOfWeek(new Date()), offset * 7);
	const weekEnd = endOfDay(addDays(weekStart, 6));

	const [entries, settings] = await Promise.all([listEntriesBetween(weekStart, weekEnd), getSettings()]);
	const now = new Date();

	const days = await Promise.all(
		Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map(async (dayStart) => {
			const dayEnd = endOfDay(dayStart);
			const dayEntries = entries.filter((e) => {
				const start = new Date(e.startTime);
				return start >= dayStart && start <= dayEnd;
			});
			const summary = await summarizeEntries(dayEntries, now);
			return { date: dayStart, entries: dayEntries, summary };
		})
	);

	const weekSummary = await summarizeEntries(entries, now);
	const weeklyTargetHours = Number(settings.weeklyTargetHours);
	const overtimeSeconds = weekSummary.totalSeconds - weeklyTargetHours * 3600;

	return { weekStart, weekEnd, offset, days, weekSummary, weeklyTargetHours, overtimeSeconds };
};
