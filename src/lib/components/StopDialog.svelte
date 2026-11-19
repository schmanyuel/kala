<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { ArrowDown, ArrowUp, Square } from '@lucide/svelte';
	import { formatCents, formatTime } from '$lib/format';
	import {
		ROUNDING_STEPS,
		nearestDirection,
		roundDuration,
		roundingLabel,
		type RoundingDirection,
		type RoundingStep
	} from '$lib/rounding';

	let {
		startTime,
		jobName,
		elapsedSeconds,
		rateCents,
		defaultStep,
		onClose
	}: {
		startTime: Date;
		jobName: string;
		elapsedSeconds: number;
		rateCents: number;
		defaultStep: RoundingStep;
		onClose: () => void;
	} = $props();

	let dialog: HTMLDialogElement;
	$effect(() => {
		dialog.showModal();
	});

	// Chosen once when the dialog opens; the numbers below keep ticking with the timer.
	let step = $state<RoundingStep>(untrack(() => defaultStep));
	let direction = $state<RoundingDirection>(
		untrack(() => nearestDirection(elapsedSeconds, defaultStep))
	);
	let submitting = $state(false);

	const pickStep = (s: RoundingStep) => {
		step = s;
		direction = nearestDirection(elapsedSeconds, s);
	};

	const pad = (n: number) => n.toString().padStart(2, '0');
	const hm = (s: number) => `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}`;
	const hms = (s: number) => `${hm(s)}:${pad(Math.floor(s % 60))}`;
	const endAt = (seconds: number) => formatTime(new Date(startTime.getTime() + seconds * 1000));

	const options = $derived.by(() => {
		if (!step) return [];
		const down = roundDuration(elapsedSeconds, step, 'down');
		const up = roundDuration(elapsedSeconds, step, 'up');
		return [
			{ dir: 'down' as const, label: 'Abrunden', icon: ArrowDown, seconds: down },
			{ dir: 'up' as const, label: 'Aufrunden', icon: ArrowUp, seconds: up }
		].filter((o, i, all) => i === 0 || o.seconds !== all[0].seconds);
	});
	// If both directions land on the same value (exact multiple / under one step), there is
	// only one card; keep the submitted direction in sync with it.
	$effect(() => {
		if (options.length === 1) direction = options[0].dir;
	});

	const booked = $derived(step ? roundDuration(elapsedSeconds, step, direction) : elapsedSeconds);
	const diff = $derived(booked - elapsedSeconds);
</script>

<!-- Bottom sheet on phones, centered dialog from sm up. Native <dialog> handles focus and Esc. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	aria-labelledby="stop-title"
	oncancel={(e) => {
		e.preventDefault();
		onClose();
	}}
	onclick={(e) => {
		if (e.target === dialog) onClose();
	}}
	class="m-0 mt-auto w-full max-w-none rounded-t-3xl border-t border-line bg-surface text-fg shadow-[0_-20px_60px_#00000099] transition duration-300 ease-out backdrop:bg-black/60 backdrop:backdrop-blur-[2px] motion-reduce:transition-none sm:m-auto sm:w-[480px] sm:rounded-3xl sm:border starting:translate-y-full sm:starting:translate-y-4 sm:starting:opacity-0"
