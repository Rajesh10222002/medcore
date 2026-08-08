from flask import Blueprint, request, jsonify
from middleware.auth import token_required, role_required
from db import get_db
from ai_client import generate_text
import requests as http_req
import os
from dotenv import load_dotenv

load_dotenv()
FHIR_URL = os.getenv("FHIR_BASE_URL")

ai_bp = Blueprint("ai", __name__)


def get_patient_context(patient_id, fhir_id, name):
    """
    Build a rich context string about the patient from both
    Neon DB (appointments) and HAPI FHIR (clinical data).
    This context is passed to the AI so it can answer questions
    about the patient's actual data.
    """
    from datetime import datetime
    today = datetime.now().date()

    context = f"Patient Name: {name}\nToday's Date: {today}\n"

    # ── Pull appointments from Neon DB ──────────────────────────
    try:
        conn = get_db()
        cur  = conn.cursor()

        # Upcoming scheduled appointments
        cur.execute("""
            SELECT a.appointment_date, a.status, a.reason,
                   d.first_name || ' ' || d.last_name AS doctor_name,
                   d.specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE a.patient_id = %s
              AND a.status = 'scheduled'
              AND a.appointment_date > NOW()
            ORDER BY a.appointment_date ASC
            LIMIT 5
        """, (patient_id,))
        upcoming = cur.fetchall()

        # Past completed appointments
        cur.execute("""
            SELECT a.appointment_date, a.status, a.reason,
                   d.first_name || ' ' || d.last_name AS doctor_name,
                   d.specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE a.patient_id = %s
              AND (a.status = 'completed' OR a.appointment_date <= NOW())
            ORDER BY a.appointment_date DESC
            LIMIT 3
        """, (patient_id,))
        past = cur.fetchall()

        cur.close()
        conn.close()

        if upcoming:
            context += "\nUpcoming Appointments:\n"
            for r in upcoming:
                appt_date = r[0]
                # Format the date nicely for the AI
                if hasattr(appt_date, 'strftime'):
                    date_str = appt_date.strftime("%A, %d %B %Y at %I:%M %p")
                else:
                    date_str = str(appt_date)
                context += f"  - {date_str} with Dr. {r[3]} ({r[4]}) — Reason: {r[2]}\n"
        else:
            context += "\nUpcoming Appointments: None scheduled\n"

        if past:
            context += "\nPast Appointments:\n"
            for r in past:
                appt_date = r[0]
                if hasattr(appt_date, 'strftime'):
                    date_str = appt_date.strftime("%d %B %Y")
                else:
                    date_str = str(appt_date)[:10]
                context += f"  - {date_str} with Dr. {r[3]} ({r[4]}) — Status: {r[1]}, Reason: {r[2]}\n"

    except Exception as e:
        print(f"Neon context error: {e}")
        context += "\nAppointments: Unable to load\n"

    # ── Pull clinical data from FHIR ─────────────────────────────
    if fhir_id:
        try:
            conditions  = []
            medications = []
            vitals      = []

            def fetch_fhir(resource_type, param=None):
                if param:
                    url = f"{FHIR_URL}/{resource_type}?{param}={fhir_id}&_count=20"
                else:
                    url = f"{FHIR_URL}/{resource_type}?subject=Patient/{fhir_id}&_count=20"
                r = http_req.get(
                    url,
                    headers={"Accept": "application/fhir+json"},
                    timeout=10
                )
                if r.status_code == 200:
                    return r.json().get("entry", [])
                return []

            # Conditions
            for entry in fetch_fhir("Condition"):
                res  = entry.get("resource", {})
                code = res.get("code", {})
                n    = code.get("text") or code.get("coding", [{}])[0].get("display", "")
                if n:
                    conditions.append(n)

            # Medications
            for entry in fetch_fhir("MedicationRequest"):
                res = entry.get("resource", {})
                med = res.get("medicationCodeableConcept", {})
                n   = med.get("text") or med.get("coding", [{}])[0].get("display", "")
                s   = res.get("status", "")
                if n:
                    medications.append(f"{n} ({s})")

            # Vitals
            for entry in fetch_fhir("Observation"):
                res   = entry.get("resource", {})
                code  = res.get("code", {})
                value = res.get("valueQuantity", {})
                n     = code.get("text") or code.get("coding", [{}])[0].get("display", "")
                v     = value.get("value", "")
                u     = value.get("unit", "")
                if n and v:
                    vitals.append(f"{n}: {v} {u}")

            if conditions:
                context += f"\nDiagnoses: {', '.join(conditions)}\n"
            if medications:
                context += f"\nCurrent Medications: {', '.join(medications)}\n"
            if vitals:
                context += f"\nRecent Vitals: {', '.join(vitals[:8])}\n"

        except Exception as e:
            print(f"FHIR context error: {e}")

    return context


