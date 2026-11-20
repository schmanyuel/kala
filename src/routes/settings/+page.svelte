<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleCheck, Minus, Plus } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatDuration } from '$lib/format';
	import { LANGS, locale, t, type Lang } from '$lib/i18n';
	import { ROUNDING_STEPS, nearestDirection, roundDuration, roundingLabel } from '$lib/rounding';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const saved = $derived(Number(data.settings.weeklyTargetHours));
	let hours = $state(0);
	$effect.pre(() => {
		hours = saved;
	});

	const dirty = $derived(hours !== saved);
	const clamp = (h: number) => Math.min(168, Math.max(0, Math.round(h * 2) / 2));
	const QUICK = [10, 20, 30, 40];

	let rounding = $state(0);
	$effect.pre(() => {
		rounding = data.settings.stopRoundingMinutes;
	});
	const example = (step: number) => {
		const s = roundDuration(167 * 60, step, nearestDirection(167 * 60, step));
		return `${Math.floor(s / 3600)}:${String((s % 3600) / 60).padStart(2, '0')}`;
	};
	const roundingDirty = $derived(rounding !== data.settings.stopRoundingMinutes);

	let language = $state<Lang>('en');
	$effect.pre(() => {
		language = data.lang;
	});
	const LANG_NAMES: Record<Lang, string> = { en: 'English', de: 'Deutsch' };

	const system = $derived([
		{ label: t('Database'), value: t('PostgreSQL · connected'), ok: true },
		{ label: t('Total entries'), value: data.entryCount.toLocaleString(locale()) },
		{ label: t('Version'), value: data.version }
	]);
</script>

<svelte:head><title>kala · {t('Settings')}</title></svelte:head>

