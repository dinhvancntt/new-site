CREATE TABLE "article_contents" (
	"article_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"search_text" text NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"title_hash" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"image_url" text,
	"category" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" text NOT NULL,
	CONSTRAINT "articles_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "articles_title_hash_unique" UNIQUE("title_hash")
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched" integer DEFAULT 0 NOT NULL,
	"skipped_dup" integer DEFAULT 0 NOT NULL,
	"skipped_extract" integer DEFAULT 0 NOT NULL,
	"written" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "article_contents" ADD CONSTRAINT "article_contents_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_contents_article_lang_idx" ON "article_contents" USING btree ("article_id","lang");--> statement-breakpoint
CREATE UNIQUE INDEX "article_contents_lang_slug_idx" ON "article_contents" USING btree ("lang","slug");--> statement-breakpoint
CREATE INDEX "article_contents_search_idx" ON "article_contents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "articles_category_published_at_idx" ON "articles" USING btree ("category","published_at" DESC NULLS LAST);