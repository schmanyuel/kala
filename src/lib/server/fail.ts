import { fail } from '@sveltejs/kit';
import { translate } from '$lib/i18n';
import { getLang } from './db/queries';

/** `fail()` with an error message translated into the configured language. */
export const failT = async (status: number, message: string) =>
	fail(status, { error: translate(await getLang(), message) });
