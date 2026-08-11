CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"weekly_target_hours" numeric(5, 2) DEFAULT '40' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