>
	<form
		method="POST"
		action="?/stopTimer"
		use:enhance={() => {
			submitting = true;
			return async ({ update, result }) => {
				await update();
				submitting = false;
				if (result.type === 'success') onClose();
			};
		}}
		class="flex flex-col gap-6 p-6 sm:p-7"
	>
		<input type="hidden" name="step" value={step} />
		<input type="hidden" name="direction" value={direction} />

		<div class="flex justify-center sm:hidden" aria-hidden="true">
			<span class="-mt-3 h-1 w-10 rounded-full bg-line-strong"></span>
		</div>

		<header class="flex flex-col gap-1.5">
			<p class="eyebrow">Eintrag abschließen · {jobName}</p>
			<h2 id="stop-title" class="text-xl font-semibold tracking-tight">Welche Zeit buchen?</h2>
			<p class="font-mono text-[13px] text-muted tabular-nums">
				Gemessen {hms(elapsedSeconds)} · {formatTime(startTime)} – {endAt(elapsedSeconds)}
			</p>
		</header>

		<fieldset class="flex flex-col gap-2.5">
			<legend class="pb-2.5 eyebrow">Runden auf</legend>
			<div class="grid grid-cols-4 gap-1 rounded-xl bg-bg p-1">
				{#each ROUNDING_STEPS as s (s)}
					<label
						class="cursor-pointer rounded-lg py-2 text-center text-sm transition-colors has-checked:bg-raised has-checked:font-semibold has-checked:text-fg has-focus-visible:outline-2 has-focus-visible:outline-accent {step ===
						s
							? ''
							: 'text-muted hover:text-fg'}"
					>
						<input
							type="radio"
							name="stepChoice"
							value={s}
							checked={step === s}
							onchange={() => pickStep(s)}
							class="sr-only"
						/>
						{roundingLabel(s)}
					</label>
				{/each}
			</div>
		</fieldset>

		{#if options.length}
			<fieldset class="grid gap-2.5 {options.length > 1 ? 'grid-cols-2' : ''}">
				<legend class="sr-only">Richtung</legend>
				{#each options as o (o.dir)}
					<label
						class="flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent {direction ===
						o.dir
							? 'border-accent bg-accent/[0.06]'
							: 'border-line-strong hover:border-muted'}"
					>
						<input
							type="radio"
							name="directionChoice"
							value={o.dir}
							checked={direction === o.dir}
							onchange={() => (direction = o.dir)}
							class="sr-only"
						/>
						<span
							class="flex items-center gap-1.5 text-xs {direction === o.dir
								? 'text-accent'
								: 'text-muted'}"
						>
							<o.icon size={13} aria-hidden="true" />
							{options.length > 1 ? o.label : 'Gerundet'}
						</span>
						<span class="font-mono text-[28px] font-medium tracking-tight tabular-nums"
							>{hm(o.seconds)}</span
						>
						<span class="flex flex-wrap gap-x-2 font-mono text-xs text-muted tabular-nums">
							<span>bis {endAt(o.seconds)}</span>
							{#if rateCents}<span class="text-fg/80"
									>{formatCents((o.seconds / 3600) * rateCents)}</span
								>{/if}
						</span>
					</label>
				{/each}
			</fieldset>
		{:else}
			<div class="flex flex-col gap-1 rounded-2xl border border-accent bg-accent/[0.06] p-4">
				<span class="text-xs text-accent">Exakt wie gemessen</span>
				<span class="font-mono text-[28px] font-medium tracking-tight tabular-nums"
					>{hm(elapsedSeconds)}</span
				>
				<span class="flex flex-wrap gap-x-2 font-mono text-xs text-muted tabular-nums">
					<span>bis {endAt(elapsedSeconds)}</span>
					{#if rateCents}<span class="text-fg/80"
							>{formatCents((elapsedSeconds / 3600) * rateCents)}</span
						>{/if}
				</span>
			</div>
		{/if}

		<p class="-mt-2 text-[13px] text-muted" aria-live="polite">
			{#if step && Math.abs(diff) >= 60}
				{diff > 0 ? '+' : '−'}{Math.round(Math.abs(diff) / 60)} min gegenüber der gemessenen Zeit. Der
				Start bleibt, das Ende wird angepasst.
			{:else}
				Start und Ende werden so gespeichert, wie sie gemessen wurden.
			{/if}
		</p>

		<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<button
				type="button"
				onclick={onClose}
				class="rounded-full px-5 py-3 text-sm font-medium text-muted hover:text-fg"
			>
				Weiterlaufen lassen
			</button>
			<button
				type="submit"
				disabled={submitting}
				class="flex items-center justify-center gap-2.5 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink hover:brightness-95 disabled:opacity-60"
			>
				<Square size={12} class="fill-ink" aria-hidden="true" />
				{hm(booked)} buchen & stoppen
			</button>
		</div>
	</form>
</dialog>
