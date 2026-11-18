import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addWageRate,
	archiveJob,
	createJob,
	createProject,
	listArchivedJobs,
	listEntriesBetween,
	listJobs,
	listProjects,
	listWageRates,
	summarizeEntries,
	unarchiveJob
} from '$lib/server/db/queries';
import { endOfMonth, startOfMonth } from '$lib/date';
import { JOB_COLORS } from '$lib/jobs';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const [jobs, archived, projects, monthEntries] = await Promise.all([
		listJobs(),
		listArchivedJobs(),
		listProjects(),
		listEntriesBetween(startOfMonth(now), endOfMonth(now))
	]);

	const jobsWithDetails = await Promise.all(
		jobs.map(async (job) => {
			const rates = await listWageRates(job.id);
			const month = await summarizeEntries(
				monthEntries.filter((e) => e.jobId === job.id),
				now
			);
			return {
				...job,
				// Rates sorted newest first; the current one is the newest that already applies.
				rates: rates.filter((r) => r.validFrom <= now).slice(0, 3),
				upcomingRate: rates.find((r) => r.validFrom > now) ?? null,
				currentRateCents: rates.find((r) => r.validFrom <= now)?.hourlyRateCents ?? null,
				projects: projects.filter((p) => p.jobId === job.id),
				month
			};
		})
	);

	return { jobs: jobsWithDetails, archived, monthStart: startOfMonth(now) };
};

function parseEuroToCents(value: string): number | null {
	const normalized = value.replace(',', '.').trim();
	if (!normalized) return null;
	const euros = Number(normalized);
	if (!Number.isFinite(euros) || euros < 0) return null;
	return Math.round(euros * 100);
}

export const actions: Actions = {
	createJob: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const hourlyRateRaw = String(form.get('hourlyRate') ?? '');
		const isMinijob = form.get('isMinijob') === 'on';
		const colorRaw = String(form.get('color') ?? '');
		const color = JOB_COLORS.includes(colorRaw) ? colorRaw : JOB_COLORS[0];

		if (!name) return fail(400, { error: 'Name fehlt.' });
		const hourlyRateCents = parseEuroToCents(hourlyRateRaw);
		if (hourlyRateCents === null) return fail(400, { error: 'Ungültiger Stundenlohn.' });

		await createJob({ name, color, hourlyRateCents, isMinijob });
		return { success: true };
	},

	addWageRate: async ({ request }) => {
		const form = await request.formData();
		const jobId = Number(form.get('jobId'));
		const hourlyRateRaw = String(form.get('hourlyRate') ?? '');
		const validFromRaw = String(form.get('validFrom') ?? '');

		if (!jobId) return fail(400, { error: 'Job fehlt.' });
		const hourlyRateCents = parseEuroToCents(hourlyRateRaw);
		if (hourlyRateCents === null) return fail(400, { error: 'Ungültiger Stundenlohn.' });

		const validFrom = validFromRaw ? new Date(`${validFromRaw}T00:00`) : new Date();
		if (isNaN(validFrom.getTime())) return fail(400, { error: 'Ungültiges Datum.' });
		await addWageRate(jobId, hourlyRateCents, validFrom);
		return { success: true };
	},

	createProject: async ({ request }) => {
		const form = await request.formData();
		const jobId = Number(form.get('jobId'));
		const name = String(form.get('name') ?? '').trim();
		if (!jobId) return fail(400, { error: 'Job fehlt.' });
		if (!name) return fail(400, { error: 'Projektname fehlt.' });
		await createProject(jobId, name);
		return { success: true };
	},

	archiveJob: async ({ request }) => {
		const form = await request.formData();
		const jobId = Number(form.get('jobId'));
		if (!jobId) return fail(400, { error: 'Job fehlt.' });
		await archiveJob(jobId);
		return { success: true };
	},

	unarchiveJob: async ({ request }) => {
		const form = await request.formData();
		const jobId = Number(form.get('jobId'));
		if (!jobId) return fail(400, { error: 'Job fehlt.' });
		await unarchiveJob(jobId);
		return { success: true };
	}
};
