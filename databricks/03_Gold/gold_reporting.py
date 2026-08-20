# Databricks notebook source
# MAGIC %md
# MAGIC # MedCore AI — Gold Layer: Power BI Reporting Model
# MAGIC ### Notebook: `03_Gold/gold_reporting`
# MAGIC
# MAGIC **This is the one and only Gold layer, and the layer Power BI should connect to.**
# MAGIC There is no separate ML feature schema — `04_ML_Training` reads these same dimension
# MAGIC and fact tables directly and does its own feature-prep joins in memory, the same way any
# MAGIC consumer of Gold would. It's a small star schema: a handful of dimensions, a handful of
# MAGIC fact tables at their natural business grain, and two pre-aggregated rollups.
# MAGIC
# MAGIC **`gold.fact_predictions` is not built by this notebook.** `04_ML_Training` writes it
# MAGIC directly, as its own last step, once model predictions exist. That keeps the pipeline a
# MAGIC single straight line — Bronze → Silver → Gold → ML — instead of looping back through
# MAGIC Gold a second time. This notebook just reports whether it's there yet (Step 11).
# MAGIC
# MAGIC | Property | Value |
# MAGIC |---|---|
# MAGIC | **Catalog** | `{CATALOG}` |
# MAGIC | **Schema** | `{CATALOG}.gold` |
# MAGIC | **Source** | `{CATALOG}.silver.*` only — `fact_predictions` comes from `04_ML_Training`, not from here |
# MAGIC
# MAGIC **Dimensions (Type 1 — current-state snapshot):**
# MAGIC
# MAGIC | Table | Grain |
# MAGIC |---|---|
# MAGIC | `gold.dim_patients` | 1 row per patient |
# MAGIC | `gold.dim_doctors` | 1 row per doctor, enriched with specialty lookup |
# MAGIC | `gold.dim_specialties` | 1 row per specialty |
# MAGIC | `gold.dim_appointment_types` | 1 row per appointment type |
# MAGIC | `gold.dim_date` | 1 row per calendar day spanning the data — for Power BI time intelligence |
# MAGIC
# MAGIC **Facts (1 row per business event):**
# MAGIC
# MAGIC | Table | Grain |
# MAGIC |---|---|
# MAGIC | `gold.fact_appointments` | 1 row per appointment |
# MAGIC | `gold.fact_referrals` | 1 row per referral |
# MAGIC | `gold.fact_patient_feedback` | 1 row per feedback rating |
# MAGIC | `gold.fact_clinical_notes` | 1 row per clinical note |
# MAGIC | `gold.fact_predictions` | 1 row per (patient, model) prediction — written by `04_ML_Training`, not this notebook |
# MAGIC
# MAGIC **Aggregates (pre-computed rollups, 1 row per entity):**
# MAGIC
# MAGIC | Table | Grain |
# MAGIC |---|---|
# MAGIC | `gold.agg_patient_summary` | 1 row per patient |
# MAGIC | `gold.agg_doctor_performance` | 1 row per doctor |
# MAGIC
# MAGIC **Why dims are Type 1 here even though Silver keeps SCD Type 2 history:** a BI report
# MAGIC almost always wants "who this patient/doctor is *today*," not a row per historical
# MAGIC version. Point-in-time correctness (joining a fact to the dimension row that was valid
# MAGIC *when the event happened*) is still possible — query `silver.patients`/`silver.doctors`
# MAGIC directly and filter on `valid_from`/`valid_to` — but that's a deliberate escape hatch, not
# MAGIC the default Power BI path.
# MAGIC
# MAGIC **Why business keys instead of surrogate integer keys:** `patient_id`, `doctor_id`,
# MAGIC `specialty_id`, `type_id`, and `date_key` are already unique, stable, and meaningful —
# MAGIC generating separate surrogate keys would add a maintenance burden with no real benefit
# MAGIC at this data volume. Use these columns directly as the relationship keys in Power BI's
# MAGIC model view.
# MAGIC
# MAGIC **Run order:** `01_Bronze` → `02_Silver` → **this notebook** → `04_ML_Training`
# MAGIC (trains models against `gold.*` and writes `gold.fact_predictions` itself). One pass,
# MAGIC no re-run of this notebook needed.
# MAGIC
# MAGIC ---
# MAGIC *Impact pSiddhi 3.0 · S4-I-07 · Rajesh Natarajan (P396) · Semester 4 Capstone*

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 1 — Set catalog and schema context

