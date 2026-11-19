<script lang="ts">
	import { ChevronLeft, ChevronRight, Plus } from '@lucide/svelte';
	import { editEntryHref, openEntrySheet } from '$lib/entry-sheet';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { isoWeek } from '$lib/date';
	import { formatCents, formatDuration, formatTime, toDatetimeLocal } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Re-render the running entry every minute.
	let now = $state(Date.now());
	$effect(() => {
		const interval = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(interval);
	});

	type Entry = PageData['days'][number]['entries'][number];

	const weekStart = $derived(new Date(data.weekStart));
	const weekEnd = $derived(new Date(data.weekEnd));
	const todayTime = $derived(new Date(data.today).getTime());

	const eyebrow = $derived.by(() => {
		const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
		const month = (d: Date) => d.toLocaleDateString('de-DE', { month: 'long' });
		const range = sameMonth
			? `${weekStart.getDate()}.–${weekEnd.getDate()}. ${month(weekEnd)}`
			: `${weekStart.getDate()}. ${month(weekStart)} – ${weekEnd.getDate()}. ${month(weekEnd)}`;
		return `KW ${isoWeek(weekStart)} · ${range}`;
	});

	const targetSeconds = $derived(data.weeklyTargetHours * 3600);
	const total = $derived(data.weekSummary.totalSeconds);
	const progress = $derived(
		targetSeconds > 0 ? Math.min(100, Math.round((total / targetSeconds) * 100)) : 0
	);
	const remaining = $derived(targetSeconds - total);
	const avgRateCents = $derived(total > 0 ? data.weekSummary.totalGrossCents / (total / 3600) : 0);

	const remainingSub = $derived.by(() => {
		if (data.offset < 0) return 'Woche abgeschlossen';
		if (data.offset > 0) return 'Woche liegt in der Zukunft';
		const daysLeft = 6 - ((new Date(todayTime).getDay() + 6) % 7);
		return daysLeft === 0
			? 'heute ist der letzte Tag'
			: `bis Sonntag, ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'} übrig`;
	});

	const hourOf = (d: Date, dayStart: Date) => (d.getTime() - dayStart.getTime()) / 3_600_000;
	const endOf = (e: Entry) => (e.endTime ? new Date(e.endTime) : new Date(now));

	// Visible hour range: 04–22 by default, widened (in 2h steps) to fit every entry.
	const range = $derived.by(() => {
		let start = 4;
		let end = 22;
		for (const day of data.days) {
			const dayStart = new Date(day.date);
			for (const e of day.entries) {
				start = Math.min(start, Math.floor(hourOf(new Date(e.startTime), dayStart) / 2) * 2);
				end = Math.max(end, Math.min(24, Math.ceil(hourOf(endOf(e), dayStart) / 2) * 2));
			}
		}
		return { start: Math.max(0, start), end };
	});
	const ticks = $derived(
		Array.from({ length: (range.end - range.start) / 2 }, (_, i) => range.start + i * 2)
	);
	const pct = (hour: number) => ((hour - range.start) / (range.end - range.start)) * 100;

	const hasRunning = $derived(data.days.some((d) => d.entries.some((e) => !e.endTime)));
	const pad = (n: number) => n.toString().padStart(2, '0');
</script>

<svelte:head><title>kala · Übersicht</title></svelte:head>

