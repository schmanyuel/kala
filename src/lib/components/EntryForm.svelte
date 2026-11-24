<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		Check,
		ChevronLeft,
		ChevronRight,
		History,
		ListTodo,
		MoveHorizontal,
		Plus,
		X
	} from '@lucide/svelte';
	import { addDays, startOfWeek } from '$lib/date';
	import { formatCents, formatDuration, formatTime, toDatetimeLocal } from '$lib/format';
	import { locale, t } from '$lib/i18n';
	import { nearestDirection, roundDuration } from '$lib/rounding';
	import type { PageData } from '../../routes/entry/$types';

	let {
		data,
		onDateChange,
		onSaved,
		onClose
	}: {
		data: PageData;
		onDateChange: (date: string) => void;
		onSaved: () => void;
		onClose: () => void;
	} = $props();

	const QUICK = [30, 60, 90, 120];
	const ROUND = [
		{ step: 15, label: '¼ h' },
		{ step: 30, label: '½ h' },
		{ step: 60, label: '1 h' }
	];
	const pad = (n: number) => n.toString().padStart(2, '0');
	const toMinutes = (t: string) => {
		const [h, m] = t.split(':').map(Number);
		return h * 60 + m;
	};
	const toHHMM = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
	const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
	const isoDate = (d: Date) => toDatetimeLocal(d).slice(0, 10);

	// Edit mode: prefilled from the entry. Read once, so refetches don't overwrite typing.
	const editing = untrack(() => data.editing);
	let jobId = $state(editing?.jobId ?? 0);
	let projectId = $state(editing?.projectId ? String(editing.projectId) : '');
	let start = $state(editing?.start ?? '09:00');
	let end = $state(editing?.end ?? '10:00');
	let items = $state<{ text: string; todoId?: number }[]>(
		editing?.activities.map((text) => ({
			text,
			todoId: editing.linkedTodos.find((t) => t.text === text)?.id
		})) ?? []
	);
	let note = $state(editing?.note ?? '');
	let draft = $state('');
	let error = $state<string | null>(null);
	let saving = $state(false);

	// Defaults: last used job; new block right after the day's last entry.
	$effect.pre(() => {
		if (!jobId || !data.jobs.some((j) => j.id === jobId)) {
			jobId = data.templates[0]?.jobId ?? data.jobs[0]?.id ?? 0;
		}
	});
	// Only when the day changes, not on every refetch, so typing isn't overwritten.
	$effect.pre(() => {
		void data.date;
		if (editing) return;
		untrack(() => {
			const last = data.dayEntries.findLast((e) => e.end);
			const from = last?.end ? Math.ceil(minutesOf(new Date(last.end)) / 15) * 15 : 9 * 60;
			start = toHHMM(Math.min(from, 22 * 60));
			end = toHHMM(Math.min(from + 60, 23 * 60 + 45));
			error = null;
		});
	});

	const day = $derived(new Date(`${data.date}T00:00`));
	const isToday = $derived(data.date === data.today);
	const job = $derived(data.jobs.find((j) => j.id === jobId));
	const jobProjects = $derived(data.projects.filter((p) => p.jobId === jobId));
	$effect.pre(() => {
		if (projectId && !jobProjects.some((p) => String(p.id) === projectId)) projectId = '';
	});

	const startMin = $derived(toMinutes(start || '00:00'));
	const endMin = $derived(toMinutes(end || '00:00'));
	const duration = $derived(Math.max(0, endMin - startMin));
	const rateCents = $derived.by(() => {
		const at = new Date(`${data.date}T${start || '00:00'}`).getTime();
		return job?.rates.find((r) => new Date(r.from).getTime() <= at)?.cents ?? 0;
	});
	const dayTotal = $derived(
		data.dayEntries.reduce((sum, e) => {
			const s = new Date(e.start).getTime();
			const en = e.end ? new Date(e.end).getTime() : Date.now();
			return sum + (en - s) / 1000;
		}, 0)
	);
	const overlaps = $derived(
		data.dayEntries.some((e) => {
			const s = minutesOf(new Date(e.start));
			const en = e.end ? minutesOf(new Date(e.end)) : minutesOf(new Date());
			return startMin < en && endMin > s;
		})
	);

	// Timeline range: 06–22, widened in 2h steps to fit entries and the new block.
	const range = $derived.by(() => {
		let lo = 6 * 60;
		let hi = 22 * 60;
		for (const e of data.dayEntries) {
			lo = Math.min(lo, minutesOf(new Date(e.start)));
			hi = Math.max(hi, e.end ? minutesOf(new Date(e.end)) : minutesOf(new Date()));
		}
		lo = Math.min(lo, startMin);
		hi = Math.max(hi, endMin);
		return { lo: Math.floor(lo / 120) * 120, hi: Math.min(24 * 60, Math.ceil(hi / 120) * 120) };
	});
	// Duration rounded to the nearest step (same rule as the stop dialog), in minutes.
	const rounded = (step: number) =>
		roundDuration(duration * 60, step, nearestDirection(duration * 60, step)) / 60;
	const hm = (min: number) => `${Math.floor(min / 60)}:${pad(min % 60)}`;

	const pct = (min: number) => ((min - range.lo) / (range.hi - range.lo)) * 100;
	const ticks = $derived(
		Array.from({ length: (range.hi - range.lo) / 240 + 1 }, (_, i) => range.lo + i * 240)
	);

	function placeBlock(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const min = range.lo + ((e.clientX - rect.left) / rect.width) * (range.hi - range.lo);
		const len = duration || 60;
		const s = Math.max(
			0,
			Math.min(24 * 60 - len, Math.round(min / 15) * 15 - Math.round(len / 30) * 15)
		);
		start = toHHMM(s);
		end = toHHMM(s + len);
	}

	const weekDays = $derived(Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day), i)));
	const suggestions = $derived(
		data.todos.filter(
			(t) => (t.jobId === null || t.jobId === jobId) && !items.some((i) => i.todoId === t.id)
		)
	);

	function addDraft() {
		const text = draft.trim();
		if (text) items.push({ text });
		draft = '';
	}

	const eyebrow = $derived(
		day.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }) +
			(isToday ? ` · ${t('today')}` : '')
	);
