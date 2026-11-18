// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** Data for the "Eintrag nachtragen" sheet, opened via shallow routing. */
			entrySheet?: import('./routes/entry/$types').PageData;
		}
		// interface Platform {}
	}
}

export {};
