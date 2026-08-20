# Databricks notebook source
# MAGIC %md
# MAGIC # MedCore AI — ML Training (inside Databricks, scikit-learn — not pyspark.ml)
# MAGIC ### Notebook: `04_ML_Training/train_and_predict`
# MAGIC
# MAGIC **Why this is safe from `CONNECT_ML.MODEL_SIZE_OVERFLOW_EXCEPTION`:** that error is
# MAGIC specific to `pyspark.ml` Estimators (`StringIndexer`, `DecisionTreeClassifier`, `KMeans`,
# MAGIC etc.) — their `.fit()` calls go through Spark Connect's `MLCache`, which has a hard
# MAGIC 256MB cumulative-size cap per session. **Plain scikit-learn never touches that cache at
# MAGIC all** — once we call `.toPandas()`, everything downstream is ordinary Python/NumPy
# MAGIC objects in the notebook's regular memory, no different from running any other library.
# MAGIC
# MAGIC This is the in-Databricks equivalent of a standalone `train_and_predict.py` script you
# MAGIC could also run outside Databricks against the same `gold.*` tables via a SQL Warehouse —
# MAGIC same models, same logic, same outputs. This version is convenient if you want
# MAGIC everything in one place / one Databricks Job, with no local Python setup needed.
# MAGIC
# MAGIC | Property | Value |
# MAGIC |---|---|
# MAGIC | **Catalog** | `{CATALOG}` |
# MAGIC | **Reads** | `{CATALOG}.gold.*` directly — no separate ML feature schema |
# MAGIC | **Writes** | Neon `ai_predictions` (via psycopg2) + `{CATALOG}.gold.fact_predictions` (via plain Spark write, not `mlflow.spark`) |
# MAGIC | **Models** | RandomForestClassifier ×2 (no-show, readmission) + KMeans (clustering) — scikit-learn |
# MAGIC
# MAGIC **Requires:** `03_Gold/gold_reporting` already run — this notebook joins `gold.dim_patients`,
# MAGIC `gold.dim_doctors`, `gold.dim_appointment_types`, `gold.fact_appointments`,
# MAGIC `gold.agg_patient_summary`, and `gold.agg_doctor_performance` itself, in memory, to build
# MAGIC its training matrices. There is no persisted intermediate feature table — Gold is the
# MAGIC single canonical layer, and this is just one more consumer of it, the same as Power BI.
# MAGIC
# MAGIC **This is the last stage of the pipeline.** It writes `gold.fact_predictions` itself —
# MAGIC nothing runs after it. The full pipeline is one straight line:
# MAGIC `01_Bronze` → `02_Silver` → `03_Gold` → `04_ML_Training`.

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 1 — Context and imports

# COMMAND ----------

dbutils.widgets.text("catalog", "medcore")
CATALOG = dbutils.widgets.get("catalog")
spark.sql(f"USE CATALOG {CATALOG}")

import pandas as pd
import numpy as np
import psycopg2
import mlflow
import mlflow.sklearn
import uuid
from datetime import datetime

from pyspark.sql.functions import col, when

from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score, silhouette_score

RANDOM_SEED = 42

# Lineage for this training run — same pattern as the Bronze notebooks'
# RUN_ID/INGESTED_AT, so gold.fact_predictions (rebuilt by re-running
# 03_Gold/gold_reporting after this notebook) can tell which model run a
# prediction came from and how recent it is.
RUN_ID = str(uuid.uuid4())[:8]
RUN_AT = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

