<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatCents, formatDuration } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ranges = [
		{ key: '12w', label: '12 Wochen', eyebrow: 'Letzte 12 Wochen' },
		{ key: '6m', label: '6 Monate', eyebrow: 'Letzte 6 Monate' },
		{ key: '1y', label: 'Jahr', eyebrow: 'Letzte 52 Wochen' }
	] as const;

	const hm = (hours: number) => formatDuration(Math.round(hours * 3600));
	const hoursLabel = (h: number) =>
		h.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

	const scaleMax = $derived(
		Math.max(data.weeklyTargetHours * 1.25, ...data.weeks.map((w) => w.hours * 1.1), 1)
	);
	const dense = $derived(data.weeks.length > 12);
	const labelEvery = $derived(Math.ceil(data.weeks.length / 12));
	const currentIndex = $derived(data.weeks.length - 1);

	const totalMonthHours = $derived(data.perJob.reduce((sum, p) => sum + p.hours, 0));
	const totalMonthCents = $derived(data.perJob.reduce((sum, p) => sum + p.grossCents, 0));
	const monthName = $derived(
		new Date(data.monthStart).toLocaleDateString('de-DE', { month: 'long' })
	);

	// Donut segments as stroke-dash ranges on a circle of circumference 100, starting at 12 o'clock.
	const segments = $derived.by(() => {
		const gap = data.perJob.length > 1 ? 1 : 0;
		let offset = 0;
		return data.perJob.map((p) => {
			const share = totalMonthHours ? (p.hours / totalMonthHours) * 100 : 0;
			const seg = { color: p.job.color, dash: Math.max(0, share - gap), offset };
			offset += share;
			return seg;
		});
	});

	const figures = $derived([
		{
			label: 'Ø pro Woche',
			value: hm(data.avgWeekHours),
			sub: `Soll ${data.weeklyTargetHours.toLocaleString('de-DE')}h`
		},
		{
			label: 'Überstunden-Saldo',
			value: `${data.balanceHours >= 0 ? '+' : '−'} ${hm(Math.abs(data.balanceHours))}`,
			sub: `seit ${new Date(data.balanceSince).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`,
			highlight: data.balanceHours > 0
		},
		{
			label: 'Ø Stundenlohn',
			value: formatCents(data.avgRateCents),
			sub: 'gewichtet über alle Jobs'
		},
		...(data.minijob
			? [
					{
						label: 'Minijob-Grenze',
						value: formatCents(data.minijob.grossCents),
						sub: `von ${formatCents(data.minijob.limitCents)} im ${monthName}`,
						highlight: false
					}
				]
			: [])
	]);
</script>

<svelte:head><title>tracky · Statistik</title></svelte:head>

