<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { connectRealtime } from '$lib/realtime';
	import { t } from '$lib/i18n';
	import EntrySheet from '$lib/components/EntrySheet.svelte';
	import {
		LayoutDashboard,
		CalendarDays,
		ChartColumn,
		Briefcase,
		FileDown,
		Settings
	} from '@lucide/svelte';

	let { children, data } = $props();

	$effect(() => {
		document.documentElement.lang = data.lang;
	});

	$effect(() => connectRealtime());

	$effect(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js', { type: 'module' });
		}
	});

	const links = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/overview', label: 'Overview', icon: CalendarDays },
		{ href: '/stats', label: 'Statistics', icon: ChartColumn },
		{ href: '/jobs', label: 'Jobs', icon: Briefcase },
		{ href: '/export', label: 'Export', icon: FileDown }
	];
	const settingsLink = { href: '/settings', label: 'Settings', icon: Settings };
</script>

{#snippet navLink(link: (typeof links)[number])}
	{@const active = page.url.pathname === link.href}
	<a
		href={link.href}
		aria-current={active ? 'page' : undefined}
		class="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {active
			? 'bg-raised font-semibold text-fg'
			: 'text-muted hover:text-fg'}"
	>
		<link.icon size={17} class={active ? 'text-accent' : ''} />
		<span>{t(link.label)}</span>
	</a>
{/snippet}

<div class="flex min-h-screen flex-col lg:flex-row">
	<aside
		id="sidebar"
		class="sticky top-0 z-10 flex shrink-0 flex-col gap-4 border-line bg-bg px-4 py-4 max-lg:border-b lg:h-screen lg:w-58 lg:gap-9 lg:border-r lg:px-5 lg:py-7"
	>
		<a
			href="/"
			aria-label="kala · {t('Dashboard')}"
			class="flex items-center justify-center gap-3 rounded-[4px] bg-accent px-4 py-3 text-ink transition hover:brightness-95 lg:py-5"
		>
			<span
				class="grid size-9 place-items-center rounded-[9px] bg-ink font-mono text-lg leading-none font-bold tracking-[-0.04em] text-accent lg:size-10 lg:rounded-[10px] lg:text-xl"
				aria-hidden="true">k:</span
			>
			<span class="font-mono text-[28px] leading-none font-bold tracking-[-0.03em] lg:text-[32px]"
				>kala</span
			>
		</a>
		<nav
			class="-mx-1 flex gap-0.5 overflow-x-auto px-1 lg:flex-col lg:overflow-visible"
			aria-label={t('Main navigation')}
		>
			{#each links as link (link.href)}
				{@render navLink(link)}
			{/each}
			<div class="lg:hidden">{@render navLink(settingsLink)}</div>
		</nav>
		<div class="mt-auto max-lg:hidden">{@render navLink(settingsLink)}</div>
	</aside>
	<main class="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-12 lg:py-8">
		{@render children()}
	</main>
</div>

{#if page.state.entrySheet}
	<EntrySheet data={page.state.entrySheet} />
{/if}
