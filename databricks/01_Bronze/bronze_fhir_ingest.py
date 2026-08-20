# Databricks notebook source
# MAGIC %md
# MAGIC # MedCore AI — Bronze Layer Ingestion (FHIR source, all resource types)
# MAGIC ### Notebook: `01_Bronze/bronze_fhir_ingest`
# MAGIC
# MAGIC | Property | Value |
# MAGIC |---|---|
# MAGIC | **Catalog** | `{CATALOG}` (parameterized — see Step 1) |
# MAGIC | **Schema** | `{CATALOG}.bronze` |
# MAGIC | **Layer** | Bronze — raw copy from source, 2nd source |
# MAGIC | **Source** | HAPI FHIR R4 public server (`hapi.fhir.org/baseR4`) |
# MAGIC | **Method** | REST API (paginated) + Delta MERGE (incremental CDC pattern) |
# MAGIC
# MAGIC **Tables created — one per FHIR resource type the Flask app actually writes:**
# MAGIC
# MAGIC | Table | FHIR resource | Written by (Flask endpoint) |
# MAGIC |---|---|---|
# MAGIC | `fhir_patients` | `Patient` | `POST /api/auth/signup` |
# MAGIC | `fhir_practitioners` | `Practitioner` | `POST /api/admin/doctors` |
# MAGIC | `fhir_conditions` | `Condition` | `POST /api/doctor/diagnosis/:id`, `POST /api/ai/parse-note` |
# MAGIC | `fhir_observations` | `Observation` | `POST /api/doctor/vitals/:id`, `POST /api/doctor/blood-group/:id` |
# MAGIC | `fhir_medication_requests` | `MedicationRequest` | `POST /api/doctor/medication/:id`, `POST /api/ai/parse-note` |
# MAGIC | `fhir_allergies` | `AllergyIntolerance` | `POST /api/doctor/allergy/:id` |
# MAGIC | `fhir_appointments` | `Appointment` | `POST /api/appointments` |
# MAGIC | `fhir_clinical_impressions` | `ClinicalImpression` | `POST /api/doctor/notes/:id` |
# MAGIC
# MAGIC **How it works:**
# MAGIC 1. Read `{CATALOG}.bronze.patients` and `{CATALOG}.bronze.doctors` to get every `fhir_id`
# MAGIC    (this notebook must run *after* `bronze_ingest`)
# MAGIC 2. `Patient` / `Practitioner` are fetched **directly by ID** (`GET /Patient/{id}`) since we
# MAGIC    already have the exact ID from Neon — no search needed
# MAGIC 3. The other 6 resource types are fetched via **search**, one patient at a time
# MAGIC    (`GET /{ResourceType}?patient={id}` or `?subject={id}` for `ClinicalImpression`),
# MAGIC    following FHIR Bundle pagination
# MAGIC 4. Every resource is flattened into a flat row, gets the same 3 Bronze metadata columns
# MAGIC    as the Neon notebook, and is `MERGE INTO`'d by its FHIR resource `id` — same CDC pattern
# MAGIC
# MAGIC **Known risk (see KB Section 18, Risk #3):** the public HAPI server can be slow or briefly
# MAGIC unavailable. Every request has a timeout + retry, and a failed/empty fetch for one patient
# MAGIC is skipped and logged rather than failing the whole run.
# MAGIC
# MAGIC ---
# MAGIC *Impact pSiddhi 3.0 · S4-I-07 · Rajesh Natarajan (P396) · Semester 4 Capstone*

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 1 — Set catalog and schema context

# COMMAND ----------

dbutils.widgets.text("catalog", "medcore")
dbutils.widgets.text("fhir_base_url", "https://hapi.fhir.org/baseR4")

CATALOG       = dbutils.widgets.get("catalog")
FHIR_BASE_URL = dbutils.widgets.get("fhir_base_url")

spark.sql(f"CREATE CATALOG IF NOT EXISTS {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.bronze")
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("USE SCHEMA bronze")

current = spark.sql("SELECT current_catalog(), current_schema()").collect()[0]
print(f"  Catalog        : {current[0]}")
print(f"  Schema         : {current[1]}")
print(f"  FHIR base URL  : {FHIR_BASE_URL}")
print("  Context set successfully")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 2 — Load patient + doctor FHIR IDs from the Neon-sourced Bronze tables
# MAGIC
# MAGIC This notebook depends on `bronze_ingest` having already run. Rows with no `fhir_id`
# MAGIC (e.g. seeded demo data that was written straight to Neon, bypassing the app's FHIR-write
# MAGIC endpoints) are skipped — there's nothing real on the FHIR server to fetch for them.

