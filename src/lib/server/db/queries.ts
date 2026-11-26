import { and, count, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from './index';
import { billedMonths, jobs, projects, settings, timeEntries, todos, wageRates } from './schema';
import { roundDuration, type RoundingDirection } from '$lib/rounding';
import { isLang, type Lang } from '$lib/i18n';

export async function listJobs() {
	return db.query.jobs.findMany({
		where: eq(jobs.archived, false),
		orderBy: [jobs.name]
	});
}

export async function listArchivedJobs() {
	return db.query.jobs.findMany({
		where: eq(jobs.archived, true),
		orderBy: [jobs.name]
	});
}

export async function listProjects(jobId?: number) {
	return db.query.projects.findMany({
		where: jobId
			? and(eq(projects.archived, false), eq(projects.jobId, jobId))
			: eq(projects.archived, false),
		orderBy: [projects.name]
	});
}

// A job's first wage rate applies retroactively (from the epoch), so manual entries
// backdated before the job's creation timestamp still get a rate. Later rate changes
// (addWageRate) apply from their own validFrom onward and supersede it.
const RETROACTIVE_DATE = new Date(0);

export async function createJob(data: {
	name: string;
	color: string;
	hourlyRateCents: number;
	isMinijob: boolean;
}) {
	return db.transaction(async (tx) => {
		const [job] = await tx
			.insert(jobs)
			.values({ name: data.name, color: data.color, isMinijob: data.isMinijob })
			.returning();
		await tx.insert(wageRates).values({
			jobId: job.id,
			hourlyRateCents: data.hourlyRateCents,
			validFrom: RETROACTIVE_DATE
		});
		return job;
	});
}

export async function archiveJob(jobId: number) {
	await db.update(jobs).set({ archived: true }).where(eq(jobs.id, jobId));
}

export async function unarchiveJob(jobId: number) {
	await db.update(jobs).set({ archived: false }).where(eq(jobs.id, jobId));
}

export async function createProject(jobId: number, name: string) {
	const [project] = await db.insert(projects).values({ jobId, name }).returning();
	return project;
}

export async function addWageRate(
	jobId: number,
	hourlyRateCents: number,
	validFrom: Date = new Date()
) {
	const [rate] = await db
		.insert(wageRates)
		.values({ jobId, hourlyRateCents, validFrom })
		.returning();
	return rate;
}

export async function getCurrentWageRateCents(jobId: number, at: Date = new Date()) {
	const [rate] = await db
		.select({ hourlyRateCents: wageRates.hourlyRateCents })
		.from(wageRates)
		.where(and(eq(wageRates.jobId, jobId), lte(wageRates.validFrom, at)))
		.orderBy(desc(wageRates.validFrom))
		.limit(1);
	return rate?.hourlyRateCents ?? null;
}

export async function listWageRates(jobId: number) {
	return db.query.wageRates.findMany({
		where: eq(wageRates.jobId, jobId),
		orderBy: [desc(wageRates.validFrom)]
	});
}

export async function getRunningEntry() {
	return db.query.timeEntries.findFirst({
		where: isNull(timeEntries.endTime),
		with: { job: true, project: true }
	});
}

export async function startTimer(jobId: number, projectId: number | null, note: string | null) {
	const running = await getRunningEntry();
	if (running) throw new Error('A timer is already running.');
	const [entry] = await db
		.insert(timeEntries)
		.values({ jobId, projectId, startTime: new Date(), note })
		.returning();
	return entry;
}

/** Moves the start of the running timer. The new start must lie in the past. */
export async function updateRunningStart(startTime: Date) {
	const running = await getRunningEntry();
	if (!running) throw new Error('No timer is running.');
	if (Number.isNaN(startTime.getTime()) || startTime.getTime() > Date.now())
		throw new Error('The start time must lie in the past.');
	await db
		.update(timeEntries)
		.set({ startTime, updatedAt: new Date() })
		.where(eq(timeEntries.id, running.id));
}

/** Past months (YYYY-MM, server-local time) that have entries but are not billed yet. */
export async function listUnbilledMonths(now = new Date()) {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const month = sql<string>`to_char(${timeEntries.startTime} at time zone ${tz}, 'YYYY-MM')`;
	const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	const rows = await db
		.selectDistinct({ month })
		.from(timeEntries)
		.where(
			sql`${month} < ${current} and ${month} not in (select ${billedMonths.month} from ${billedMonths})`
		);
	return rows.map((r) => r.month).sort();
}

export async function listBilledMonths(limit = 6) {
	return db.select().from(billedMonths).orderBy(desc(billedMonths.month)).limit(limit);
}

export async function setMonthBilled(month: string, billed: boolean) {
	if (billed) await db.insert(billedMonths).values({ month }).onConflictDoNothing();
	else await db.delete(billedMonths).where(eq(billedMonths.month, month));
}

/** Stops the running timer. With a rounding step the booked duration is rounded and the
 *  end time set to start + rounded duration (rounding up may put the end slightly ahead). */
export async function stopTimer(
	rounding: { step: number; direction: RoundingDirection } = { step: 0, direction: 'down' }
) {
	const running = await getRunningEntry();
	if (!running) throw new Error('No timer is running.');
	const now = new Date();
	const start = new Date(running.startTime).getTime();
	const seconds = Math.max(0, (now.getTime() - start) / 1000);
	// Computed in SQL: start_time has microsecond precision, a JS Date would truncate it
	// and leave the booked duration a hair under the rounded value (e.g. 2:44:59.999).
	const endTime = rounding.step
		? sql`${timeEntries.startTime} + make_interval(secs => ${roundDuration(seconds, rounding.step, rounding.direction)})`
		: now;
	const [entry] = await db
		.update(timeEntries)
		.set({ endTime, updatedAt: now })
		.where(eq(timeEntries.id, running.id))
		.returning();
	return entry;
}

export async function createManualEntry(data: {
	jobId: number;
	projectId: number | null;
	startTime: Date;
	endTime: Date;
	note: string | null;
	activities?: string[];
	/** Todos whose text is part of `activities`; they get checked off and linked to the entry. */
	todoIds?: number[];
}) {
	const { todoIds = [], ...values } = data;
	return db.transaction(async (tx) => {
		const [entry] = await tx.insert(timeEntries).values(values).returning();
		if (todoIds.length) {
			await tx
				.update(todos)
				.set({ doneAt: new Date(), entryId: entry.id })
				.where(and(inArray(todos.id, todoIds), isNull(todos.doneAt)));
		}
		return entry;
	});
}

/** A finished entry plus the todos checked off into it, for the edit form. */
export async function getEntryForEdit(id: number) {
	const entry = await db.query.timeEntries.findFirst({ where: eq(timeEntries.id, id) });
	if (!entry || !entry.endTime) return null;
	const linked = await db.query.todos.findMany({ where: eq(todos.entryId, id) });
	return { ...entry, endTime: entry.endTime, linkedTodos: linked };
}

/** Updates a finished entry. Todos linked to it whose activity was removed go back to
 *  open; newly picked todos (`todoIds`) get checked off and linked. */
export async function updateEntry(
	id: number,
	data: {
		jobId: number;
		projectId: number | null;
		startTime: Date;
		endTime: Date;
		note: string | null;
		activities: string[];
		todoIds?: number[];
	}
) {
	const { todoIds = [], ...values } = data;
	await db.transaction(async (tx) => {
		const linked = await tx.query.todos.findMany({ where: eq(todos.entryId, id) });
		const reopen = linked.filter((t) => !values.activities.includes(t.text)).map((t) => t.id);
		if (reopen.length) {
			await tx.update(todos).set({ doneAt: null, entryId: null }).where(inArray(todos.id, reopen));
		}
		if (todoIds.length) {
			await tx
				.update(todos)
				.set({ doneAt: new Date(), entryId: id })
				.where(and(inArray(todos.id, todoIds), isNull(todos.doneAt)));
		}
		await tx
			.update(timeEntries)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(timeEntries.id, id));
	});
}