# ─────────────────────────────────────────
# POST /api/ai/chat
# Uses Ollama — free, no quota
# ─────────────────────────────────────────
@ai_bp.route("/ai/chat", methods=["POST"])
@token_required
def chat():
    data       = request.json
    message    = data.get("message", "")
    patient_id = request.user.get("patient_id")
    fhir_id    = request.user.get("fhir_id")
    name       = request.user.get("name", "Patient")
    first_name = name.split()[0]

    if not message:
        return jsonify({"error": "Message required"}), 400

    try:
        patient_context = get_patient_context(patient_id, fhir_id, name)

        prompt = f"""You are a helpful AI health assistant for MedCore AI.
The patient's name is {first_name}.

Here is the patient's actual data from their health records:
{patient_context}

Patient's question: {message}

Instructions:
- Answer DIRECTLY using the data above — if they ask about next appointment, tell them the exact date, doctor name, and reason
- Be friendly, warm, and personal — use the patient's first name
- Keep your response to 3-4 sentences maximum
- If the data above clearly shows the answer, give it — do not say you don't have it
- If the data truly does not contain the answer, say so honestly and suggest they check the Appointments section
- Never make up data that is not in the context above
- Never replace doctor advice for medical decisions

Response:"""

        reply = generate_text(prompt)
        return jsonify({"reply": reply}), 200

    except Exception as e:
        print(f"Ollama chat error: {e}")
        return jsonify({
            "reply": "I'm having trouble connecting right now. Please try again in a moment."
        }), 200


