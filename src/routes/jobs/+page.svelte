<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Archive,
		ArchiveRestore,
		Calendar,
		Check,
		ChevronLeft,
		Pencil,
		Plus
	} from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatCents, formatDuration } from '$lib/format';
	import { JOB_COLORS, MINIJOB_LIMIT_CENTS } from '$lib/jobs';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showNewRateFor = $state<number | null>(null);
	let showNewProjectFor = $state<number | null>(null);
	let showArchive = $state(false);

	const monthShort = $derived(
		new Date(data.monthStart).toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')
	);
	const eyebrow = $derived(`${data.jobs.length} aktiv · ${data.archived.length} archiviert`);
	const defaultColor = $derived(
		JOB_COLORS.find((c) => !data.jobs.some((j) => j.color.toLowerCase() === c.toLowerCase())) ??
			JOB_COLORS[0]
	);

	const day = (d: Date) =>
		new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
	const since = (d: Date) => (new Date(d).getFullYear() <= 1970 ? 'von Anfang an' : day(d));

	// Close the inline forms once their action went through.
	const closeOnSuccess =
		() =>
		async ({ update, result }: { update: () => Promise<void>; result: { type: string } }) => {
			await update();
			if (result.type === 'success') {
				showNewRateFor = null;
				showNewProjectFor = null;
			}
		};
</script>

<svelte:head><title>tracky · Jobs</title></svelte:head>

