import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createManualEntry,
	getEntryForEdit,
	listEntriesBetween,
	listJobs,
	listOpenTodos,
	listProjects,
	listRecentEntries,
	getLang,
	listWageRates,
	updateEntry
} from '$lib/server/db/queries';
import { endOfDay, startOfDay } from '$lib/date';
import { toDatetimeLocal } from '$lib/format';
import { LOCALES, translate, type Lang } from '$lib/i18n';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const hhmm = (d: Date) => toDatetimeLocal(d).slice(11, 16);

export const load: PageServerLoad = async ({ url }) => {
	// ?edit=<id> opens a finished entry for editing; its day is the default date.
	const editId = Number(url.searchParams.get('edit'));
	const editEntry = editId ? await getEntryForEdit(editId) : null;
	const dateParam = url.searchParams.get('date');
	const date =
		dateParam && DATE_RE.test(dateParam)
			? dateParam
			: toDatetimeLocal(editEntry?.startTime ?? new Date()).slice(0, 10);
	const day = new Date(`${date}T00:00`);

	const lang = await getLang();
	const [dayEntriesAll, jobs, projects, todos, recent] = await Promise.all([
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
				weekday: e.startTime
					.toLocaleDateString(LOCALES[lang], { weekday: 'short' })
					.replace('.', ''),
				start,
				end,
				count: 1
			});
	}
	// Map keeps insertion order (newest first), so the stable sort breaks ties by recency.
	const templates = [...combos.values()].sort((a, b) => b.count - a.count).slice(0, 3);

	// The edited entry is the block being placed, so it isn't drawn as an existing one.
	const dayEntries = dayEntriesAll.filter((e) => e.id !== editEntry?.id);

	return {
		date,
		editing: editEntry && {
			id: editEntry.id,
			jobId: editEntry.jobId,
			projectId: editEntry.projectId,
			start: hhmm(editEntry.startTime),
			end: hhmm(editEntry.endTime),
			note: editEntry.note,
			activities: editEntry.activities,
			linkedTodos: editEntry.linkedTodos.map((t) => ({ id: t.id, text: t.text }))
		},
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

type EntryInput = {
	jobId: number;
	projectId: number | null;
	startTime: Date;
	endTime: Date;
	note: string | null;
	activities: string[];
	todoIds: number[];
};

/** Parses and validates the entry form shared by create and update. */
function parseEntryForm(form: FormData, lang: Lang): EntryInput | { error: string } {
	const t = (key: string) => translate(lang, key);
	const jobId = Number(form.get('jobId'));
	const projectIdRaw = String(form.get('projectId') ?? '');
	const date = String(form.get('date') ?? '');
	const start = String(form.get('start') ?? '');
	const end = String(form.get('end') ?? '');
	const note = String(form.get('note') ?? '').trim() || null;
	const activities = form
		.getAll('activity')
		.map((a) => String(a).trim())
		.filter(Boolean);
	const todoIds = form.getAll('todoId').map(Number).filter(Boolean);

	if (!jobId) return { error: t('Please select a job.') };
	if (!DATE_RE.test(date) || !TIME_RE.test(start) || !TIME_RE.test(end)) {
		return { error: t('Please enter date, start and end.') };
	}
	const startTime = new Date(`${date}T${start}`);
	const endTime = new Date(`${date}T${end}`);
	if (endTime <= startTime) return { error: t('End must be after the start.') };
	if (startTime > new Date()) return { error: t('The entry is in the future.') };

	return {
		jobId,
		projectId: projectIdRaw ? Number(projectIdRaw) : null,
		startTime,
		endTime,
		note,
		activities,
		todoIds
	};
}

/** The form only has minute precision. If neither time was touched, keep the stored
 *  timestamps (with their seconds) so saving other fields doesn't shift the entry. As soon
 *  as one changes, both are taken from the form, so a rounded duration stays exact. */
const sameMinute = (a: Date, b: Date) => toDatetimeLocal(a) === toDatetimeLocal(b);

export const actions: Actions = {
	create: async ({ request }) => {
		const input = parseEntryForm(await request.formData(), await getLang());
		if ('error' in input) return fail(400, { error: input.error });
		await createManualEntry(input);
		return { success: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const existing = id ? await getEntryForEdit(id) : null;
		if (!existing) return fail(404, { error: translate(await getLang(), 'Entry not found.') });
		const lang = await getLang();
		const input = parseEntryForm(form, lang);
		if ('error' in input) return fail(400, { error: input.error });
		const timesUnchanged =
			sameMinute(input.startTime, existing.startTime) &&
			sameMinute(input.endTime, existing.endTime);
		await updateEntry(
			id,
			timesUnchanged
				? { ...input, startTime: existing.startTime, endTime: existing.endTime }
				: input
		);
		return { success: true };
	}
};
