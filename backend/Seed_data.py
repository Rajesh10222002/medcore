"""
MedCore AI — Full Database Seed Script
Clears existing data and inserts realistic dummy data for ML training
Run: python seed_data.py
"""

import psycopg2
import bcrypt
import random
import uuid
from datetime import datetime, date, timedelta
from dotenv import load_dotenv
import os

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

# ── Indian names pool ─────────────────────────────────────────────────────────
FIRST_NAMES_M = [
    "Arjun","Vikram","Rahul","Suresh","Anil","Ravi","Karthik","Deepak",
    "Sanjay","Mahesh","Rajesh","Pradeep","Venkat","Ganesh","Ramesh",
    "Anand","Dinesh","Sunil","Ajay","Vijay","Arun","Naveen","Praveen",
    "Harish","Girish","Mohan","Gopal","Ashok","Satish","Naresh",
    "Balaji","Murali","Sridhar","Krishnan","Senthil","Manoj","Nikhil",
    "Rohan","Varun","Tarun","Shiva","Prasad","Srikanth","Santosh","Pratap",
    "Balachandar","Selvam","Murugan","Kumaran","Durai"
]

FIRST_NAMES_F = [
    "Priya","Anitha","Lakshmi","Meena","Kavitha","Sangeetha","Divya",
    "Nithya","Revathi","Padma","Usha","Vijaya","Malathi","Radha","Geetha",
    "Rekha","Sujatha","Kamala","Nalini","Bharathi","Saranya","Deepa",
    "Archana","Sowmya","Lavanya","Aishwarya","Hema","Jaya","Suganya",
    "Ranjitha","Kiruthiga","Nivetha","Pooja","Sneha","Madhuri","Swathi",
    "Keerthana","Brindha","Mythili","Janani","Vasantha","Lalitha","Sumathi",
    "Chandra","Parvathi","Saraswathi","Ambika","Nandita","Vimala","Meenakshi"
]

LAST_NAMES = [
    "Kumar","Sharma","Patel","Reddy","Nair","Pillai","Iyer","Rao",
    "Krishnan","Murugan","Selvam","Rajan","Venkatesh","Subramaniam",
    "Natarajan","Sundaram","Balakrishnan","Ramaswamy","Annamalai",
    "Chandrasekaran","Govindarajan","Sivasubramanian","Ramachandran",
    "Narayanan","Venkatesan","Muthuswamy","Palaniswamy","Dhandapani",
    "Arunachalam","Rajagopal","Balasubramanian","Thirumalai","Annamalai",
    "Devarajan","Sureshkumar","Jayaraman","Manoharan","Periyasamy",
    "Somasundaram","Radhakrishnan","Palanisamy","Kathirvel","Duraisamy",
    "Thiagarajan","Muthukumar","Ganesan","Arumugam","Shanmugam","Rajendran"
]

SPECIALIZATIONS = [
    "General Medicine",
    "Cardiology",
    "Dermatology",
    "Orthopedics",
    "Pediatrics",
    "Neurology",
    "Gynecology",
    "Psychiatry",
]

REASONS = [
    "Fever and cold","Headache","Back pain","Chest pain","Skin rash",
    "Stomach ache","Knee pain","Cough","Shortness of breath","Dizziness",
    "Fatigue","Joint pain","High blood pressure","Diabetes follow-up",
    "Anxiety and stress","Sleep problems","Weight management","Migraine",
    "Allergy consultation","Routine checkup","Eye strain","Neck pain",
    "Muscle cramps","Palpitations","Vomiting","Ear pain","Throat infection",
    "Urinary issues","Numbness in hands","Follow-up visit"
]

STATUSES = ["scheduled", "completed", "cancelled"]
STATUS_WEIGHTS = [0.25, 0.55, 0.20]  # realistic distribution

FEEDBACK_COMMENTS = [
    "Very thorough and explained everything clearly.",
    "Short wait time, doctor was attentive.",
    "Helped resolve my issue quickly.",
    "Great bedside manner, would recommend.",
    "Listened carefully to my concerns.",
    "Prescribed medication worked well.",
    "Clear instructions for follow-up care.",
    "Answered all my questions patiently.",
    "Felt rushed, but the advice was useful.",
    "Waited a while past my slot, otherwise fine.",
    None, None, None,  # some ratings are submitted with no comment
]
FEEDBACK_RATINGS       = [5, 4, 3, 2, 1]
FEEDBACK_RATING_WEIGHTS = [0.40, 0.30, 0.15, 0.10, 0.05]  # mostly positive

