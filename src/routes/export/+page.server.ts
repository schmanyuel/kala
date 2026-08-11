import type { PageServerLoad } from './$types';
import { toDatetimeLocal } from '$lib/format';
import { endOfDay, startOfMonth } from '$lib/date';

export const load: PageServerLoad = async () => {
	const now = new Date();
	return {
		defaultFrom: toDatetimeLocal(startOfMonth(now)).slice(0, 10),
		defaultTo: toDatetimeLocal(endOfDay(now)).slice(0, 10)
	};
};