# COMMAND ----------

from datetime import datetime
from pyspark.sql import Row
from pyspark.sql.functions import lit
import uuid
import requests
import time

RUN_ID      = str(uuid.uuid4())[:8]
INGESTED_AT = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

patients_df  = spark.table(f"{CATALOG}.bronze.patients").select("patient_id", "fhir_id")
doctors_df   = spark.table(f"{CATALOG}.bronze.doctors").select("doctor_id", "fhir_id")

patient_rows = [r for r in patients_df.collect() if r["fhir_id"]]
doctor_rows  = [r for r in doctors_df.collect() if r["fhir_id"]]

print(f"  Patients with a fhir_id : {len(patient_rows)} / {patients_df.count()}")
print(f"  Doctors with a fhir_id  : {len(doctor_rows)} / {doctors_df.count()}")
print(f"  Run ID                  : {RUN_ID}")
print(f"  Ingested at             : {INGESTED_AT}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 3 — FHIR fetch helpers (paginated search + direct-by-ID, both with retry + timeout)

# COMMAND ----------

SESSION = requests.Session()
REQUEST_TIMEOUT_SECS = 15
MAX_RETRIES = 3


def fetch_fhir_search(resource_type, search_param, search_value):
    """
    Fetch every entry of {resource_type}?{search_param}={search_value} from the FHIR
    server, following pagination. Returns a list of resource dicts. Returns [] (never
    raises) if there are none, or the server fails after retries.
    """
    entries = []
    url = f"{FHIR_BASE_URL}/{resource_type}"
    params = {search_param: search_value, "_count": 50}

    while url:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                resp = SESSION.get(url, params=params, timeout=REQUEST_TIMEOUT_SECS)
                resp.raise_for_status()
                bundle = resp.json()
                break
            except (requests.exceptions.RequestException, ValueError) as e:
                if attempt == MAX_RETRIES:
                    print(f"    [WARN] {resource_type} search failed for "
                          f"{search_param}={search_value} after {MAX_RETRIES} attempts: {e}")
                    return entries
                time.sleep(1.5 * attempt)
        else:
            return entries

        for entry in bundle.get("entry", []):
            if "resource" in entry:
                entries.append(entry["resource"])

        next_link = next((l["url"] for l in bundle.get("link", []) if l.get("relation") == "next"), None)
        url = next_link
        params = None  # already baked into next_link

    return entries


def fetch_fhir_by_id(resource_type, resource_id):
    """
    Fetch a single resource directly by its known ID (GET /{resource_type}/{id}).
    Used for Patient/Practitioner since we already have the exact ID from Neon —
    no search needed. Returns None (never raises) on 404 or repeated failure.
    """
    url = f"{FHIR_BASE_URL}/{resource_type}/{resource_id}"
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = SESSION.get(url, timeout=REQUEST_TIMEOUT_SECS)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
        except (requests.exceptions.RequestException, ValueError) as e:
            if attempt == MAX_RETRIES:
                print(f"    [WARN] {resource_type}/{resource_id} fetch failed "
                      f"after {MAX_RETRIES} attempts: {e}")
                return None
            time.sleep(1.5 * attempt)
    return None


print("  fetch_fhir_search() and fetch_fhir_by_id() defined — retries on failure, never raise")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 4 — Flatten functions, one per FHIR resource type
# MAGIC
# MAGIC Each mirrors the exact fields the Flask app itself writes (see the endpoint table above) —
# MAGIC so every Bronze column traces back to a real field in a real `POST` payload.

# COMMAND ----------

def _name_parts(resource):
    names = resource.get("name", [{}])
    n0 = names[0] if names else {}
    given = " ".join(n0.get("given", []))
    family = n0.get("family", "")
    return given, family


def flatten_patient(resource):
    given, family = _name_parts(resource)
    return Row(
        patient_fhir_id=resource.get("id"),
        given_name=given,
        family_name=family,
        birth_date=resource.get("birthDate"),
        gender=resource.get("gender"),
        active=resource.get("active"),
    )


def flatten_practitioner(resource):
    given, family = _name_parts(resource)
    qualifications = resource.get("qualification", [{}])
    specialization = qualifications[0].get("code", {}).get("text") if qualifications else None
    return Row(
        practitioner_fhir_id=resource.get("id"),
        given_name=given,
        family_name=family,
        specialization=specialization,
        active=resource.get("active"),
    )


def flatten_condition(resource, patient_fhir_id):
    code = resource.get("code", {})
    code_text = code.get("text") or (code.get("coding", [{}])[0].get("display"))
    clinical_status_coding = resource.get("clinicalStatus", {}).get("coding", [{}])
    return Row(
        condition_id=resource.get("id"),
        patient_fhir_id=patient_fhir_id,
        code_text=code_text,
        clinical_status=clinical_status_coding[0].get("code") if clinical_status_coding else None,
        recorded_date=resource.get("recordedDate"),
    )


def flatten_observation(resource, patient_fhir_id):
    coding = resource.get("code", {}).get("coding", [{}])
    coding0 = coding[0] if coding else {}
    value_quantity = resource.get("valueQuantity", {})
    return Row(
        observation_id=resource.get("id"),
        patient_fhir_id=patient_fhir_id,
        loinc_code=coding0.get("code"),
        display_name=coding0.get("display"),
        value=str(value_quantity.get("value")) if value_quantity.get("value") is not None
              else resource.get("valueString"),
        unit=value_quantity.get("unit"),
        effective_date=resource.get("effectiveDateTime"),
    )


def flatten_medication_request(resource, patient_fhir_id):
    med = resource.get("medicationCodeableConcept", {})
    med_text = med.get("text") or (med.get("coding", [{}])[0].get("display"))
    dosage = resource.get("dosageInstruction", [{}])
    dosage_text = dosage[0].get("text") if dosage else None
    return Row(
        medication_request_id=resource.get("id"),
        patient_fhir_id=patient_fhir_id,
        medication_text=med_text,
        status=resource.get("status"),
        intent=resource.get("intent"),
        dosage_text=dosage_text,
        authored_on=resource.get("authoredOn"),
    )


def flatten_allergy(resource, patient_fhir_id):
    code = resource.get("code", {})
    substance_text = code.get("text") or (code.get("coding", [{}])[0].get("display"))
    clinical_status_coding = resource.get("clinicalStatus", {}).get("coding", [{}])
    reactions = resource.get("reaction", [{}])
    severity = reactions[0].get("severity") if reactions else None
    return Row(
        allergy_id=resource.get("id"),
        patient_fhir_id=patient_fhir_id,
        substance_text=substance_text,
        clinical_status=clinical_status_coding[0].get("code") if clinical_status_coding else None,
        severity=severity,
        recorded_date=resource.get("recordedDate"),
    )


def flatten_appointment(resource, patient_fhir_id):
    participants = resource.get("participant", [])
    practitioner_fhir_id = None
    for p in participants:
        ref = p.get("actor", {}).get("reference", "")
        if ref.startswith("Practitioner/"):
            practitioner_fhir_id = ref.split("/", 1)[1]
    return Row(
        fhir_appointment_id=resource.get("id"),
        patient_fhir_id=patient_fhir_id,
        practitioner_fhir_id=practitioner_fhir_id,
        status=resource.get("status"),
        description=resource.get("description"),
        start_time=resource.get("start"),
    )


def flatten_clinical_impression(resource, patient_fhir_id):
    return Row(
        clinical_impression_id=resource.get("id"),
        patient_fhir_id=patient_fhir_id,
        status=resource.get("status"),
        description=resource.get("description"),
        recorded_date=resource.get("date"),
    )


print("  8 flatten functions defined")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 5 — Fetch `Patient` and `Practitioner` directly by ID

# COMMAND ----------

print("Fetching Patient resources by ID...")
patient_resource_rows = []
for i, row in enumerate(patient_rows, start=1):
    resource = fetch_fhir_by_id("Patient", row["fhir_id"])
    if resource:
        patient_resource_rows.append(flatten_patient(resource))
    if i % 25 == 0:
        print(f"  ...{i}/{len(patient_rows)} checked, {len(patient_resource_rows)} found")
print(f"  Total Patient resources found : {len(patient_resource_rows)}")

print("-" * 60)
print("Fetching Practitioner resources by ID...")
practitioner_resource_rows = []
for i, row in enumerate(doctor_rows, start=1):
    resource = fetch_fhir_by_id("Practitioner", row["fhir_id"])
    if resource:
        practitioner_resource_rows.append(flatten_practitioner(resource))
print(f"  Total Practitioner resources found : {len(practitioner_resource_rows)}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 6 — Fetch the 6 patient-linked resource types via search
# MAGIC
# MAGIC One loop over patients per resource type — same pattern for all 6, just a different
# MAGIC `resource_type` / `search_param` / flatten function each time.

# COMMAND ----------

SEARCHABLE_RESOURCES = [
    # (resource_type,       search_param, flatten_fn,                collector_list_name)
    ("Condition",           "patient",  flatten_condition,           "condition_rows"),
    ("Observation",         "patient",  flatten_observation,         "observation_rows"),
    ("MedicationRequest",   "patient",  flatten_medication_request,  "medication_request_rows"),
    ("AllergyIntolerance",  "patient",  flatten_allergy,             "allergy_rows"),
    ("Appointment",         "patient",  flatten_appointment,         "appointment_rows"),
    ("ClinicalImpression",  "subject",  flatten_clinical_impression, "clinical_impression_rows"),
]

collected = {name: [] for _, _, _, name in SEARCHABLE_RESOURCES}

for resource_type, search_param, flatten_fn, collector_name in SEARCHABLE_RESOURCES:
    print(f"Fetching {resource_type} ({search_param}=<patient fhir_id>)...")
    rows_for_type = collected[collector_name]
    for i, row in enumerate(patient_rows, start=1):
        fhir_id = row["fhir_id"]
        resources = fetch_fhir_search(resource_type, search_param, fhir_id)
        if resources:
            rows_for_type.extend(flatten_fn(r, fhir_id) for r in resources)
        if i % 50 == 0:
            print(f"  ...{i}/{len(patient_rows)} patients checked, {len(rows_for_type)} {resource_type} rows so far")
    print(f"  Total {resource_type} resources flattened : {len(rows_for_type)}")
    print("-" * 60)

condition_rows           = collected["condition_rows"]
observation_rows         = collected["observation_rows"]
medication_request_rows  = collected["medication_request_rows"]
allergy_rows             = collected["allergy_rows"]
appointment_rows         = collected["appointment_rows"]
clinical_impression_rows = collected["clinical_impression_rows"]

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 7 — Build Spark DataFrames and add Bronze metadata columns

# COMMAND ----------

from pyspark.sql.types import StructType, StructField, StringType, BooleanType

# Explicit schemas — required because some fields (e.g. Patient.active) are never set
# by this app's FHIR-write endpoints, so every row has None there. Without an explicit
# schema, Spark tries to *infer* each column's type from the data and throws
# CANNOT_DETERMINE_TYPE when a column is 100% None with nothing to infer from.
#
# `active` is BooleanType, not StringType — it comes straight from the FHIR
# resource's own JSON boolean (resource.get("active")), and the existing
# medcore.bronze.fhir_patients/fhir_practitioners tables already have it typed
# that way. Declaring it as StringType here caused
# DELTA_FAILED_TO_MERGE_FIELDS on every MERGE against those tables — Delta's
# schema evolution can add columns but won't silently reconcile an existing
# column's type against an incompatible incoming type.
FHIR_SCHEMAS = {
    "fhir_patients": StructType([
        StructField("patient_fhir_id", StringType()),
        StructField("given_name", StringType()),
        StructField("family_name", StringType()),
        StructField("birth_date", StringType()),
        StructField("gender", StringType()),
        StructField("active", BooleanType()),
    ]),
    "fhir_practitioners": StructType([
        StructField("practitioner_fhir_id", StringType()),
        StructField("given_name", StringType()),
        StructField("family_name", StringType()),
        StructField("specialization", StringType()),
        StructField("active", BooleanType()),
    ]),
    "fhir_conditions": StructType([
        StructField("condition_id", StringType()),
        StructField("patient_fhir_id", StringType()),
        StructField("code_text", StringType()),
        StructField("clinical_status", StringType()),
        StructField("recorded_date", StringType()),
    ]),
    "fhir_observations": StructType([
        StructField("observation_id", StringType()),
        StructField("patient_fhir_id", StringType()),
        StructField("loinc_code", StringType()),
        StructField("display_name", StringType()),
        StructField("value", StringType()),
        StructField("unit", StringType()),
        StructField("effective_date", StringType()),
    ]),
    "fhir_medication_requests": StructType([
        StructField("medication_request_id", StringType()),
        StructField("patient_fhir_id", StringType()),
        StructField("medication_text", StringType()),
        StructField("status", StringType()),
        StructField("intent", StringType()),
        StructField("dosage_text", StringType()),
        StructField("authored_on", StringType()),
    ]),
    "fhir_allergies": StructType([
        StructField("allergy_id", StringType()),
        StructField("patient_fhir_id", StringType()),
        StructField("substance_text", StringType()),
        StructField("clinical_status", StringType()),
        StructField("severity", StringType()),
        StructField("recorded_date", StringType()),
    ]),
    "fhir_appointments": StructType([
        StructField("fhir_appointment_id", StringType()),
        StructField("patient_fhir_id", StringType()),
        StructField("practitioner_fhir_id", StringType()),
        StructField("status", StringType()),
        StructField("description", StringType()),
        StructField("start_time", StringType()),
    ]),
    "fhir_clinical_impressions": StructType([
        StructField("clinical_impression_id", StringType()),
        StructField("patient_fhir_id", StringType()),
        StructField("status", StringType()),
        StructField("description", StringType()),
        StructField("recorded_date", StringType()),
    ]),
}


def to_bronze_df(rows, table_name):
    if not rows:
        return None
    return (
        spark.createDataFrame(rows, schema=FHIR_SCHEMAS[table_name])
        .withColumn("ingested_at",     lit(INGESTED_AT))
        .withColumn("source_system",   lit("hapi_fhir"))
        .withColumn("pipeline_run_id", lit(RUN_ID))
    )

FHIR_TABLES = {
    "fhir_patients":              (to_bronze_df(patient_resource_rows, "fhir_patients"),                      "patient_fhir_id"),
    "fhir_practitioners":         (to_bronze_df(practitioner_resource_rows, "fhir_practitioners"),            "practitioner_fhir_id"),
    "fhir_conditions":            (to_bronze_df(condition_rows, "fhir_conditions"),                           "condition_id"),
    "fhir_observations":          (to_bronze_df(observation_rows, "fhir_observations"),                       "observation_id"),
    "fhir_medication_requests":   (to_bronze_df(medication_request_rows, "fhir_medication_requests"),         "medication_request_id"),
    "fhir_allergies":             (to_bronze_df(allergy_rows, "fhir_allergies"),                              "allergy_id"),
    "fhir_appointments":          (to_bronze_df(appointment_rows, "fhir_appointments"),                       "fhir_appointment_id"),
    "fhir_clinical_impressions":  (to_bronze_df(clinical_impression_rows, "fhir_clinical_impressions"),       "clinical_impression_id"),
}

for table_name, (df, _) in FHIR_TABLES.items():
    status = f"ready — {df.count()} rows" if df is not None else "EMPTY (nothing fetched this run)"
    print(f"  {table_name:<28} {status}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 8 — Load into `{CATALOG}.bronze.*` via Delta MERGE
# MAGIC
# MAGIC Same CDC pattern as the Neon Bronze notebook — first run creates the table,
# MAGIC every run after that MERGEs by the FHIR resource's own `id` (upsert).

# COMMAND ----------

from delta.tables import DeltaTable


def load_fhir_to_bronze(table_name, df, primary_key):
    if df is None:
        print(f"  [SKIPPED]  {table_name:<28} no rows fetched this run")
        return

    full_table_name = f"{CATALOG}.bronze.{table_name}"
    table_exists = spark.catalog.tableExists(full_table_name)

    if not table_exists:
        (
            df.write
            .format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .saveAsTable(full_table_name)
        )
        count = spark.table(full_table_name).count()
        print(f"  [CREATED]  {full_table_name:<50} {count} rows")
    else:
        delta_table = DeltaTable.forName(spark, full_table_name)
        (
            delta_table.alias("target")
            .merge(df.alias("source"), f"target.{primary_key} = source.{primary_key}")
            .withSchemaEvolution()
            .whenMatchedUpdateAll()
            .whenNotMatchedInsertAll()
            .execute()
        )
        count = spark.table(full_table_name).count()
        print(f"  [MERGED]   {full_table_name:<50} {count} rows")


print("Writing to bronze via Delta MERGE...")
print("-" * 60)
for table_name, (df, pk) in FHIR_TABLES.items():
    load_fhir_to_bronze(table_name, df, pk)
print("-" * 60)
print("FHIR Bronze load complete!")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 9 — Verify

# COMMAND ----------

print("=" * 60)
print("  FHIR BRONZE VERIFICATION")
print("=" * 60)

for table_name in FHIR_TABLES.keys():
    full_name = f"{CATALOG}.bronze.{table_name}"
    if spark.catalog.tableExists(full_name):
        df = spark.table(full_name)
        print(f"  {full_name:<50} {df.count():>5} rows | {len(df.columns)} cols")
    else:
        print(f"  {full_name:<50} does not exist yet (no data fetched this run)")

print("-" * 60)
print(f"  Patients checked : {len(patient_rows)}")
print(f"  Doctors checked  : {len(doctor_rows)}")
print(f"  Run ID           : {RUN_ID}")
print(f"  Status           : FHIR BRONZE COMPLETE (all 8 resource types)")
print("=" * 60)