print(f"  Catalog : {CATALOG}")
print(f"  Run ID  : {RUN_ID}")
print(f"  Run at  : {RUN_AT}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 2 — Build training matrices from `gold.*` (plain Spark joins, zero `pyspark.ml`)
# MAGIC
# MAGIC **Zero ML libraries touch Spark here — not even `StringIndexer`.** Even a lightweight
# MAGIC `pyspark.ml` Estimator goes through Databricks Serverless's Spark Connect `MLCache`, which
# MAGIC is exactly what's been throwing `CONNECT_ML.MODEL_SIZE_OVERFLOW_EXCEPTION` in the past —
# MAGIC that error hit on a `StringIndexer.fit()`, not a real model. The fix is to keep everything
# MAGIC below 100% plain Spark SQL/DataFrame joins, then drop to pandas via `.toPandas()` — from
# MAGIC that point on this is ordinary Python/NumPy, no different from running any other library.
# MAGIC Categorical columns (`gender`, `specialization`, `visit_frequency`) are kept as plain
# MAGIC strings through the Spark side; sklearn encodes them in Step 4, in pandas.

# COMMAND ----------

fact_appointments      = spark.table(f"{CATALOG}.gold.fact_appointments")
dim_patients           = spark.table(f"{CATALOG}.gold.dim_patients")
dim_doctors            = spark.table(f"{CATALOG}.gold.dim_doctors")
agg_patient_summary    = spark.table(f"{CATALOG}.gold.agg_patient_summary")

# Appointment-grain matrix, for the no-show model. fact_appointments carries no
# patient/doctor attributes by design (that's dim_patients'/dim_doctors' job in
# a star schema) — join them in here, the same way any BI query against Gold would.
ml_features_sdf = (
    fact_appointments
    .join(dim_patients.select("patient_id", "age", "gender"), on="patient_id", how="inner")
    .join(dim_doctors.select(col("doctor_id"), col("specialization")), on="doctor_id", how="inner")
    .join(
        agg_patient_summary.select(
            "patient_id", "total_appointments", "cancellation_rate",
            "avg_no_show_risk", "visit_frequency"
        ),
        on="patient_id", how="inner"
    )
)

# appointment_type — does video vs in-person affect no-show rate? Left join
# since older appointments have type_id = NULL.
if spark.catalog.tableExists(f"{CATALOG}.gold.dim_appointment_types"):
    appt_types = spark.table(f"{CATALOG}.gold.dim_appointment_types").select(
        col("type_id"), col("name").alias("appointment_type")
    )
    ml_features_sdf = (
        ml_features_sdf
        .join(appt_types, on="type_id", how="left")
        .fillna({"appointment_type": "Unspecified"})
    )

# doctor's avg_rating — does patient-satisfaction correlate with no-show behavior?
if spark.catalog.tableExists(f"{CATALOG}.gold.agg_doctor_performance"):
    doctor_ratings = spark.table(f"{CATALOG}.gold.agg_doctor_performance").select("doctor_id", "avg_rating")
    ml_features_sdf = (
        ml_features_sdf
        .join(doctor_ratings, on="doctor_id", how="left")
        .fillna({"avg_rating": 0.0})
    )

# Patient-grain matrix, for readmission + clustering. agg_patient_summary already
# contains every patient attribute needed (age, gender, patient_since_days,
# visit stats) — it's the same pre-aggregated rollup Power BI reads, so no
# further join is needed here at all.
patient_features_sdf = (
    agg_patient_summary
    .dropDuplicates(["patient_id"])
    .withColumn(
        "high_readmission_risk",
        when((col("total_appointments") >= 5) & (col("cancellation_rate") > 30), 1).otherwise(0)
    )
)

ml_features = ml_features_sdf.toPandas()
patient_features = patient_features_sdf.toPandas()

print(f"  ml_features      : {len(ml_features)} rows (pandas — no more Spark from here on)")
print(f"  patient_features : {len(patient_features)} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 3 — MLflow (Databricks-hosted — logs to the same experiment either version runs)

# COMMAND ----------

mlflow.set_tracking_uri("databricks")
mlflow.set_experiment("/MedCore_AI/medcore_ml_experiments")
print("  MLflow experiment : /MedCore_AI/medcore_ml_experiments (Databricks-hosted)")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 4 — Encode categoricals in pandas (sklearn's job, not Spark's)

# COMMAND ----------

for df in (ml_features, patient_features):
    for cat_col in ["gender", "specialization", "visit_frequency"]:
        if cat_col in df.columns:
            df[f"{cat_col}_idx"] = df[cat_col].astype("category").cat.codes

# COMMAND ----------

# MAGIC %md
# MAGIC ## Model 1 — No-Show Predictor (Random Forest)

# COMMAND ----------

model1_features = [
    "appt_hour", "appt_day_of_week", "appt_month", "age",
    "total_appointments", "cancellation_rate", "avg_no_show_risk", "visit_frequency_idx"
]
data1 = ml_features.dropna(subset=model1_features + ["is_cancelled"])
X1, y1 = data1[model1_features], data1["is_cancelled"]
X1_train, X1_test, y1_train, y1_test = train_test_split(X1, y1, test_size=0.2, random_state=RANDOM_SEED)

with mlflow.start_run(run_name="no_show_random_forest"):
    model1 = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=RANDOM_SEED)
    model1.fit(X1_train, y1_train)

    proba1 = model1.predict_proba(X1_test)[:, 1]
    pred1 = model1.predict(X1_test)
    auc1 = roc_auc_score(y1_test, proba1) if y1_test.nunique() > 1 else float("nan")
    acc1 = accuracy_score(y1_test, pred1)

    mlflow.log_param("model_type", "RandomForestClassifier")
    mlflow.log_param("n_estimators", 100)
    mlflow.log_param("max_depth", 6)
    mlflow.log_metric("auc", auc1)
    mlflow.log_metric("accuracy", acc1)
    mlflow.sklearn.log_model(model1, "no_show_random_forest")  # sklearn flavor -> no MLCache involvement

print(f"  AUC={auc1:.4f}  Accuracy={acc1:.4f}")

all_proba1 = model1.predict_proba(X1)[:, 1]
all_pred1 = model1.predict(X1)
# Matches the LIVE ai_predictions schema (patient_id, prediction_type,
# prediction_result, confidence_score) — no DB migration, script adapts
# to what's actually there. Note: no-show is naturally an appointment-level
# prediction, but this schema only has patient_id — so it's stored keyed
# by the patient the appointment belongs to, not the appointment itself.
# If a patient has multiple upcoming appointments, only their most recent
# no-show prediction in this batch survives the upsert (by design — same
# ON CONFLICT behavior as the other 2 models).
no_show_predictions = pd.DataFrame({
    "patient_id": data1["patient_id"].values,
    "prediction_type": "no_show_random_forest",
    "prediction_result": all_pred1.astype(str),
    "confidence_score": all_proba1,
})

# COMMAND ----------

# MAGIC %md
# MAGIC ## Model 2 — Readmission Risk (Random Forest)

# COMMAND ----------

model2_features = ["age", "total_appointments", "cancellation_rate", "avg_no_show_risk", "visit_frequency_idx"]
data2 = patient_features.dropna(subset=model2_features + ["high_readmission_risk"])
X2, y2 = data2[model2_features], data2["high_readmission_risk"]
X2_train, X2_test, y2_train, y2_test = train_test_split(X2, y2, test_size=0.2, random_state=RANDOM_SEED)

with mlflow.start_run(run_name="readmission_random_forest"):
    model2 = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=RANDOM_SEED)
    model2.fit(X2_train, y2_train)

    proba2 = model2.predict_proba(X2_test)[:, 1]
    pred2 = model2.predict(X2_test)
    auc2 = roc_auc_score(y2_test, proba2) if y2_test.nunique() > 1 else float("nan")
    acc2 = accuracy_score(y2_test, pred2)

    mlflow.log_param("model_type", "RandomForestClassifier")
    mlflow.log_metric("auc", auc2)
    mlflow.log_metric("accuracy", acc2)
    mlflow.sklearn.log_model(model2, "readmission_random_forest")

