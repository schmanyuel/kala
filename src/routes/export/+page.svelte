<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowRight, Check, Download, Eye, FileText, Sheet } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { addDays, startOfMonth, startOfWeek } from '$lib/date';
	import { formatCents, formatDuration, formatTime, toDatetimeLocal } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const PREVIEW_ROWS = 10;
	const isoDate = (d: Date) => toDatetimeLocal(d).slice(0, 10);

	let format = $state<'pdf' | 'csv'>('pdf');

	const today = $derived(new Date(`${data.today}T00:00`));
	const presets = $derived.by(() => {
		const week = startOfWeek(today);
		const month = startOfMonth(today);
		return [
			{ label: 'Diese Woche', from: isoDate(week), to: isoDate(addDays(week, 6)) },
			{ label: 'Letzte Woche', from: isoDate(addDays(week, -7)), to: isoDate(addDays(week, -1)) },
			{
				label: today.toLocaleDateString('de-DE', { month: 'long' }),
				from: isoDate(month),
				to: isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0))
			}
		];
	});
	const activePreset = $derived(presets.find((p) => p.from === data.from && p.to === data.to));

	const allSelected = $derived(data.jobs.every((j) => data.selectedJobIds.includes(j.id)));
	const query = $derived.by(() => {
		const params = new URLSearchParams({ from: data.from, to: data.to });
		if (!allSelected) params.set('jobs', data.selectedJobIds.join(','));
		return params.toString();
	});

	function update(changes: { from?: string; to?: string; jobs?: number[] }) {
		const from = changes.from ?? data.from;
		const to = changes.to ?? data.to;
		if (!from || !to) return;
		const jobs = changes.jobs ?? data.selectedJobIds;
		const params = new URLSearchParams({ from, to });
		if (jobs.length !== data.jobs.length) params.set('jobs', jobs.join(','));
		goto(`?${params}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function toggleJob(id: number) {
		const selected = data.selectedJobIds.includes(id)
			? data.selectedJobIds.filter((j) => j !== id)
			: [...data.selectedJobIds, id];
		update({ jobs: selected });
	}

	const perJobByName = $derived(new Map(data.perJob.map((p) => [p.name, p])));
	const dayLabel = (d: Date) =>
		new Date(d)
			.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
			.replace(',', '');
	const hm = (s: number) =>
		`${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
	const rangeLabel = $derived(
		`${new Date(`${data.from}T00:00`).toLocaleDateString('de-DE')} – ${new Date(`${data.to}T00:00`).toLocaleDateString('de-DE')}`
	);
</script>

<svelte:head><title>kala · Export</title></svelte:head>

<div class="flex flex-col gap-7 lg:min-h-[calc(100vh-4rem)]">
	<PageHeader eyebrow="Stundennachweis · CSV · PDF" title="Export" />

	<div class="grid flex-1 gap-10 lg:grid-cols-[400px_1fr]">
		<div class="flex flex-col gap-7.5">
			<fieldset class="flex flex-col gap-3">
				<legend class="pb-3 eyebrow">Zeitraum</legend>
				<div class="flex flex-wrap gap-1.5">
					{#each presets as preset (preset.label)}
						{@const active = activePreset === preset}
						<button
							type="button"
							aria-pressed={active}
							class="rounded-full px-3 py-1.5 text-xs transition-colors {active
								? 'bg-accent font-semibold text-ink'
								: 'border border-line font-medium hover:border-muted'}"
							onclick={() => update({ from: preset.from, to: preset.to })}
						>
							{preset.label}
						</button>
					{/each}
					<span
						class="rounded-full px-3 py-1.5 text-xs {activePreset
							? 'border border-dashed border-line text-muted'
							: 'bg-accent font-semibold text-ink'}"
					>
						Eigener
					</span>
				</div>
				<div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
					<label
						class="flex h-10.5 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-line-strong bg-surface px-3.5 focus-within:border-accent"
					>
						<span class="w-6 text-xs text-muted">Von</span>
						<input
							type="date"
							value={data.from}
							max={data.to}
							onchange={(e) => update({ from: e.currentTarget.value })}
							class="w-full min-w-0 bg-transparent font-mono text-sm [color-scheme:dark] outline-none"
						/>
					</label>
					<ArrowRight size={14} class="shrink-0 text-muted max-sm:hidden" aria-hidden="true" />
					<label
						class="flex h-10.5 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-line-strong bg-surface px-3.5 focus-within:border-accent"
					>
						<span class="w-6 text-xs text-muted">Bis</span>
						<input
							type="date"
							value={data.to}
							min={data.from}
							onchange={(e) => update({ to: e.currentTarget.value })}
							class="w-full min-w-0 bg-transparent font-mono text-sm [color-scheme:dark] outline-none"
						/>
					</label>
				</div>
			</fieldset>

			{#if data.jobs.length}
				<fieldset class="flex flex-col gap-2">
					<legend class="pb-3 eyebrow">Jobs</legend>
					{#each data.jobs as job (job.id)}
						{@const checked = data.selectedJobIds.includes(job.id)}
						{@const totals = perJobByName.get(job.name)}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-[10px] bg-surface px-3.5 py-3 has-focus-visible:outline-2 has-focus-visible:outline-accent"
						>
							<input
								type="checkbox"
								{checked}
								onchange={() => toggleJob(job.id)}
								class="peer sr-only"
							/>
							<span
								class="grid size-4.5 place-items-center rounded-[5px] border {checked
									? 'border-fg bg-fg text-ink'
									: 'border-line-strong'}"
								aria-hidden="true"
							>
								{#if checked}<Check size={13} strokeWidth={3} />{/if}
							</span>
							<span class="size-2 rounded-xs" style:background={job.color} aria-hidden="true"
							></span>
							<span class="flex-1 truncate text-sm {checked ? '' : 'text-muted'}">
								{job.name}{#if job.archived}<span class="text-muted">{' · archiviert'}</span>{/if}
							</span>
							<span class="font-mono text-xs text-muted"
								>{totals ? formatDuration(totals.seconds) : '—'}</span
							>
						</label>
					{/each}
				</fieldset>
			{/if}

			<fieldset class="flex flex-col gap-3">
				<legend class="pb-3 eyebrow">Format</legend>
				<div class="grid grid-cols-2 gap-2.5">
					{#each [{ key: 'pdf', label: 'PDF', desc: 'Stundennachweis zum Ausdrucken', icon: FileText }, { key: 'csv', label: 'CSV', desc: 'Für Excel, Steuer & Lohnbüro', icon: Sheet }] as const as option (option.key)}
						{@const active = format === option.key}
						<label
							class="flex cursor-pointer flex-col gap-2.5 rounded-xl border p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent {active
								? 'border-accent bg-accent/[0.06]'
								: 'border-line bg-surface hover:border-line-strong'}"
						>
							<input
								type="radio"
								name="format"
								value={option.key}
								bind:group={format}
								class="sr-only"
							/>
							<span class="flex items-center justify-between">
								<option.icon size={20} class={active ? 'text-accent' : 'text-muted'} />
								<span
									class="size-4 rounded-full {active
										? 'border-[5px] border-accent'
										: 'border-[1.5px] border-line-strong'}"
									aria-hidden="true"
								></span>
							</span>
							<span class="text-base font-semibold">{option.label}</span>
							<span class="text-xs leading-snug text-muted">{option.desc}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="mt-auto flex flex-col gap-4">
				<dl class="flex justify-between border-t border-line pt-4">
					<div class="flex flex-col gap-1">
						<dt class="text-xs text-muted">Einträge</dt>
						<dd class="font-mono text-base font-medium">{data.rows.length}</dd>
					</div>
					<div class="flex flex-col gap-1">
						<dt class="text-xs text-muted">Stunden</dt>
						<dd class="font-mono text-base font-medium">{formatDuration(data.totalSeconds)}</dd>
					</div>
					<div class="flex flex-col gap-1">
						<dt class="text-xs text-muted">Brutto</dt>
						<dd class="font-mono text-base font-medium">{formatCents(data.totalGrossCents)}</dd>
					</div>
				</dl>
				<a
					href="/export/{format}?{query}"
					download
					class="flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-ink hover:brightness-95 {data
						.selectedJobIds.length
						? ''
						: 'pointer-events-none opacity-40'}"
					aria-disabled={!data.selectedJobIds.length}
				>
					<Download size={16} />
					{format.toUpperCase()} herunterladen
				</a>
			</div>
		</div>

		<section
			id="preview"
			aria-label="Vorschau"
			class="flex min-w-0 flex-col items-center gap-5 overflow-hidden rounded-2xl bg-surface px-4 py-6 sm:px-10 sm:py-7"
		>
			<div class="flex w-full items-center justify-between text-[13px] text-muted">
				<span class="flex items-center gap-2"><Eye size={15} /> Vorschau</span>
				<span class="font-mono text-[11px] tracking-wide"
					>{format === 'pdf' ? 'A4 · PDF' : 'CSV · Semikolon-getrennt'}</span
				>
			</div>

			<div
				class="flex w-full max-w-[540px] flex-1 flex-col gap-6 rounded bg-[#f7f5ef] px-6 py-8 text-[#1a1a18] shadow-[0_24px_60px_#00000080] sm:px-11 sm:py-11"
			>
				<div class="flex items-start justify-between">
					<div class="flex flex-col gap-1">
						<p class="text-[22px] font-bold tracking-tight">Stundennachweis</p>
						<p class="font-mono text-[10px] text-[#7a776f]">{rangeLabel}</p>
					</div>
					<p class="flex items-center gap-1.5 text-[13px] font-bold tracking-tight">
						<span class="size-3 rounded-full bg-[#1a1a18]"></span>kala
					</p>
				</div>

				{#if data.rows.length}
					<table class="w-full table-fixed text-[9.5px]">
						<thead>
							<tr
								class="border-b border-[#1a1a18] text-left font-mono text-[8px] tracking-widest text-[#7a776f] uppercase"
							>
								<th class="w-[22%] py-1.5 font-normal">Datum</th>
								<th class="py-1.5 font-normal">Job</th>
								<th class="w-[22%] py-1.5 font-normal max-sm:hidden">Zeit</th>
								<th class="w-[12%] py-1.5 text-right font-normal">Dauer</th>
								<th class="w-[15%] py-1.5 text-right font-normal">Betrag</th>
							</tr>
						</thead>
						<tbody>
							{#each data.rows.slice(0, PREVIEW_ROWS) as row (row.id)}
								<tr class="border-b border-[#e2ded3] align-top">
									<td class="py-1.5 font-mono">{dayLabel(row.start)}</td>
									<td class="py-1.5">
										<span class="block truncate"
											>{row.jobName}{row.note ? ` · ${row.note}` : ''}</span
										>
										{#each row.activities as activity, i (i)}
											<span class="block truncate text-[8.5px] text-[#7a776f]">– {activity}</span>
										{/each}
									</td>
									<td class="py-1.5 font-mono max-sm:hidden">
										{formatTime(new Date(row.start))}–{row.running
											? 'läuft'
											: formatTime(new Date(row.end))}
									</td>
									<td class="py-1.5 text-right font-mono">{hm(row.seconds)}</td>
									<td class="py-1.5 text-right font-mono"
										>{(row.grossCents / 100).toFixed(2).replace('.', ',')}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if data.rows.length > PREVIEW_ROWS}
						<p class="-mt-3 font-mono text-[9px] text-[#7a776f]">
							+ {data.rows.length - PREVIEW_ROWS} weitere Einträge
						</p>
					{/if}
				{:else}
					<p class="py-10 text-center text-xs text-[#7a776f]">Keine Einträge in diesem Zeitraum.</p>
				{/if}

				<div class="mt-auto flex flex-col gap-1.5 border-t-[1.5px] border-[#1a1a18] pt-3">
					{#if data.perJob.length > 1}
						{#each data.perJob as job (job.name)}
							<p class="flex justify-between text-[9.5px] text-[#7a776f]">
								<span>{job.name} · {hm(job.seconds)} h</span>
								<span class="font-mono text-[#1a1a18]">{formatCents(job.grossCents)}</span>
							</p>
						{/each}
					{/if}
					<p class="flex justify-between text-[11px] font-bold">
						<span>Gesamt · {hm(data.totalSeconds)} h</span>
						<span class="font-mono">{formatCents(data.totalGrossCents)}</span>
					</p>
				</div>
			</div>
		</section>
	</div>
</div>
