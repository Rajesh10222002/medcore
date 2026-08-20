# Databricks notebook source
# MAGIC %md
# MAGIC # MedCore AI — Bronze Layer Ingestion
# MAGIC ### Notebook: `01_Bronze/bronze_ingest`
# MAGIC
# MAGIC | Property | Value |
# MAGIC |---|---|
# MAGIC | **Catalog** | `medcore` |
# MAGIC | **Schema** | `medcore.bronze` |
# MAGIC | **Layer** | Bronze — raw copy from source |
# MAGIC | **Source** | Neon PostgreSQL (production DB) |
# MAGIC | **Method** | Spark JDBC + Delta MERGE (incremental CDC pattern) |
# MAGIC | **Tables** | users · patients · doctors · appointments · doctor_schedules · doctor_leaves |
# MAGIC
# MAGIC **How it works:**
# MAGIC 1. Connect to Neon via JDBC (no pip installs — native Spark driver)
# MAGIC 2. Pull each table as a Spark DataFrame
# MAGIC 3. Add Bronze metadata columns (`ingested_at`, `source_system`, `pipeline_run_id`)
# MAGIC 4. First run → `CREATE TABLE` and full load
# MAGIC 5. Subsequent runs → `MERGE INTO` (upsert by primary key) — incremental CDC
# MAGIC
# MAGIC ---
# MAGIC *Impact pSiddhi 3.0 · S4-I-07 · Rajesh Natarajan (P396) · Semester 4 Capstone*

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 1 — Set catalog and schema context

# COMMAND ----------

# Catalog is passed in by the Databricks Job (see resources/jobs.yml base_parameters).
# Falls back to "medcore" for manual/interactive runs in the notebook UI.
dbutils.widgets.text("catalog", "medcore")
CATALOG = dbutils.widgets.get("catalog")

# Set the active catalog and schema so all table references resolve to {CATALOG}.bronze
spark.sql(f"CREATE CATALOG IF NOT EXISTS {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.bronze")
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("USE SCHEMA bronze")

# NOTE: spark.databricks.delta.schema.autoMerge.enabled is NOT settable via
# spark.conf on Serverless (CONFIG_NOT_AVAILABLE error). Schema evolution for
# a new column on an existing table is instead handled per-merge-call below,
# via .withSchemaEvolution() on each DeltaMergeBuilder — the serverless-safe
# equivalent for MERGE INTO operations specifically.

# Confirm context
current = spark.sql("SELECT current_catalog(), current_schema()").collect()[0]
print(f"  Catalog : {current[0]}")
print(f"  Schema  : {current[1]}")
print("  Context set successfully")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 2 — Load credentials from Databricks Secrets
# MAGIC
# MAGIC Credentials are stored securely in `medcore-secrets` scope.  
# MAGIC No passwords appear in any cell — safe to share and screenshot.

# COMMAND ----------

from datetime import datetime
from pyspark.sql.functions import lit, current_timestamp, col
import uuid

# Load from Databricks Secrets (never hard-code credentials)
DB_HOST = dbutils.secrets.get(scope="medcore-secrets", key="neon-host")
DB_USER = dbutils.secrets.get(scope="medcore-secrets", key="neon-user")
DB_PASS = dbutils.secrets.get(scope="medcore-secrets", key="neon-password")
DB_NAME = "neondb"

# JDBC URL — native Spark PostgreSQL connector
JDBC_URL = f"jdbc:postgresql://{DB_HOST}/{DB_NAME}?sslmode=require"

# Unique run ID for this pipeline execution (useful for audit/lineage)
RUN_ID      = str(uuid.uuid4())[:8]
INGESTED_AT = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