</script>

<form
	method="POST"
	action={editing ? '/entry?/update' : '/entry?/create'}
	class="flex h-full min-h-0 flex-col"
	use:enhance={({ cancel }) => {
		addDraft();
		if (!jobId) {
			error = t('Please create a job first.');
			cancel();
			return;
		}
		saving = true;
		return async ({ result }) => {
			saving = false;
			if (result.type === 'success') onSaved();
			else if (result.type === 'failure') error = String(result.data?.error ?? t('Saving failed.'));
			else error = t('Saving failed.');
		};
	}}
>
	<input type="hidden" name="date" value={data.date} />
	{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
	{#each items as item, i (i)}
		<input type="hidden" name="activity" value={item.text} />
		{#if item.todoId}<input type="hidden" name="todoId" value={item.todoId} />{/if}
	{/each}

	<header class="flex items-start justify-between gap-4 px-5 pt-2 pb-5 sm:px-8 sm:pt-7">
		<div class="flex flex-col gap-1.5">
			<p class="eyebrow">{eyebrow}</p>
			<h2 id="entry-sheet-title" class="text-xl font-semibold tracking-tight sm:text-2xl">
				{editing ? t('Edit entry') : t('Add entry')}
			</h2>
		</div>
		<div class="flex items-center gap-1.5">
			<button
				type="button"
				class="grid size-8.5 place-items-center rounded-full border border-line hover:border-muted max-sm:hidden"
				aria-label={t('Previous day')}
				onclick={() => onDateChange(isoDate(addDays(day, -1)))}
			>
				<ChevronLeft size={15} />
			</button>
			<button
				type="button"
				class="grid size-8.5 place-items-center rounded-full border border-line hover:border-muted disabled:opacity-30 max-sm:hidden"
				aria-label={t('Next day')}
				disabled={isToday}
				onclick={() => onDateChange(isoDate(addDays(day, 1)))}
			>
				<ChevronRight size={15} />
			</button>
			<button
				type="button"
				class="grid size-8.5 place-items-center rounded-full bg-raised hover:bg-line-strong"
				aria-label={t('Close')}
				onclick={onClose}
			>
				<X size={15} />
			</button>
		</div>
	</header>

	<div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6 sm:px-8">
		{#if data.jobs.length === 0}
			<p
				class="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted"
			>
				{t('No jobs yet.')}
				<a href="/jobs" class="text-accent underline underline-offset-2">{t('Create one first.')}</a
				>
			</p>
		{/if}

		<!-- Day picker (phone) -->
		<div class="grid grid-cols-7 gap-1.5 sm:hidden" role="group" aria-label={t('Choose day')}>
			{#each weekDays as d (d.getTime())}
				{@const iso = isoDate(d)}
				{@const active = iso === data.date}
				<button
					type="button"
					disabled={iso > data.today}
					aria-pressed={active}
					onclick={() => onDateChange(iso)}
					class="flex h-13 flex-col items-center justify-center gap-0.5 rounded-xl disabled:opacity-35 {active
						? 'bg-fg text-ink'
						: 'bg-bg'}"
				>
					<span
						class="font-mono text-[10px] tracking-wider {active ? 'text-ink/60' : 'text-muted'}"
					>
						{d.toLocaleDateString(locale(), { weekday: 'short' }).slice(0, 2).toUpperCase()}
					</span>
					<span class="font-mono text-base font-semibold">{d.getDate()}</span>
				</button>
			{/each}
		</div>

		<!-- Day timeline (desktop) -->
		<section class="flex flex-col gap-2.5 max-sm:hidden" aria-label={t('Your day')}>
			<div class="flex justify-between">
				<span class="eyebrow text-[10px]">{t('Your day')}</span>
				<span class="font-mono text-[11px] text-muted"
					>{t('so far {duration}', { duration: formatDuration(dayTotal) })}</span
				>
			</div>
			<div class="relative h-4" aria-hidden="true">
				{#each ticks as t (t)}
					<span
						class="absolute -translate-x-1/2 font-mono text-[10px] text-muted first:translate-x-0 last:-translate-x-full"
						style:left="{pct(t)}%">{pad(t / 60)}</span
					>
				{/each}
			</div>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div
				class="relative h-16 cursor-crosshair overflow-hidden rounded-xl bg-bg"
				onclick={placeBlock}
			>
				{#each ticks.slice(1, -1) as t (t)}
					<span class="absolute inset-y-0 w-px bg-line/60" style:left="{pct(t)}%"></span>
				{/each}
				{#each data.dayEntries as e (e.id)}
					{@const s = minutesOf(new Date(e.start))}
					{@const en = e.end ? minutesOf(new Date(e.end)) : minutesOf(new Date())}
					<div
						class="absolute top-3 flex h-10 items-center overflow-hidden rounded-lg bg-line-strong px-2.5 text-[11px] font-semibold text-muted"
						style:left="{pct(s)}%"
						style:width="{pct(en) - pct(s)}%"
						title="{e.jobName}: {formatTime(new Date(e.start))} – {e.end
							? formatTime(new Date(e.end))
							: t('running')}"
					>
						{#if en - s >= 90}<span class="truncate">{e.jobName}</span>{/if}
					</div>
				{/each}
				{#if duration > 0}
					<div
						class="absolute top-3 flex h-10 items-center justify-between rounded-lg border-[1.5px] px-1 transition-[left,width] duration-150 motion-reduce:transition-none {overlaps
							? 'border-red-400 bg-red-400/15'
							: 'border-accent bg-accent/15'}"
						style:left="{pct(startMin)}%"
						style:width="{pct(endMin) - pct(startMin)}%"
						aria-hidden="true"
					>
						<span class="h-4 w-[3px] rounded-full {overlaps ? 'bg-red-400' : 'bg-accent'}"></span>
						<span class="h-4 w-[3px] rounded-full {overlaps ? 'bg-red-400' : 'bg-accent'}"></span>
					</div>
				{/if}
			</div>
			<p class="flex items-center gap-1.5 text-xs text-muted">
				<MoveHorizontal size={13} />
				{t('Click free time to place the block there')}
			</p>
		</section>

		<div class="grid grid-cols-2 gap-2.5">
			<label class="flex min-w-0 flex-col gap-1.5">
				<span class="text-xs text-muted">Job</span>
				<span
					class="flex h-11 items-center gap-2 rounded-[10px] border border-line-strong bg-bg px-3 focus-within:border-accent"
				>
					<span
						class="size-2.5 shrink-0 rounded-[3px]"
						style:background={job?.color ?? 'transparent'}
					></span>
					<select
						name="jobId"
						bind:value={jobId}
						class="w-full min-w-0 bg-transparent text-sm outline-none"
					>
						{#each data.jobs as j (j.id)}<option value={j.id}>{j.name}</option>{/each}
					</select>
				</span>
			</label>
			<label class="flex min-w-0 flex-col gap-1.5">
				<span class="text-xs text-muted">{t('Project')}</span>
				<span
					class="flex h-11 items-center rounded-[10px] border border-line-strong bg-bg px-3 focus-within:border-accent"
				>
					<select
						name="projectId"
						bind:value={projectId}
						disabled={!jobProjects.length}
						class="w-full min-w-0 bg-transparent text-sm outline-none disabled:text-muted"
					>
						<option value="">{jobProjects.length ? t('No project') : '—'}</option>
						{#each jobProjects as p (p.id)}<option value={String(p.id)}>{p.name}</option>{/each}
					</select>
				</span>
			</label>
		</div>

		<div class="flex flex-col gap-2.5">
			<div class="flex items-end gap-2.5">
				<label class="flex min-w-0 flex-1 flex-col gap-1.5">
					<span class="text-xs text-muted">{t('Start')}</span>
					<input
						type="time"
						name="start"
						bind:value={start}
						step="60"
						required
						class="h-11 rounded-[10px] border border-line-strong bg-bg px-3 font-mono text-[15px] [color-scheme:dark] outline-none focus:border-accent"
					/>
				</label>
				<label class="flex min-w-0 flex-1 flex-col gap-1.5">
					<span class="text-xs text-muted">{t('End')}</span>
					<input
						type="time"
						name="end"
						bind:value={end}
						step="60"
						required
						class="h-11 rounded-[10px] border border-line-strong bg-bg px-3 font-mono text-[15px] [color-scheme:dark] outline-none focus:border-accent"
					/>
				</label>
			</div>
			<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('Duration')}>
				{#each QUICK as q (q)}
					<button
						type="button"
						aria-pressed={duration === q}
						onclick={() => (end = toHHMM(Math.min(startMin + q, 23 * 60 + 59)))}
						class="rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors {duration === q
							? 'bg-raised text-fg'
							: 'border border-line text-muted hover:border-muted'}"
					>
						{q < 60 ? `${q}m` : `${Math.floor(q / 60)}h${q % 60 ? ` ${q % 60}m` : ''}`}
					</button>
				{/each}
				{#if overlaps}<span class="ml-auto text-xs text-red-300">{t('Overlaps with an entry')}</span
					>{/if}
			</div>
			{#if duration}
				<div
					class="flex flex-wrap items-center gap-1.5"
					role="group"
					aria-label={t('Round duration')}
				>
					<span class="mr-0.5 text-[11px] text-muted">{t('Round')}</span>
					{#each ROUND as r (r.step)}
						{@const target = rounded(r.step)}
						<button
							type="button"
							aria-pressed={target === duration}
							aria-label={t('Round to {step}: {time}', { step: r.label, time: hm(target) })}
							onclick={() => (end = toHHMM(Math.min(startMin + target, 23 * 60 + 59)))}
							class="flex items-baseline gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors {target ===
							duration
								? 'bg-raised text-fg'
								: 'border border-line text-muted hover:border-muted hover:text-fg'}"
						>
							{r.label}{#if target !== duration}<span class="font-mono">→ {hm(target)}</span>{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<section class="flex flex-col gap-2.5" aria-labelledby="activities-label">
			<div class="flex items-baseline justify-between gap-3">
				<h3 id="activities-label" class="eyebrow text-[10px]">{t('What did you do?')}</h3>
				<span class="text-[11px] text-muted">{t('appears in the timesheet')}</span>
			</div>
			<div
				class="flex flex-col gap-1 rounded-xl border border-line-strong bg-bg p-2 focus-within:border-accent"
			>
				<ul>
					{#each items as item, i (i)}
						<li class="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-surface">
							<span class="font-mono text-sm text-accent" aria-hidden="true">–</span>
							<span class="flex-1 text-sm">{item.text}</span>
							{#if item.todoId}<ListTodo
									size={13}
									class="text-muted"
									aria-label={t('from tasks')}
								/>{/if}
							<button
								type="button"
								class="rounded p-0.5 text-muted hover:text-fg sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
								aria-label={t('Remove “{text}”', { text: item.text })}
								onclick={() => items.splice(i, 1)}
							>
								<X size={14} />
							</button>
						</li>
					{/each}
				</ul>
				<label class="flex items-center gap-2.5 px-2 py-1.5">
					<span class="font-mono text-sm text-accent" aria-hidden="true">–</span>
					<span class="sr-only">{t('Add activity')}</span>
					<input
						type="text"
						bind:value={draft}
						placeholder={items.length
							? t('Another activity … (Enter)')
							: t('e.g. Closed the till (Enter)')}
						class="w-full bg-transparent text-sm outline-none placeholder:text-muted/60"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addDraft();
							}
						}}
					/>
				</label>
			</div>
			{#if suggestions.length}
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="flex items-center gap-1.5 text-xs text-muted"
						><ListTodo size={13} /> {t('From tasks:')}</span
					>
					{#each suggestions as todo (todo.id)}
						<button
							type="button"
							class="flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-1 text-xs hover:border-muted"
							onclick={() => items.push({ text: todo.text, todoId: todo.id })}
						>
							<Plus size={11} />{todo.text}
						</button>
					{/each}
				</div>
			{/if}
		</section>

		<label class="flex flex-col gap-1.5">
			<span class="text-xs text-muted">{t('Note')}</span>
			<input
				type="text"
				name="note"
				bind:value={note}
				placeholder={t('optional')}
				class="h-11 rounded-[10px] border border-line-strong bg-bg px-3 text-sm outline-none placeholder:text-muted/60 focus:border-accent"
			/>
		</label>

		{#if data.templates.length && !editing}
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="flex items-center gap-1.5 text-xs text-muted"
					><History size={13} /> {t('Like last time:')}</span
				>
				{#each data.templates as tpl (`${tpl.jobId}-${tpl.start}-${tpl.end}`)}
					<button
						type="button"
						class="rounded-full border border-line-strong px-2.5 py-1 text-xs hover:border-muted"
						onclick={() => {
							jobId = tpl.jobId;
							start = tpl.start;
							end = tpl.end;
						}}
					>
						{tpl.jobName} · {tpl.start}–{tpl.end}
					</button>
				{/each}
			</div>
		{/if}

		{#if error}<p
				role="alert"
				class="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
			>
				{error}
			</p>{/if}
	</div>

	<footer
		class="flex items-center gap-4 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-4.5"
	>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="font-mono text-[15px] font-medium whitespace-nowrap tabular-nums">
				{formatDuration(
					duration * 60
				)}{#if rateCents}{` · ${formatCents((duration / 60) * rateCents)}`}{/if}
			</span>
			<span class="text-xs text-muted"
				>{t('Day total after: {duration}', {
					duration: formatDuration(dayTotal + duration * 60)
				})}</span
			>
		</div>
		<button
			type="submit"
			disabled={saving || !duration}
			class="flex h-12 shrink-0 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-ink hover:brightness-95 disabled:opacity-50"
		>
			<Check size={16} />
			{#if editing}<span class="sm:hidden">{t('Save')}</span><span class="max-sm:hidden"
					>{t('Save changes')}</span
				>{:else}{t('Save entry')}{/if}
		</button>
	</footer>
</form>
