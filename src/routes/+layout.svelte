<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const links = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/overview', label: 'Übersicht' },
		{ href: '/jobs', label: 'Jobs' }
	];
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-neutral-50 text-neutral-900">
	<header class="border-b border-neutral-200 bg-white">
		<div class="mx-auto flex max-w-3xl items-center gap-6 px-4 py-3">
			<span class="text-sm font-semibold tracking-tight text-neutral-900">tracky</span>
			<nav class="flex gap-4 text-sm">
				{#each links as link (link.href)}
					<a
						href={link.href}
						class="rounded px-2 py-1 transition-colors {page.url.pathname === link.href
							? 'bg-teal-50 text-teal-700'
							: 'text-neutral-500 hover:text-neutral-900'}"
					>
						{link.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>
	<main class="mx-auto max-w-3xl px-4 py-8">
		{@render children()}
	</main>
</div>
