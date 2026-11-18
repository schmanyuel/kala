import { and, count, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from './index';
import { jobs, projects, settings, timeEntries, todos, wageRates } from './schema';

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
	if (running) throw new Error('Es läuft bereits ein Timer.');
	const [entry] = await db
		.insert(timeEntries)
		.values({ jobId, projectId, startTime: new Date(), note })
		.returning();
	return entry;
}

export async function stopTimer() {
	const running = await getRunningEntry();
	if (!running) throw new Error('Kein Timer läuft.');
	const [entry] = await db
		.update(timeEntries)
		.set({ endTime: new Date(), updatedAt: new Date() })
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
