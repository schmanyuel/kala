import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { db } from './index';
import { jobs, projects, timeEntries, wageRates } from './schema';

export async function listJobs() {
	return db.query.jobs.findMany({
		where: eq(jobs.archived, false),
		orderBy: [jobs.name]
	});
}

export async function listProjects(jobId?: number) {
	return db.query.projects.findMany({
		where: jobId ? and(eq(projects.archived, false), eq(projects.jobId, jobId)) : eq(projects.archived, false),
		orderBy: [projects.name]
	});
}

// A job's first wage rate applies retroactively (from the epoch), so manual entries
// backdated before the job's creation timestamp still get a rate. Later rate changes
// (addWageRate) apply from their own validFrom onward and supersede it.
const RETROACTIVE_DATE = new Date(0);

export async function createJob(data: { name: string; hourlyRateCents: number; isMinijob: boolean }) {
	return db.transaction(async (tx) => {
		const [job] = await tx
			.insert(jobs)
			.values({ name: data.name, isMinijob: data.isMinijob })
			.returning();
		await tx
			.insert(wageRates)
			.values({ jobId: job.id, hourlyRateCents: data.hourlyRateCents, validFrom: RETROACTIVE_DATE });
		return job;
	});
}

export async function archiveJob(jobId: number) {
	await db.update(jobs).set({ archived: true }).where(eq(jobs.id, jobId));
}

export async function addWageRate(jobId: number, hourlyRateCents: number, validFrom: Date = new Date()) {
	const [rate] = await db.insert(wageRates).values({ jobId, hourlyRateCents, validFrom }).returning();
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
}) {
	const [entry] = await db.insert(timeEntries).values(data).returning();
	return entry;
}

export async function deleteEntry(id: number) {
	await db.delete(timeEntries).where(eq(timeEntries.id, id));
}

export async function listEntriesBetween(start: Date, end: Date) {
	return db.query.timeEntries.findMany({
		where: and(gte(timeEntries.startTime, start), lte(timeEntries.startTime, end)),
		with: { job: true, project: true },
		orderBy: [desc(timeEntries.startTime)]
	});
}

/** Sums duration (in seconds) and gross pay (in cents) for a set of entries, using the
 *  wage rate that was active at each entry's start time. Running entries (endTime null)
 *  count up to `now`. */
export async function summarizeEntries(entries: (typeof timeEntries.$inferSelect)[], now: Date = new Date()) {
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
