import postgres from 'postgres';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// Dedicated connection for LISTEN — postgres.js keeps this open persistently,
// separate from the pooled query connection used by drizzle.
const listenClient = postgres(env.DATABASE_URL, { max: 1 });

type Listener = (table: string) => void;
const subscribers = new Set<Listener>();

let started = false;
function ensureListening() {
	if (started) return;
	started = true;
	listenClient.listen('tracky_changes', (table) => {
		for (const fn of subscribers) fn(table);
	});
}

export function subscribe(fn: Listener): () => void {
	ensureListening();
	subscribers.add(fn);
	return () => subscribers.delete(fn);
}
