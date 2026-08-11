<script lang="ts">
	import { formatCents } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Validated CVD-safe categorical order (dataviz skill reference palette).
	const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

	const maxWeekHours = $derived(Math.max(1, ...data.weeks.map((w) => w.hours)));
	const maxJobHours = $derived(Math.max(1, ...data.perJob.map((p) => p.hours)));
	const currentWeekIndex = $derived(data.weeks.length - 1);

	function weekTick(date: Date): string {
		return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
	}

	function monthLabel(start: Date, end: Date): string {
		return new Date(start).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-lg font-semibold text-neutral-900">Statistik</h1>
		<p class="mt-1 text-sm text-neutral-500">Verlauf der letzten {data.weeks.length} Wochen und Verteilung nach Job.</p>
	</div>

	<section class="rounded-lg border border-neutral-200 bg-white p-5">
		<h2 class="text-sm font-semibold text-neutral-900">Stunden pro Woche</h2>
		<div class="mt-4 flex items-stretch gap-2" style="height: 160px">
			{#each data.weeks as week, i (week.weekStart)}
				<div class="flex flex-1 flex-col items-center gap-1">
					<span class="text-xs tabular-nums text-neutral-500">
						{week.hours > 0 ? week.hours.toFixed(1) : ''}
					</span>
					<div class="flex w-full flex-1 items-end">
						<div
							class="w-full rounded-t {i === currentWeekIndex ? 'bg-teal-600' : 'bg-neutral-300'}"
							style="height: {Math.max(2, (week.hours / maxWeekHours) * 100)}%"
							title="{weekTick(week.weekStart)}: {week.hours.toFixed(1)}h"
						></div>
					</div>
					<span class="text-xs text-neutral-400">{weekTick(week.weekStart)}</span>
				</div>
			{/each}
		</div>
	</section>

	<section class="rounded-lg border border-neutral-200 bg-white p-5">
		<h2 class="text-sm font-semibold text-neutral-900">Stunden pro Job — {monthLabel(data.monthStart, data.monthEnd)}</h2>
		{#if data.perJob.length === 0}
			<p class="mt-3 text-sm text-neutral-500">Noch keine Einträge in diesem Monat.</p>
		{:else}
			<ul class="mt-4 space-y-3">
				{#each data.perJob as entry, i (entry.job.id)}
					<li>
						<div class="flex items-center justify-between text-sm">
							<span class="flex items-center gap-2 font-medium text-neutral-900">
								<span class="inline-block h-2.5 w-2.5 rounded-full" style="background: {CATEGORICAL[i % CATEGORICAL.length]}"
								></span>
								{entry.job.name}
							</span>
							<span class="text-neutral-500">{entry.hours.toFixed(1)}h · {formatCents(entry.grossCents)}</span>
						</div>
						<div class="mt-1 h-2 w-full rounded-full bg-neutral-100">
							<div
								class="h-2 rounded-full"
								style="width: {Math.max(2, (entry.hours / maxJobHours) * 100)}%; background: {CATEGORICAL[
									i % CATEGORICAL.length
								]}"
							></div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
