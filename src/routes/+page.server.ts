import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addActivity,
	createTodo,
	deleteEntry,
	deleteTodo,
	getCurrentWageRateCents,
	getRunningEntry,
	getSettings,
	listEntriesBetween,
	listJobs,
	listTodos,
	removeActivity,
	setTodoDone,
	startTimer,
	stopTimer,
	summarizeEntries
} from '$lib/server/db/queries';
import { addDays, endOfDay, endOfMonth, startOfDay, startOfMonth, startOfWeek } from '$lib/date';
import { MINIJOB_LIMIT_CENTS } from '$lib/jobs';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const weekStart = startOfWeek(now);
	const [jobs, runningEntry, todayEntries, weekEntries, monthEntries, settings, todos] =
		await Promise.all([
			listJobs(),
			getRunningEntry(),
			listEntriesBetween(startOfDay(now), endOfDay(now)),
			listEntriesBetween(weekStart, endOfDay(addDays(weekStart, 6))),
			listEntriesBetween(startOfMonth(now), endOfMonth(now)),
			getSettings(),
			listTodos(startOfDay(now))
		]);

	const [todaySummary, weekSummary, monthSummary, minijobSummary] = await Promise.all([
		summarizeEntries(todayEntries, now),
		summarizeEntries(weekEntries, now),
		summarizeEntries(monthEntries, now),
		summarizeEntries(
			monthEntries.filter((e) => e.job.isMinijob),
			now
		)
	]);

	// Seconds per weekday (Mon–Sun) and job, for the stacked week chart.
	const week = Array.from({ length: 7 }, (_, i) => {
		const day = addDays(weekStart, i);
		const perJob = new Map<number, { color: string; name: string; seconds: number }>();
		for (const e of weekEntries) {
			const start = new Date(e.startTime);
			if (start < day || start > endOfDay(day)) continue;
			const seconds = Math.max(
				0,
				((e.endTime ? new Date(e.endTime) : now).getTime() - start.getTime()) / 1000
			);
			const slot = perJob.get(e.jobId) ?? { color: e.job.color, name: e.job.name, seconds: 0 };
			slot.seconds += seconds;
			perJob.set(e.jobId, slot);
		}
		const segments = [...perJob.values()];
		return { day, segments, totalSeconds: segments.reduce((sum, s) => sum + s.seconds, 0) };
	});

	const runningRateCents = runningEntry
		? ((await getCurrentWageRateCents(runningEntry.jobId, new Date(runningEntry.startTime))) ?? 0)
		: 0;

	return {
		jobs,
		runningEntry,
		runningRateCents,
		todayEntries,
		todos,
		todaySummary,
		weekSummary,
		monthSummary,
		week,
		weeklyTargetHours: Number(settings.weeklyTargetHours),
		minijob: jobs.some((j) => j.isMinijob)
			? { grossCents: minijobSummary.totalGrossCents, limitCents: MINIJOB_LIMIT_CENTS }
			: null
	};
};

export const actions: Actions = {
	startTimer: async ({ request }) => {
		const form = await request.formData();
		const jobId = Number(form.get('jobId'));
		const projectIdRaw = form.get('projectId');
		const note = String(form.get('note') ?? '').trim() || null;

		if (!jobId) return fail(400, { error: 'Bitte einen Job auswählen.' });

		try {
			await startTimer(jobId, projectIdRaw ? Number(projectIdRaw) : null, note);
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : 'Timer konnte nicht gestartet werden.'
			});
		}
		return { success: true };
	},

	stopTimer: async () => {
		try {
			await stopTimer();
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : 'Timer konnte nicht gestoppt werden.'
			});
		}
		return { success: true };
	},

	deleteEntry: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Eintrag fehlt.' });
		await deleteEntry(id);
		return { success: true };
	},

	addActivity: async ({ request }) => {
		const form = await request.formData();
		const entryId = Number(form.get('entryId'));
		const text = String(form.get('text') ?? '').trim();
		if (!entryId || !text) return fail(400, { error: 'Tätigkeit fehlt.' });
		await addActivity(entryId, text);
		return { success: true };
	},

	removeActivity: async ({ request }) => {
		const form = await request.formData();
		const entryId = Number(form.get('entryId'));
		const index = Number(form.get('index'));
		if (!entryId || !Number.isInteger(index)) return fail(400, { error: 'Tätigkeit fehlt.' });
		await removeActivity(entryId, index);
		return { success: true };
	},

	createTodo: async ({ request }) => {
		const form = await request.formData();
		const text = String(form.get('text') ?? '').trim();
		const jobIdRaw = String(form.get('jobId') ?? '');
		if (!text) return fail(400, { error: 'Aufgabe fehlt.' });
		await createTodo(text, jobIdRaw ? Number(jobIdRaw) : null);
		return { success: true };
	},

	toggleTodo: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Aufgabe fehlt.' });
		await setTodoDone(id, form.get('done') === '1');
		return { success: true };
	},

	deleteTodo: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Aufgabe fehlt.' });
		await deleteTodo(id);
		return { success: true };
	}
};
