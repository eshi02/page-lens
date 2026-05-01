CREATE TYPE "public"."export_job_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"format" text NOT NULL,
	"status" "export_job_status" DEFAULT 'pending' NOT NULL,
	"pdf_data" "bytea",
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_issue_stats" (
	"user_id" uuid NOT NULL,
	"issue_key" text NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_issue_stats_user_id_issue_key_pk" PRIMARY KEY("user_id","issue_key")
);
--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_issue_stats" ADD CONSTRAINT "user_issue_stats_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "export_jobs_user_idx" ON "export_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "export_jobs_status_idx" ON "export_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "user_issue_stats_user_count_idx" ON "user_issue_stats" USING btree ("user_id","total_count");