CREATE TABLE "adblue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "adblue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"car_id" integer NOT NULL,
	"event_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"odometer_km" integer NOT NULL,
	"liters_milliliters" integer NOT NULL,
	"price_huf" integer NOT NULL,
	CONSTRAINT "adblue_odometer_km_nonnegative" CHECK ("adblue"."odometer_km" >= 0),
	CONSTRAINT "adblue_liters_milliliters_positive" CHECK ("adblue"."liters_milliliters" > 0),
	CONSTRAINT "adblue_price_huf_nonnegative" CHECK ("adblue"."price_huf" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cars" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cars_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cars_name_length" CHECK (char_length("cars"."name") BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"car_id" integer NOT NULL,
	"event_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount_huf" integer NOT NULL,
	"notes" text,
	CONSTRAINT "expenses_amount_huf_nonnegative" CHECK ("expenses"."amount_huf" >= 0),
	CONSTRAINT "expenses_notes_length" CHECK ("expenses"."notes" IS NULL OR char_length("expenses"."notes") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "fuel" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fuel_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"car_id" integer NOT NULL,
	"event_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"odometer_km" integer NOT NULL,
	"liters_milliliters" integer NOT NULL,
	"price_huf" integer NOT NULL,
	"full_tank" boolean NOT NULL,
	"remark" text,
	CONSTRAINT "fuel_odometer_km_nonnegative" CHECK ("fuel"."odometer_km" >= 0),
	CONSTRAINT "fuel_liters_milliliters_positive" CHECK ("fuel"."liters_milliliters" > 0),
	CONSTRAINT "fuel_price_huf_nonnegative" CHECK ("fuel"."price_huf" >= 0),
	CONSTRAINT "fuel_remark_length" CHECK ("fuel"."remark" IS NULL OR char_length("fuel"."remark") <= 500)
);
--> statement-breakpoint
ALTER TABLE "adblue" ADD CONSTRAINT "adblue_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel" ADD CONSTRAINT "fuel_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_adblue_car_event_date" ON "adblue" USING btree ("car_id","event_date" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "cars_name_lower_key" ON "cars" USING btree (lower("name" COLLATE "C"));--> statement-breakpoint
CREATE INDEX "idx_expenses_car_event_date" ON "expenses" USING btree ("car_id","event_date" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_fuel_car_event_date" ON "fuel" USING btree ("car_id","event_date" DESC NULLS FIRST,"id" DESC NULLS FIRST);