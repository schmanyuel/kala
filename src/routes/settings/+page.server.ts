import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getSettings, updateWeeklyTargetHours } from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	const settings = await getSettings();
	return { settings };
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