REFERRAL_REASONS = [
    "Elevated blood pressure on repeat visits, recommend specialist workup",
    "Persistent symptoms not resolving with current treatment",
    "Requires specialized diagnostic evaluation",
    "Patient history suggests need for expert consultation",
    "Abnormal test results warrant further specialist review",
    "Chronic condition management needs specialist input",
    "Symptoms outside my specialty's scope, referring for expert opinion",
]
REFERRAL_STATUSES = ["pending", "pending", "accepted", "accepted", "completed", "declined"]

def random_phone():
    return f"+91{random.randint(7000000000, 9999999999)}"

def random_dob(min_age=18, max_age=75):
    days = random.randint(min_age * 365, max_age * 365)
    return (date.today() - timedelta(days=days)).strftime("%Y-%m-%d")

def hash_password(pwd):
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()

HISTORY_START = date(2023, 1, 1)  # multi-year history for YoY reporting

def random_appointment_date(status):
    today = date.today()
    if status == "scheduled":
        # Future — next 2 months
        days_ahead = random.randint(1, 60)
        d = today + timedelta(days=days_ahead)
    else:
        # Past — spread across the full history window, not just recent months,
        # so year-over-year comparisons have real prior-year data to compare against
        span_days = (today - HISTORY_START).days
        days_ago  = random.randint(1, span_days)
        d = today - timedelta(days=days_ago)
    # Only weekdays
    while d.weekday() >= 5:
        d += timedelta(days=1)
    # Random slot between 9am and 5pm
    hour   = random.choice([9,9,10,10,11,11,14,14,15,15,16])
    minute = random.choice([0, 30])
    return datetime(d.year, d.month, d.day, hour, minute)

def random_historical_datetime():
    """Not tied to a specific appointment — used for referrals, which aren't
    appointment-linked. Spread evenly across the same history window."""
    today = date.today()
    span_days = (today - HISTORY_START).days
    days_ago  = random.randint(0, span_days)
    d = today - timedelta(days=days_ago)
    hour   = random.randint(8, 17)
    minute = random.choice([0, 15, 30, 45])
    return datetime(d.year, d.month, d.day, hour, minute)

print("=" * 60)
print("  MedCore AI — Database Seed Script")
print("=" * 60)
print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("-" * 60)

conn = psycopg2.connect(DB_URL)
cur  = conn.cursor()

