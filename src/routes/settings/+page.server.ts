import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { countEntries, getSettings, updateWeeklyTargetHours } from '$lib/server/db/queries';
import { version } from '../../../package.json';

export const load: PageServerLoad = async () => {
	const [settings, entryCount] = await Promise.all([getSettings(), countEntries()]);
	return { settings, entryCount, version };
};

export const actions: Actions = {
	updateWeeklyTargetHours: async ({ request }) => {
		const form = await request.formData();
		const hours = Number(String(form.get('weeklyTargetHours') ?? '').replace(',', '.'));
		if (!Number.isFinite(hours) || hours < 0 || hours > 168) {
			return fail(400, { error: 'Ungültige Stundenzahl.' });
		}
		await updateWeeklyTargetHours(hours);
		return { success: true };
	}
};