print(f"  AUC={auc2:.4f}  Accuracy={acc2:.4f}")

all_proba2 = model2.predict_proba(X2)[:, 1]
all_pred2 = model2.predict(X2)
readmission_predictions = pd.DataFrame({
    "patient_id": data2["patient_id"].values,
    "prediction_type": "readmission_random_forest",
    "prediction_result": all_pred2.astype(str),
    "confidence_score": all_proba2,
})

# COMMAND ----------

# MAGIC %md
# MAGIC ## Model 3 — Patient Risk Clustering (K-Means)

# COMMAND ----------

model3_features = ["age", "total_appointments", "cancellation_rate", "avg_no_show_risk", "patient_since_days"]
data3 = patient_features.dropna(subset=model3_features)
X3 = data3[model3_features]
X3_scaled = StandardScaler().fit_transform(X3)

with mlflow.start_run(run_name="patient_clustering_kmeans"):
    model3 = KMeans(n_clusters=3, random_state=RANDOM_SEED, n_init=10)
    clusters = model3.fit_predict(X3_scaled)
    sil = silhouette_score(X3_scaled, clusters)

    mlflow.log_param("model_type", "KMeans")
    mlflow.log_param("k", 3)
    mlflow.log_metric("silhouette", sil)
    mlflow.sklearn.log_model(model3, "patient_clustering_kmeans")

