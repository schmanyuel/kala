<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let from = $state(data.defaultFrom);
	let to = $state(data.defaultTo);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-lg font-semibold text-neutral-900">Export</h1>
		<p class="mt-1 text-sm text-neutral-500">Zeiteinträge für einen Zeitraum als CSV oder PDF exportieren.</p>
	</div>

	<div class="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
		<label class="text-sm">
			<span class="block text-neutral-500">Von</span>
			<input type="date" bind:value={from} class="mt-1 rounded border border-neutral-300 px-2 py-1" />
		</label>
		<label class="text-sm">
			<span class="block text-neutral-500">Bis</span>
			<input type="date" bind:value={to} class="mt-1 rounded border border-neutral-300 px-2 py-1" />
		</label>
		<a
			href="/export/csv?from={from}&to={to}"
			class="rounded bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700"
		>
			CSV exportieren
		</a>
		<a
			href="/export/pdf?from={from}&to={to}"
			class="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
		>
			PDF exportieren
		</a>
	</div>
</div>