# ─────────────────────────────────────────
# GET /api/ai/suggested-questions
# ─────────────────────────────────────────
@ai_bp.route("/ai/suggested-questions", methods=["GET"])
@token_required
def suggested_questions():
    patient_id = request.user.get("patient_id")
    fhir_id    = request.user.get("fhir_id")
    questions  = []

    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM appointments
            WHERE patient_id = %s
              AND status = 'scheduled'
              AND appointment_date > NOW()
        """, (patient_id,))
        upcoming = cur.fetchone()[0]
        if upcoming > 0:
            questions.append("When is my next appointment?")
            questions.append("Which doctor am I seeing next?")
        else:
            questions.append("How do I book an appointment?")
        cur.close()
        conn.close()
    except:
        pass

    if fhir_id:
        try:
            def fetch_fhir(resource_type, param=None):
                if param:
                    url = f"{FHIR_URL}/{resource_type}?{param}={fhir_id}&_count=5"
                else:
                    url = f"{FHIR_URL}/{resource_type}?subject=Patient/{fhir_id}&_count=5"
                r = http_req.get(url, headers={"Accept": "application/fhir+json"}, timeout=8)
                if r.status_code == 200:
                    return r.json().get("entry", [])
                return []

            has_meds       = len(fetch_fhir("MedicationRequest")) > 0
            has_conditions = len(fetch_fhir("Condition")) > 0
            has_vitals     = len(fetch_fhir("Observation")) > 0

            if has_meds:
                questions.append("What medications am I currently taking?")
            if has_conditions:
                questions.append("What does my diagnosis mean?")
            if has_vitals:
                questions.append("Are my vitals in the normal range?")
        except:
            pass

    if len(questions) < 4:
        defaults = [
            "How can I improve my health?",
            "What should I eat to stay healthy?",
            "How much water should I drink daily?",
            "What are my lab results?"
        ]
        for d in defaults:
            if d not in questions:
                questions.append(d)
            if len(questions) >= 4:
                break

    return jsonify({"questions": list(dict.fromkeys(questions))[:4]}), 200


# ─────────────────────────────────────────
# POST /api/ai/copilot
# Uses Ollama — local, free
# ─────────────────────────────────────────
@ai_bp.route("/ai/copilot", methods=["POST"])
@token_required
@role_required(["doctor"])
def copilot():
    data       = request.json
    symptoms   = data.get("symptoms", "")
    patient_id = data.get("patient_id")

    if not symptoms:
        return jsonify({"error": "Symptoms required"}), 400

    patient_context = ""
    if patient_id:
        try:
            conn = get_db()
            cur  = conn.cursor()
            cur.execute("""
                SELECT first_name, last_name,
                       date_of_birth, gender, fhir_id
                FROM patients WHERE patient_id = %s
            """, (patient_id,))
            row = cur.fetchone()
            if row:
                from datetime import date
                age = (date.today() - row[2]).days // 365
                patient_context = f"Patient: {row[0]} {row[1]}, {age}y {row[3]}\n"
                fhir_id = row[4]
                if fhir_id:
                    resp = http_req.get(
                        f"{FHIR_URL}/Patient/{fhir_id}/$everything",
                        headers={"Accept": "application/fhir+json"},
                        timeout=10
                    )
                    if resp.status_code == 200:
                        entries    = resp.json().get("entry", [])
                        conditions = []
                        meds       = []
                        for entry in entries:
                            res   = entry.get("resource", {})
                            rtype = res.get("resourceType", "")
                            if rtype == "Condition":
                                code = res.get("code", {})
                                n    = code.get("text") or code.get("coding", [{}])[0].get("display", "")
                                if n: conditions.append(n)
                            elif rtype == "MedicationRequest":
                                med = res.get("medicationCodeableConcept", {})
                                n   = med.get("text") or med.get("coding", [{}])[0].get("display", "")
                                if n: meds.append(n)
                        if conditions:
                            patient_context += f"Known conditions: {', '.join(conditions)}\n"
                        if meds:
                            patient_context += f"Current medications: {', '.join(meds)}\n"
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Copilot context error: {e}")

    try:
        prompt = f"""You are an AI clinical decision support assistant for MedCore AI.
A doctor is seeking a differential diagnosis.

{patient_context}

Presenting symptoms: {symptoms}

Provide a structured clinical response with:
### Differential Diagnoses
1. Top 3 differential diagnoses with likelihood percentage
2. Key supporting findings for each

### Recommended Investigations
List immediate investigations needed.

### Red Flags
List red flags to watch for.

Keep response concise and clinically focused."""

        reply = generate_text(prompt, temperature=0.3)
        return jsonify({"reply": reply}), 200

    except Exception as e:
        print(f"Copilot error: {e}")
        return jsonify({
            "reply": "AI copilot temporarily unavailable. Please try again."
        }), 200


# ─────────────────────────────────────────
# GET /api/ai/health-summary
# Uses Ollama — free, no quota
# ─────────────────────────────────────────
@ai_bp.route("/ai/health-summary", methods=["GET"])
@token_required
@role_required(["patient"])
def health_summary():
    patient_id = request.user.get("patient_id")
    fhir_id    = request.user.get("fhir_id")
    name       = request.user.get("name", "Patient")
    first_name = name.split()[0]
    context    = get_patient_context(patient_id, fhir_id, name)

    try:
        prompt = f"""You are a caring AI health assistant for {first_name}.

Here is their health data:
{context}

Write a warm, personalised 2-sentence health summary for their dashboard.
- Mention something specific from their actual data (upcoming appointment, medication, diagnosis)
- Be encouraging and positive
- Keep it simple — no medical jargon
- If no data available at all, write a welcoming message

