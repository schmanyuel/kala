<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showNewRateFor = $state<number | null>(null);
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-lg font-semibold text-neutral-900">Jobs</h1>
		<p class="mt-1 text-sm text-neutral-500">Anstellungen mit Stundenlohn, z. B. Hauptjob und Minijob.</p>
	</div>

	{#if form?.error}
		<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
	{/if}

	<ul class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
		{#each data.jobs as job (job.id)}
			<li class="p-4">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="font-medium text-neutral-900">
							{job.name}
							{#if job.isMinijob}
								<span class="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-xs font-normal text-teal-700"
									>Minijob</span
								>
							{/if}
						</p>
						<p class="text-sm text-neutral-500">
							{job.currentRateCents !== null ? `${formatCents(job.currentRateCents)}/h` : 'kein Stundenlohn hinterlegt'}
						</p>
					</div>
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="text-sm text-neutral-500 hover:text-neutral-900"
							onclick={() => (showNewRateFor = showNewRateFor === job.id ? null : job.id)}
						>
							Lohn ändern
						</button>
						<form method="POST" action="?/archiveJob" use:enhance>
							<input type="hidden" name="jobId" value={job.id} />
							<button type="submit" class="text-sm text-neutral-400 hover:text-red-600">Archivieren</button>
						</form>
					</div>
				</div>

				{#if showNewRateFor === job.id}
					<form
						method="POST"
						action="?/addWageRate"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								showNewRateFor = null;
							};
						}}
						class="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3"
					>
						<input type="hidden" name="jobId" value={job.id} />
						<label class="text-sm">
							<span class="block text-neutral-500">Neuer Stundenlohn (€)</span>
							<input
								type="text"
								name="hourlyRate"
								required
								placeholder="14,50"
								class="mt-1 w-28 rounded border border-neutral-300 px-2 py-1"
							/>
						</label>
						<label class="text-sm">
							<span class="block text-neutral-500">Gültig ab</span>
							<input
								type="date"
								name="validFrom"
								class="mt-1 rounded border border-neutral-300 px-2 py-1"
							/>
						</label>
						<button type="submit" class="rounded bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700">
							Speichern
						</button>
					</form>
				{/if}
			</li>
		{:else}
			<li class="p-4 text-sm text-neutral-500">Noch keine Jobs angelegt.</li>
		{/each}
	</ul>

	<div class="rounded-lg border border-neutral-200 bg-white p-4">
		<h2 class="mb-3 text-sm font-semibold text-neutral-900">Neuen Job anlegen</h2>
		<form method="POST" action="?/createJob" use:enhance class="flex flex-wrap items-end gap-3">
			<label class="text-sm">
				<span class="block text-neutral-500">Name</span>
				<input
					type="text"
					name="name"
					required
					placeholder="z. B. Hauptjob"
					class="mt-1 w-48 rounded border border-neutral-300 px-2 py-1"
				/>
			</label>
			<label class="text-sm">
				<span class="block text-neutral-500">Stundenlohn (€)</span>
				<input
					type="text"
					name="hourlyRate"
					required
					placeholder="14,50"
					class="mt-1 w-28 rounded border border-neutral-300 px-2 py-1"
				/>
			</label>
			<label class="flex items-center gap-2 pb-1.5 text-sm text-neutral-600">
				<input type="checkbox" name="isMinijob" class="rounded border-neutral-300" />
				Minijob
			</label>
			<button type="submit" class="rounded bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700">
				Anlegen
			</button>
		</form>
	</div>
</div>
