<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleCheck, Minus, Plus } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatDuration } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const saved = $derived(Number(data.settings.weeklyTargetHours));
	let hours = $state(0);
	$effect.pre(() => {
		hours = saved;
	});

	const dirty = $derived(hours !== saved);
	const clamp = (h: number) => Math.min(168, Math.max(0, Math.round(h * 2) / 2));
	const QUICK = [10, 20, 30, 40];

	const system = $derived([
		{ label: 'Datenbank', value: 'PostgreSQL · verbunden', ok: true },
		{ label: 'Einträge gesamt', value: data.entryCount.toLocaleString('de-DE') },
		{ label: 'Version', value: data.version }
	]);
</script>

<svelte:head><title>tracky · Einstellungen</title></svelte:head>

<div class="flex flex-col gap-7">
	<PageHeader eyebrow="tracky · self-hosted" title="Einstellungen">
		{#if form?.success && !dirty}
			<p
				role="status"
				class="flex items-center gap-2 rounded-full border border-accent/25 bg-accent/[0.08] px-3.5 py-2 text-[13px] font-medium text-accent"
			>
				<CircleCheck size={15} /> Gespeichert
			</p>
		{/if}
	</PageHeader>

	{#if form?.error}
		<p
			role="alert"
			class="max-w-190 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
		>
			{form.error}
		</p>
	{/if}

	<div class="flex max-w-190 flex-col">
		<section
			id="soll-arbeitszeit"
			class="grid gap-5 border-t border-line py-8 md:grid-cols-[240px_1fr] md:gap-12"
		>
			<div class="flex flex-col gap-1.5">
				<h2 class="text-base font-semibold">Soll-Arbeitszeit</h2>
				<p class="text-[13px] leading-relaxed text-muted">
					Grundlage für Überstunden-Saldo und den Fortschritt im Dashboard.
				</p>
			</div>
			<form
				method="POST"
				action="?/updateWeeklyTargetHours"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
				class="flex flex-col gap-4"
			>
				<div class="flex w-fit items-stretch rounded-[14px] border border-line-strong bg-surface">
					<button
						type="button"
						class="grid w-14 place-items-center text-fg hover:text-accent"
						aria-label="Eine Stunde weniger"
						onclick={() => (hours = clamp(hours - 1))}
					>
						<Minus size={18} />
					</button>
					<label class="flex h-16 items-center gap-2 border-x border-line-strong px-6">
						<span class="sr-only">Soll-Arbeitszeit pro Woche in Stunden</span>
						<input
							type="number"
							name="weeklyTargetHours"
							min="0"
							max="168"
							step="0.5"
							bind:value={hours}
							class="w-[2.2em] [appearance:textfield] bg-transparent text-right font-mono text-[30px] font-medium tracking-tight outline-none [&::-webkit-inner-spin-button]:appearance-none"
						/>
						<span class="text-[13px] whitespace-nowrap text-muted">h / Woche</span>
					</label>
					<button
						type="button"
						class="grid w-14 place-items-center text-fg hover:text-accent"
						aria-label="Eine Stunde mehr"
						onclick={() => (hours = clamp(hours + 1))}
					>
						<Plus size={18} />
					</button>
				</div>
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="mr-1 text-xs text-muted">Schnellwahl</span>
					{#each QUICK as q (q)}
						<button
							type="button"
							aria-pressed={hours === q}
							class="rounded-full px-2.5 py-1 font-mono text-xs transition-colors {hours === q
								? 'bg-raised text-fg'
								: 'border border-line text-muted hover:border-muted'}"
							onclick={() => (hours = q)}
						>
							{q}h
						</button>
					{/each}
				</div>
				<p class="text-[13px] text-muted">
					≈ {formatDuration(((hours || 0) / 5) * 3600)} pro Tag bei 5 Arbeitstagen
				</p>
				<button
					type="submit"
					disabled={!dirty}
					class="w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:brightness-95 disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted"
				>
					Speichern
				</button>
			</form>
		</section>

		<section
			id="system"
			class="grid gap-5 border-t border-line py-8 md:grid-cols-[240px_1fr] md:gap-12"
		>
			<div class="flex flex-col gap-1.5">
				<h2 class="text-base font-semibold">System</h2>
				<p class="text-[13px] leading-relaxed text-muted">
					Deine Instanz läuft selbst gehostet. Daten bleiben bei dir.
				</p>
			</div>
			<dl>
				{#each system as row (row.label)}
					<div class="flex items-center justify-between gap-4 border-b border-line py-3">
						<dt class="text-[13px] text-muted">{row.label}</dt>
						<dd class="flex items-center gap-2 font-mono text-xs">
							{#if row.ok}<span class="size-1.75 rounded-full bg-accent" aria-hidden="true"
								></span>{/if}
							{row.value}
						</dd>
					</div>
				{/each}
			</dl>
		</section>
	</div>
</div>