<div class="flex flex-col gap-7">
	<PageHeader eyebrow={ranges.find((r) => r.key === data.range)?.eyebrow ?? ''} title="Statistik">
		<nav class="flex gap-0.5 rounded-full border border-line p-1" aria-label="Zeitraum">
			{#each ranges as r (r.key)}
				<a
					href="?range={r.key}"
					aria-current={data.range === r.key ? 'page' : undefined}
					class="rounded-full px-3.5 py-2 text-[13px] transition-colors {data.range === r.key
						? 'bg-raised font-semibold'
						: 'text-muted hover:text-fg'}"
				>
					{r.label}
				</a>
			{/each}
		</nav>
	</PageHeader>

	<section id="weekly" class="flex flex-col gap-6">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div class="flex flex-col gap-1.5">
				<h2 class="text-[17px] font-semibold">Stunden pro Woche</h2>
				<p class="text-[13px] text-muted">
					Ø {hm(data.avgWeekHours)} · {data.weeksOverTarget} von {data.completedWeeks} Wochen über dem
					Soll
				</p>
			</div>
			<ul class="flex items-center gap-4.5 text-xs text-muted">
				<li class="flex items-center gap-2">
					<span class="size-2 rounded-xs bg-line-strong"></span>Woche
				</li>
				<li class="flex items-center gap-2">
					<span class="size-2 rounded-xs bg-accent"></span>Aktuell
				</li>
				<li class="flex items-center gap-2">
					<span class="h-0.5 w-3.5 bg-muted"></span>Soll {data.weeklyTargetHours.toLocaleString(
						'de-DE'
					)}h
				</li>
			</ul>
		</div>

		<div class="flex flex-col gap-2">
			<div class="relative flex h-64 items-end {dense ? 'gap-1' : 'gap-1.5 sm:gap-3'}">
				<div
					class="pointer-events-none absolute inset-x-0 z-10 h-px bg-fg/50"
					style:bottom="{(data.weeklyTargetHours / scaleMax) * 100}%"
					aria-hidden="true"
				></div>
				{#each data.weeks as week, i (week.weekStart)}
					{@const current = i === currentIndex}
					<div class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
						{#if !dense}
							<span
								class="font-mono text-[11px] tabular-nums max-sm:hidden sm:text-xs {current
									? 'text-accent'
									: week.hours >= data.weeklyTargetHours
										? 'text-fg'
										: 'text-muted'}"
							>
								{hoursLabel(week.hours)}
							</span>
						{/if}
						<div
							class="w-full rounded-t-md rounded-b-[2px] {current ? 'bg-accent' : 'bg-line-strong'}"
							style:height="{Math.max(1, (week.hours / scaleMax) * 100)}%"
							title="KW {week.kw}: {hm(week.hours)}"
						></div>
					</div>
				{/each}
			</div>
			<div class="flex {dense ? 'gap-1' : 'gap-1.5 sm:gap-3'}" aria-hidden="true">
				{#each data.weeks as week, i (week.weekStart)}
					<span
						class="min-w-0 flex-1 overflow-visible text-center font-mono text-[11px] tracking-wide whitespace-nowrap {i ===
						currentIndex
							? 'text-accent'
							: 'text-muted'}"
					>
						{#if (currentIndex - i) % labelEvery === 0}<span class={dense ? '' : 'max-sm:hidden'}
								>KW
							</span>{week.kw}{/if}
					</span>
				{/each}
			</div>
			<table class="sr-only">
				<caption>Stunden pro Kalenderwoche</caption>
				<thead><tr><th>Woche</th><th>Stunden</th></tr></thead>
				<tbody>
					{#each data.weeks as week (week.weekStart)}
						<tr><td>KW {week.kw}</td><td>{hm(week.hours)}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<div class="grid gap-7 xl:grid-cols-[1fr_400px]">
		<section id="per-job" class="flex flex-col gap-6 rounded-2xl bg-surface p-6 sm:p-7">
			<div class="flex items-center justify-between">
				<h2 class="text-[17px] font-semibold">Stunden pro Job</h2>
				<span class="text-[13px] text-muted">{monthName}</span>
			</div>
			{#if data.perJob.length === 0}
				<p class="py-8 text-center text-sm text-muted">Noch keine Einträge in diesem Monat.</p>
			{:else}
				<div class="flex flex-1 flex-col items-center gap-9 sm:flex-row">
					<div class="relative size-44 shrink-0">
						<svg viewBox="0 0 36 36" class="size-full -rotate-90" aria-hidden="true">
							<circle
								cx="18"
								cy="18"
								r="15.9155"
								fill="none"
								class="stroke-line"
								stroke-width="3.6"
							/>
							{#each segments as seg, i (i)}
								<circle
									cx="18"
									cy="18"
									r="15.9155"
									fill="none"
									stroke={seg.color}
									stroke-width="3.6"
									stroke-dasharray="{seg.dash} {100 - seg.dash}"
									stroke-dashoffset={-seg.offset}
								/>
							{/each}
						</svg>
						<div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
							<span class="font-mono text-[22px] font-medium tracking-tight"
								>{hm(totalMonthHours)}</span
							>
							<span class="text-xs text-muted">{formatCents(totalMonthCents)}</span>
						</div>
					</div>
					<ul class="w-full flex-1">
						{#each data.perJob as p (p.job.id)}
							<li class="flex flex-col gap-2.5 border-t border-line py-4">
								<div class="flex items-center gap-2.5">
									<span class="size-2.5 rounded-[3px]" style:background={p.job.color}></span>
									<span class="text-[15px] font-semibold">{p.job.name}</span>
									{#if p.job.isMinijob}
										<span
											class="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-muted uppercase"
											>Minijob</span
										>
									{/if}
									<span class="ml-auto font-mono text-[13px] text-muted"
										>{Math.round((p.hours / totalMonthHours) * 100)} %</span
									>
								</div>
								<div
									class="flex flex-wrap gap-x-4 pl-5 font-mono text-xl font-medium tracking-tight"
								>
									<span>{hm(p.hours)}</span>
									<span class="text-muted">{formatCents(p.grossCents)}</span>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>

		<section id="kennzahlen" class="flex flex-col">
			<h2 class="pb-3.5 text-[17px] font-semibold">Kennzahlen</h2>
			<dl>
				{#each figures as f (f.label)}
					<div class="flex items-center justify-between gap-4 border-t border-line py-4">
						<div class="flex flex-col gap-1">
							<dt class="eyebrow">{f.label}</dt>
							<span class="text-[13px] text-muted">{f.sub}</span>
						</div>
						<dd
							class="font-mono text-[22px] font-medium tracking-tight tabular-nums {f.highlight
								? 'text-accent'
								: ''}"
						>
							{f.value}
						</dd>
					</div>
				{/each}
			</dl>
		</section>
	</div>
</div>