# COMMAND ----------

dbutils.widgets.text("catalog", "medcore")
CATALOG = dbutils.widgets.get("catalog")

spark.sql(f"CREATE CATALOG IF NOT EXISTS {CATALOG}")
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("CREATE SCHEMA IF NOT EXISTS gold")
spark.sql("USE SCHEMA gold")

current = spark.sql("SELECT current_catalog(), current_schema()").collect()[0]
print(f"  Catalog : {current[0]}")
print(f"  Schema  : {current[1]}")
print("  Context set successfully")

# COMMAND ----------

from pyspark.sql.functions import (
    col, lit, when, coalesce, to_date,
    year, quarter, month, dayofmonth, dayofweek, date_format, weekofyear,
    min as spark_min, max as spark_max
)

def table_exists(schema, name):
    return spark.catalog.tableExists(f"{CATALOG}.{schema}.{name}")

def save_gold_table(df, name, comment):
    full_name = f"{CATALOG}.gold.{name}"
    (
        df.write
        .format("delta")
        .mode("overwrite")
        .option("overwriteSchema", "true")
        .saveAsTable(full_name)
    )
    spark.sql(f"COMMENT ON TABLE {full_name} IS '{comment}'")
    print(f"  [SAVED]  {full_name:<35} {df.count():>5} rows | {len(df.columns)} cols")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 2 — `gold.dim_date`
# MAGIC
# MAGIC Spans every date that appears in appointments, referrals, or feedback — the standard
# MAGIC calendar-table pattern Power BI's time-intelligence DAX (`TOTALYTD`, `SAMEPERIODLASTYEAR`,
# MAGIC etc.) expects to mark as its Date Table.

# COMMAND ----------

date_sources = [
    spark.table(f"{CATALOG}.silver.appointments").select(to_date(col("appointment_date_only")).alias("d"))
]
if table_exists("silver", "referrals"):
    date_sources.append(spark.table(f"{CATALOG}.silver.referrals").select(to_date(col("created_at")).alias("d")))
if table_exists("silver", "patient_feedback"):
    date_sources.append(spark.table(f"{CATALOG}.silver.patient_feedback").select(to_date(col("created_at")).alias("d")))

all_dates = date_sources[0]
for d in date_sources[1:]:
    all_dates = all_dates.union(d)

bounds = all_dates.filter(col("d").isNotNull()).agg(
    spark_min("d").alias("min_d"), spark_max("d").alias("max_d")
).collect()[0]
min_d, max_d = bounds["min_d"], bounds["max_d"]

dim_date_df = (
    spark.sql(f"SELECT explode(sequence(to_date('{min_d}'), to_date('{max_d}'), interval 1 day)) AS date_key")
    .withColumn("year",         year("date_key"))
    .withColumn("quarter",      quarter("date_key"))
    .withColumn("month",        month("date_key"))
    .withColumn("month_name",   date_format("date_key", "MMMM"))
    .withColumn("day",          dayofmonth("date_key"))
    .withColumn("day_of_week",  dayofweek("date_key"))    # 1=Sunday .. 7=Saturday
    .withColumn("day_name",     date_format("date_key", "EEEE"))
    .withColumn("week_of_year", weekofyear("date_key"))
    .withColumn("is_weekend",   col("day_of_week").isin(1, 7))
)

save_gold_table(dim_date_df, "dim_date", "Calendar date dimension for Power BI time-intelligence DAX.")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 3 — `gold.dim_patients`

# COMMAND ----------

dim_patients_df = (
    spark.table(f"{CATALOG}.silver.patients")
    .filter(col("is_current") == True)
    .select(
        "patient_id", "first_name", "last_name", "age", "age_group", "gender",
        "blood_group", "phone", "email", "patient_since_days", "fhir_id"
    )
)

save_gold_table(dim_patients_df, "dim_patients", "Current-state patient dimension (Type 1) for BI reporting.")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 4 — `gold.dim_specialties` and `gold.dim_appointment_types`
# MAGIC
# MAGIC Small standalone lookup dimensions, plus reused right below to enrich `dim_doctors`.