export async function addActivity(entryId: number, text: string) {
	await db
		.update(timeEntries)
		.set({
			activities: sql`array_append(${timeEntries.activities}, ${text})`,
			updatedAt: new Date()
		})
		.where(eq(timeEntries.id, entryId));
}

export async function removeActivity(entryId: number, index: number) {
	const entry = await db.query.timeEntries.findFirst({ where: eq(timeEntries.id, entryId) });
	if (!entry) return;
	const text = entry.activities[index];
	await db
		.update(timeEntries)
		.set({ activities: entry.activities.filter((_, i) => i !== index), updatedAt: new Date() })
		.where(eq(timeEntries.id, entryId));
	// A todo checked off into this entry goes back to open when its activity is removed.
	if (text !== undefined) {
		await db
			.update(todos)
			.set({ doneAt: null, entryId: null })
			.where(and(eq(todos.entryId, entryId), eq(todos.text, text)));
	}
}

/** Most recent finished entries, newest first, for "same as last time" shortcuts. */
export async function listRecentEntries(limit = 30) {
	return db.query.timeEntries.findMany({
		where: sql`${timeEntries.endTime} is not null`,
		with: { job: true },
		orderBy: [desc(timeEntries.startTime)],
		limit
	});
}

/** Open todos plus the ones checked off since `doneSince`, oldest first. */
export async function listTodos(doneSince: Date) {
	return db.query.todos.findMany({
		where: or(isNull(todos.doneAt), gte(todos.doneAt, doneSince)),
		with: { job: true, entry: true },
		orderBy: [todos.createdAt, todos.id]
	});
}

export async function listOpenTodos() {
	return db.query.todos.findMany({
		where: isNull(todos.doneAt),
		with: { job: true },
		orderBy: [todos.createdAt, todos.id]
	});
}

export async function createTodo(text: string, jobId: number | null) {
	await db.insert(todos).values({ text, jobId });
}

/** Renames a todo / moves it to another job. A todo already checked off into an entry
 *  gets its activity text in that entry renamed along with it. */