try:
    # ── STEP 1: Ensure admins table + demo admin account exist ─────
    # `admins` was previously created out-of-band directly in Neon —
    # not reproducible on a fresh database. Idempotent: never touches
    # an admin account that already exists.
    print("\n[1/8] Ensuring admins table + demo admin account...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            admin_id   SERIAL PRIMARY KEY,
            user_id    INTEGER REFERENCES users(user_id),
            name       VARCHAR,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()

    cur.execute("SELECT user_id FROM users WHERE email = %s", ("admin@medcore.ai",))
    row = cur.fetchone()
    if row:
        admin_user_id = row[0]
    else:
        pwd_hash = hash_password("admin123")
        cur.execute(
            "INSERT INTO users (email, password_hash, role) VALUES (%s,%s,'admin') RETURNING user_id",
            ("admin@medcore.ai", pwd_hash)
        )
        admin_user_id = cur.fetchone()[0]

    cur.execute("SELECT admin_id FROM admins WHERE user_id = %s", (admin_user_id,))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO admins (user_id, name) VALUES (%s, %s)",
            (admin_user_id, "Administrator")
        )
    conn.commit()
    print("  admins table ready, demo admin account confirmed")

    # ── STEP 2: Ensure lookup/feature tables exist ──────────────────
    # specialties, appointment_types, patient_feedback, referrals —
    # see zlocal/NEW_TABLES_SPEC.md. Idempotent: CREATE TABLE IF NOT
    # EXISTS + ON CONFLICT DO NOTHING, safe to re-run against a DB
    # that already has data.
    print("\n[2/8] Ensuring specialties, appointment_types, patient_feedback, referrals...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS specialties (
            specialty_id   SERIAL PRIMARY KEY,
            name           VARCHAR UNIQUE NOT NULL,
            description    TEXT,
            is_active      BOOLEAN DEFAULT TRUE
        )
    """)
    for name in SPECIALIZATIONS:
        cur.execute(
            "INSERT INTO specialties (name) VALUES (%s) ON CONFLICT (name) DO NOTHING",
            (name,)
        )

    cur.execute("""
        CREATE TABLE IF NOT EXISTS appointment_types (
            type_id        SERIAL PRIMARY KEY,
            name           VARCHAR UNIQUE NOT NULL,
            duration_mins  INTEGER DEFAULT 30,
            is_active      BOOLEAN DEFAULT TRUE
        )
    """)
    for name, duration in [("In-Person", 30), ("Video Consultation", 20)]:
        cur.execute(
            "INSERT INTO appointment_types (name, duration_mins) VALUES (%s, %s) ON CONFLICT (name) DO NOTHING",
            (name, duration)
        )
    cur.execute("""
        ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES appointment_types(type_id)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS patient_feedback (
            feedback_id     SERIAL PRIMARY KEY,
            appointment_id  INTEGER NOT NULL REFERENCES appointments(appointment_id),
            patient_id      INTEGER NOT NULL REFERENCES patients(patient_id),
            doctor_id       INTEGER NOT NULL REFERENCES doctors(doctor_id),
            rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
            comment         TEXT,
            created_at      TIMESTAMP DEFAULT NOW()
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS referrals (
            referral_id           SERIAL PRIMARY KEY,
            patient_id            INTEGER NOT NULL REFERENCES patients(patient_id),
            referring_doctor_id   INTEGER NOT NULL REFERENCES doctors(doctor_id),
            referred_to_doctor_id INTEGER NOT NULL REFERENCES doctors(doctor_id),
            reason                TEXT,
            status                VARCHAR DEFAULT 'pending',
            decline_reason        TEXT,
            created_at            TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS decline_reason TEXT")
    conn.commit()
    print("  specialties, appointment_types, patient_feedback, referrals ready")

    # ── STEP 3: Clear existing data ───────────────────────────────
    print("\n[3/8] Clearing existing data...")
    cur.execute("DELETE FROM patient_feedback")
    cur.execute("DELETE FROM referrals")
    cur.execute("DELETE FROM doctor_leaves")
    cur.execute("DELETE FROM appointments")
    cur.execute("DELETE FROM clinical_notes")
    cur.execute("DELETE FROM ai_predictions")
    cur.execute("DELETE FROM doctor_schedules")
    cur.execute("DELETE FROM doctors WHERE user_id IN (SELECT user_id FROM users WHERE role='doctor')")
    cur.execute("DELETE FROM patients WHERE user_id IN (SELECT user_id FROM users WHERE role='patient')")
    cur.execute("DELETE FROM users WHERE role IN ('doctor','patient')")
    conn.commit()
    print("  Cleared all existing patients, doctors, appointments")

    # ── STEP 4: Create doctors (20) ───────────────────────────────
    print("\n[4/8] Creating 20 doctors...")
    doctor_ids = []
    used_emails = set()

    # Fixed demo doctors with known credentials
    DEMO_DOCTORS = [
        {"first_name": "Priya",   "last_name": "Sharma",  "specialization": "General Medicine", "email": "doctor@medcore.ai",  "password": "admin123"},
        {"first_name": "Rajkumar","last_name": "Nair",    "specialization": "Cardiology",        "email": "doctor2@medcore.ai", "password": "admin123"},
    ]
    for d in DEMO_DOCTORS:
        used_emails.add(d["email"])
        fhir_id  = str(uuid.uuid4())
        pwd_hash = hash_password(d["password"])
        cur.execute("INSERT INTO users (email, password_hash, role) VALUES (%s,%s,'doctor') RETURNING user_id",
                    (d["email"], pwd_hash))
        user_id = cur.fetchone()[0]
        cur.execute("""
            INSERT INTO doctors (user_id, first_name, last_name, specialization,
             license_number, phone, email, fhir_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING doctor_id
        """, (user_id, d["first_name"], d["last_name"], d["specialization"],
              f"MCI{random.randint(10000,99999)}A", random_phone(), d["email"], fhir_id))
        doctor_id = cur.fetchone()[0]
        doctor_ids.append(doctor_id)
        for day in range(5):
            cur.execute("INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration) VALUES (%s,%s,'09:00','17:00',30)",
                        (doctor_id, day))
        print(f"  [DEMO] Dr. {d['first_name']} {d['last_name']} → {d['email']} / {d['password']}")

    for i in range(20):
        gender     = random.choice(["male", "female"])
        first_name = random.choice(FIRST_NAMES_M if gender == "male" else FIRST_NAMES_F)
        last_name  = random.choice(LAST_NAMES)
        spec       = SPECIALIZATIONS[i % len(SPECIALIZATIONS)]
        email      = f"dr.{first_name.lower()}.{last_name.lower()}{i}@medcore.ai"
        while email in used_emails:
            email = f"dr.{first_name.lower()}.{last_name.lower()}{i}{random.randint(1,99)}@medcore.ai"
        used_emails.add(email)
        phone      = random_phone()
        license_no = f"MCI{random.randint(10000,99999)}{chr(65+i%26)}"
        fhir_id    = str(uuid.uuid4())
        pwd_hash   = hash_password("Doctor@123")

        # users row
        cur.execute("""
            INSERT INTO users (email, password_hash, role)
            VALUES (%s, %s, 'doctor') RETURNING user_id
        """, (email, pwd_hash))
        user_id = cur.fetchone()[0]

        # doctors row
        cur.execute("""
            INSERT INTO doctors
            (user_id, first_name, last_name, specialization,
             license_number, phone, email, fhir_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING doctor_id
        """, (user_id, first_name, last_name, spec,
              license_no, phone, email, fhir_id))
        doctor_id = cur.fetchone()[0]
        doctor_ids.append(doctor_id)

        # doctor_schedules Mon-Fri 9-5
        for day in range(5):
            cur.execute("""
                INSERT INTO doctor_schedules
                (doctor_id, day_of_week, start_time, end_time, slot_duration)
                VALUES (%s,%s,'09:00','17:00',30)
            """, (doctor_id, day))

        print(f"  Dr. {first_name} {last_name} ({spec})")

    conn.commit()
    print(f"  Created {len(doctor_ids)} doctors with schedules")

    # ── STEP 5: Create patients (200) ────────────────────────────
    print("\n[5/8] Creating 200 patients...")
    patient_ids = []
    used_emails_p = set()

    # Fixed demo patients with known credentials
    DEMO_PATIENTS = [
        {"first_name": "Rajesh",  "last_name": "Natarajan", "email": "patient@medcore.ai",  "password": "admin123",  "gender": "male",   "dob": "1999-02-16"},
        {"first_name": "Preethi", "last_name": "Rajan",     "email": "patient2@medcore.ai", "password": "admin123",  "gender": "female", "dob": "1995-06-20"},
    ]
    for p in DEMO_PATIENTS:
        used_emails_p.add(p["email"])
        fhir_id  = str(uuid.uuid4())
        pwd_hash = hash_password(p["password"])
        cur.execute("INSERT INTO users (email, password_hash, role) VALUES (%s,%s,'patient') RETURNING user_id",
                    (p["email"], pwd_hash))
        user_id = cur.fetchone()[0]
        cur.execute("""
            INSERT INTO patients (user_id, first_name, last_name, date_of_birth,
             gender, phone, email, fhir_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING patient_id
        """, (user_id, p["first_name"], p["last_name"], p["dob"],
              p["gender"], random_phone(), p["email"], fhir_id))
        patient_id = cur.fetchone()[0]
        patient_ids.append(patient_id)
        print(f"  [DEMO] {p['first_name']} {p['last_name']} → {p['email']} / {p['password']}")

    for i in range(200):
        gender     = random.choice(["male", "female"])
        first_name = random.choice(FIRST_NAMES_M if gender == "male" else FIRST_NAMES_F)
        last_name  = random.choice(LAST_NAMES)
        email      = f"{first_name.lower()}.{last_name.lower()}{i}@gmail.com"
        while email in used_emails_p:
            email = f"{first_name.lower()}.{last_name.lower()}{i}{random.randint(1,99)}@gmail.com"
        used_emails_p.add(email)
        phone      = random_phone()
        dob        = random_dob()
        fhir_id    = str(uuid.uuid4())
        pwd_hash   = hash_password("Patient@123")

        # users row
        cur.execute("""
            INSERT INTO users (email, password_hash, role)
            VALUES (%s,%s,'patient') RETURNING user_id
        """, (email, pwd_hash))
        user_id = cur.fetchone()[0]

        # patients row
        cur.execute("""
            INSERT INTO patients
            (user_id, first_name, last_name, date_of_birth,
             gender, phone, email, fhir_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING patient_id
        """, (user_id, first_name, last_name, dob,
              gender, phone, email, fhir_id))
        patient_id = cur.fetchone()[0]
        patient_ids.append(patient_id)

    conn.commit()
    print(f"  Created {len(patient_ids)} patients")

    # ── STEP 6: Create appointments — near-term scheduled + multi-year history ──
    # Scheduled (future) appointments stay a realistic near-term booking volume.
    # Completed/cancelled appointments are scaled up and spread from HISTORY_START
    # to today, so each year has comparable density for YoY reporting.
    FUTURE_COUNT = 150
    PAST_COUNT   = 2850
    PAST_STATUSES = ["completed", "cancelled"]
    PAST_WEIGHTS  = [0.55 / 0.75, 0.20 / 0.75]  # same relative mix as before, renormalized

    print(f"\n[6/8] Creating {FUTURE_COUNT} scheduled + {PAST_COUNT} historical appointments "
          f"({HISTORY_START.isoformat()} to today)...")
    appt_count = 0
    used_slots  = set()

    def insert_appointment(patient_id, doctor_id, appt_date, status, reason, no_show_risk):
        slot_key = (doctor_id, appt_date.strftime("%Y-%m-%d %H:%M"))
        if slot_key in used_slots:
            return False
        used_slots.add(slot_key)
        cur.execute("""
            INSERT INTO appointments
            (patient_id, doctor_id, appointment_date,
             status, reason, no_show_risk)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (patient_id, doctor_id, appt_date,
              status, reason, no_show_risk))
        return True

    for _ in range(FUTURE_COUNT):
        patient_id = random.choice(patient_ids)
        doctor_id  = random.choice(doctor_ids)
        reason     = random.choice(REASONS)
        appt_date  = random_appointment_date("scheduled")
        no_show_risk = round(random.uniform(5.0, 85.0), 1)
        if insert_appointment(patient_id, doctor_id, appt_date, "scheduled", reason, no_show_risk):
            appt_count += 1

    for _ in range(PAST_COUNT):
        patient_id = random.choice(patient_ids)
        doctor_id  = random.choice(doctor_ids)
        status     = random.choices(PAST_STATUSES, PAST_WEIGHTS)[0]
        reason     = random.choice(REASONS)
        appt_date  = random_appointment_date(status)
        no_show_risk = round(random.uniform(5.0, 85.0), 1)
        if insert_appointment(patient_id, doctor_id, appt_date, status, reason, no_show_risk):
            appt_count += 1

    conn.commit()
    print(f"  Created {appt_count} appointments")

    # ── STEP 7: Create doctor leaves (60) ────────────────────────
    print("\n[7/8] Creating doctor leave records...")
    leave_count = 0
    today = date.today()

    for doctor_id in random.sample(doctor_ids, 15):
        # 2-4 leaves per doctor
        for _ in range(random.randint(2, 4)):
            days_offset  = random.randint(-30, 60)
            leave_date   = today + timedelta(days=days_offset)
            # Skip weekends
            while leave_date.weekday() >= 5:
                leave_date += timedelta(days=1)

            block_type = random.choice(["full_day","full_day","hourly"])
            if block_type == "hourly":
                start_h = random.choice([9,10,11,14,15])
                end_h   = start_h + random.choice([1,2])
                cur.execute("""
                    INSERT INTO doctor_leaves
                    (doctor_id, leave_date, block_type,
                     block_start, block_end, reason)
                    VALUES (%s,%s,'hourly',%s,%s,%s)
                """, (doctor_id, leave_date,
                      f"{start_h:02d}:00", f"{end_h:02d}:00",
                      random.choice(["Personal work","Meeting","Training"])))
            else:
                cur.execute("""
                    INSERT INTO doctor_leaves
                    (doctor_id, leave_date, block_type, reason)
                    VALUES (%s,%s,'full_day',%s)
                """, (doctor_id, leave_date,
                      random.choice(["Personal","Medical","Conference","Holiday"])))
            leave_count += 1

    conn.commit()
    print(f"  Created {leave_count} leave records")

    # ── STEP 8: Seed sample patient feedback + referrals (demo data) ──
    print("\n[8/8] Seeding sample patient feedback + referrals...")

    cur.execute("SELECT appointment_id, patient_id, doctor_id, appointment_date FROM appointments WHERE status = 'completed'")
    completed_appts = cur.fetchall()

    # Feedback timestamps are tied to the actual appointment date (patients rate
    # shortly after their visit) rather than DEFAULT NOW(), so ratings spread
    # across the same multi-year history as the appointments themselves.
    feedback_count = 0
    sample_size = min(1200, len(completed_appts))
    for appt_id, patient_id, doctor_id, appt_date in random.sample(completed_appts, sample_size):
        rating   = random.choices(FEEDBACK_RATINGS, FEEDBACK_RATING_WEIGHTS)[0]
        comment  = random.choice(FEEDBACK_COMMENTS)
        feedback_created_at = appt_date + timedelta(days=random.randint(0, 3))
        cur.execute("""
            INSERT INTO patient_feedback (appointment_id, patient_id, doctor_id, rating, comment, created_at)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (appt_id, patient_id, doctor_id, rating, comment, feedback_created_at))
        feedback_count += 1
    conn.commit()
    print(f"  Created {feedback_count} patient feedback ratings")

    # Referrals aren't appointment-linked, so their history is spread evenly
    # across the same HISTORY_START-to-today window independently.
    referral_count = 0
    for _ in range(125):
        patient_id                     = random.choice(patient_ids)
        referring_id, referred_to_id   = random.sample(doctor_ids, 2)
        reason                         = random.choice(REFERRAL_REASONS)
        status                         = random.choice(REFERRAL_STATUSES)
        referral_created_at            = random_historical_datetime()
        cur.execute("""
            INSERT INTO referrals (patient_id, referring_doctor_id, referred_to_doctor_id, reason, status, created_at)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (patient_id, referring_id, referred_to_id, reason, status, referral_created_at))
        referral_count += 1
    conn.commit()
    print(f"  Created {referral_count} referrals")

    # ── SUMMARY ──────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  SEED COMPLETE — MedCore AI")
    print("=" * 60)

    cur.execute("SELECT COUNT(*) FROM users WHERE role='doctor'")
    print(f"  Doctors     : {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM users WHERE role='patient'")
    print(f"  Patients    : {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM appointments")
    print(f"  Appointments: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM doctor_leaves")
    print(f"  Leave records: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM patient_feedback")
    print(f"  Feedback ratings: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM referrals")
    print(f"  Referrals   : {cur.fetchone()[0]}")
    cur.execute("SELECT status, COUNT(*) FROM appointments GROUP BY status ORDER BY status")
    print("  Appointment breakdown:")
    for row in cur.fetchall():
        print(f"    {row[0]:<12} {row[1]}")
    print("=" * 60)
    print(f"  Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n  Demo login credentials:")
    print("  ─" * 30)
    print("  ADMIN   : admin@medcore.ai      / admin123")
    print("  DOCTOR  : doctor@medcore.ai     / admin123  (Dr. Priya Sharma — General Medicine)")
    print("  DOCTOR  : doctor2@medcore.ai    / admin123  (Dr. Rajkumar Nair — Cardiology)")
    print("  PATIENT : patient@medcore.ai    / admin123  (Rajesh Natarajan)")
    print("  PATIENT : patient2@medcore.ai   / admin123  (Preethi Rajan)")

except Exception as e:
    conn.rollback()
    print(f"\nERROR: {e}")
    raise
finally:
    cur.close()
    conn.close()