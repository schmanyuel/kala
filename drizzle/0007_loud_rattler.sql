CREATE TABLE "billed_months" (
	"month" text PRIMARY KEY NOT NULL,
	"billed_at" timestamp with time zone DEFAULT now() NOT NULL
);