<div class="flex flex-col gap-7">
	<PageHeader {eyebrow} title="Jobs">
		{#if data.archived.length}
			<button
				type="button"
				class="flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-muted {showArchive
					? 'bg-raised text-fg'
					: 'text-muted'}"
				aria-expanded={showArchive}
				aria-controls="archive"
				onclick={() => (showArchive = !showArchive)}
			>
				<Archive size={15} /> Archiv ({data.archived.length})
			</button>
		{/if}
	</PageHeader>

	{#if form?.error}
		<p
			role="alert"
			class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
		>
			{form.error}
		</p>
	{/if}

	<div class="grid items-start gap-7 xl:grid-cols-[1fr_360px]">
		<div class="flex min-w-0 flex-col gap-5">
			{#if showArchive && data.archived.length}
				<section
					id="archive"
					aria-label="Archivierte Jobs"
					class="rounded-2xl border border-line p-5"
				>
					<h2 class="pb-3 eyebrow">Archiviert</h2>
					<ul>
						{#each data.archived as job (job.id)}
							<li class="flex items-center gap-3 border-t border-line py-3">
								<span class="size-3 rounded-[3px] opacity-60" style:background={job.color}></span>
								<span class="flex-1 text-sm text-muted">{job.name}</span>
								<form method="POST" action="?/unarchiveJob" use:enhance>
									<input type="hidden" name="jobId" value={job.id} />
									<button
										type="submit"
										class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-raised hover:text-fg"
									>
										<ArchiveRestore size={14} /> Wiederherstellen
									</button>
								</form>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#each data.jobs as job (job.id)}
				{@const editing = showNewRateFor === job.id}
				<article
					id="job-{job.id}"
					class="flex flex-col gap-6 rounded-2xl bg-surface p-5 sm:p-7 {editing
						? 'ring-1 ring-line-strong'
						: ''}"
					aria-labelledby="job-{job.id}-name"
				>
					<div class="flex flex-wrap items-center gap-3">
						<span class="size-3.5 rounded" style:background={job.color} aria-hidden="true"></span>
						<h2 id="job-{job.id}-name" class="text-[22px] font-semibold tracking-tight">
							{job.name}
						</h2>
						{#if job.isMinijob}
							<span
								class="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-accent uppercase"
								>Minijob</span
							>
						{/if}
						<div class="ml-auto flex items-center gap-1">
							<button
								type="button"
								class="flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors {editing
									? 'border-line-strong bg-raised'
									: 'border-line hover:border-muted'}"
								aria-expanded={editing}
								onclick={() => (showNewRateFor = editing ? null : job.id)}
							>
								<Pencil size={14} /> Lohn ändern
							</button>
							<form method="POST" action="?/archiveJob" use:enhance>
								<input type="hidden" name="jobId" value={job.id} />
								<button
									type="submit"
									class="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-raised hover:text-fg"
									aria-label="{job.name} archivieren"
									title="Archivieren"
								>
									<Archive size={16} />
								</button>
							</form>
						</div>
					</div>

					<dl class="grid grid-cols-3">
						{#each [{ label: 'Stundenlohn', value: job.currentRateCents !== null ? `${formatCents(job.currentRateCents)}/h` : '—' }, { label: `Stunden ${monthShort}.`, value: formatDuration(job.month.totalSeconds) }, { label: `Brutto ${monthShort}.`, value: formatCents(job.month.totalGrossCents) }] as stat, i (stat.label)}
							<div
								class="flex min-w-0 flex-col gap-1.5 {i
									? 'border-l border-line pl-3 sm:pl-6'
									: 'pr-3'}"
							>
								<dt class="truncate eyebrow max-sm:tracking-normal">{stat.label}</dt>
								<dd class="font-mono text-lg font-medium tracking-tight tabular-nums sm:text-2xl">
									{stat.value}
								</dd>
							</div>
						{/each}
					</dl>

					{#if job.isMinijob}
						{@const share = Math.min(100, (job.month.totalGrossCents / MINIJOB_LIMIT_CENTS) * 100)}
						<div class="flex flex-col gap-2">
							<div class="h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
								<div
									class="h-full rounded-full {share >= 90 ? 'bg-red-400' : 'bg-accent'}"
									style:width="{share}%"
								></div>
							</div>
							<p class="text-xs text-muted">
								{Math.round(share)} % der Minijob-Grenze ({formatCents(MINIJOB_LIMIT_CENTS)}) im {new Date(
									data.monthStart
								).toLocaleDateString('de-DE', { month: 'long' })}
							</p>
						</div>
					{/if}

					{#if editing}
						<form
							method="POST"
							action="?/addWageRate"
							use:enhance={closeOnSuccess}
							class="flex flex-wrap items-end gap-4 rounded-xl bg-bg p-5"
						>
							<input type="hidden" name="jobId" value={job.id} />
							<label class="flex w-44 flex-col gap-2">
								<span class="text-xs text-muted">Neuer Stundenlohn</span>
								<span
									class="flex h-10.5 items-center rounded-[10px] border border-line-strong px-3.5 focus-within:border-accent"
								>
									<input
										type="text"
										name="hourlyRate"
										inputmode="decimal"
										required
										placeholder={job.currentRateCents !== null
											? (job.currentRateCents / 100).toFixed(2).replace('.', ',')
											: '14,00'}
										class="w-full min-w-0 bg-transparent font-mono text-[15px] outline-none placeholder:text-muted/60"
									/>
									<span class="text-[13px] text-muted">€/h</span>
								</span>
							</label>
							<label class="flex w-48 flex-col gap-2">
								<span class="text-xs text-muted">Gültig ab</span>
								<span
									class="flex h-10.5 items-center gap-2 rounded-[10px] border border-line-strong px-3.5 focus-within:border-accent"
								>
									<input
										type="date"
										name="validFrom"
										class="w-full min-w-0 bg-transparent font-mono text-sm outline-none [&::-webkit-calendar-picker-indicator]:opacity-0"
									/>
									<Calendar size={15} class="pointer-events-none -ml-6 shrink-0 text-muted" />
								</span>
							</label>
							<div class="ml-auto flex items-center gap-1">
								<button
									type="button"
									class="h-10.5 px-4 text-[13px] font-medium text-muted hover:text-fg"
									onclick={() => (showNewRateFor = null)}
								>
									Abbrechen
								</button>
								<button
									type="submit"
									class="flex h-10.5 items-center gap-2 rounded-full bg-accent px-4.5 text-[13px] font-semibold text-ink hover:brightness-95"
								>
									<Check size={15} /> Lohn speichern
								</button>
							</div>
						</form>
					{/if}

					<div class="flex flex-col gap-6 border-t border-line pt-5 sm:flex-row sm:gap-8">
						<div class="flex min-w-0 flex-1 flex-col gap-2.5">
							<h3 class="eyebrow text-[10px]">Lohnverlauf</h3>
							<ol class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
								{#if job.upcomingRate}
									<li class="flex items-center gap-1.5">
										<span class="font-mono text-accent"
											>{formatCents(job.upcomingRate.hourlyRateCents)}</span
										>
										<span class="text-muted">ab {day(job.upcomingRate.validFrom)}</span>
									</li>
									<li aria-hidden="true"><ChevronLeft size={12} class="text-line-strong" /></li>
								{/if}
								{#each job.rates as rate, i (rate.id)}
									{#if i}<li aria-hidden="true">
											<ChevronLeft size={12} class="text-line-strong" />
										</li>{/if}
									<li class="flex items-center gap-1.5">
										<span class="font-mono {i ? 'text-muted' : ''}"
											>{formatCents(rate.hourlyRateCents)}</span
										>
										<span class={i ? 'text-muted/60' : 'text-muted'}
											>{i || new Date(rate.validFrom).getFullYear() <= 1970
												? since(rate.validFrom)
												: `seit ${since(rate.validFrom)}`}</span
										>
									</li>
								{:else}
									<li class="text-muted">Kein Stundenlohn hinterlegt.</li>
								{/each}
							</ol>
						</div>
						<div class="flex flex-col gap-2.5">
							<h3 class="eyebrow text-[10px]">Projekte</h3>
							<div class="flex flex-wrap items-center gap-1.5">
								{#each job.projects as project (project.id)}
									<span class="rounded-full bg-raised px-2.5 py-1 text-xs">{project.name}</span>
								{/each}
								{#if showNewProjectFor === job.id}
									<form
										method="POST"
										action="?/createProject"
										use:enhance={closeOnSuccess}
										class="flex items-center gap-1"
									>
										<input type="hidden" name="jobId" value={job.id} />
										<!-- svelte-ignore a11y_autofocus -->
										<input
											type="text"
											name="name"
											required
											autofocus
											aria-label="Name des neuen Projekts"
											placeholder="Projektname"
											class="w-32 rounded-full border border-accent bg-transparent px-2.5 py-1 text-xs outline-none"
										/>
										<button
											type="submit"
											class="grid size-6.5 place-items-center rounded-full bg-accent text-ink"
											aria-label="Projekt anlegen"
										>
											<Check size={13} />
										</button>
									</form>
								{:else}
									<button
										type="button"
										class="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-muted hover:text-fg"
										onclick={() => (showNewProjectFor = job.id)}
									>
										<Plus size={12} /> Projekt
									</button>
								{/if}
							</div>
						</div>
					</div>
				</article>
			{:else}
				<p
					class="rounded-2xl border border-dashed border-line px-6 py-14 text-center text-sm text-muted"
				>
					Noch keine Jobs angelegt. Leg rechts deinen ersten an.
				</p>
			{/each}
		</div>

		<section
			id="new-job"
			aria-labelledby="new-job-title"
			class="flex flex-col gap-5.5 rounded-2xl bg-surface p-5 sm:p-7 xl:sticky xl:top-8"
		>
			<div class="flex flex-col gap-1.5">
				<h2 id="new-job-title" class="text-[17px] font-semibold">Neuen Job anlegen</h2>
				<p class="text-[13px] leading-snug text-muted">
					Anstellung mit Stundenlohn, z. B. Hauptjob oder Minijob.
				</p>
			</div>
			<form method="POST" action="?/createJob" use:enhance class="flex flex-col gap-5.5">
				<label class="flex flex-col gap-2">
					<span class="text-xs text-muted">Name</span>
					<input
						type="text"
						name="name"
						required
						placeholder="z. B. Werkstudent Agentur"
						class="h-10.5 rounded-[10px] border border-line-strong bg-bg px-3.5 text-sm outline-none placeholder:text-muted/60 focus:border-accent"
					/>
				</label>
				<fieldset class="flex flex-col gap-2.5">
					<legend class="pb-2.5 text-xs text-muted">Farbe</legend>
					<div class="flex flex-wrap gap-2">
						{#each JOB_COLORS as color (color)}
							<label
								class="grid size-7.5 cursor-pointer place-items-center rounded-full border-2 border-transparent has-checked:border-(--swatch) has-focus-visible:outline-2 has-focus-visible:outline-accent"
								style:--swatch={color}
							>
								<input
									type="radio"
									name="color"
									value={color}
									checked={color === defaultColor}
									class="sr-only"
									aria-label="Farbe {color}"
								/>
								<span class="size-5 rounded-full" style:background={color}></span>
							</label>
						{/each}
					</div>
				</fieldset>
				<label class="flex flex-col gap-2">
					<span class="text-xs text-muted">Stundenlohn</span>
					<span
						class="flex h-10.5 items-center rounded-[10px] border border-line-strong bg-bg px-3.5 focus-within:border-accent"
					>
						<input
							type="text"
							name="hourlyRate"
							inputmode="decimal"
							required
							placeholder="14,00"
							class="w-full min-w-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted/60"
						/>
						<span class="text-[13px] text-muted">€/h</span>
					</span>
				</label>
				<label class="flex cursor-pointer items-center gap-3 border-y border-line py-3.5">
					<span class="flex flex-1 flex-col gap-0.5">
						<span class="text-sm font-medium">Minijob</span>
						<span class="text-xs text-muted"
							>Zählt zur Minijob-Grenze ({formatCents(MINIJOB_LIMIT_CENTS)} / Monat)</span
						>
					</span>
					<input type="checkbox" name="isMinijob" class="peer sr-only" />
					<span
						class="relative h-6 w-10 shrink-0 rounded-full bg-line-strong transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-[3px] after:left-[3px] after:size-4.5 after:rounded-full after:bg-fg after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-ink"
						aria-hidden="true"
					></span>
				</label>
				<button
					type="submit"
					class="flex h-11 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-ink hover:brightness-95"
				>
					<Plus size={16} /> Job anlegen
				</button>
			</form>
		</section>
	</div>
</div>
