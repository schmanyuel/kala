import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countEntries,
	getLang,
	getSettings,
	updateLanguage,
	updateStopRounding,
	updateWeeklyTargetHours
} from '$lib/server/db/queries';
import { isRoundingStep } from '$lib/rounding';
import { isLang, translate } from '$lib/i18n';
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
			return fail(400, { error: translate(await getLang(), 'Invalid number of hours.') });
		}
		await updateWeeklyTargetHours(hours);
		return { success: true };
	},

	updateStopRounding: async ({ request }) => {
		const form = await request.formData();
		const minutes = Number(form.get('stopRoundingMinutes'));
		if (!isRoundingStep(minutes))
			return fail(400, { error: translate(await getLang(), 'Invalid rounding step.') });
		await updateStopRounding(minutes);
		return { success: true };
	},

	updateLanguage: async ({ request }) => {
		const language = (await request.formData()).get('language');
		if (!isLang(language))
			return fail(400, { error: translate(await getLang(), 'Invalid language.') });
		await updateLanguage(language);
		return { success: true };
	}
};