export async function updateTodo(id: number, text: string, jobId: number | null) {
	await db.transaction(async (tx) => {
		const todo = await tx.query.todos.findFirst({ where: eq(todos.id, id) });
		if (!todo) return;
		if (todo.entryId && todo.text !== text) {
			await tx
				.update(timeEntries)
				.set({
					activities: sql`array_replace(${timeEntries.activities}, ${todo.text}, ${text})`,
					updatedAt: new Date()
				})
				.where(eq(timeEntries.id, todo.entryId));
		}
		await tx.update(todos).set({ text, jobId }).where(eq(todos.id, id));
	});
}

export async function deleteTodo(id: number) {
	await db.delete(todos).where(eq(todos.id, id));
}

/** Checking a todo off appends it to the running entry's activities (if the timer runs for
 *  the same job, or the todo has no job). Unchecking takes it out again. */
export async function setTodoDone(id: number, done: boolean) {
	await db.transaction(async (tx) => {
		const todo = await tx.query.todos.findFirst({ where: eq(todos.id, id) });
		if (!todo) return;
		if (done && !todo.doneAt) {
			const running = await tx.query.timeEntries.findFirst({ where: isNull(timeEntries.endTime) });
			const attach =
				running && (todo.jobId === null || todo.jobId === running.jobId) ? running : null;
			if (attach) {
				await tx
					.update(timeEntries)
					.set({
						activities: sql`array_append(${timeEntries.activities}, ${todo.text})`,
						updatedAt: new Date()
					})
					.where(eq(timeEntries.id, attach.id));
			}
			await tx
				.update(todos)
				.set({ doneAt: new Date(), entryId: attach?.id ?? null })
				.where(eq(todos.id, id));
		} else if (!done && todo.doneAt) {
			if (todo.entryId) {
				await tx
					.update(timeEntries)
					.set({
						activities: sql`array_remove(${timeEntries.activities}, ${todo.text})`,
						updatedAt: new Date()
					})
					.where(eq(timeEntries.id, todo.entryId));
			}
			await tx.update(todos).set({ doneAt: null, entryId: null }).where(eq(todos.id, id));
		}
	});
}

export async function deleteEntry(id: number) {
	await db.delete(timeEntries).where(eq(timeEntries.id, id));
}

export async function listEntriesBetween(start: Date, end: Date, jobIds?: number[]) {
	return db.query.timeEntries.findMany({
		where: and(
			gte(timeEntries.startTime, start),
			lte(timeEntries.startTime, end),
			jobIds ? inArray(timeEntries.jobId, jobIds) : undefined
		),
		with: { job: true, project: true },
		orderBy: [desc(timeEntries.startTime)]
	});
}

/** Sums duration (in seconds) and gross pay (in cents) for a set of entries, using the
 *  wage rate that was active at each entry's start time. Running entries (endTime null)
 *  count up to `now`. */
export async function summarizeEntries(
	entries: (typeof timeEntries.$inferSelect)[],
	now: Date = new Date()
) {
	let totalSeconds = 0;
	let totalGrossCents = 0;
	const rateCache = new Map<string, number>();

	for (const entry of entries) {
		const end = entry.endTime ?? now;
		const seconds = Math.max(0, (end.getTime() - entry.startTime.getTime()) / 1000);
		totalSeconds += seconds;

		const cacheKey = `${entry.jobId}:${entry.startTime.toISOString()}`;
		let rateCents = rateCache.get(cacheKey);
		if (rateCents === undefined) {
			rateCents = (await getCurrentWageRateCents(entry.jobId, entry.startTime)) ?? 0;
			rateCache.set(cacheKey, rateCents);
		}
		totalGrossCents += (seconds / 3600) * rateCents;
	}

	return { totalSeconds, totalGrossCents: Math.round(totalGrossCents) };
}

export async function countEntries() {
	const [row] = await db.select({ value: count() }).from(timeEntries);
	return row.value;
}

export async function getSettings() {
	const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
	if (row) return row;
	const [created] = await db.insert(settings).values({ id: 1 }).returning();
	return created;
}

export async function updateWeeklyTargetHours(hours: number) {
	await db
		.insert(settings)
		.values({ id: 1, weeklyTargetHours: hours.toFixed(2) })
		.onConflictDoUpdate({
			target: settings.id,
			set: { weeklyTargetHours: hours.toFixed(2), updatedAt: new Date() }
		});
}

export async function updateStopRounding(minutes: number) {
	await db
		.insert(settings)
		.values({ id: 1, stopRoundingMinutes: minutes })
		.onConflictDoUpdate({
			target: settings.id,
			set: { stopRoundingMinutes: minutes, updatedAt: new Date() }
		});
}

export async function updateLanguage(language: Lang) {
	await db
		.insert(settings)
		.values({ id: 1, language })
		.onConflictDoUpdate({ target: settings.id, set: { language, updatedAt: new Date() } });
}

/** The UI/export language, for server code that has no layout data (actions, endpoints). */
export async function getLang(): Promise<Lang> {
	const { language } = await getSettings();
	return isLang(language) ? language : 'en';
}
