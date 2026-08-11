import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addWageRate, archiveJob, createJob, getCurrentWageRateCents, listJobs } from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	const jobs = await listJobs();
	const jobsWithRate = await Promise.all(
		jobs.map(async (job) => ({
			...job,
			currentRateCents: await getCurrentWageRateCents(job.id)
		}))
	);
	return { jobs: jobsWithRate };
};

function parseEuroToCents(value: string): number | null {
	const normalized = value.replace(',', '.').trim();
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

		if (!name) return fail(400, { error: 'Name fehlt.' });
		const hourlyRateCents = parseEuroToCents(hourlyRateRaw);
		if (hourlyRateCents === null) return fail(400, { error: 'Ungültiger Stundenlohn.' });

		await createJob({ name, hourlyRateCents, isMinijob });
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

		const validFrom = validFromRaw ? new Date(validFromRaw) : new Date();
		await addWageRate(jobId, hourlyRateCents, validFrom);
		return { success: true };
	},

	archiveJob: async ({ request }) => {
		const form = await request.formData();
		const jobId = Number(form.get('jobId'));
		if (!jobId) return fail(400, { error: 'Job fehlt.' });
		await archiveJob(jobId);
		return { success: true };
	}
};