print(f"  Silhouette score : {sil:.4f}")

cluster_risk = data3.assign(cluster=clusters).groupby("cluster")["avg_no_show_risk"].mean().sort_values()
risk_labels = ["Low Risk", "Medium Risk", "High Risk"]
cluster_to_label = {cluster_id: risk_labels[i] for i, cluster_id in enumerate(cluster_risk.index)}
print(f"  Cluster -> risk label mapping : {cluster_to_label}")

cluster_predictions = pd.DataFrame({
    "patient_id": data3["patient_id"].values,
    "prediction_type": "patient_clustering_kmeans",
    "prediction_result": [cluster_to_label[c] for c in clusters],
    "confidence_score": np.nan,
})

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 5 — Write predictions to Neon `ai_predictions` (via psycopg2)
# MAGIC
# MAGIC Matches the LIVE table's actual columns (`patient_id`, `prediction_type`,
# MAGIC `prediction_result`, `confidence_score`, `created_at`) — no schema
# MAGIC migration, this script adapts to what's already there instead.

# COMMAND ----------

DB_HOST = dbutils.secrets.get(scope="medcore-secrets", key="neon-host")
DB_USER = dbutils.secrets.get(scope="medcore-secrets", key="neon-user")
DB_PASS = dbutils.secrets.get(scope="medcore-secrets", key="neon-password")

all_predictions = pd.concat([no_show_predictions, readmission_predictions, cluster_predictions], ignore_index=True)

conn = psycopg2.connect(host=DB_HOST, user=DB_USER, password=DB_PASS, dbname="neondb", sslmode="require")
conn.autocommit = False
cur = conn.cursor()

# Table already exists live — this CREATE is just a safety net for a fresh DB
# that's never seen this table before. Matches the live schema exactly.
cur.execute("""
    CREATE TABLE IF NOT EXISTS ai_predictions (
        prediction_id      SERIAL PRIMARY KEY,
        patient_id          INTEGER NOT NULL,
        prediction_type     VARCHAR NOT NULL,
        prediction_result   VARCHAR,
        confidence_score    FLOAT,
        created_at           TIMESTAMP DEFAULT NOW()
    )
""")
conn.commit()

# ON CONFLICT needs a UNIQUE constraint on (patient_id, prediction_type).
# Add it if missing — harmless no-op if it's already there (e.g. from an
# earlier run of this exact cell).
cur.execute("""
    DO $$
    BEGIN
        ALTER TABLE ai_predictions
            ADD CONSTRAINT ai_predictions_patient_type_unique
            UNIQUE (patient_id, prediction_type);
    EXCEPTION
        WHEN duplicate_table THEN NULL;
    END $$;
""")
conn.commit()

