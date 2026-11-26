import { pgTable, serial, integer, text, timestamp, boolean, numeric } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const jobs = pgTable('jobs', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	color: text('color').notNull().default('#64748b'),
	isMinijob: boolean('is_minijob').notNull().default(false),
	archived: boolean('archived').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const jobsRelations = relations(jobs, ({ many }) => ({
	wageRates: many(wageRates),
	projects: many(projects),
	timeEntries: many(timeEntries)
}));

// Hourly rate, historized: a job can have multiple rates over time.
// The rate valid for an entry is the one with the latest validFrom <= entry start.
export const wageRates = pgTable('wage_rates', {
	id: serial('id').primaryKey(),
	jobId: integer('job_id')
		.notNull()
		.references(() => jobs.id, { onDelete: 'cascade' }),
	hourlyRateCents: integer('hourly_rate_cents').notNull(),
	validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const wageRatesRelations = relations(wageRates, ({ one }) => ({
	job: one(jobs, { fields: [wageRates.jobId], references: [jobs.id] })
}));

export const projects = pgTable('projects', {
	id: serial('id').primaryKey(),
	jobId: integer('job_id')
		.notNull()
		.references(() => jobs.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	color: text('color').notNull().default('#64748b'),
	archived: boolean('archived').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
	job: one(jobs, { fields: [projects.jobId], references: [jobs.id] }),
	timeEntries: many(timeEntries)
}));

export const timeEntries = pgTable('time_entries', {
	id: serial('id').primaryKey(),
	jobId: integer('job_id')
		.notNull()
		.references(() => jobs.id, { onDelete: 'cascade' }),
	projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
	// endTime is null while the timer is running (at most one running entry expected).
	startTime: timestamp('start_time', { withTimezone: true }).notNull(),
	endTime: timestamp('end_time', { withTimezone: true }),
	note: text('note'),
	// What was done during the entry, one item per line (shown in the timesheet).
	activities: text('activities')
		.array()
		.notNull()
		.default(sql`'{}'::text[]`),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
	job: one(jobs, { fields: [timeEntries.jobId], references: [jobs.id] }),
	project: one(projects, { fields: [timeEntries.projectId], references: [projects.id] })
}));

// Single-user app: always exactly one row (id = 1).
export const settings = pgTable('settings', {
	id: integer('id').primaryKey().default(1),
	weeklyTargetHours: numeric('weekly_target_hours', { precision: 5, scale: 2 })
		.notNull()
		.default('40'),
	/** Rounding step preselected when stopping the timer (0 = exact). */
	stopRoundingMinutes: integer('stop_rounding_minutes').notNull().default(15),
	/** UI and export language ('en' | 'de'), shared by every device. */
	language: text('language').notNull().default('en'),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// Personal to-do list. Checking a todo off copies its text into an entry's activities
// (the running one, or the one being added manually) and remembers that entry.
export const todos = pgTable('todos', {
	id: serial('id').primaryKey(),
	jobId: integer('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
	text: text('text').notNull(),
	doneAt: timestamp('done_at', { withTimezone: true }),
	entryId: integer('entry_id').references(() => timeEntries.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const todosRelations = relations(todos, ({ one }) => ({
	job: one(jobs, { fields: [todos.jobId], references: [jobs.id] }),
	entry: one(timeEntries, { fields: [todos.entryId], references: [timeEntries.id] })
}));

// Months (YYYY-MM, local time) that have already been billed. Past months with entries
// that are not listed here show up as "still to bill".
export const billedMonths = pgTable('billed_months', {
	month: text('month').primaryKey(),
	billedAt: timestamp('billed_at', { withTimezone: true }).notNull().defaultNow()
});
