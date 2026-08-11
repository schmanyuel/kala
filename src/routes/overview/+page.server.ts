import type { PageServerLoad } from './$types';
import { listEntriesBetween, summarizeEntries } from '$lib/server/db/queries';

function startOfWeek(date: Date): Date {
	const d = new Date(date);
	const dayIndex = (d.getDay() + 6) % 7; // Monday = 0
	d.setDate(d.getDate() - dayIndex);
	d.setHours(0, 0, 0, 0);
	return d;
}

function addDays(date: Date, days: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
}

function endOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
}

export const load: PageServerLoad = async ({ url }) => {
	const offset = Number(url.searchParams.get('offset') ?? '0') || 0;
	const weekStart = addDays(startOfWeek(new Date()), offset * 7);
	const weekEnd = endOfDay(addDays(weekStart, 6));

	const entries = await listEntriesBetween(weekStart, weekEnd);
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

	return { weekStart, weekEnd, offset, days, weekSummary };
};
