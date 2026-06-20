from flask import Blueprint, request, jsonify
from middleware.auth import token_required, role_required
from db import get_db
from google import genai
import requests as http_req
import os
from dotenv import load_dotenv

load_dotenv()
FHIR_URL = os.getenv("FHIR_BASE_URL")

ai_bp = Blueprint("ai", __name__)


def get_gemini_client():
    return genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def get_patient_context(patient_id, fhir_id, name):
    context = f"Patient Name: {name}\n"

    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT a.appointment_date, a.status, a.reason,
                   d.first_name || ' ' || d.last_name,
                   d.specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE a.patient_id = %s
            ORDER BY a.appointment_date DESC
            LIMIT 5
        """, (patient_id,))
        rows = cur.fetchall()
        if rows:
            context += "\nAppointments:\n"
            for r in rows:
                context += f"  - {r[3]} ({r[4]}) on {str(r[0])[:10]} — Status: {r[1]}, Reason: {r[2]}\n"
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Neon context error: {e}")

    if fhir_id:
        try:
            resp = http_req.get(
                f"{FHIR_URL}/Patient/{fhir_id}/$everything",
                headers={"Accept": "application/fhir+json"},
                timeout=10
            )
            if resp.status_code == 200:
                entries     = resp.json().get("entry", [])
                conditions  = []
                medications = []
                vitals      = []

                for entry in entries:
                    res   = entry.get("resource", {})
                    rtype = res.get("resourceType", "")

                    if rtype == "Condition":
                        code     = res.get("code", {})
                        name_val = code.get("text") or \
                                   code.get("coding", [{}])[0].get("display", "")
                        if name_val:
                            conditions.append(name_val)

                    elif rtype == "MedicationRequest":
                        med      = res.get("medicationCodeableConcept", {})
                        med_name = med.get("text") or \
                                   med.get("coding", [{}])[0].get("display", "")
                        status   = res.get("status", "")
                        if med_name:
                            medications.append(f"{med_name} ({status})")

                    elif rtype == "Observation":
                        code     = res.get("code", {})
                        value    = res.get("valueQuantity", {})
                        obs_name = code.get("text") or \
                                   code.get("coding", [{}])[0].get("display", "")
                        obs_val  = value.get("value", "")
                        obs_unit = value.get("unit", "")
                        if obs_name and obs_val:
                            vitals.append(f"{obs_name}: {obs_val} {obs_unit}")

                if conditions:
                    context += f"\nDiagnoses: {', '.join(conditions)}\n"
                if medications:
                    context += f"\nMedications: {', '.join(medications)}\n"
                if vitals:
                    context += f"\nVitals/Labs: {', '.join(vitals[:10])}\n"

        except Exception as e:
            print(f"FHIR context error: {e}")

    return context


# ─────────────────────────────────────────
# POST /api/ai/chat
# ─────────────────────────────────────────
@ai_bp.route("/ai/chat", methods=["POST"])
@token_required
def chat():
    data       = request.json
    message    = data.get("message", "")
    patient_id = request.user.get("patient_id")
    fhir_id    = request.user.get("fhir_id")
    name       = request.user.get("name", "Patient")

    if not message:
        return jsonify({"error": "Message required"}), 400

    try:
        patient_context = get_patient_context(patient_id, fhir_id, name)
        client = get_gemini_client()

        prompt = f"""You are a helpful AI health assistant for MedCore AI.

Here is the patient's actual health data:
{patient_context}

Patient's question: {message}

Instructions:
- Answer based on the patient's ACTUAL data above
- Be friendly, clear, and simple
- Keep response to 3-4 sentences maximum
- If data is not available for the question, say so honestly
- Never make specific diagnoses or replace doctor advice
- Be empathetic and supportive

