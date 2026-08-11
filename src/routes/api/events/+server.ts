import type { RequestHandler } from './$types';
import { subscribe } from '$lib/server/realtime';

const HEARTBEAT_MS = 25_000;

export const GET: RequestHandler = () => {
	const encoder = new TextEncoder();
	let unsubscribe: () => void;
	let heartbeat: ReturnType<typeof setInterval>;

	const stream = new ReadableStream({
		start(controller) {
			unsubscribe = subscribe((table) => {
				controller.enqueue(encoder.encode(`data: ${table}\n\n`));
			});
			heartbeat = setInterval(() => {
				controller.enqueue(encoder.encode(': ping\n\n'));
			}, HEARTBEAT_MS);
		},
		cancel() {
			unsubscribe();
			clearInterval(heartbeat);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