<div class="flex flex-col gap-7">
	<PageHeader eyebrow="kala · {t('self-hosted')}" title={t('Settings')}>
		{#if form?.success && !dirty && !roundingDirty && language === data.lang}
			<p
				role="status"
				class="flex items-center gap-2 rounded-full border border-accent/25 bg-accent/[0.08] px-3.5 py-2 text-[13px] font-medium text-accent"
			>
				<CircleCheck size={15} />
				{t('Saved')}
			</p>
		{/if}
	</PageHeader>

	{#if form?.error}
		<p
			role="alert"
			class="max-w-190 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
		>
			{form.error}
		</p>
	{/if}

	<div class="flex max-w-190 flex-col">
		<section class="grid gap-5 border-t border-line py-8 md:grid-cols-[240px_1fr] md:gap-12">
			<div class="flex flex-col gap-1.5">
				<h2 class="text-base font-semibold">{t('Language')}</h2>
				<p class="text-[13px] leading-relaxed text-muted">
					{t('Used for the interface, dates and exports on every device.')}
				</p>
			</div>
			<form
				method="POST"
				action="?/updateLanguage"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
				class="flex flex-col gap-4"
			>
				<fieldset class="grid w-full max-w-sm grid-cols-2 gap-1 rounded-xl bg-surface p-1">
					<legend class="sr-only">{t('Language')}</legend>
					{#each LANGS as l (l)}
						<label
							class="cursor-pointer rounded-lg py-2.5 text-center text-sm transition-colors has-checked:bg-raised has-checked:font-semibold has-checked:text-fg has-focus-visible:outline-2 has-focus-visible:outline-accent {language ===
							l
								? ''
								: 'text-muted hover:text-fg'}"
						>
							<input type="radio" name="language" value={l} bind:group={language} class="sr-only" />
							{LANG_NAMES[l]}
						</label>
					{/each}
				</fieldset>
				<button
					type="submit"
					disabled={language === data.lang}
					class="w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:brightness-95 disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted"
				>
					{t('Save')}
				</button>
			</form>
		</section>

		<section
			id="soll-arbeitszeit"
			class="grid gap-5 border-t border-line py-8 md:grid-cols-[240px_1fr] md:gap-12"
		>
			<div class="flex flex-col gap-1.5">
				<h2 class="text-base font-semibold">{t('Weekly target')}</h2>
				<p class="text-[13px] leading-relaxed text-muted">
					{t('Basis for the overtime balance and the progress on the dashboard.')}
				</p>
			</div>
			<form
				method="POST"
				action="?/updateWeeklyTargetHours"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
				class="flex flex-col gap-4"
			>
				<div class="flex w-fit items-stretch rounded-[14px] border border-line-strong bg-surface">
					<button
						type="button"
						class="grid w-14 place-items-center text-fg hover:text-accent"
						aria-label={t('One hour less')}
						onclick={() => (hours = clamp(hours - 1))}
					>
						<Minus size={18} />
					</button>
					<label class="flex h-16 items-center gap-2 border-x border-line-strong px-6">
						<span class="sr-only">{t('Weekly target in hours')}</span>
						<input
							type="number"
							name="weeklyTargetHours"
							min="0"
							max="168"
							step="0.5"
							bind:value={hours}
							class="w-[2.2em] [appearance:textfield] bg-transparent text-right font-mono text-[30px] font-medium tracking-tight outline-none [&::-webkit-inner-spin-button]:appearance-none"
						/>
						<span class="text-[13px] whitespace-nowrap text-muted">{t('h / week')}</span>
					</label>
					<button
						type="button"
						class="grid w-14 place-items-center text-fg hover:text-accent"
						aria-label={t('One hour more')}
						onclick={() => (hours = clamp(hours + 1))}
					>
						<Plus size={18} />
					</button>
				</div>
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="mr-1 text-xs text-muted">{t('Quick pick')}</span>
					{#each QUICK as q (q)}
						<button
							type="button"
							aria-pressed={hours === q}
							class="rounded-full px-2.5 py-1 font-mono text-xs transition-colors {hours === q
								? 'bg-raised text-fg'
								: 'border border-line text-muted hover:border-muted'}"
							onclick={() => (hours = q)}
						>
							{q}h
						</button>
					{/each}
				</div>
				<p class="text-[13px] text-muted">
					{t('≈ {duration} per day over 5 working days', {
						duration: formatDuration(((hours || 0) / 5) * 3600)
					})}
				</p>
				<button
					type="submit"
					disabled={!dirty}
					class="w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:brightness-95 disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted"
				>
					{t('Save')}
				</button>
			</form>
		</section>

		<section
			id="rundung"
			class="grid gap-5 border-t border-line py-8 md:grid-cols-[240px_1fr] md:gap-12"
		>
			<div class="flex flex-col gap-1.5">
				<h2 class="text-base font-semibold">{t('Rounding when stopping')}</h2>
				<p class="text-[13px] leading-relaxed text-muted">
					{t(
						'Preselected in the stop dialog. Time is rounded to the nearest step, and you can still choose rounding down or up each time.'
					)}
				</p>
			</div>
			<form
				method="POST"
				action="?/updateStopRounding"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
				class="flex flex-col gap-4"
			>
				<fieldset class="grid w-full max-w-sm grid-cols-4 gap-1 rounded-xl bg-surface p-1">
					<legend class="sr-only">{t('Rounding step')}</legend>
					{#each ROUNDING_STEPS as s (s)}
						<label
							class="cursor-pointer rounded-lg py-2.5 text-center text-sm transition-colors has-checked:bg-raised has-checked:font-semibold has-checked:text-fg has-focus-visible:outline-2 has-focus-visible:outline-accent {rounding ===
							s
								? ''
								: 'text-muted hover:text-fg'}"
						>
							<input
								type="radio"
								name="stopRoundingMinutes"
								value={s}
								bind:group={rounding}
								class="sr-only"
							/>
							{t(roundingLabel(s))}
						</label>
					{/each}
				</fieldset>
				<p class="text-[13px] text-muted">
					{rounding
						? t('Example: 2:47 measured → {rounded} preselected', { rounded: example(rounding) })
						: t('Entries are saved exactly as measured.')}
				</p>
				<button
					type="submit"
					disabled={!roundingDirty}
					class="w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:brightness-95 disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted"
				>
					{t('Save')}
				</button>
			</form>
		</section>

		<section
			id="system"
			class="grid gap-5 border-t border-line py-8 md:grid-cols-[240px_1fr] md:gap-12"
		>
			<div class="flex flex-col gap-1.5">
				<h2 class="text-base font-semibold">{t('System')}</h2>
				<p class="text-[13px] leading-relaxed text-muted">
					{t('Your instance is self-hosted. Your data stays with you.')}
				</p>
			</div>
			<dl>
				{#each system as row (row.label)}
					<div class="flex items-center justify-between gap-4 border-b border-line py-3">
						<dt class="text-[13px] text-muted">{row.label}</dt>
						<dd class="flex items-center gap-2 font-mono text-xs">
							{#if row.ok}<span class="size-1.75 rounded-full bg-accent" aria-hidden="true"
								></span>{/if}
							{row.value}
						</dd>
					</div>
				{/each}
			</dl>
		</section>
	</div>
</div>
