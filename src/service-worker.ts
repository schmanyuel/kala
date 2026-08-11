/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `tracky-cache-${version}`;
// App shell + static assets. Pages themselves are server-rendered and DB-backed,
// so they're served network-first with a cache fallback for when offline.
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	const isAsset = url.origin === location.origin && ASSETS.includes(url.pathname);

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			if (isAsset) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
			}

			try {
				const response = await fetch(event.request);
				if (response.status === 200) cache.put(event.request, response.clone());
				return response;
			} catch (err) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				throw err;
			}
		})()
	);
});
