import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createManualEntry,
	deleteEntry,
	getRunningEntry,
	listEntriesBetween,
	listJobs,
	startTimer,
	stopTimer,
	summarizeEntries
} from '$lib/server/db/queries';

function startOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function endOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
}

export const load: PageServerLoad = async () => {
	const now = new Date();
	const [jobs, runningEntry, todayEntries] = await Promise.all([
		listJobs(),
		getRunningEntry(),
		listEntriesBetween(startOfDay(now), endOfDay(now))
	]);
	const todaySummary = await summarizeEntries(todayEntries, now);

	return { jobs, runningEntry, todayEntries, todaySummary };
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
			return fail(400, { error: err instanceof Error ? err.message : 'Timer konnte nicht gestartet werden.' });
		}
		return { success: true };
	},

	stopTimer: async () => {
		try {
			await stopTimer();
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : 'Timer konnte nicht gestoppt werden.' });
		}
		return { success: true };
	},

	createManualEntry: async ({ request }) => {
		const form = await request.formData();
		const jobId = Number(form.get('jobId'));
		const projectIdRaw = form.get('projectId');
		const startRaw = String(form.get('startTime') ?? '');
		const endRaw = String(form.get('endTime') ?? '');
		const note = String(form.get('note') ?? '').trim() || null;

		if (!jobId) return fail(400, { error: 'Bitte einen Job auswählen.' });
		const startTime = new Date(startRaw);
		const endTime = new Date(endRaw);
		if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
			return fail(400, { error: 'Ungültige Zeit.' });
		}
		if (endTime <= startTime) {
			return fail(400, { error: 'Ende muss nach dem Start liegen.' });
		}

		await createManualEntry({
			jobId,
			projectId: projectIdRaw ? Number(projectIdRaw) : null,
			startTime,
			endTime,
			note
		});
		return { success: true };
	},

	deleteEntry: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Eintrag fehlt.' });
		await deleteEntry(id);
		return { success: true };
	}
};