# COMMAND ----------

if table_exists("silver", "specialties"):
    dim_specialties_df = spark.table(f"{CATALOG}.silver.specialties").select(
        "specialty_id", "name", "description", "is_active"
    )
    save_gold_table(dim_specialties_df, "dim_specialties", "Specialty lookup dimension.")
else:
    dim_specialties_df = None
    print("  [SKIPPED]  dim_specialties — silver.specialties not found")

if table_exists("silver", "appointment_types"):
    dim_appointment_types_df = spark.table(f"{CATALOG}.silver.appointment_types").select(
        "type_id", "name", "duration_mins", "is_active"
    )
    save_gold_table(dim_appointment_types_df, "dim_appointment_types", "Appointment type lookup dimension.")
else:
    print("  [SKIPPED]  dim_appointment_types — silver.appointment_types not found")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 5 — `gold.dim_doctors`
# MAGIC
# MAGIC `doctors.specialization` is a free-text column, not a foreign key — it's matched against
# MAGIC `specialties.name` on a best-effort basis so `specialty_id` is available for anyone who
# MAGIC wants to browse/filter through `dim_specialties` instead of the raw text.

# COMMAND ----------

dim_doctors_base = (
    spark.table(f"{CATALOG}.silver.doctors")
    .filter(col("is_current") == True)
    .select("doctor_id", "first_name", "last_name", "specialization", "phone", "email", "fhir_id")
)

if dim_specialties_df is not None:
    dim_doctors_df = (
        dim_doctors_base.alias("doc")
        .join(
            dim_specialties_df.select(
                col("specialty_id"), col("name").alias("specialty_name")
            ).alias("spec"),
            col("doc.specialization") == col("spec.specialty_name"),
            "left"
        )
        .select("doc.*", "spec.specialty_id")
    )
else:
    dim_doctors_df = dim_doctors_base.withColumn("specialty_id", lit(None).cast("int"))

save_gold_table(dim_doctors_df, "dim_doctors", "Current-state doctor dimension (Type 1) for BI reporting.")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 6 — `gold.fact_appointments`

# COMMAND ----------

appt_source = spark.table(f"{CATALOG}.silver.appointments")

fact_appointments_df = appt_source.select(
    "appointment_id", "patient_id", "doctor_id",
    to_date(col("appointment_date_only")).alias("date_key"),
    "status", "reason", "no_show_risk", "risk_category",
    "is_completed", "is_cancelled", "is_scheduled",
    "appt_hour", "appt_day_of_week", "appt_month", "appt_year",
    "days_from_today", "is_future",
    *(["type_id"] if "type_id" in appt_source.columns else [])
)
if "type_id" not in fact_appointments_df.columns:
    fact_appointments_df = fact_appointments_df.withColumn("type_id", lit(None).cast("int"))

save_gold_table(
    fact_appointments_df, "fact_appointments",
    "Appointment-grain fact. Joins to dim_patients, dim_doctors, dim_appointment_types, dim_date."
)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 7 — `gold.fact_referrals`

# COMMAND ----------

if table_exists("silver", "referrals"):
    fact_referrals_df = (
        spark.table(f"{CATALOG}.silver.referrals")
        .withColumn("date_key", to_date(col("created_at")))
        .withColumn("is_pending",   when(col("status") == "pending", 1).otherwise(0))
        .withColumn("is_accepted",  when(col("status") == "accepted", 1).otherwise(0))
        .withColumn("is_completed", when(col("status") == "completed", 1).otherwise(0))
        .withColumn("is_declined",  when(col("status") == "declined", 1).otherwise(0))
        .select(
            "referral_id", "patient_id", "referring_doctor_id", "referred_to_doctor_id",
            "reason", "status", "decline_reason", "date_key",
            "is_pending", "is_accepted", "is_completed", "is_declined"
        )
    )
    save_gold_table(
        fact_referrals_df, "fact_referrals",
        "Referral-grain fact. referring_doctor_id and referred_to_doctor_id both join to dim_doctors."
    )
else:
    print("  [SKIPPED]  fact_referrals — silver.referrals not found")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 8 — `gold.fact_patient_feedback`

