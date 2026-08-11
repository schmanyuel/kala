<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-lg font-semibold text-neutral-900">Einstellungen</h1>
		<p class="mt-1 text-sm text-neutral-500">Soll-Arbeitszeit für die Überstunden-Berechnung.</p>
	</div>

	{#if form?.error}
		<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
	{:else if form?.success}
		<p class="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">Gespeichert.</p>
	{/if}

	<form
		method="POST"
		action="?/updateWeeklyTargetHours"
		use:enhance
		class="flex items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
	>
		<label class="text-sm">
			<span class="block text-neutral-500">Soll-Arbeitszeit pro Woche (Stunden)</span>
			<input
				type="text"
				name="weeklyTargetHours"
				value={data.settings.weeklyTargetHours}
				class="mt-1 w-28 rounded border border-neutral-300 px-2 py-1"
			/>
		</label>
		<button type="submit" class="rounded bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700">
			Speichern
		</button>
	</form>
</div>
