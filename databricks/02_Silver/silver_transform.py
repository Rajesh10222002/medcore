# Databricks notebook source
# MAGIC %md
# MAGIC # MedCore AI — Silver Layer Transform
# MAGIC ### Notebook: `02_Silver/silver_transform`
# MAGIC
# MAGIC | Property | Value |
# MAGIC |---|---|
# MAGIC | **Catalog** | `medcore` |
# MAGIC | **Schema** | `medcore.silver` |
# MAGIC | **Layer** | Silver — cleaned, validated, SCD Type 2 history |
# MAGIC | **Source** | `medcore.bronze.*` Delta tables |
# MAGIC | **Pattern** | SCD Type 2 for dimension tables · Type 1 MERGE for fact/event tables |
# MAGIC
# MAGIC **SCD Type 2 tables (history preserved):**
# MAGIC - `silver.patients` — phone, email, blood_group changes tracked
# MAGIC - `silver.doctors` — specialization, contact changes tracked
# MAGIC - `silver.doctor_schedules` — schedule changes tracked
# MAGIC
# MAGIC **Type 1 MERGE tables (current state only):**
# MAGIC - `silver.appointments` — status updates overwrite
# MAGIC - `silver.users` — auth state only
# MAGIC - `silver.doctor_leaves` — immutable events
# MAGIC - `silver.admins`, `silver.clinical_notes`, `silver.ai_predictions` — lookup/event tables added
# MAGIC   after discovering they were missing from the original Bronze `TABLE_CONFIG`
# MAGIC
# MAGIC **Derived analytical views (rebuilt each run):**
# MAGIC - `silver.patient_appointment_summary`
# MAGIC - `silver.doctor_performance_summary`
# MAGIC
# MAGIC ---
# MAGIC *Impact pSiddhi 3.0 · S4-I-07 · Rajesh Natarajan (P396) · Semester 4 Capstone*

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 1 — Set catalog context and imports

# COMMAND ----------

from pyspark.sql.functions import (
    col, lit, current_date, to_date, to_timestamp,
    datediff, floor, when, coalesce, trim, upper,
    count, avg, sum as spark_sum, max as spark_max, min as spark_min,
    round as spark_round, md5, concat_ws, monotonically_increasing_id
)
from pyspark.sql.types import StringType, BooleanType, IntegerType
from delta.tables import DeltaTable
from datetime import datetime, date

# Catalog is passed in by the Databricks Job (see resources/jobs.yml base_parameters).
# Falls back to "medcore" for manual/interactive runs in the notebook UI.
dbutils.widgets.text("catalog", "medcore")
CATALOG = dbutils.widgets.get("catalog")

spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("CREATE SCHEMA IF NOT EXISTS silver")
spark.sql("USE SCHEMA silver")

# Same note as Bronze — schema evolution for MERGE handled per-call via
# .withSchemaEvolution() below, not via spark.conf (unavailable on Serverless).

