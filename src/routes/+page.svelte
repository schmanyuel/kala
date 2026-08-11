<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents, formatDuration, formatTime, toDatetimeLocal } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let elapsedSeconds = $state(0);
	let showManualEntry = $state(false);

	$effect(() => {
		if (!data.runningEntry) return;
		const start = new Date(data.runningEntry.startTime).getTime();
		const tick = () => (elapsedSeconds = (Date.now() - start) / 1000);
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	});

	const now = new Date();
	const defaultStart = toDatetimeLocal(now);
	const defaultEnd = toDatetimeLocal(now);
</script>

<div class="space-y-8">
	{#if form?.error}
		<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
	{/if}

	<section class="rounded-lg border border-neutral-200 bg-white p-5">
		{#if data.runningEntry}
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-neutral-500">{data.runningEntry.job.name} läuft seit {formatTime(new Date(data.runningEntry.startTime))}</p>
					<p class="mt-1 font-mono text-3xl tabular-nums text-neutral-900">{formatDuration(elapsedSeconds)}</p>
				</div>
				<form method="POST" action="?/stopTimer" use:enhance>
					<button type="submit" class="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
						Stopp
					</button>
				</form>
			</div>
		{:else if data.jobs.length === 0}
			<p class="text-sm text-neutral-500">
				Lege zuerst einen <a href="/jobs" class="text-teal-700 underline">Job</a> an, um Zeit zu tracken.
			</p>
		{:else}
			<form method="POST" action="?/startTimer" use:enhance class="flex flex-wrap items-end gap-3">
				<label class="text-sm">
					<span class="block text-neutral-500">Job</span>
					<select name="jobId" required class="mt-1 rounded border border-neutral-300 px-2 py-1.5">
						{#each data.jobs as job (job.id)}
							<option value={job.id}>{job.name}</option>
						{/each}
					</select>
				</label>
				<label class="text-sm">
					<span class="block text-neutral-500">Notiz (optional)</span>
					<input type="text" name="note" class="mt-1 rounded border border-neutral-300 px-2 py-1.5" />
				</label>
				<button type="submit" class="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
					Start
				</button>
			</form>
		{/if}
	</section>

	<section class="flex items-baseline justify-between rounded-lg border border-neutral-200 bg-white p-5">
		<div>
			<p class="text-sm text-neutral-500">Heute</p>
			<p class="text-xl font-semibold text-neutral-900">{formatDuration(data.todaySummary.totalSeconds)}</p>
		</div>
		<p class="text-lg text-neutral-600">{formatCents(data.todaySummary.totalGrossCents)} brutto</p>
	</section>

	<section>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-neutral-900">Einträge heute</h2>
			<button type="button" class="text-sm text-teal-700 hover:underline" onclick={() => (showManualEntry = !showManualEntry)}>
				{showManualEntry ? 'Abbrechen' : '+ Manueller Eintrag'}
			</button>
		</div>

		{#if showManualEntry}
			<form
				method="POST"
				action="?/createManualEntry"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						showManualEntry = false;
					};
				}}
				class="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
			>
				<label class="text-sm">
					<span class="block text-neutral-500">Job</span>
					<select name="jobId" required class="mt-1 rounded border border-neutral-300 px-2 py-1.5">
						{#each data.jobs as job (job.id)}
							<option value={job.id}>{job.name}</option>
						{/each}
					</select>
				</label>
				<label class="text-sm">
					<span class="block text-neutral-500">Start</span>
					<input type="datetime-local" name="startTime" required value={defaultStart} class="mt-1 rounded border border-neutral-300 px-2 py-1.5" />
				</label>
				<label class="text-sm">
					<span class="block text-neutral-500">Ende</span>
					<input type="datetime-local" name="endTime" required value={defaultEnd} class="mt-1 rounded border border-neutral-300 px-2 py-1.5" />
				</label>
				<label class="text-sm">
					<span class="block text-neutral-500">Notiz (optional)</span>
					<input type="text" name="note" class="mt-1 rounded border border-neutral-300 px-2 py-1.5" />
				</label>
				<button type="submit" class="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
					Speichern
				</button>
			</form>
		{/if}

		<ul class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
			{#each data.todayEntries as entry (entry.id)}
				<li class="flex items-center justify-between p-4">
					<div>
						<p class="text-sm font-medium text-neutral-900">{entry.job.name}</p>
						<p class="text-sm text-neutral-500">
							{formatTime(new Date(entry.startTime))} – {entry.endTime ? formatTime(new Date(entry.endTime)) : 'läuft'}
							{#if entry.note}
								<span class="text-neutral-400">· {entry.note}</span>
							{/if}
						</p>
					</div>
					<form method="POST" action="?/deleteEntry" use:enhance>
						<input type="hidden" name="id" value={entry.id} />
						<button type="submit" class="text-sm text-neutral-400 hover:text-red-600">Löschen</button>
					</form>
				</li>
			{:else}
				<li class="p-4 text-sm text-neutral-500">Noch keine Einträge heute.</li>
			{/each}
		</ul>
	</section>
</div>
