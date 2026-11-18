CREATE TABLE "todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"text" text NOT NULL,
	"done_at" timestamp with time zone,
	"entry_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "activities" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_entry_id_time_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."time_entries"("id") ON DELETE set null ON UPDATE no action;