# COMMAND ----------

if table_exists("silver", "patient_feedback"):
    fact_feedback_df = (
        spark.table(f"{CATALOG}.silver.patient_feedback")
        .withColumn("date_key", to_date(col("created_at")))
        .select("feedback_id", "appointment_id", "patient_id", "doctor_id", "rating", "comment", "date_key")
    )
    save_gold_table(
        fact_feedback_df, "fact_patient_feedback",
        "Patient feedback fact, 1 row per rating. Joins to dim_patients, dim_doctors, dim_date."
    )
else:
    print("  [SKIPPED]  fact_patient_feedback — silver.patient_feedback not found")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 9 — `gold.fact_clinical_notes`
# MAGIC
# MAGIC `admins` and `ai_predictions` (also in Silver as of this pipeline) are deliberately **not**
# MAGIC turned into Gold tables: `admins` is an internal auth-adjacent table with no reporting
# MAGIC value, and `ai_predictions` is Neon's own copy of the exact same predictions
# MAGIC `04_ML_Training` already writes into `gold.fact_predictions` — building a second Gold fact
# MAGIC from it would just be a lagged duplicate, not new information.

# COMMAND ----------

if table_exists("silver", "clinical_notes"):
    fact_clinical_notes_df = (
        spark.table(f"{CATALOG}.silver.clinical_notes")
        .withColumn("date_key", to_date(col("created_at")))
        .select("note_id", "patient_id", "doctor_id", "note_text", "note_type", "date_key")
    )
    save_gold_table(
        fact_clinical_notes_df, "fact_clinical_notes",
        "Clinical documentation fact, 1 row per note. Joins to dim_patients, dim_doctors, dim_date."
    )
else:
    print("  [SKIPPED]  fact_clinical_notes — silver.clinical_notes not found")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 10 — `gold.agg_patient_summary` and `gold.agg_doctor_performance`
# MAGIC
# MAGIC Silver already built these as derived analytical views (they're the input to the ML
# MAGIC feature store too). Gold re-publishes them under the reporting schema so a report author
# MAGIC never has to reach into `silver` — everything they need lives in `gold`.

# COMMAND ----------

agg_patient_summary_df = spark.table(f"{CATALOG}.silver.patient_appointment_summary")
save_gold_table(
    agg_patient_summary_df, "agg_patient_summary",
    "Pre-aggregated patient rollup: visit counts, cancellation rate, no-show risk, care-complexity counts."
)

agg_doctor_performance_df = spark.table(f"{CATALOG}.silver.doctor_performance_summary")
save_gold_table(
    agg_doctor_performance_df, "agg_doctor_performance",
    "Pre-aggregated doctor rollup: workload, cancellation rate, average patient feedback rating."
)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 11 — Verify all Gold tables
# MAGIC
# MAGIC `fact_predictions` is written by `04_ML_Training`, not this notebook — it'll show as
# MAGIC "not built yet" until that notebook has run once. That's expected on a first pass through
# MAGIC the pipeline, not an error.

# COMMAND ----------

GOLD_TABLES = [
    "dim_date", "dim_patients", "dim_doctors", "dim_specialties", "dim_appointment_types",
    "fact_appointments", "fact_referrals", "fact_patient_feedback", "fact_clinical_notes",
    "agg_patient_summary", "agg_doctor_performance", "fact_predictions",
]

print("=" * 70)
print(f"  GOLD VERIFICATION — {CATALOG}.gold  (Power BI connects here)")
print("=" * 70)

total_rows = 0
tables_present = 0
for table_name in GOLD_TABLES:
    full_name = f"{CATALOG}.gold.{table_name}"
    if not spark.catalog.tableExists(full_name):
        print(f"  {full_name:<40} not built yet")
        continue
    df = spark.table(full_name)
    rows = df.count()
    total_rows += rows
    tables_present += 1
    print(f"  {full_name:<40} {rows:>6} rows | {len(df.columns)} cols")

print("-" * 70)
print(f"  Tables built  : {tables_present} / {len(GOLD_TABLES)}")
print(f"  Total rows    : {total_rows}")
print(f"  Status        : GOLD REPORTING LAYER READY FOR POWER BI")
print("=" * 70)
