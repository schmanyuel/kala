import type { LayoutServerLoad } from './$types';
import { getLang } from '$lib/server/db/queries';

export const load: LayoutServerLoad = async () => ({ lang: await getLang() });
