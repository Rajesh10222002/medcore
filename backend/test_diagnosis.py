import requests
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

FHIR_URL = os.getenv("FHIR_BASE_URL")
fhir_id  = "136993504"

# Test writing a condition to FHIR
condition = {
    "resourceType": "Condition",
    "subject": {"reference": f"Patient/{fhir_id}"},
    "code": {
        "text": "Hypertension",
        "coding": [{
            "system":  "http://hl7.org/fhir/sid/icd-10",
            "code":    "I10",
            "display": "Hypertension"
        }]
    },
    "recordedDate": "2026-06-20",
    "clinicalStatus": {
        "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
            "code":   "active"
        }]
    }
}

resp = requests.post(
    f"{FHIR_URL}/Condition",
    json=condition,
    headers={"Content-Type": "application/fhir+json"},
    timeout=10
)

print(f"Status: {resp.status_code}")
print(f"Response: {resp.text[:500]}")

import json

FHIR_URL = "https://hapi.fhir.org/baseR4"
fhir_id  = "136993504"

# Test 1 - Medications
resp = requests.get(
    f"{FHIR_URL}/MedicationRequest?subject=Patient/{fhir_id}",
    headers={"Accept": "application/fhir+json"},
    timeout=10
)
data    = resp.json()
entries = data.get("entry", [])
print(f"Medications found: {len(entries)}")
for e in entries[:3]:
    res = e.get("resource", {})
    med = res.get("medicationCodeableConcept", {})
    print(f"  - {med.get('text')} | status: {res.get('status')}")

print()

# Test 2 - Conditions
resp2 = requests.get(
    f"{FHIR_URL}/Condition?subject=Patient/{fhir_id}",
    headers={"Accept": "application/fhir+json"},
    timeout=10
)
data2    = resp2.json()
entries2 = data2.get("entry", [])
print(f"Conditions found: {len(entries2)}")
for e in entries2[:3]:
    res  = e.get("resource", {})
    code = res.get("code", {})
    print(f"  - {code.get('text')}")

print()

# Test 3 - Allergies
resp3 = requests.get(
    f"{FHIR_URL}/AllergyIntolerance?patient=Patient/{fhir_id}",
    headers={"Accept": "application/fhir+json"},
    timeout=10
)
data3    = resp3.json()
entries3 = data3.get("entry", [])
print(f"Allergies found: {len(entries3)}")
for e in entries3[:3]:
    res  = e.get("resource", {})
    code = res.get("code", {})
    print(f"  - {code.get('text')}")