Response:"""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return jsonify({"reply": response.text}), 200

    except Exception as e:
        print(f"Gemini chat error: {e}")
        return jsonify({
            "reply": "I'm having trouble connecting right now. Please try again shortly."
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
            WHERE patient_id = %s AND status = 'scheduled'
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
            resp = http_req.get(
                f"{FHIR_URL}/Patient/{fhir_id}/$everything",
                headers={"Accept": "application/fhir+json"},
                timeout=8
            )
            if resp.status_code == 200:
                entries = resp.json().get("entry", [])
                types   = [e.get("resource", {}).get("resourceType") for e in entries]

                if "MedicationRequest" in types:
                    questions.append("What medications am I currently taking?")
                    questions.append("Are there any side effects I should watch for?")
                if "Condition" in types:
                    questions.append("What does my diagnosis mean?")
                    questions.append("How can I manage my condition better?")
                if "Observation" in types:
                    questions.append("Are my vitals in the normal range?")
                    questions.append("What do my lab results mean?")
        except:
            pass

    if len(questions) < 3:
        questions += [
            "How can I improve my health?",
            "What should I eat to stay healthy?",
            "How much water should I drink daily?",
        ]

    return jsonify({"questions": list(dict.fromkeys(questions))[:4]}), 200


# ─────────────────────────────────────────
# POST /api/ai/copilot
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
                        entries     = resp.json().get("entry", [])
                        conditions  = []
                        medications = []
                        for entry in entries:
                            res   = entry.get("resource", {})
                            rtype = res.get("resourceType", "")
                            if rtype == "Condition":
                                code = res.get("code", {})
                                n    = code.get("text") or \
                                       code.get("coding", [{}])[0].get("display", "")
                                if n: conditions.append(n)
                            elif rtype == "MedicationRequest":
                                med = res.get("medicationCodeableConcept", {})
                                n   = med.get("text") or \
                                      med.get("coding", [{}])[0].get("display", "")
                                if n: medications.append(n)
                        if conditions:
                            patient_context += f"Conditions: {', '.join(conditions)}\n"
                        if medications:
                            patient_context += f"Medications: {', '.join(medications)}\n"
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Copilot context error: {e}")

    try:
        client = get_gemini_client()
        prompt = f"""You are an AI clinical decision support assistant for MedCore AI.
A doctor is seeking a differential diagnosis.

{patient_context}

Presenting symptoms: {symptoms}

Provide a structured clinical response with:
1. Top 3 differential diagnoses with likelihood percentage
2. Key supporting findings for each
3. Recommended immediate investigations
4. Red flags to watch for

Keep response concise and clinically focused.
Format clearly with sections."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return jsonify({"reply": response.text}), 200

    except Exception as e:
        print(f"Copilot error: {e}")
        return jsonify({
            "reply": "AI copilot temporarily unavailable. Please try again."
        }), 200


# ─────────────────────────────────────────
# GET /api/ai/health-summary
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
        client = get_gemini_client()
        prompt = f"""You are a caring AI health assistant for {first_name}.

Here is their health data:
{context}

Write a warm, personalised 2-sentence health summary for their dashboard.
- Mention something specific from their actual data
- Be encouraging and positive
- Keep it simple — no medical jargon
- If no data available, write a welcoming message

Write only the summary — no labels or prefixes."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return jsonify({"summary": response.text.strip()}), 200

    except Exception as e:
        print(f"Health summary error: {e}")
        return jsonify({
            "summary": f"Welcome back, {first_name}! Your health journey is important to us. Book an appointment to keep your health on track."
        }), 200


# ─────────────────────────────────────────
# POST /api/ai/explain-lab
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
        client = get_gemini_client()
        prompt = f"""Explain this lab/vital result to a patient in simple, friendly language.

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
- Compare to normal range above
- Be reassuring but honest
- Do not make a diagnosis

Write only the explanation."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return jsonify({"explanation": response.text.strip()}), 200

    except Exception as e:
        print(f"Lab explain error: {e}")
        return jsonify({
            "explanation": f"Your {name} result is {value} {unit}. Please ask your doctor to explain what this means for your situation."
        }), 200


# ─────────────────────────────────────────
# POST /api/ai/drug-interaction
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
        client = get_gemini_client()
        prompt = f"""Check for drug interactions between these medications: {med_list}

Respond in JSON format only:
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
Return only valid JSON with no markdown."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        import json, re
        text   = response.text.strip()
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
        client  = get_gemini_client()

        prompt = f"""Generate a brief clinical summary for a doctor.

Patient: {name}, {age}y {row[3]}
{context}

Write a 3-line clinical summary:
Line 1: Demographics and primary diagnosis
Line 2: Current medications and recent vitals if available
Line 3: Visit frequency and any notable concerns

Be concise and clinical."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return jsonify({"summary": response.text.strip()}), 200

    except Exception as e:
        print(f"Patient summary error: {e}")
        return jsonify({"summary": "Unable to generate summary at this time."}), 200
    finally:
        cur.close()
        conn.close()