print("  Credentials loaded from Databricks Secrets")
print(f"  DB           : {DB_NAME}")
print(f"  User         : {DB_USER}")
print(f"  Run ID       : {RUN_ID}")
print(f"  Ingested at  : {INGESTED_AT}")
print(f"  JDBC         : jdbc:postgresql://[REDACTED]/{DB_NAME}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 3 — Define table config and JDBC reader
# MAGIC
# MAGIC Each table has a defined **primary key** used for the MERGE (upsert) operation.  
# MAGIC This is what makes the pipeline incremental — new rows are inserted, changed rows are updated, nothing is duplicated.

# COMMAND ----------

# Table config: name → primary key for MERGE
TABLE_CONFIG = {
    "users":            "user_id",
    "patients":         "patient_id",
    "doctors":          "doctor_id",
    "appointments":     "appointment_id",
    "doctor_schedules": "schedule_id",
    "doctor_leaves":    "leave_id",
    "specialties":       "specialty_id",
    "patient_feedback":  "feedback_id",
    "referrals":         "referral_id",
    "appointment_types": "type_id",
}

def read_from_neon(table_name):
    """Read a table from Neon PostgreSQL via Spark JDBC"""
    df = (
        spark.read
        .format("jdbc")
        .option("url",      JDBC_URL)
        .option("dbtable",  table_name)
        .option("user",     DB_USER)
        .option("password", DB_PASS)
        .option("driver",   "org.postgresql.Driver")
        .option("sslmode",  "require")
        .option("fetchsize","1000")         # batch fetch for performance
        .load()
    )
    return df

print("  JDBC reader defined")
print(f"  Tables to ingest: {list(TABLE_CONFIG.keys())}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 4 — Extract all 10 tables from Neon
# MAGIC
# MAGIC Each table is read via JDBC and enriched with 3 Bronze metadata columns:
# MAGIC
# MAGIC | Column | Purpose |
# MAGIC |---|---|
# MAGIC | `ingested_at` | Timestamp of this pipeline run |
# MAGIC | `source_system` | Always `neon_postgresql` for lineage |
# MAGIC | `pipeline_run_id` | Unique ID per run — helps trace any issue back to a specific execution |

# COMMAND ----------

print("=" * 60)
print("  BRONZE EXTRACTION — MedCore AI")
print("=" * 60)
print(f"  Started    : {INGESTED_AT}")
print(f"  Run ID     : {RUN_ID}")
print("-" * 60)

extracted = {}

for table_name in TABLE_CONFIG.keys():
    df = read_from_neon(table_name)

    # Add Bronze metadata columns
    df_enriched = (
        df
        .withColumn("ingested_at",     lit(INGESTED_AT))
        .withColumn("source_system",   lit("neon_postgresql"))
        .withColumn("pipeline_run_id", lit(RUN_ID))
    )

    extracted[table_name] = df_enriched
    print(f"  Extracted [{table_name}] — {df.count()} rows | {len(df.columns)} source columns")

print("-" * 60)
print(f"  Total tables extracted : {len(extracted)}")
print("  Extraction complete")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 5 — Load into `medcore.bronze.*` using Delta MERGE
# MAGIC
# MAGIC **Why MERGE and not overwrite?**
# MAGIC
# MAGIC | Mode | Behaviour | Problem |
# MAGIC |---|---|---|
# MAGIC | `overwrite` | Deletes everything, re-inserts all rows | Loses history, slow, not incremental |
# MAGIC | `MERGE (upsert)` | Inserts new rows, updates changed rows | Incremental, fast, no data loss |
# MAGIC
# MAGIC The MERGE pattern is CDC (Change Data Capture) — the industry standard for database → lakehouse ingestion.  
# MAGIC On the **first run**, the table doesn't exist yet so we do a full `saveAsTable`.  
# MAGIC On **every subsequent run**, we do `MERGE INTO` using the primary key.

# COMMAND ----------

from delta.tables import DeltaTable

def load_to_bronze(table_name, df, primary_key):
    """
    Load a DataFrame into medcore.bronze using Delta MERGE (upsert).
    First run: creates the table with full load.
    Subsequent runs: merges by primary key (insert new, update changed).
    """
    full_table_name = f"{CATALOG}.bronze.{table_name}"

    # Check if Delta table already exists in the catalog
    table_exists = spark.catalog.tableExists(full_table_name)

    if not table_exists:
        # First run — create and full load
        (
            df.write
            .format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .saveAsTable(full_table_name)
        )
        count = spark.table(full_table_name).count()
        print(f"  [CREATED]  {full_table_name:<45} {count} rows")
    else:
        # Subsequent runs — MERGE by primary key
        delta_table = DeltaTable.forName(spark, full_table_name)

        (
            delta_table.alias("target")
            .merge(
                df.alias("source"),
                f"target.{primary_key} = source.{primary_key}"
            )
            .withSchemaEvolution()      # serverless-safe equivalent of autoMerge.enabled, for MERGE specifically
            .whenMatchedUpdateAll()     # Update all columns if row exists
            .whenNotMatchedInsertAll()  # Insert if row is new
            .execute()
        )
        count = spark.table(full_table_name).count()
        print(f"  [MERGED]   {full_table_name:<45} {count} rows")

print("Writing to medcore.bronze via Delta MERGE...")
print("-" * 60)

for table_name, df in extracted.items():
    pk = TABLE_CONFIG[table_name]
    load_to_bronze(table_name, df, pk)

print("-" * 60)
print("Bronze load complete!")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 6 — Verify all Bronze tables

# COMMAND ----------

print("=" * 60)
print("  BRONZE VERIFICATION — medcore.bronze")
print("=" * 60)

total_rows = 0
for table_name in TABLE_CONFIG.keys():
    full_name = f"{CATALOG}.bronze.{table_name}"
    df        = spark.table(full_name)
    rows      = df.count()
    cols      = len(df.columns)
    total_rows += rows
    print(f"  {full_name:<45} {rows:>5} rows | {cols} cols")

print("-" * 60)
print(f"  Total rows   : {total_rows}")
print(f"  Total tables : {len(TABLE_CONFIG)}")
print(f"  Run ID       : {RUN_ID}")
print(f"  Status       : BRONZE COMPLETE")
print("=" * 60)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 7 — Preview sample data from key tables

# COMMAND ----------

print(f"Sample: {CATALOG}.bronze.patients")
spark.table(f"{CATALOG}.bronze.patients").select(
    "patient_id", "first_name", "last_name", "gender",
    "date_of_birth", "ingested_at", "source_system", "pipeline_run_id"
).show(5, truncate=False)

print(f"Sample: {CATALOG}.bronze.appointments")
spark.table(f"{CATALOG}.bronze.appointments").select(
    "appointment_id", "patient_id", "doctor_id",
    "status", "reason", "no_show_risk",
    "ingested_at", "pipeline_run_id"
).show(5, truncate=False)

print(f"Sample: {CATALOG}.bronze.doctors")
spark.table(f"{CATALOG}.bronze.doctors").select(
    "doctor_id", "first_name", "last_name",
    "specialization", "ingested_at"
).show(5, truncate=False)