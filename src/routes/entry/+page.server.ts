import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createManualEntry,
	listEntriesBetween,
	listJobs,
	listOpenTodos,
	listProjects,
	listRecentEntries,
	listWageRates
} from '$lib/server/db/queries';
import { endOfDay, startOfDay } from '$lib/date';
import { toDatetimeLocal } from '$lib/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const hhmm = (d: Date) => toDatetimeLocal(d).slice(11, 16);

export const load: PageServerLoad = async ({ url }) => {
	const dateParam = url.searchParams.get('date');
	const date =
		dateParam && DATE_RE.test(dateParam) ? dateParam : toDatetimeLocal(new Date()).slice(0, 10);
	const day = new Date(`${date}T00:00`);

	const [dayEntries, jobs, projects, todos, recent] = await Promise.all([
		listEntriesBetween(startOfDay(day), endOfDay(day)),
		listJobs(),
		listProjects(),
		listOpenTodos(),
		listRecentEntries()
	]);

	const jobsWithRates = await Promise.all(
		jobs.map(async (job) => ({
			id: job.id,
			name: job.name,
			color: job.color,
			rates: (await listWageRates(job.id)).map((r) => ({
				cents: r.hourlyRateCents,
				from: r.validFrom
			}))
		}))
	);

	// Most frequent job + time combinations among recent entries, for one-tap prefill.
	const combos = new Map<
		string,
		{ jobId: number; jobName: string; weekday: string; start: string; end: string; count: number }
	>();
	for (const e of recent) {
		const start = hhmm(e.startTime);
		const end = hhmm(e.endTime!);
		const key = `${e.jobId}|${start}|${end}`;
		const combo = combos.get(key);
		if (combo) combo.count++;
		else
			combos.set(key, {
				jobId: e.jobId,
				jobName: e.job.name,
				weekday: e.startTime.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''),
				start,
				end,
				count: 1
			});
	}
	// Map keeps insertion order (newest first), so the stable sort breaks ties by recency.
	const templates = [...combos.values()].sort((a, b) => b.count - a.count).slice(0, 3);

	return {
		date,
		today: toDatetimeLocal(new Date()).slice(0, 10),
		dayEntries: dayEntries
			.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
			.map((e) => ({
				id: e.id,
				jobName: e.job.name,
				color: e.job.color,
				start: e.startTime,
				end: e.endTime,
				activities: e.activities
			})),
		jobs: jobsWithRates,
		projects: projects.map((p) => ({ id: p.id, jobId: p.jobId, name: p.name })),
		todos: todos.map((t) => ({ id: t.id, text: t.text, jobId: t.jobId })),
		templates
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const jobId = Number(form.get('jobId'));
		const projectIdRaw = String(form.get('projectId') ?? '');
		const date = String(form.get('date') ?? '');
		const start = String(form.get('start') ?? '');
		const end = String(form.get('end') ?? '');
		const activities = form
			.getAll('activity')
			.map((a) => String(a).trim())
			.filter(Boolean);
		const todoIds = form.getAll('todoId').map(Number).filter(Boolean);

		if (!jobId) return fail(400, { error: 'Bitte einen Job auswählen.' });
		if (!DATE_RE.test(date) || !TIME_RE.test(start) || !TIME_RE.test(end)) {
			return fail(400, { error: 'Bitte Datum, Start und Ende angeben.' });
		}
		const startTime = new Date(`${date}T${start}`);
		const endTime = new Date(`${date}T${end}`);
		if (endTime <= startTime) return fail(400, { error: 'Ende muss nach dem Start liegen.' });
		if (startTime > new Date()) return fail(400, { error: 'Der Eintrag liegt in der Zukunft.' });

		await createManualEntry({
			jobId,
			projectId: projectIdRaw ? Number(projectIdRaw) : null,
			startTime,
			endTime,
			note: null,
			activities,
			todoIds
		});
		return { success: true };
	}
};