<div class="flex flex-col gap-7">
	<PageHeader {eyebrow} title="Wochenübersicht">
		<nav class="flex items-center gap-2" aria-label="Woche wechseln">
			<a
				href="?offset={data.offset - 1}"
				class="grid size-9.5 place-items-center rounded-full border border-line transition-colors hover:border-muted"
				aria-label="Vorherige Woche"
			>
				<ChevronLeft size={16} />
			</a>
			<a
				href="?offset=0"
				aria-current={data.offset === 0 ? 'page' : undefined}
				class="flex h-9.5 items-center rounded-full px-4 text-[13px] font-medium transition-colors {data.offset ===
				0
					? 'bg-raised'
					: 'border border-line hover:border-muted'}"
			>
				Diese Woche
			</a>
			<a
				href="?offset={data.offset + 1}"
				class="grid size-9.5 place-items-center rounded-full border border-line transition-colors hover:border-muted"
				aria-label="Nächste Woche"
			>
				<ChevronRight size={16} />
			</a>
		</nav>
	</PageHeader>

	<section
		id="summary"
		aria-label="Wochensumme"
		class="grid grid-cols-2 border-y border-line xl:grid-cols-4"
	>
		<div class="flex min-w-0 flex-col gap-1.5 py-5 pr-4 sm:pr-6">
			<span class="eyebrow">Woche gesamt</span>
			<span class="font-mono text-2xl font-medium tracking-tight tabular-nums sm:text-[30px]"
				>{formatDuration(total)}</span
			>
			<div class="flex flex-col gap-2 pt-1.5">
				<div
					class="h-1 w-full overflow-hidden rounded-full bg-line"
					role="progressbar"
					aria-valuenow={progress}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label="Fortschritt zum Wochensoll"
				>
					<div class="h-full rounded-full bg-accent" style:width="{progress}%"></div>
				</div>
				<span class="text-[13px] text-muted"
					>{progress} % von {data.weeklyTargetHours.toLocaleString('de-DE')}h Soll</span
				>
			</div>
		</div>
		<div class="flex min-w-0 flex-col gap-1.5 border-l border-line py-5 pl-4 sm:px-6">
			<span class="eyebrow">Brutto</span>
			<span class="font-mono text-2xl font-medium tracking-tight tabular-nums sm:text-[30px]"
				>{formatCents(data.weekSummary.totalGrossCents)}</span
			>
			<span class="text-[13px] text-muted"
				>{total > 0 ? `Ø ${formatCents(avgRateCents)} / Stunde` : 'noch nichts verdient'}</span
			>
		</div>
		<div
			class="flex min-w-0 flex-col gap-1.5 border-t border-line py-5 pr-4 sm:pr-6 xl:border-t-0 xl:border-l xl:px-6"
		>
			<span class="eyebrow">{remaining > 0 ? 'Noch offen' : 'Über Soll'}</span>
			<span
				class="font-mono text-2xl font-medium tracking-tight tabular-nums sm:text-[30px] {remaining >
				0
					? ''
					: 'text-accent'}"
			>
				{remaining > 0 ? formatDuration(remaining) : `+ ${formatDuration(-remaining)}`}
			</span>
			<span class="text-[13px] text-muted">{remainingSub}</span>
		</div>
		<div
			class="flex min-w-0 flex-col gap-1.5 border-t border-l border-line py-5 pl-4 sm:px-6 xl:border-t-0"
		>
			<span class="eyebrow">Nach Job</span>
			{#if data.perJob.length}
				<div class="flex gap-[3px] pt-3.5 pb-2.5">
					{#each data.perJob as job (job.name)}
						<div
							class="h-2.5 rounded-[3px]"
							style:background={job.color}
							style:flex-grow={job.seconds}
						></div>
					{/each}
				</div>
				<ul class="flex flex-col gap-1.5">
					{#each data.perJob as job (job.name)}
						<li class="flex items-center gap-2 text-[13px]">
							<span class="size-2 rounded-xs" style:background={job.color}></span>
							<span class="flex-1 truncate">{job.name}</span>
							<span class="font-mono text-xs text-muted">{formatDuration(job.seconds)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<span class="pt-2 text-[13px] text-muted">Keine Einträge in dieser Woche.</span>
			{/if}
		</div>
	</section>

	<section id="timeline" aria-label="Tage der Woche" class="flex flex-col">
		<div
			class="grid grid-cols-[48px_1fr_88px] gap-3 pb-2.5 sm:grid-cols-[96px_1fr_150px] sm:gap-6"
			aria-hidden="true"
		>
			<span></span>
			<div class="relative h-4">
				{#each ticks as tick, i (tick)}
					<span
						class="absolute font-mono text-[10px] tracking-wide text-muted {i % 2
							? 'max-sm:hidden'
							: ''}"
						style:left="{pct(tick)}%"
					>
						{pad(tick)}<span class="max-sm:hidden">:00</span>
					</span>
				{/each}
			</div>
			<span></span>
		</div>

		<ol class="border-b border-line">
			{#each data.days as day (day.date)}
				{@const date = new Date(day.date)}
				{@const isToday = date.getTime() === todayTime}
				{@const isFuture = date.getTime() > todayTime}
				<li
					class="group grid h-19 grid-cols-[48px_1fr_88px] items-center gap-3 border-t border-line sm:grid-cols-[96px_1fr_150px] sm:gap-6 {isToday
						? 'bg-accent/[0.03]'
						: ''}"
					aria-current={isToday ? 'date' : undefined}
				>
					<div class="flex flex-col gap-0.5">
						<span
							class="font-mono text-[13px] font-semibold tracking-wider {isToday
								? 'text-accent'
								: isFuture
									? 'text-muted'
									: ''}"
						>
							{date.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2).toUpperCase()}
						</span>
						<span class="text-xs text-muted">
							{isToday
								? 'Heute'
								: date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
						</span>
					</div>

					<div class="relative h-full">
						{#each ticks as tick (tick)}
							<span
								class="absolute inset-y-0 w-px bg-line/50"
								style:left="{pct(tick)}%"
								aria-hidden="true"
							></span>
						{/each}
						{#each day.entries as entry (entry.id)}
							{@const start = Math.max(range.start, hourOf(new Date(entry.startTime), date))}
							{@const end = Math.min(range.end, hourOf(endOf(entry), date))}
							{@const running = !entry.endTime}
							<svelte:element
								this={running ? 'div' : 'a'}
								href={running ? undefined : editEntryHref(entry.id)}
								onclick={running
									? undefined
									: (e: MouseEvent) => {
											if (e.metaKey || e.ctrlKey || e.shiftKey) return;
											e.preventDefault();
											openEntrySheet(undefined, entry.id);
										}}
								tabindex={running ? undefined : -1}
								class="absolute top-5 flex h-9 min-w-1.5 items-center overflow-hidden px-2.5 text-xs font-semibold text-ink {running
									? 'rounded-l-md'
									: 'rounded-md transition hover:ring-2 hover:ring-fg/60 hover:brightness-110'}"
								style:left="{pct(start)}%"
								style:width="{pct(end) - pct(start)}%"
								style:background={entry.job.color}
								title="{entry.job.name}: {formatTime(new Date(entry.startTime))} – {entry.endTime
									? formatTime(new Date(entry.endTime))
									: 'jetzt'}{entry.note ? ` · ${entry.note}` : ''}"
								aria-hidden="true"
							>
								{#if end - start >= 1.5}
									<span class="truncate max-sm:hidden"
										>{entry.job.name}{entry.note ? ` · ${entry.note}` : ''}</span
									>
								{/if}
							</svelte:element>
							{#if running}
								<span
									class="absolute top-3 h-13 w-0.5 bg-fg"
									style:left="{pct(end)}%"
									aria-hidden="true"
								></span>
							{/if}
						{/each}
						<ul class="sr-only">
							{#each day.entries as entry (entry.id)}
								<li>
									{#if entry.endTime}
										<a
											href={editEntryHref(entry.id)}
											class="focus:not-sr-only"
											onclick={(e) => {
												e.preventDefault();
												openEntrySheet(undefined, entry.id);
											}}
											>{entry.job.name}, {formatTime(new Date(entry.startTime))} bis {formatTime(
												new Date(entry.endTime)
											)} bearbeiten</a
										>
									{:else}
										{entry.job.name}, {formatTime(new Date(entry.startTime))} bis jetzt
									{/if}
								</li>
							{/each}
						</ul>
					</div>

					<div class="flex items-center justify-end gap-2 sm:gap-3">
						{#if !isFuture}
							{@const iso = toDatetimeLocal(date).slice(0, 10)}
							<a
								href="/entry?date={iso}"
								class="grid size-7 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-accent hover:text-accent sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
								aria-label="Eintrag für {date.toLocaleDateString('de-DE', {
									weekday: 'long',
									day: 'numeric',
									month: 'long'
								})} nachtragen"
								onclick={(e) => {
									if (e.metaKey || e.ctrlKey || e.shiftKey) return;
									e.preventDefault();
									openEntrySheet(iso);
								}}
							>
								<Plus size={14} />
							</a>
						{/if}
						<div class="flex flex-col items-end gap-0.5">
							<span
								class="font-mono text-[15px] font-medium tabular-nums {day.summary.totalSeconds
									? ''
									: 'text-muted'}"
							>
								{day.summary.totalSeconds ? formatDuration(day.summary.totalSeconds) : '—'}
							</span>
							{#if day.summary.totalSeconds}
								<span class="text-xs text-muted">{formatCents(day.summary.totalGrossCents)}</span>
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ol>

		{#if data.perJob.length}
			<ul class="flex flex-wrap items-center gap-x-5 gap-y-2 pt-4 sm:pl-30">
				{#each data.perJob as job (job.name)}
					<li class="flex items-center gap-2 text-xs text-muted">
						<span class="size-2 rounded-xs" style:background={job.color}></span>
						{job.name}{job.rateCents !== null ? ` · ${formatCents(job.rateCents)}/h` : ''}
					</li>
				{/each}
				{#if hasRunning}
					<li class="flex items-center gap-2 text-xs text-muted">
						<span class="h-3 w-0.5 bg-fg"></span>Jetzt · Timer läuft
					</li>
				{/if}
			</ul>
		{/if}
	</section>
</div>