# Confirm context
current = spark.sql("SELECT current_catalog(), current_schema()").collect()[0]
print(f"  Catalog  : {current[0]}")
print(f"  Schema   : {current[1]}")
print(f"  Run time : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 2 — Create Silver schema if not exists

# COMMAND ----------

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.silver")
print(f"  {CATALOG}.silver schema ready")
spark.sql(f"SHOW SCHEMAS IN {CATALOG}").show()

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 3 — Load all Bronze tables

# COMMAND ----------

print("Loading Bronze tables...")
print("-" * 50)

br_patients   = spark.table(f"{CATALOG}.bronze.patients")
br_doctors    = spark.table(f"{CATALOG}.bronze.doctors")
br_appts      = spark.table(f"{CATALOG}.bronze.appointments")
br_users      = spark.table(f"{CATALOG}.bronze.users")
br_schedules  = spark.table(f"{CATALOG}.bronze.doctor_schedules")
br_leaves     = spark.table(f"{CATALOG}.bronze.doctor_leaves")
br_specialties  = spark.table(f"{CATALOG}.bronze.specialties")
br_feedback     = spark.table(f"{CATALOG}.bronze.patient_feedback")
br_referrals    = spark.table(f"{CATALOG}.bronze.referrals")
br_appt_types   = spark.table(f"{CATALOG}.bronze.appointment_types")
br_admins          = spark.table(f"{CATALOG}.bronze.admins")
br_clinical_notes  = spark.table(f"{CATALOG}.bronze.clinical_notes")
br_ai_predictions  = spark.table(f"{CATALOG}.bronze.ai_predictions")

for name, df in [
    ("patients",         br_patients),
    ("doctors",          br_doctors),
    ("appointments",     br_appts),
    ("users",            br_users),
    ("doctor_schedules", br_schedules),
    ("doctor_leaves",    br_leaves),
]:
    print(f"  bronze.{name:<22} {df.count()} rows | {len(df.columns)} cols")

print("-" * 50)
print("  All Bronze tables loaded")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 4 — SCD Type 2 helper function
# MAGIC
# MAGIC This function implements the full SCD Type 2 logic:
# MAGIC 1. Compare incoming source rows against current Silver records
# MAGIC 2. For changed rows → expire the old row (`valid_to = today, is_current = false`)
# MAGIC 3. Insert a new row for the changed record with new values (`valid_from = today, is_current = true, scd_version + 1`)
# MAGIC 4. For new rows → insert as version 1
# MAGIC 5. For unchanged rows → do nothing

# COMMAND ----------

def apply_scd2(source_df, table_name, primary_key, tracked_columns):
    """
    Apply SCD Type 2 to a Silver Delta table.

    Args:
        source_df      : incoming Bronze DataFrame (cleaned)
        table_name     : full table name e.g. {CATALOG}.silver.patients
        primary_key    : business key column e.g. patient_id
        tracked_columns: list of columns to watch for changes
    """
    today     = date.today().strftime("%Y-%m-%d")
    far_future = "9999-12-31"

    # Add SCD columns to source
    source_enriched = (
        source_df
        .withColumn("valid_from",   lit(today))
        .withColumn("valid_to",     lit(far_future))
        .withColumn("is_current",   lit(True))
        .withColumn("scd_version",  lit(1))
        # Surrogate key = hash of primary key + all tracked column values
        .withColumn("surrogate_key", md5(
            concat_ws("||",
                col(primary_key).cast(StringType()),
                *[col(c).cast(StringType()) for c in tracked_columns]
            )
        ))
    )

    table_exists = spark.catalog.tableExists(table_name)

    if not table_exists:
        # First run — full load, all rows are current version 1
        (
            source_enriched.write
            .format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .saveAsTable(table_name)
        )
        count = spark.table(table_name).count()
        print(f"  [CREATED]  {table_name:<45} {count} rows (v1)")

    else:
        silver_dt = DeltaTable.forName(spark, table_name)
        silver_df = spark.table(table_name)

        # Step A: Find rows that exist in Silver and have CHANGED values
        current_silver = silver_df.filter(col("is_current") == True)

        # Join source to current silver on primary key
        changed = (
            source_enriched.alias("src")
            .join(current_silver.alias("tgt"), primary_key, "inner")
            .filter(
                # Any tracked column differs between source and current
                " OR ".join([
                    f"src.{c} != tgt.{c} OR (src.{c} IS NULL AND tgt.{c} IS NOT NULL) OR (src.{c} IS NOT NULL AND tgt.{c} IS NULL)"
                    for c in tracked_columns
                ])
            )
            .select("src.*")
        )

        # Step B: Expire old rows for changed records
        # Set valid_to = today and is_current = false for those rows
        if changed.count() > 0:
            changed_keys = changed.select(primary_key).distinct()

            (
                silver_dt.alias("tgt")
                .merge(
                    changed_keys.alias("src"),
                    f"tgt.{primary_key} = src.{primary_key} AND tgt.is_current = true"
                )
                .whenMatchedUpdate(set={
                    "valid_to":   lit(today),
                    "is_current": lit(False)
                })
                .execute()
            )

        # Step C: Find new rows (not in Silver at all)
        new_rows = (
            source_enriched.alias("src")
            .join(silver_df.select(primary_key).distinct().alias("tgt"),
                  primary_key, "left_anti")
        )

        # Step D: Rows to insert = changed rows (new version) + truly new rows
        # For changed rows bump scd_version
        if changed.count() > 0:
            changed_versioned = (
                changed.alias("src")
                .join(
                    silver_df.filter(col("is_current") == False)
                    .groupBy(primary_key)
                    .agg(spark_max("scd_version").alias("max_ver"))
                    .alias("ver"),
                    primary_key, "left"
                )
                .withColumn("scd_version",
                    coalesce(col("ver.max_ver"), lit(0)) + 1
                )
                .drop("max_ver")
            )
            to_insert = new_rows.union(changed_versioned.select(new_rows.columns))
        else:
            to_insert = new_rows

        # Step E: Insert all new / changed rows
        if to_insert.count() > 0:
            (
                to_insert.write
                .format("delta")
                .mode("append")
                .saveAsTable(table_name)
            )

        count   = spark.table(table_name).count()
        current = spark.table(table_name).filter(col("is_current") == True).count()
        print(f"  [SCD2]     {table_name:<45} {count} total rows | {current} current")

print("  SCD Type 2 function defined")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 5 — Silver: patients (SCD Type 2)
# MAGIC
# MAGIC **Transformations:**
# MAGIC - Calculate `age` from `date_of_birth`
# MAGIC - Add `age_group` category
# MAGIC - Standardise `gender` to UPPER CASE
# MAGIC - Fill null `blood_group` with `Unknown`
# MAGIC - Track changes in: phone, email, blood_group, gender

# COMMAND ----------

silver_patients_df = (
    br_patients
    .withColumn("age",
        floor(datediff(current_date(), to_date(col("date_of_birth"))) / 365)
    )
    .withColumn("age_group",
        when(col("age") < 18,  "Paediatric")
        .when(col("age") < 35, "Young Adult")
        .when(col("age") < 55, "Middle Aged")
        .when(col("age") < 70, "Senior")
        .otherwise("Elderly")
    )
    .withColumn("gender",      upper(trim(col("gender"))))
    .withColumn("blood_group", coalesce(col("blood_group"), lit("Unknown")))
    .withColumn("patient_since_days",
        datediff(current_date(), to_date(col("created_at")))
    )
    .drop("password_hash", "source_system", "ingested_at", "pipeline_run_id")
    .fillna({"phone": "Unknown", "email": "Unknown"})
)

apply_scd2(
    source_df       = silver_patients_df,
    table_name      = f"{CATALOG}.silver.patients",
    primary_key     = "patient_id",
    tracked_columns = ["phone", "email", "blood_group", "gender"]
)

print("\n  Sample — current patients:")
spark.table(f"{CATALOG}.silver.patients").filter(col("is_current") == True).select(
    "patient_id","first_name","last_name","age","age_group",
    "gender","blood_group","valid_from","valid_to","scd_version","is_current"
).show(5, truncate=False)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 6 — Silver: doctors (SCD Type 2)
# MAGIC
# MAGIC Track changes in: specialization, phone, email

# COMMAND ----------

silver_doctors_df = (
    br_doctors
    .withColumn("specialization", trim(col("specialization")))
    .drop("source_system", "ingested_at", "pipeline_run_id")
    .fillna({"phone": "Unknown"})
)

apply_scd2(
    source_df       = silver_doctors_df,
    table_name      = f"{CATALOG}.silver.doctors",
    primary_key     = "doctor_id",
    tracked_columns = ["specialization", "phone", "email"]
)

print("\n  Sample — current doctors:")
spark.table(f"{CATALOG}.silver.doctors").filter(col("is_current") == True).select(
    "doctor_id","first_name","last_name","specialization",
    "valid_from","scd_version","is_current"
).show(5, truncate=False)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 7 — Silver: doctor_schedules (SCD Type 2)
# MAGIC
# MAGIC Track changes in: start_time, end_time, slot_duration

# COMMAND ----------

silver_schedules_df = (
    br_schedules
    .drop("source_system", "ingested_at", "pipeline_run_id")
)

apply_scd2(
    source_df       = silver_schedules_df,
    table_name      = f"{CATALOG}.silver.doctor_schedules",
    primary_key     = "schedule_id",
    tracked_columns = ["start_time", "end_time", "slot_duration"]
)

print("\n  Sample — current schedules:")
spark.table(f"{CATALOG}.silver.doctor_schedules").filter(col("is_current") == True).select(
    "schedule_id","doctor_id","day_of_week",
    "start_time","end_time","slot_duration",
    "valid_from","scd_version","is_current"
).show(5, truncate=False)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 8 — Silver: appointments (Type 1 MERGE)
# MAGIC
# MAGIC Appointments are fact/event records — we track status changes but don't need full history.
# MAGIC
# MAGIC **Transformations:**
# MAGIC - Parse `appointment_date` → extract time features (hour, day_of_week, month)
# MAGIC - Add binary flags: `is_completed`, `is_cancelled`, `is_scheduled`
# MAGIC - Add `risk_category` from `no_show_risk` score
# MAGIC - Add `days_from_today` and `is_future` flags

# COMMAND ----------

from pyspark.sql.functions import hour, dayofweek, month, year

silver_appts_df = (
    br_appts
    .withColumn("appointment_ts",       to_timestamp(col("appointment_date")))
    .withColumn("appointment_date_only",to_date(col("appointment_date")))
    .withColumn("appt_hour",            hour(col("appointment_ts")))
    .withColumn("appt_day_of_week",     dayofweek(col("appointment_ts")))
    .withColumn("appt_month",           month(col("appointment_ts")))
    .withColumn("appt_year",            year(col("appointment_ts")))
    .withColumn("is_completed",  when(col("status") == "completed",  1).otherwise(0))
    .withColumn("is_cancelled",  when(col("status") == "cancelled",  1).otherwise(0))
    .withColumn("is_scheduled",  when(col("status") == "scheduled",  1).otherwise(0))
    .withColumn("days_from_today",
        datediff(to_date(col("appointment_date")), current_date())
    )
    .withColumn("is_future", when(col("days_from_today") > 0, 1).otherwise(0))
    .withColumn("no_show_risk",  coalesce(col("no_show_risk"), lit(25.0)))
    .withColumn("risk_category",
        when(col("no_show_risk") < 30, "Low")
        .when(col("no_show_risk") < 60, "Medium")
        .otherwise("High")
    )
    .fillna({"reason": "Not specified"})
    .drop("source_system", "ingested_at", "pipeline_run_id")
)

table_name = f"{CATALOG}.silver.appointments"
table_exists = spark.catalog.tableExists(table_name)

if not table_exists:
    silver_appts_df.write.format("delta").mode("overwrite").option("overwriteSchema","true").saveAsTable(table_name)
    print(f"  [CREATED]  {table_name} ({silver_appts_df.count()} rows)")
else:
    dt = DeltaTable.forName(spark, table_name)
    (
        dt.alias("tgt")
        .merge(silver_appts_df.alias("src"), "tgt.appointment_id = src.appointment_id")
        .withSchemaEvolution()
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute()
    )
    print(f"  [MERGED]   {table_name} ({spark.table(table_name).count()} rows)")

print("\n  Sample:")
spark.table(table_name).select(
    "appointment_id","patient_id","doctor_id","status",
    "appt_hour","appt_day_of_week","no_show_risk","risk_category","is_future"
).show(5, truncate=False)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 9 — Silver: users, doctor_leaves, specialties, patient_feedback, referrals, appointment_types, admins, clinical_notes, ai_predictions (Type 1 MERGE)

# COMMAND ----------

for table_name, df, pk in [
    (f"{CATALOG}.silver.users",         br_users,  "user_id"),
    (f"{CATALOG}.silver.doctor_leaves", br_leaves, "leave_id"),
    (f"{CATALOG}.silver.specialties",       br_specialties, "specialty_id"),
    (f"{CATALOG}.silver.patient_feedback",  br_feedback,    "feedback_id"),
    (f"{CATALOG}.silver.referrals",         br_referrals,   "referral_id"),
    (f"{CATALOG}.silver.appointment_types", br_appt_types,  "type_id"),
    (f"{CATALOG}.silver.admins",           br_admins,          "admin_id"),
    (f"{CATALOG}.silver.clinical_notes",   br_clinical_notes,  "note_id"),
    (f"{CATALOG}.silver.ai_predictions",   br_ai_predictions,  "prediction_id"),
]:
    clean_df = df.drop("source_system", "ingested_at", "pipeline_run_id")
    exists   = spark.catalog.tableExists(table_name)

    if not exists:
        clean_df.write.format("delta").mode("overwrite").option("overwriteSchema","true").saveAsTable(table_name)
        print(f"  [CREATED]  {table_name:<45} ({clean_df.count()} rows)")
    else:
        dt = DeltaTable.forName(spark, table_name)
        (
            dt.alias("tgt")
            .merge(clean_df.alias("src"), f"tgt.{pk} = src.{pk}")
            .withSchemaEvolution()
            .whenMatchedUpdateAll()
            .whenNotMatchedInsertAll()
            .execute()
        )
        print(f"  [MERGED]   {table_name:<45} ({spark.table(table_name).count()} rows)")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 9b — Silver: FHIR-sourced tables (Type 1 MERGE + light cleaning)
# MAGIC
# MAGIC These come from `bronze_fhir_ingest`, the second Bronze source (Week 11). Each FHIR
# MAGIC resource already has its own permanent `id` from the FHIR server — there's no need for
# MAGIC SCD Type 2 versioning here, a resource's history lives on the FHIR server itself if it's
# MAGIC ever updated. Plain Type 1 MERGE (insert new, update changed) is the right pattern —
# MAGIC same as `appointments`/`users`/`doctor_leaves` above.
# MAGIC
# MAGIC Any of these Bronze tables may not exist yet if `bronze_fhir_ingest` hasn't found data
# MAGIC for that resource type on a given run (e.g. no allergies recorded for any patient yet) —
# MAGIC each is skipped gracefully rather than failing the whole notebook.

# COMMAND ----------

# (bronze_table_name,          silver_table_name,           primary_key,               date_columns_to_cast)
FHIR_SILVER_TABLES = [
    ("fhir_patients",             "fhir_patients",             "patient_fhir_id",        []),
    ("fhir_practitioners",        "fhir_practitioners",        "practitioner_fhir_id",   []),
    ("fhir_conditions",           "fhir_conditions",           "condition_id",           ["recorded_date"]),
    ("fhir_observations",         "fhir_observations",         "observation_id",         ["effective_date"]),
    ("fhir_medication_requests",  "fhir_medication_requests",  "medication_request_id",  ["authored_on"]),
    ("fhir_allergies",            "fhir_allergies",             "allergy_id",             ["recorded_date"]),
    ("fhir_appointments",         "fhir_appointments",          "fhir_appointment_id",    []),
    ("fhir_clinical_impressions", "fhir_clinical_impressions",  "clinical_impression_id", ["recorded_date"]),
]

print("Loading FHIR-sourced Bronze tables into Silver...")
print("-" * 60)

for bronze_name, silver_name, pk, date_cols in FHIR_SILVER_TABLES:
    bronze_full = f"{CATALOG}.bronze.{bronze_name}"
    silver_full = f"{CATALOG}.silver.{silver_name}"

    if not spark.catalog.tableExists(bronze_full):
        print(f"  [SKIPPED]  {silver_full:<45} bronze source not found yet (no FHIR data fetched this run)")
        continue

    clean_df = spark.table(bronze_full).drop("source_system", "ingested_at", "pipeline_run_id")
    for date_col in date_cols:
        clean_df = clean_df.withColumn(date_col, to_date(col(date_col)))

    exists = spark.catalog.tableExists(silver_full)
    if not exists:
        clean_df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(silver_full)
        print(f"  [CREATED]  {silver_full:<45} ({clean_df.count()} rows)")
    else:
        dt = DeltaTable.forName(spark, silver_full)
        (
            dt.alias("tgt")
            .merge(clean_df.alias("src"), f"tgt.{pk} = src.{pk}")
            .withSchemaEvolution()
            .whenMatchedUpdateAll()
            .whenNotMatchedInsertAll()
            .execute()
        )
        print(f"  [MERGED]   {silver_full:<45} ({spark.table(silver_full).count()} rows)")

print("-" * 60)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 10 — Silver: patient_appointment_summary (derived analytical view)
# MAGIC
# MAGIC Joined view combining patient demographics with appointment metrics.
# MAGIC Rebuilt on every run from current Silver records.
# MAGIC This is the primary input for the Gold ML feature table.

# COMMAND ----------

# Appointment stats per patient from Silver
appt_stats = (
    spark.table(f"{CATALOG}.silver.appointments")
    .groupBy("patient_id")
    .agg(
        count("appointment_id").alias("total_appointments"),
        spark_sum("is_completed").alias("completed_count"),
        spark_sum("is_cancelled").alias("cancelled_count"),
        spark_sum("is_scheduled").alias("scheduled_count"),
        spark_round(avg("no_show_risk"), 2).alias("avg_no_show_risk"),
        spark_max("appointment_date_only").alias("last_appointment_date"),
        spark_min("appointment_date_only").alias("first_appointment_date"),
    )
    .withColumn("cancellation_rate",
        spark_round(
            when(col("total_appointments") > 0,
                col("cancelled_count") / col("total_appointments") * 100
            ).otherwise(0.0), 2
        )
    )
    .withColumn("visit_frequency",
        when(col("total_appointments") >= 10, "Frequent")
        .when(col("total_appointments") >= 3,  "Regular")
        .otherwise("New")
    )
)

# FHIR-derived enrichment (Week 11 addition) — joined by fhir_id, not patient_id,
# since these counts come from the FHIR-sourced Silver tables, not Neon.
# Built up incrementally so this works even if only some FHIR tables exist yet.
fhir_enrichment = None

if spark.catalog.tableExists(f"{CATALOG}.silver.fhir_conditions"):
    diagnosis_ct = (
        spark.table(f"{CATALOG}.silver.fhir_conditions")
        .groupBy("patient_fhir_id")
        .agg(count("condition_id").alias("diagnosis_count"))
    )
    fhir_enrichment = diagnosis_ct

if spark.catalog.tableExists(f"{CATALOG}.silver.fhir_medication_requests"):
    active_meds_ct = (
        spark.table(f"{CATALOG}.silver.fhir_medication_requests")
        .filter(col("status") == "active")
        .groupBy("patient_fhir_id")
        .agg(count("medication_request_id").alias("active_medication_count"))
    )
    fhir_enrichment = (
        active_meds_ct if fhir_enrichment is None
        else fhir_enrichment.join(active_meds_ct, "patient_fhir_id", "outer")
    )

if spark.catalog.tableExists(f"{CATALOG}.silver.fhir_allergies"):
    allergy_ct = (
        spark.table(f"{CATALOG}.silver.fhir_allergies")
        .groupBy("patient_fhir_id")
        .agg(count("allergy_id").alias("allergy_count"))
    )
    fhir_enrichment = (
        allergy_ct if fhir_enrichment is None
        else fhir_enrichment.join(allergy_ct, "patient_fhir_id", "outer")
    )

print(f"  FHIR enrichment (diagnosis/medication/allergy counts) available : {fhir_enrichment is not None}")

# Referral enrichment — has_active_referral becomes a new candidate feature
# for the readmission model (a patient mid-referral plausibly behaves
# differently than one with no open referral)
referral_enrichment = None
if spark.catalog.tableExists(f"{CATALOG}.silver.referrals"):
    referral_enrichment = (
        spark.table(f"{CATALOG}.silver.referrals")
        .filter(col("status").isin("pending", "accepted"))
        .groupBy("patient_id")
        .agg(count("referral_id").alias("active_referral_count"))
    )
print(f"  Referral enrichment available : {referral_enrichment is not None}")

# Join with current patients only (is_current = true)
current_patients = spark.table(f"{CATALOG}.silver.patients").filter(col("is_current") == True)

patient_summary = (
    current_patients
    .join(appt_stats, on="patient_id", how="left")
)

if fhir_enrichment is not None:
    patient_summary = (
        patient_summary
        .join(fhir_enrichment, current_patients["fhir_id"] == fhir_enrichment["patient_fhir_id"], "left")
        .drop("patient_fhir_id")
    )

if referral_enrichment is not None:
    patient_summary = patient_summary.join(referral_enrichment, on="patient_id", how="left")

FILLNA_DEFAULTS = {
    "total_appointments": 0,
    "completed_count":    0,
    "cancelled_count":    0,
    "scheduled_count":    0,
    "avg_no_show_risk":   25.0,
    "cancellation_rate":  0.0,
    "visit_frequency":    "New",
    "diagnosis_count":         0,
    "active_medication_count": 0,
    "allergy_count":           0,
    "active_referral_count":   0,
}
# Only fill columns that actually exist on patient_summary — diagnosis_count/
# active_medication_count/allergy_count only get added above if the matching
# FHIR-sourced Silver table exists AND has data this run (e.g. none of them do
# when every seeded patient's fhir_id is a random UUID never registered with
# the real FHIR server — referencing a column that was never joined in throws
# UNRESOLVED_COLUMN, not a silent no-op).
patient_summary = patient_summary.fillna({
    k: v for k, v in FILLNA_DEFAULTS.items() if k in patient_summary.columns
})

(
    patient_summary.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{CATALOG}.silver.patient_appointment_summary")
)

print(f"  {CATALOG}.silver.patient_appointment_summary: {patient_summary.count()} rows")

preview_cols = [
    "patient_id", "first_name", "age", "age_group", "gender",
    "total_appointments", "completed_count", "cancelled_count",
    "cancellation_rate", "avg_no_show_risk", "visit_frequency",
    "diagnosis_count", "active_medication_count", "allergy_count",
]
preview_cols = [c for c in preview_cols if c in patient_summary.columns]
patient_summary.select(*preview_cols).show(5, truncate=False)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 11 — Silver: doctor_performance_summary (derived analytical view)

# COMMAND ----------

doctor_stats = (
    spark.table(f"{CATALOG}.silver.appointments")
    .groupBy("doctor_id")
    .agg(
        count("appointment_id").alias("total_appointments"),
        spark_sum("is_completed").alias("completed_count"),
        spark_sum("is_cancelled").alias("cancelled_count"),
        spark_round(avg("no_show_risk"), 2).alias("avg_patient_risk"),
        spark_max("appointment_date_only").alias("last_appointment_date"),
    )
    .withColumn("cancellation_rate",
        spark_round(
            when(col("total_appointments") > 0,
                col("cancelled_count") / col("total_appointments") * 100
            ).otherwise(0.0), 2
        )
    )
    .withColumn("workload_category",
        when(col("total_appointments") >= 50, "High")
        .when(col("total_appointments") >= 20, "Medium")
        .otherwise("Low")
    )
)

current_doctors = spark.table(f"{CATALOG}.silver.doctors").filter(col("is_current") == True)

# Real quality signal — was missing before, doctor_performance_summary only had
# volume/cancellation stats. patient_feedback gives an actual rating.
feedback_stats = (
    spark.table(f"{CATALOG}.silver.patient_feedback")
    .groupBy("doctor_id")
    .agg(
        spark_round(avg("rating"), 2).alias("avg_rating"),
        count("feedback_id").alias("feedback_count"),
    )
) if spark.catalog.tableExists(f"{CATALOG}.silver.patient_feedback") else None

doctor_performance = (
    current_doctors
    .join(doctor_stats, on="doctor_id", how="left")
)

if feedback_stats is not None:
    doctor_performance = doctor_performance.join(feedback_stats, on="doctor_id", how="left")

doctor_performance = doctor_performance.fillna({
    "total_appointments": 0,
    "completed_count":    0,
    "cancelled_count":    0,
    "cancellation_rate":  0.0,
    "workload_category":  "Low",
    "avg_rating":          0.0,
    "feedback_count":      0
})

(
    doctor_performance.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{CATALOG}.silver.doctor_performance_summary")
)

print(f"  {CATALOG}.silver.doctor_performance_summary: {doctor_performance.count()} rows")
dp_preview_cols = [
    "doctor_id", "first_name", "last_name", "specialization",
    "total_appointments", "completed_count", "cancelled_count",
    "cancellation_rate", "workload_category", "avg_rating", "feedback_count"
]
dp_preview_cols = [c for c in dp_preview_cols if c in doctor_performance.columns]
doctor_performance.select(*dp_preview_cols).show(5, truncate=False)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 12 — Verify all Silver tables

# COMMAND ----------

SILVER_TABLES = [
    (f"{CATALOG}.silver.patients",                    "SCD Type 2"),
    (f"{CATALOG}.silver.doctors",                     "SCD Type 2"),
    (f"{CATALOG}.silver.doctor_schedules",            "SCD Type 2"),
    (f"{CATALOG}.silver.appointments",                "Type 1 MERGE"),
    (f"{CATALOG}.silver.users",                       "Type 1 MERGE"),
    (f"{CATALOG}.silver.doctor_leaves",                "Type 1 MERGE"),
    (f"{CATALOG}.silver.specialties",                  "Type 1 MERGE"),
    (f"{CATALOG}.silver.patient_feedback",             "Type 1 MERGE"),
    (f"{CATALOG}.silver.referrals",                    "Type 1 MERGE"),
    (f"{CATALOG}.silver.appointment_types",            "Type 1 MERGE"),
    (f"{CATALOG}.silver.admins",                       "Type 1 MERGE"),
    (f"{CATALOG}.silver.clinical_notes",               "Type 1 MERGE"),
    (f"{CATALOG}.silver.ai_predictions",               "Type 1 MERGE"),
    (f"{CATALOG}.silver.patient_appointment_summary", "Derived view"),
    (f"{CATALOG}.silver.doctor_performance_summary",  "Derived view"),
    (f"{CATALOG}.silver.fhir_patients",               "Type 1 MERGE (FHIR)"),
    (f"{CATALOG}.silver.fhir_practitioners",          "Type 1 MERGE (FHIR)"),
    (f"{CATALOG}.silver.fhir_conditions",             "Type 1 MERGE (FHIR)"),
    (f"{CATALOG}.silver.fhir_observations",           "Type 1 MERGE (FHIR)"),
    (f"{CATALOG}.silver.fhir_medication_requests",    "Type 1 MERGE (FHIR)"),
    (f"{CATALOG}.silver.fhir_allergies",              "Type 1 MERGE (FHIR)"),
    (f"{CATALOG}.silver.fhir_appointments",           "Type 1 MERGE (FHIR)"),
    (f"{CATALOG}.silver.fhir_clinical_impressions",   "Type 1 MERGE (FHIR)"),
]

print("=" * 70)
print(f"  SILVER VERIFICATION — {CATALOG}.silver")
print("=" * 70)

total_rows = 0
for table_name, scd_type in SILVER_TABLES:
    if not spark.catalog.tableExists(table_name):
        print(f"  {table_name:<50} does not exist yet (FHIR source had no data this run)")
        continue

    df   = spark.table(table_name)
    rows = df.count()
    cols = len(df.columns)
    total_rows += rows

    # Show current vs historical for SCD Type 2 tables
    if scd_type == "SCD Type 2":
        current = df.filter(col("is_current") == True).count()
        hist    = rows - current
        print(f"  {table_name:<50} {rows:>5} rows | {current} current | {hist} historical | {cols} cols")
    else:
        print(f"  {table_name:<50} {rows:>5} rows | {scd_type:<20} | {cols} cols")

print("-" * 70)
print(f"  Total rows    : {total_rows}")
print(f"  Total tables  : {len(SILVER_TABLES)}")
print(f"  Status        : SILVER COMPLETE")
print("=" * 70)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 13 — Validate SCD Type 2 integrity
# MAGIC
# MAGIC Check that SCD Type 2 tables have no data quality issues:
# MAGIC - No patient has two `is_current = true` rows (would mean duplicate current record)
# MAGIC - Every row has a valid `valid_from` ≤ `valid_to`
# MAGIC - `scd_version` is always ≥ 1

# COMMAND ----------

print("Running SCD Type 2 integrity checks...")
print("-" * 50)
all_passed = True

for table_name in [
    f"{CATALOG}.silver.patients",
    f"{CATALOG}.silver.doctors",
    f"{CATALOG}.silver.doctor_schedules"
]:
    df  = spark.table(table_name)
    pk  = table_name.split(".")[-1].replace("doctor_", "").rstrip("s") + "_id"
    # Fix pk names
    pk_map = {
        "patients":         "patient_id",
        "doctors":          "doctor_id",
        "doctor_schedules": "schedule_id"
    }
    pk = pk_map[table_name.split(".")[-1]]

    # Check 1: No duplicate current rows per entity
    duplicates = (
        df.filter(col("is_current") == True)
        .groupBy(pk)
        .count()
        .filter(col("count") > 1)
        .count()
    )

    # Check 2: valid_from <= valid_to
    invalid_dates = df.filter(
        col("valid_from") > col("valid_to")
    ).count()

    # Check 3: scd_version >= 1
    bad_version = df.filter(col("scd_version") < 1).count()

    status = "PASS" if (duplicates == 0 and invalid_dates == 0 and bad_version == 0) else "FAIL"
    if status == "FAIL": all_passed = False

    print(f"  {table_name.split('.')[-1]:<25} duplicate_currents={duplicates} | invalid_dates={invalid_dates} | bad_version={bad_version} → {status}")

print("-" * 50)
print(f"  Overall SCD integrity : {'ALL CHECKS PASSED' if all_passed else 'FAILURES DETECTED'}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Silver layer complete
# MAGIC
# MAGIC Up to 22 tables loaded into `{CATALOG}.silver` (11 Neon-sourced + 3 more Neon lookup/event
# MAGIC tables + 8 FHIR-sourced — the FHIR ones only appear once `bronze_fhir_ingest` has found
# MAGIC matching data).
# MAGIC
# MAGIC | Table | Pattern | Key columns added |
# MAGIC |---|---|---|
# MAGIC | `silver.patients` | SCD Type 2 | age, age_group, surrogate_key, valid_from, valid_to, is_current, scd_version |
# MAGIC | `silver.doctors` | SCD Type 2 | surrogate_key, valid_from, valid_to, is_current, scd_version |
# MAGIC | `silver.doctor_schedules` | SCD Type 2 | surrogate_key, valid_from, valid_to, is_current, scd_version |
# MAGIC | `silver.appointments` | Type 1 MERGE | appt_hour, appt_day_of_week, flags, risk_category |
# MAGIC | `silver.users` | Type 1 MERGE | — |
# MAGIC | `silver.doctor_leaves` | Type 1 MERGE | — |
# MAGIC | `silver.admins` | Type 1 MERGE | — |
# MAGIC | `silver.clinical_notes` | Type 1 MERGE | — |
# MAGIC | `silver.ai_predictions` | Type 1 MERGE | Neon's live copy of model predictions — one run behind `gold.fact_predictions`, useful as an audit trail |
# MAGIC | `silver.patient_appointment_summary` | Derived | visit_frequency, cancellation_rate, avg_no_show_risk, diagnosis_count, active_medication_count, allergy_count |
# MAGIC | `silver.doctor_performance_summary` | Derived | workload_category, cancellation_rate |
# MAGIC | `silver.fhir_patients` | Type 1 MERGE (FHIR) | — |
# MAGIC | `silver.fhir_practitioners` | Type 1 MERGE (FHIR) | — |
# MAGIC | `silver.fhir_conditions` | Type 1 MERGE (FHIR) | recorded_date cast to date |
# MAGIC | `silver.fhir_observations` | Type 1 MERGE (FHIR) | effective_date cast to date |
# MAGIC | `silver.fhir_medication_requests` | Type 1 MERGE (FHIR) | authored_on cast to date |
# MAGIC | `silver.fhir_allergies` | Type 1 MERGE (FHIR) | recorded_date cast to date |
# MAGIC | `silver.fhir_appointments` | Type 1 MERGE (FHIR) | — |
# MAGIC | `silver.fhir_clinical_impressions` | Type 1 MERGE (FHIR) | recorded_date cast to date |
# MAGIC
# MAGIC **Run this notebook again** — SCD Type 2 tables will track any new changes as new versions. Type 1 tables will upsert. Derived views will rebuild.
# MAGIC
# MAGIC **Next step:** Run `03_Gold/gold_reporting` (builds the star schema Power BI
# MAGIC connects to), then `04_ML_Training/train_and_predict` (trains models directly
# MAGIC against `gold.*` and writes `gold.fact_predictions` itself). One pass, in order,
# MAGIC and the whole pipeline is done: Bronze → Silver → Gold → ML.