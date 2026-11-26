<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Check,
		CircleAlert,
		Pencil,
		Plus,
		Sparkles,
		Square,
		Play,
		Trash2,
		X
	} from '@lucide/svelte';
	import { formatCents, formatDuration, formatTime, toDatetimeLocal } from '$lib/format';
	import { editEntryHref, openEntrySheet } from '$lib/entry-sheet';
	import { isoWeek } from '$lib/date';
	import { locale, t } from '$lib/i18n';
	import StopDialog from '$lib/components/StopDialog.svelte';
	import { isRoundingStep } from '$lib/rounding';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let elapsedSeconds = $state(0);
	let activeTab = $state<'todos' | 'entries'>('todos');
	let activityDraft = $state('');
	let editingStart = $state(false);
	let startDraft = $state('');

	function openStartEdit() {
		if (!data.runningEntry) return;
		startDraft = toDatetimeLocal(new Date(data.runningEntry.startTime));
		editingStart = true;
	}
	function shiftStart(minutes: number) {
		const d = new Date(startDraft);
		if (Number.isNaN(d.getTime())) return;
		startDraft = toDatetimeLocal(new Date(Math.min(d.getTime() + minutes * 60_000, Date.now())));
	}
	const startDraftIso = $derived.by(() => {
		const d = new Date(startDraft);
		return Number.isNaN(d.getTime()) ? '' : d.toISOString();
	});
	const monthLabel = (m: string) =>
		new Date(`${m}-01T00:00`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
	let todoDraft = $state('');
	// New todos default to the job the timer is running for.
	const initialTodoJob = () => (data.runningEntry ? String(data.runningEntry.jobId) : '');
	let todoJobId = $state(initialTodoJob());
	let editingTodoId = $state<number | null>(null);
	let stopOpen = $state(false);

	// Hidden until mounted so a dismissed hint never flashes on load.
	const TODO_HINT_KEY = 'kala:todo-hint-dismissed';
	let showTodoHint = $state(false);
	$effect(() => {
		showTodoHint = localStorage.getItem(TODO_HINT_KEY) !== '1';
	});
	const dismissTodoHint = () => {
		localStorage.setItem(TODO_HINT_KEY, '1');
		showTodoHint = false;
	};

	const focusSelect = (node: HTMLInputElement) => {
		node.focus();
		node.select();
	};

	$effect(() => {
		if (!data.runningEntry) return;
		const start = new Date(data.runningEntry.startTime).getTime();
		const tick = () => (elapsedSeconds = (Date.now() - start) / 1000);
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	});

	const now = new Date();

	const pad = (n: number) => n.toString().padStart(2, '0');
	const clock = (s: number) =>
		`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;
	const short = (s: number) => `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}`;

	const weekday = $derived(now.toLocaleDateString(locale(), { weekday: 'long' }));
	const title = $derived(now.toLocaleDateString(locale(), { day: 'numeric', month: 'long' }));
	const monthShort = $derived(now.toLocaleDateString(locale(), { month: 'short' }));

	const earnedCents = $derived((elapsedSeconds / 3600) * data.runningRateCents);
	const maxDaySeconds = $derived(Math.max(3600, ...data.week.map((d) => d.totalSeconds)));
	const weekJobs = $derived([
		...new Map(data.week.flatMap((d) => d.segments).map((s) => [s.name, s.color])).entries()
	]);
	const stats = $derived([
		{
			label: t('Today'),
			value: formatDuration(data.todaySummary.totalSeconds),
			sub: t('{amount} gross', { amount: formatCents(data.todaySummary.totalGrossCents) })
		},
		{
			label: t('This week'),
			value: formatDuration(data.weekSummary.totalSeconds),
			sub: t('of {hours}h target', { hours: data.weeklyTargetHours.toLocaleString(locale()) })
		},
		{
			label: t('Gross {month}', { month: monthShort }),
			value: formatCents(data.monthSummary.totalGrossCents),
			sub: data.minijob
				? t('Minijob limit {percent} %', {
						percent: Math.round((data.minijob.grossCents / data.minijob.limitCents) * 100)
					})
				: t('{duration} worked', { duration: formatDuration(data.monthSummary.totalSeconds) })
		}
	]);

	const todayIndex = (now.getDay() + 6) % 7;

	const openTodoCount = $derived(data.todos.filter((t) => !t.doneAt).length);
	// Todos grouped by job (in job order), todos without a job last.
	const todoGroups = $derived(
		[
			...data.jobs.map((j) => ({
				key: `job-${j.id}`,
				name: j.name,
				color: j.color,
				todos: data.todos.filter((t) => t.jobId === j.id)
			})),
			{
				key: 'none',
				name: t('No job'),
				color: 'var(--color-muted)',
				todos: data.todos.filter(
					(t) => t.jobId === null || !data.jobs.some((j) => j.id === t.jobId)
				)
			}
		].filter((g) => g.todos.length)
	);

	const entrySeconds = (e: PageData['todayEntries'][number]) =>
		((e.endTime ? new Date(e.endTime).getTime() : Date.now()) - new Date(e.startTime).getTime()) /
		1000;
</script>

<svelte:head><title>kala · {t('Dashboard')}</title></svelte:head>

<div class="flex flex-col gap-7">
	<header id="topbar" class="reveal flex flex-wrap items-center justify-between gap-4 [--i:0]">
		<div class="flex flex-col gap-1">
			<p class="eyebrow">{weekday} · {t('Wk')} {isoWeek(now)}</p>
			<h1 class="text-[28px] font-semibold tracking-tight">{title}</h1>
		</div>
		<a
			href="/entry"
			class="flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-[13px] font-semibold text-ink transition hover:brightness-95"
			onclick={(e) => {
				if (e.metaKey || e.ctrlKey || e.shiftKey) return;
				e.preventDefault();
				openEntrySheet();
			}}
		>
			<Plus size={15} />
			{t('Add entry')}
		</a>
	</header>

	{#if data.unbilled.length}
		<a
			href="/export#billing"
			class="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/[0.06] px-4 py-3 text-sm hover:border-accent"
		>
			<CircleAlert size={16} class="shrink-0 text-accent" aria-hidden="true" />
			<span class="flex-1">
				{t('Still to bill: {months}', { months: data.unbilled.map(monthLabel).join(', ') })}
			</span>
			<span class="text-xs text-muted">{t('Export')} →</span>
		</a>
	{/if}

	{#if form?.error}
		<p
			role="alert"
			class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
		>
			{form.error}
		</p>
	{/if}

	<section
		id="timer-hero"
		class="reveal rounded-[20px] bg-accent px-6 py-7 text-ink [--i:1] sm:px-10 sm:py-9"
	>
		{#if data.runningEntry}
			<div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
				<div class="flex min-w-0 flex-col gap-3.5">
					<p
						class="flex items-center gap-2 font-mono text-xs font-medium tracking-[0.1em] uppercase"
					>
						<span class="size-2.5 animate-pulse rounded-full bg-ink" aria-hidden="true"></span>
						<button
							type="button"
							class="inline-flex items-center gap-1.5 rounded underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
							aria-expanded={editingStart}
							onclick={() => (editingStart ? (editingStart = false) : openStartEdit())}
							title={t('Change start time')}
						>
							{t('Running since {time}', {
								time: formatTime(new Date(data.runningEntry.startTime))
							})}
							<Pencil size={11} aria-hidden="true" />
						</button>
						· {data.runningEntry.job.name}
					</p>
					{#if editingStart}
						<form
							method="POST"
							action="?/updateStart"
							use:enhance={() =>
								async ({ result, update }) => {
									await update();
									if (result.type === 'success') editingStart = false;
								}}
							class="flex flex-wrap items-center gap-1.5"
						>
							<input type="hidden" name="startTime" value={startDraftIso} />
							<button
								type="button"
								class="rounded-full border border-ink/25 px-2.5 py-1.5 font-mono text-xs hover:bg-ink/10"
								onclick={() => shiftStart(-15)}>−15</button
							>
							<input
								type="datetime-local"
								bind:value={startDraft}
								max={toDatetimeLocal(new Date())}
								aria-label={t('Start time')}
								class="rounded-lg border border-ink/25 bg-transparent px-2.5 py-1 font-mono text-sm outline-none focus:border-ink"
							/>
							<button
								type="button"
								class="rounded-full border border-ink/25 px-2.5 py-1.5 font-mono text-xs hover:bg-ink/10"
								onclick={() => shiftStart(15)}>+15</button
							>
							<button
								class="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-accent disabled:opacity-40"
								disabled={!startDraftIso}>{t('Save')}</button
							>
							<button
								type="button"
								class="rounded-full p-1.5 hover:bg-ink/10"
								aria-label={t('Cancel')}
								onclick={() => (editingStart = false)}><X size={14} /></button
							>
						</form>
					{/if}
					<p
						class="font-mono text-6xl leading-none font-medium tracking-[-0.06em] tabular-nums sm:text-8xl xl:text-[112px]"
						aria-live="off"
					>
						{clock(elapsedSeconds)}
					</p>
					{#if data.runningEntry.note}<p class="text-base text-ink/70">
							{data.runningEntry.note}
						</p>{/if}
					<div class="flex flex-wrap items-center gap-1.5 pt-1" aria-label={t('Activity report')}>
						<span class="mr-1 font-mono text-[10px] tracking-[0.14em] text-ink/60 uppercase"
							>{t('Report')}</span
						>
						{#each data.runningEntry.activities as activity, i (i)}
							<form method="POST" action="?/removeActivity" use:enhance class="group">
								<input type="hidden" name="entryId" value={data.runningEntry.id} />
								<input type="hidden" name="index" value={i} />
								<button
									type="submit"
									class="flex items-center gap-1.5 rounded-full bg-ink/8 px-2.5 py-1 text-xs font-medium hover:bg-ink/15"
									aria-label={t('Remove “{text}” from the report', { text: activity })}
								>
									<Check size={12} class="group-hover:hidden" /><X
										size={12}
										class="hidden group-hover:block"
									/>{activity}
								</button>
							</form>
						{/each}
						<form
							method="POST"
							action="?/addActivity"
							use:enhance={() =>
								async ({ update }) => {
									await update();
									activityDraft = '';
								}}
							class="flex items-center gap-1 rounded-full border border-ink/25 py-0.5 pr-1 pl-2.5 focus-within:border-ink"
						>
							<input type="hidden" name="entryId" value={data.runningEntry.id} />
							<Plus size={12} aria-hidden="true" />
							<input
								type="text"
								name="text"
								required
								bind:value={activityDraft}
								aria-label={t('Add activity to the report')}
								placeholder={t('Activity')}
								class="w-24 bg-transparent py-0.5 text-xs font-medium outline-none placeholder:text-ink/50 focus:w-48"
							/>
						</form>
					</div>
				</div>
				<div class="flex items-end justify-between gap-6 md:flex-col md:items-end md:gap-4">
					{#if data.runningRateCents > 0}
						<div class="flex flex-col md:items-end">
							<span class="font-mono text-[11px] tracking-[0.14em] text-ink/60 uppercase"
								>{t('So far')}</span
							>
							<span class="font-mono text-[28px] font-semibold tabular-nums"
								>{formatCents(earnedCents)}</span
							>
						</div>
					{/if}
					<!-- Without JS this stops exactly; with JS the button opens the rounding dialog. -->
					<form method="POST" action="?/stopTimer" use:enhance>
						<button
							type="submit"
							onclick={(e) => {
								e.preventDefault();
								stopOpen = true;
							}}
							class="flex items-center gap-2.5 rounded-full bg-ink px-7 py-4 text-base font-semibold text-fg hover:bg-raised"
						>
							<Square size={14} class="fill-accent text-accent" />
							{t('Stop')}
						</button>
					</form>
				</div>
			</div>
		{:else if data.jobs.length === 0}
			<div class="flex flex-col gap-3">
				<p class="font-mono text-xs font-medium tracking-[0.1em] uppercase">
					{t('Nothing to track yet')}
				</p>
				<p class="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
					{t('Create a job first, then you can track time.')}
				</p>
				<a
					href="/jobs"
					class="mt-2 flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-fg hover:bg-raised"
				>
					<Plus size={15} class="text-accent" />
					{t('Create job')}
				</a>
			</div>
		{:else}
			<form
				method="POST"
				action="?/startTimer"
				use:enhance
				class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
			>
				<div class="flex min-w-0 flex-col gap-3.5">
					<p class="font-mono text-xs font-medium tracking-[0.1em] uppercase">{t('Ready')}</p>
					<p
						class="font-mono text-6xl leading-none font-medium tracking-[-0.06em] text-ink/30 tabular-nums sm:text-8xl xl:text-[112px]"
					>
						00:00:00
					</p>
				</div>
				<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
					<label class="flex flex-col gap-1.5">
						<span class="font-mono text-[11px] tracking-[0.14em] text-ink/60 uppercase">Job</span>
						<select
							name="jobId"
							required
							class="rounded-lg border border-ink/20 bg-ink/5 px-3 py-2.5 text-sm text-ink focus:border-ink focus:outline-none"
						>
							{#each data.jobs as job (job.id)}<option value={job.id}>{job.name}</option>{/each}
						</select>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class="font-mono text-[11px] tracking-[0.14em] text-ink/60 uppercase"
							>{t('Note')}</span
						>
						<input
							type="text"
							name="note"
							placeholder={t('optional')}
							class="rounded-lg border border-ink/20 bg-ink/5 px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
						/>
					</label>
					<button
						type="submit"
						class="flex items-center justify-center gap-2.5 rounded-full bg-ink px-7 py-3.5 text-base font-semibold text-fg hover:bg-raised"
					>
						<Play size={14} class="fill-accent text-accent" />
						{t('Start')}
					</button>
				</div>
			</form>
		{/if}
	</section>

	<div class="grid grid-cols-[minmax(0,1fr)] gap-7 xl:grid-cols-[minmax(0,1fr)_420px]">
		<div class="flex min-w-0 flex-col gap-7">
			<section
				id="stats"
				aria-label={t('Key figures')}
				class="reveal grid border-y border-line [--i:2] sm:grid-cols-3"
			>
				{#each stats as stat, i (stat.label)}
					<div
						class="flex flex-col gap-1.5 py-5 {i
							? 'border-line max-sm:border-t sm:border-l sm:pl-6'
							: ''}"
					>
						<span class="eyebrow">{stat.label}</span>
						<span class="font-mono text-[30px] font-medium tracking-tight tabular-nums"
							>{stat.value}</span
						>
						<span class="text-[13px] text-muted">{stat.sub}</span>
					</div>
				{/each}
			</section>

			<section id="week" class="reveal flex flex-col gap-4 [--i:3]">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h2 class="text-[17px] font-semibold">{t('This week')}</h2>
					<ul class="flex flex-wrap gap-4">
						{#each weekJobs as [name, color] (name)}
							<li class="flex items-center gap-1.5 text-xs text-muted">
								<span class="size-2 rounded-full" style:background={color}></span>{name}
							</li>
						{/each}
					</ul>
				</div>
				<div class="grid h-60 grid-cols-7 gap-2 sm:gap-3.5">
					{#each data.week as day, i (i)}
						<div class="flex h-full flex-col items-center gap-2">
							<div class="flex w-full flex-1 flex-col items-center justify-end gap-[3px]">
								<span
									class="mb-1 font-mono text-[11px] {day.totalSeconds ? 'text-fg' : 'text-muted'}"
								>
									{day.totalSeconds ? short(day.totalSeconds) : '–'}
								</span>
								{#each day.segments as seg (seg.name)}
									<div
										class="w-full rounded-md"
										style:background={seg.color}
										style:height="{(seg.seconds / maxDaySeconds) * 82}%"
										title="{seg.name}: {formatDuration(seg.seconds)}"
									></div>
								{:else}
									<div class="h-1.5 w-full rounded-md bg-line"></div>
								{/each}
							</div>
							<span
								class="font-mono text-[11px] tracking-wider {i === todayIndex
									? 'text-accent'
									: 'text-muted'}"
							>
								{new Date(day.day)
									.toLocaleDateString(locale(), { weekday: 'short' })
									.slice(0, 2)
									.toUpperCase()}
							</span>
						</div>
					{/each}
				</div>
			</section>
		</div>

		<section id="side-panel" class="reveal flex flex-col rounded-2xl bg-surface p-5 [--i:4] sm:p-6">
			<div class="flex gap-1 pb-4" role="tablist" aria-label={t('Tasks and entries')}>
				{#each [{ key: 'todos', label: t('Tasks'), count: openTodoCount }, { key: 'entries', label: t('Entries today'), count: data.todayEntries.length }] as const as tab (tab.key)}
					{@const active = activeTab === tab.key}
					<button
						type="button"
						role="tab"
						id="tab-{tab.key}"
						aria-selected={active}
						aria-controls="panel-{tab.key}"
						class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors {active
							? 'bg-raised font-semibold'
							: 'font-medium text-muted hover:text-fg'}"
						onclick={() => (activeTab = tab.key)}
					>
						{tab.label}
						<span class="font-mono text-[11px] {active ? 'text-accent' : 'text-muted'}"
							>{tab.count}</span
						>
					</button>
				{/each}
			</div>

			{#if activeTab === 'todos'}
				<div
					id="panel-todos"
					role="tabpanel"
					aria-labelledby="tab-todos"
					class="flex flex-1 flex-col"
				>
					<form
						method="POST"
						action="?/createTodo"
						use:enhance={() =>
							async ({ update }) => {
								await update({ reset: false });
								todoDraft = '';
							}}
						class="flex h-11 items-center gap-2.5 rounded-xl border border-line-strong bg-bg pr-1.5 pl-3.5 focus-within:border-accent"
					>
						<Plus size={15} class="shrink-0 text-accent" aria-hidden="true" />
						<input
							type="text"
							name="text"
							required
							bind:value={todoDraft}
							aria-label={t('New task')}
							placeholder={t('New task …')}
							class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
						/>
						<label
							class="flex shrink-0 items-center gap-1.5 rounded-full bg-raised py-1 pr-1.5 pl-2.5"
						>
							<span
								class="size-1.75 rounded-xs"
								style:background={data.jobs.find((j) => String(j.id) === todoJobId)?.color ??
									'var(--color-muted)'}
								aria-hidden="true"
							></span>
							<span class="sr-only">{t('Job of the task')}</span>
							<select
								name="jobId"
								bind:value={todoJobId}
								class="max-w-24 bg-transparent text-[11px] outline-none"
							>
								<option value="">{t('No job')}</option>
								{#each data.jobs as job (job.id)}<option value={String(job.id)}>{job.name}</option
									>{/each}
							</select>
						</label>
					</form>

					{#each todoGroups as group (group.key)}
						<div class="flex flex-col pt-4.5">
							<h3 class="flex items-center gap-2 pb-1.5">
								<span class="size-1.75 rounded-xs" style:background={group.color} aria-hidden="true"
								></span>
								<span class="eyebrow text-[10px]">{group.name}</span>
							</h3>
							<ul>
								{#each group.todos as todo, ti (todo.id)}
									{@const done = !!todo.doneAt}
									<li
										style:--i={Math.min(ti, 6)}
										class="reveal-item group flex items-center gap-3 border-t border-line py-2.5 has-[form[action$=updateTodo]]:items-start"
									>
										<form method="POST" action="?/toggleTodo" use:enhance>
											<input type="hidden" name="id" value={todo.id} />
											<input type="hidden" name="done" value={done ? '0' : '1'} />
											<button
												type="submit"
												role="checkbox"
												aria-checked={done}
												aria-label={done
													? t('Reopen “{text}”', { text: todo.text })
													: t('Complete “{text}”', { text: todo.text })}
												class="grid size-4.5 place-items-center rounded-[5px] transition-colors {done
													? 'bg-accent text-ink'
													: 'border-[1.5px] border-line-strong hover:border-accent'}"
											>
												{#if done}<Check size={12} strokeWidth={3} />{/if}
											</button>
										</form>
										{#if editingTodoId === todo.id}
											<form
												method="POST"
												action="?/updateTodo"
												use:enhance={() =>
													async ({ update, result }) => {
														await update({ reset: false });
														if (result.type === 'success') editingTodoId = null;
													}}
												class="flex min-w-0 flex-1 flex-col gap-2"
											>
												<input type="hidden" name="id" value={todo.id} />
												<input
													type="text"
													name="text"
													required
													value={todo.text}
													use:focusSelect
													onkeydown={(e) => {
														if (e.key === 'Escape') {
															e.preventDefault();
															editingTodoId = null;
														}
													}}
													aria-label={t('Edit task')}
													class="w-full min-w-0 rounded-lg border border-accent bg-bg px-2.5 py-1.5 text-sm outline-none"
												/>
												<div class="flex flex-wrap items-center gap-2">
													<label
														class="flex items-center gap-1.5 rounded-full bg-raised py-1 pr-1.5 pl-2.5"
													>
														<span class="sr-only">{t('Job of the task')}</span>
														<select
															name="jobId"
															value={todo.jobId === null ? '' : String(todo.jobId)}
															class="max-w-32 bg-transparent text-[11px] outline-none"
														>
															<option value="">{t('No job')}</option>
															{#each data.jobs as job (job.id)}<option value={String(job.id)}
																	>{job.name}</option
																>{/each}
														</select>
													</label>
													<span class="ml-auto flex items-center gap-1">
														<button
															type="button"
															onclick={() => (editingTodoId = null)}
															class="rounded-full px-3 py-1 text-xs text-muted hover:text-fg"
															>{t('Cancel')}</button
														>
														<button
															type="submit"
															class="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink hover:brightness-95"
															>{t('Save')}</button
														></span
													>
												</div>
											</form>
										{:else}
											<div class="flex min-w-0 flex-1 flex-col gap-0.5">
												<button
													type="button"
													ondblclick={() => (editingTodoId = todo.id)}
													onclick={(e) => {
														if (e.detail === 0) editingTodoId = todo.id;
													}}
													title={t('Double-click to edit')}
													class="cursor-text text-left text-sm break-words {done
														? 'text-muted line-through'
														: ''}">{todo.text}</button
												>
												{#if done}
													<span class="text-xs {todo.entry ? 'text-accent' : 'text-muted'}">
														{todo.entry
															? todo.entry.id === data.runningEntry?.id
																? t('→ in the running entry')
																: t('→ in the entry of {date}', {
																		date: new Date(todo.entry.startTime).toLocaleDateString(
																			locale(),
																			{
																				day: '2-digit',
																				month: '2-digit'
																			}
																		)
																	})
															: t('done')}
													</span>
												{/if}
											</div>
											<div
												class="flex items-center sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100"
											>
												<button
													type="button"
													onclick={() => (editingTodoId = todo.id)}
													aria-label={t('Edit “{text}”', { text: todo.text })}
													class="rounded-md p-1 text-muted hover:bg-raised hover:text-fg"
												>
													<Pencil size={14} />
												</button>
												<form method="POST" action="?/deleteTodo" use:enhance>
													<input type="hidden" name="id" value={todo.id} />
													<button
														type="submit"
														aria-label={t('Delete “{text}”', { text: todo.text })}
														class="rounded-md p-1 text-muted hover:bg-raised hover:text-red-400"
													>
														<Trash2 size={14} />
													</button>
												</form>
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{:else}
						<p class="py-10 text-center text-sm text-muted">{t('No open tasks.')}</p>
					{/each}

					{#if showTodoHint}
						<div
							class="mt-auto flex items-start gap-2.5 rounded-xl bg-bg p-3.5 text-xs leading-relaxed text-muted max-xl:mt-5"
						>
							<Sparkles size={15} class="mt-px shrink-0 text-accent" aria-hidden="true" />
							<p class="flex-1">
								{t(
									'Completed tasks are added to the activity report of the running entry automatically – or you can pick them when adding an entry.'
								)}
							</p>
							<button
								type="button"
								onclick={dismissTodoHint}
								class="-m-1 shrink-0 rounded-md p-1 hover:bg-ink/8 hover:text-ink"
								aria-label={t('Dismiss hint')}
							>
								<X size={14} aria-hidden="true" />
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<div id="panel-entries" role="tabpanel" aria-labelledby="tab-entries">
					<ul>
						{#each data.todayEntries as entry (entry.id)}
							{@const running = !entry.endTime}
							<li class="group flex items-center gap-2 border-t border-line py-2.5">
								{#snippet entryBody()}
									<span class="h-9.5 w-[3px] shrink-0 rounded-sm" style:background={entry.job.color}
									></span>
									<span class="flex min-w-0 flex-1 flex-col gap-0.5">
										<span class="truncate text-sm font-semibold">{entry.job.name}</span>
										<span class="truncate text-[13px] text-muted">
											{entry.note ??
												(entry.activities.length
													? entry.activities.join(' · ')
													: (entry.project?.name ?? '—'))}
										</span>
									</span>
									<span class="flex flex-col items-end gap-0.5">
										<span
											class="font-mono text-[15px] font-medium tabular-nums {running
												? 'text-accent'
												: ''}"
										>
											{short(running ? elapsedSeconds : entrySeconds(entry))}
										</span>
										<span class="font-mono text-[11px] text-muted">
											{formatTime(new Date(entry.startTime))} – {entry.endTime
												? formatTime(new Date(entry.endTime))
												: t('now')}
										</span>
									</span>
								{/snippet}
								{#if running}
									<div class="flex min-w-0 flex-1 items-center gap-3.5">{@render entryBody()}</div>
								{:else}
									<a
										href={editEntryHref(entry.id)}
										aria-label={t('Edit entry {job}', { job: entry.job.name })}
										class="-mx-2 flex min-w-0 flex-1 items-center gap-3.5 rounded-lg px-2 py-1 transition-colors hover:bg-raised"
										onclick={(e) => {
											if (e.metaKey || e.ctrlKey || e.shiftKey) return;
											e.preventDefault();
											openEntrySheet(undefined, entry.id);
										}}
									>
										{@render entryBody()}
									</a>
								{/if}
								<form
									method="POST"
									action="?/deleteEntry"
									use:enhance
									class="sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100"
								>
									<input type="hidden" name="id" value={entry.id} />
									<button
										type="submit"
										aria-label={t('Delete entry')}
										class="rounded-md p-1.5 text-muted hover:bg-raised hover:text-red-400"
									>
										<Trash2 size={15} />
									</button>
								</form>
							</li>
						{:else}
							<li class="border-t border-line py-10 text-center text-sm text-muted">
								{t('No entries today yet.')}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	</div>
</div>

{#if stopOpen && data.runningEntry}
	<StopDialog
		startTime={new Date(data.runningEntry.startTime)}
		jobName={data.runningEntry.job.name}
		{elapsedSeconds}
		rateCents={data.runningRateCents}
		defaultStep={isRoundingStep(data.stopRoundingMinutes) ? data.stopRoundingMinutes : 0}
		onClose={() => (stopOpen = false)}
	/>
{/if}
