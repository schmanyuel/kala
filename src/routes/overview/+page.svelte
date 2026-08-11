<script lang="ts">
	import { formatCents, formatDate, formatDuration, formatTime } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function weekLabel(start: Date, end: Date): string {
		const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
		return `${fmt(start)} – ${fmt(end)}`;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold text-neutral-900">Wochenübersicht</h1>
			<p class="mt-1 text-sm text-neutral-500">{weekLabel(new Date(data.weekStart), new Date(data.weekEnd))}</p>
		</div>
		<div class="flex items-center gap-2 text-sm">
			<a href="?offset={data.offset - 1}" class="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100">← Vorherige</a>
			<a href="?offset=0" class="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100">Heute</a>
			<a href="?offset={data.offset + 1}" class="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100">Nächste →</a>
		</div>
	</div>

	<section class="flex items-baseline justify-between rounded-lg border border-neutral-200 bg-white p-5">
		<div>
			<p class="text-sm text-neutral-500">Woche gesamt</p>
			<p class="text-xl font-semibold text-neutral-900">{formatDuration(data.weekSummary.totalSeconds)}</p>
		</div>
		<p class="text-lg text-neutral-600">{formatCents(data.weekSummary.totalGrossCents)} brutto</p>
	</section>

	<ul class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
		{#each data.days as day (day.date)}
			<li class="p-4">
				<div class="flex items-center justify-between">
					<p class="text-sm font-medium text-neutral-900">{formatDate(new Date(day.date))}</p>
					<p class="text-sm text-neutral-500">
						{formatDuration(day.summary.totalSeconds)}
						{#if day.summary.totalSeconds > 0}
							<span class="text-neutral-400">· {formatCents(day.summary.totalGrossCents)}</span>
						{/if}
					</p>
				</div>
				{#if day.entries.length > 0}
					<ul class="mt-2 space-y-1">
						{#each day.entries as entry (entry.id)}
							<li class="text-sm text-neutral-500">
								{entry.job.name}: {formatTime(new Date(entry.startTime))} – {entry.endTime
									? formatTime(new Date(entry.endTime))
									: 'läuft'}
								{#if entry.note}
									<span class="text-neutral-400">· {entry.note}</span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</div>
