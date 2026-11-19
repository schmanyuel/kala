import { goto, preloadData, pushState, replaceState } from '$app/navigation';
import type { PageData } from '../routes/entry/$types';

const href = (date?: string, edit?: number) => {
	const params = new URLSearchParams();
	if (edit) params.set('edit', String(edit));
	if (date) params.set('date', date);
	const query = params.toString();
	return query ? `/entry?${query}` : '/entry';
};

/** URL of the edit form for a finished entry (also the no-JS fallback link). */
export const editEntryHref = (id: number) => href(undefined, id);

/** Opens the entry sheet over the current page (shallow routing): empty for "Eintrag
 *  nachtragen", or prefilled with entry `edit`. Falls back to the full /entry page if the
 *  data can't be preloaded. */
export async function openEntrySheet(date?: string, edit?: number) {
	const url = href(date, edit);
	const result = await preloadData(url);
	if (result.type === 'loaded' && result.status === 200)
		pushState(url, { entrySheet: result.data as PageData });
	else await goto(url);
}

/** Switches the open sheet to another day without adding a history entry. */
export async function changeEntrySheetDate(date: string, edit?: number) {
	const url = href(date, edit);
	const result = await preloadData(url);
	if (result.type === 'loaded' && result.status === 200)
		replaceState(url, { entrySheet: result.data as PageData });
}
