import { invalidateAll } from '$app/navigation';

const DEBOUNCE_MS = 150;

// Connects to the SSE change stream and refetches load data shortly after any
// change — simple and correct for a single-user app open on multiple devices.
export function connectRealtime(): () => void {
	const source = new EventSource('/api/events');
	let timeout: ReturnType<typeof setTimeout> | undefined;

	source.onmessage = () => {
		clearTimeout(timeout);
		timeout = setTimeout(invalidateAll, DEBOUNCE_MS);
	};

	return () => {
		clearTimeout(timeout);
		source.close();
	};
}
