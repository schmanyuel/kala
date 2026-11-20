// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageData {
			lang: import('$lib/i18n').Lang;
		}
		interface PageState {
			/** Data for the "Add entry" sheet, opened via shallow routing. */
			entrySheet?: import('./routes/entry/$types').PageData;
		}
		// interface Platform {}
	}
}

export {};
