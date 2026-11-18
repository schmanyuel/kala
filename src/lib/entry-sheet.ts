import { goto, preloadData, pushState, replaceState } from '$app/navigation';
import type { PageData } from '../routes/entry/$types';

const href = (date?: string) => (date ? `/entry?date=${date}` : '/entry');

/** Opens the "Eintrag nachtragen" sheet over the current page (shallow routing).
 *  Falls back to the full /entry page if the data can't be preloaded. */
export async function openEntrySheet(date?: string) {
	const url = href(date);
	const result = await preloadData(url);
	if (result.type === 'loaded' && result.status === 200)
		pushState(url, { entrySheet: result.data as PageData });
	else await goto(url);
}

/** Switches the open sheet to another day without adding a history entry. */
export async function changeEntrySheetDate(date: string) {
	const url = href(date);
	const result = await preloadData(url);
	if (result.type === 'loaded' && result.status === 200)
		replaceState(url, { entrySheet: result.data as PageData });
}