Write only the summary — no labels or prefixes."""

        summary = generate_text(prompt)
        return jsonify({"summary": summary}), 200

    except Exception as e:
        print(f"Ollama health summary error: {e}")
        return jsonify({
            "summary": f"Welcome back, {first_name}! Your health journey is important to us. Book an appointment to get started."
        }), 200


# ─────────────────────────────────────────
# POST /api/ai/explain-lab
# Uses Ollama — free, no quota
# ─────────────────────────────────────────
@ai_bp.route("/ai/explain-lab", methods=["POST"])
@token_required
def explain_lab():
    data  = request.json
    name  = data.get("name", "")
    value = data.get("value", "")
    unit  = data.get("unit", "")

    if not name or not value:
        return jsonify({"error": "Lab name and value required"}), 400

    try:
        prompt = f"""Explain this lab or vital result to a patient in simple, friendly language.

Lab or vital: {name}
Result: {value} {unit}

Normal ranges for reference:
- Heart rate: 60-100 bpm
- Systolic BP: 90-120 mmHg
- Diastolic BP: 60-80 mmHg
- Temperature: 36.1-37.2 Celsius
- Respiratory rate: 12-20 per min
- Oxygen saturation: 95-100 percent

Instructions:
- 2 sentences maximum
- No medical jargon
- Compare to the normal range above
- Be reassuring but honest
- Do not make a diagnosis

Write only the explanation."""

        explanation = generate_text(prompt)
        return jsonify({"explanation": explanation}), 200

    except Exception as e:
        print(f"Ollama lab explain error: {e}")
        return jsonify({
            "explanation": f"Your {name} result is {value} {unit}. Please ask your doctor to explain what this means for your situation."
        }), 200


# ─────────────────────────────────────────
# POST /api/ai/drug-interaction
# Uses Ollama — local, free
# ─────────────────────────────────────────
@ai_bp.route("/ai/drug-interaction", methods=["POST"])
@token_required
def drug_interaction():
    data        = request.json
    medications = data.get("medications", [])

    if len(medications) < 2:
        return jsonify({"interactions": [], "safe": True}), 200

    med_list = ", ".join(medications)

    try:
        prompt = f"""Check for drug interactions between: {med_list}

Respond in JSON format only with no markdown or explanation:
{{
  "safe": true or false,
  "interactions": [
    {{
      "drugs": "Drug A + Drug B",
      "severity": "mild or moderate or severe",
      "description": "brief description"
    }}
  ],
  "summary": "one sentence overall safety summary"
}}