upsert_sql = """
    INSERT INTO ai_predictions (patient_id, prediction_type, prediction_result, confidence_score, created_at)
    VALUES (%s, %s, %s, %s, NOW())
    ON CONFLICT (patient_id, prediction_type)
    DO UPDATE SET prediction_result = EXCLUDED.prediction_result,
                  confidence_score = EXCLUDED.confidence_score,
                  created_at = NOW()
"""

rows_written = 0
for _, row in all_predictions.iterrows():
    confidence = None if pd.isna(row["confidence_score"]) else float(row["confidence_score"])
    cur.execute(upsert_sql, (int(row["patient_id"]), row["prediction_type"],
                             row["prediction_result"], confidence))
    rows_written += 1

conn.commit()
cur.close()
conn.close()
print(f"  [PUSHED]  {rows_written} predictions -> Neon.ai_predictions")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Step 6 — Write predictions directly into `gold.fact_predictions`
# MAGIC
# MAGIC Plain `spark.createDataFrame(...).write` — a normal Delta write, not an ML operation, so
# MAGIC this has nothing to do with the MLCache either. This is the **only** place
# MAGIC `gold.fact_predictions` gets built — `03_Gold/gold_reporting` never touches it, so there's
# MAGIC no need to re-run that notebook after this one. Full overwrite each run (same pattern as
# MAGIC the other Gold rollups), stamped with `model_run_id` / `model_run_at` for lineage.

# COMMAND ----------

from pyspark.sql.functions import lit

# Columns are already patient_id/prediction_type/prediction_result/confidence_score
# (matches Neon's live ai_predictions schema) — no renaming needed, these
# dataframes are used as-is for the Gold write too, just stamped with run lineage.
no_show_sdf = spark.createDataFrame(no_show_predictions) \
    .withColumn("model_run_id", lit(RUN_ID)).withColumn("model_run_at", lit(RUN_AT))
readmission_sdf = spark.createDataFrame(readmission_predictions) \
    .withColumn("model_run_id", lit(RUN_ID)).withColumn("model_run_at", lit(RUN_AT))
cluster_sdf = spark.createDataFrame(cluster_predictions) \
    .withColumn("model_run_id", lit(RUN_ID)).withColumn("model_run_at", lit(RUN_AT))

fact_predictions_sdf = (
    no_show_sdf
    .unionByName(readmission_sdf, allowMissingColumns=True)
    .unionByName(cluster_sdf, allowMissingColumns=True)
)

(
    fact_predictions_sdf.write
    .format("delta").mode("overwrite").option("overwriteSchema", "true")
    .saveAsTable(f"{CATALOG}.gold.fact_predictions")
)
spark.sql(
    f"COMMENT ON TABLE {CATALOG}.gold.fact_predictions IS "
    "'Model prediction fact — 1 row per (patient, prediction_type). Joins to gold.dim_patients.'"
)
print(f"  [SAVED]  {CATALOG}.gold.fact_predictions  ({fact_predictions_sdf.count()} rows)")

# COMMAND ----------

print("=" * 60)
print("  ML TRAINING COMPLETE (ran inside Databricks, scikit-learn only)")
print("=" * 60)
print(f"  Run ID                : {RUN_ID}")
print(f"  Model 1 (no-show)     : AUC={auc1:.4f}  acc={acc1:.4f}")
print(f"  Model 2 (readmission) : AUC={auc2:.4f}  acc={acc2:.4f}")
print(f"  Model 3 (clustering)  : silhouette={sil:.4f}")
print(f"  Predictions written   : {rows_written} rows -> Neon.ai_predictions (for the app)")
print(f"  Predictions written   : {CATALOG}.gold.fact_predictions (for Power BI)")
print("  Pipeline complete      : Bronze -> Silver -> Gold -> ML. No re-run needed.")
print("=" * 60)