If no interactions found return safe true and empty interactions array.
Return only valid JSON."""

        import json, re
        text   = generate_text(prompt, temperature=0.1)
        text   = re.sub(r'```json|```', '', text).strip()
        result = json.loads(text)
        return jsonify(result), 200

    except Exception as e:
        print(f"Drug interaction error: {e}")
        return jsonify({
            "safe":         True,
            "interactions": [],
            "summary":      "Unable to check interactions at this time."
        }), 200


# ─────────────────────────────────────────
# GET /api/ai/patient-summary/:patient_id
# Provider selected via AI_PROVIDER env var (see ai_client.py) — Ollama
# locally, Gemini in the deployed environment
# ─────────────────────────────────────────
@ai_bp.route("/ai/patient-summary/<int:patient_id>", methods=["GET"])
@token_required
@role_required(["doctor"])
def patient_summary(patient_id):
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT first_name, last_name, date_of_birth,
                   gender, fhir_id
            FROM patients WHERE patient_id = %s
        """, (patient_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Patient not found"}), 404

        from datetime import date
        dob = row[2]
        if dob:
            today = date.today()
            age   = today.year - dob.year - (
                (today.month, today.day) < (dob.month, dob.day)
            )
        else:
            age = 0

        fhir_id = row[4]
        name    = f"{row[0]} {row[1]}"
        context = get_patient_context(patient_id, fhir_id, name)

        prompt = f"""Generate a brief clinical summary for a doctor reviewing this patient.

Patient: {name}, {age}y {row[3]}
{context}

Write a 3-line clinical summary:
Line 1: Patient demographics and primary diagnosis if any
Line 2: Current medications and most recent vitals if available
Line 3: Visit frequency and any notable concerns

Be concise and clinical. If certain data is not available, skip that part."""

        summary = generate_text(prompt)
        return jsonify({"summary": summary}), 200

    except Exception as e:
        print(f"Patient summary error: {e}")
        return jsonify({"summary": "Unable to generate summary at this time."}), 200
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/ai/parse-note
# Ollama NLP: extract diagnoses + medications
# from free-text clinical note
# ─────────────────────────────────────────
@ai_bp.route("/ai/parse-note", methods=["POST"])
@token_required
@role_required(["doctor"])
def parse_note():
    data       = request.json
    note_text  = data.get("note_text", "")
    patient_id = data.get("patient_id")

    if not note_text:
        return jsonify({"error": "Note text required"}), 400

    prompt = f"""You are a clinical NLP system. Extract structured medical data from this doctor's note.

Clinical note:
{note_text}

Extract and return ONLY valid JSON in this exact format — no explanation, no markdown, no extra text:
{{
  "diagnoses": [
    {{"display": "condition name", "icd_code": "ICD-10 code or empty string"}}
  ],
  "medications": [
    {{"name": "drug name", "dosage": "dose or empty string", "frequency": "frequency or empty string"}}
  ]
}}

Rules:
- Only include items explicitly mentioned in the note
- If no diagnoses found, return empty array
- If no medications found, return empty array
- ICD codes optional — leave as empty string if unsure
- Return ONLY the JSON object, nothing else"""

    try:
        raw = generate_text(prompt, temperature=0.1)

        import json, re
        clean = re.sub(r'```json|```', '', raw).strip()
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        if not match:
            raise ValueError("No JSON found in Ollama response")

        parsed      = json.loads(match.group())
        diagnoses   = parsed.get("diagnoses", [])
        medications = parsed.get("medications", [])

        # Write to FHIR if patient_id provided
        fhir_written = {"diagnoses": [], "medications": []}

        if patient_id:
            conn = get_db()
            cur  = conn.cursor()
            try:
                cur.execute(
                    "SELECT fhir_id FROM patients WHERE patient_id = %s",
                    (patient_id,)
                )
                row     = cur.fetchone()
                fhir_id = row[0] if row and row[0] else None

                if fhir_id:
                    from datetime import datetime

                    for dx in diagnoses:
                        try:
                            condition = {
                                "resourceType": "Condition",
                                "subject":      {"reference": f"Patient/{fhir_id}"},
                                "code": {
                                    "text": dx["display"],
                                    "coding": [{
                                        "system":  "http://hl7.org/fhir/sid/icd-10",
                                        "code":    dx.get("icd_code") or "Z99",
                                        "display": dx["display"]
                                    }]
                                },
                                "recordedDate": str(datetime.now().date()),
                                "clinicalStatus": {
                                    "coding": [{
                                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                                        "code":   "active"
                                    }]
                                }
                            }
                            resp = http_req.post(
                                f"{FHIR_URL}/Condition",
                                json=condition,
                                headers={"Content-Type": "application/fhir+json"},
                                timeout=10
                            )
                            if resp.status_code in [200, 201]:
                                fhir_written["diagnoses"].append(dx["display"])
                        except Exception as fe:
                            print(f"FHIR condition write error: {fe}")

                    for med in medications:
                        try:
                            med_display = f"{med['name']} {med.get('dosage','')} {med.get('frequency','')}".strip()
                            medication  = {
                                "resourceType": "MedicationRequest",
                                "status":       "active",
                                "intent":       "order",
                                "subject":      {"reference": f"Patient/{fhir_id}"},
                                "medicationCodeableConcept": {
                                    "text":   med_display,
                                    "coding": [{"display": med["name"]}]
                                },
                                "authoredOn":        str(datetime.now().date()),
                                "dosageInstruction": [{"text": f"{med.get('dosage','')} {med.get('frequency','')}".strip()}]
                            }
                            resp = http_req.post(
                                f"{FHIR_URL}/MedicationRequest",
                                json=medication,
                                headers={"Content-Type": "application/fhir+json"},
                                timeout=10
                            )
                            if resp.status_code in [200, 201]:
                                fhir_written["medications"].append(med["name"])
                        except Exception as fe:
                            print(f"FHIR medication write error: {fe}")

            finally:
                cur.close()
                conn.close()

        return jsonify({
            "diagnoses":    diagnoses,
            "medications":  medications,
            "fhir_written": fhir_written,
            "message":      f"Extracted {len(diagnoses)} diagnosis/diagnoses and {len(medications)} medication(s)"
        }), 200

    except Exception as e:
        print(f"Ollama parse-note error: {e}")
        return jsonify({
            "diagnoses":    [],
            "medications":  [],
            "fhir_written": {"diagnoses": [], "medications": []},
            "message":      "Could not parse note automatically. Please add diagnoses and medications manually."
        }), 200


# ─────────────────────────────────────────
# POST /api/ai/suggest-specialty
# Patient describes symptoms in plain language, AI suggests which
# specialty (from the doctors actually on the platform) fits best.
# ─────────────────────────────────────────
@ai_bp.route("/ai/suggest-specialty", methods=["POST"])
@token_required
@role_required(["patient"])
def suggest_specialty():
    data     = request.json
    symptoms = (data.get("symptoms") or "").strip()

    if not symptoms:
        return jsonify({"error": "Please describe your symptoms"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        # Canonical list from the specialties table, not just whatever
        # values happen to already be on a doctor row — guarantees the
        # AI can never suggest a specialty that isn't a real, active one.
        cur.execute("SELECT name FROM specialties WHERE is_active ORDER BY name")
        specialties = [r[0] for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()

    if not specialties:
        return jsonify({"specialty": None, "reason": "No specialties available right now."}), 200

    specialty_list = ", ".join(specialties)
    fallback_specialty = next((s for s in specialties if s.lower() == "general medicine"), specialties[0])

    prompt = f"""A patient describes their symptoms below. You must pick exactly one
specialty from this list — no other specialty exists on this platform:
{specialty_list}

Patient's symptoms: {symptoms}

Rules:
- Always pick one specialty from the list above, even if the match is only
  approximate. If truly nothing fits well, pick "{fallback_specialty}" as a
  safe general first opinion.
- Never invent a specialty that isn't in the list.
- Do not diagnose.

Respond with ONLY valid JSON, no markdown, no extra text, in this exact shape:
{{"specialty": "<one specialty name from the list above, exactly as written>", "reason": "<one short, friendly sentence explaining why>"}}"""

    try:
        raw = generate_text(prompt, temperature=0.2)

        import json, re
        clean = re.sub(r'```json|```', '', raw).strip()
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

        picked = str(parsed.get("specialty") or "").strip()
        reason = str(parsed.get("reason") or "").strip()

        # Exact match first, then a loose substring match either direction
        # (covers minor model drift like "General Medicine Physician")
        matched = next((s for s in specialties if s.lower() == picked.lower()), None)
        if not matched and picked:
            matched = next(
                (s for s in specialties if s.lower() in picked.lower() or picked.lower() in s.lower()),
                None
            )
        # The model ignored the JSON instruction entirely — fall back to
        # scanning the raw text for any known specialty name before giving up.
        if not matched:
            matched = next((s for s in specialties if s.lower() in raw.lower()), None)
        if not matched:
            matched = fallback_specialty

        return jsonify({"specialty": matched, "reason": reason or raw.strip()[:200]}), 200

    except Exception as e:
        print(f"Suggest-specialty error: {e}")
        return jsonify({
            "specialty": fallback_specialty,
            "reason":    "Unable to fully analyze your symptoms right now, so we've pointed you to a general doctor as a safe first opinion."
        }), 200