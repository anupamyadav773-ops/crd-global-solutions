import json
from flask import Blueprint, request, jsonify, g

solar_bp = Blueprint("solar", __name__)

# Exact 10-Step Workflow from real-world solar pipeline
# Note: Step 7 and 8 swapped as requested by user
STAGE_KEYS = [
    "create_customer",     # 1. Create Custmer
    "collect_docs",        # 2. Collect Document (7 docs)
    "pm_suryaghar",        # 3. Online PM Suryaghar
    "finance_online",      # 4. Finance Online
    "bank_submission",     # 5. Submit Document to Bank
    "installation",        # 6. Installation Project
    "final_bill",          # 7. Generate Final Bill (Swapped with 8)
    "dcr_certificate",     # 8. Generate DCR Certificate (Swapped with 7)
    "discom_submission",   # 9. Submit Document to DISCOM
    "track_subsidy"        # 10. Track Subsidy
]

STAGE_LABELS = {
    "create_customer": "1. Create Customer",
    "collect_docs": "2. Collect Document",
    "pm_suryaghar": "3. Online PM Suryaghar",
    "finance_online": "4. Finance Online",
    "bank_submission": "5. Submit Document to Bank",
    "installation": "6. Installation Project",
    "final_bill": "7. Generate Final Bill",
    "dcr_certificate": "8. Generate DCR Certificate",
    "discom_submission": "9. Submit Document to DISCOM",
    "track_subsidy": "10. Track Subsidy"
}

LEGACY_STAGE_MAP = {
    "lead_docs": "create_customer",
    "portal_feasibility": "pm_suryaghar",
    "net_metering": "discom_submission",
    "subsidy_completed": "track_subsidy"
}

NEW_COLUMNS_SPEC = [
    ("email", "ALTER TABLE solar_projects ADD COLUMN email VARCHAR(180) NULL"),
    ("current_stage", "ALTER TABLE solar_projects ADD COLUMN current_stage VARCHAR(50) NOT NULL DEFAULT 'create_customer'"),
    ("deal_amount", "ALTER TABLE solar_projects ADD COLUMN deal_amount DECIMAL(12,2) NULL"),
    ("advance_amount", "ALTER TABLE solar_projects ADD COLUMN advance_amount DECIMAL(12,2) NULL"),
    ("consumer_number", "ALTER TABLE solar_projects ADD COLUMN consumer_number VARCHAR(100) NULL"),
    ("sanction_load_kw", "ALTER TABLE solar_projects ADD COLUMN sanction_load_kw DECIMAL(8,2) NULL"),
    ("portal_app_number", "ALTER TABLE solar_projects ADD COLUMN portal_app_number VARCHAR(100) NULL"),
    ("portal_date", "ALTER TABLE solar_projects ADD COLUMN portal_date DATE NULL"),
    ("bank_submission_date", "ALTER TABLE solar_projects ADD COLUMN bank_submission_date DATE NULL"),
    ("bank_reference", "ALTER TABLE solar_projects ADD COLUMN bank_reference VARCHAR(100) NULL"),
    ("bank_branch", "ALTER TABLE solar_projects ADD COLUMN bank_branch VARCHAR(180) NULL"),
    ("inverter_details", "ALTER TABLE solar_projects ADD COLUMN inverter_details VARCHAR(255) NULL"),
    ("panel_details", "ALTER TABLE solar_projects ADD COLUMN panel_details VARCHAR(255) NULL"),
    ("technician_name", "ALTER TABLE solar_projects ADD COLUMN technician_name VARCHAR(180) NULL"),
    ("final_bill_number", "ALTER TABLE solar_projects ADD COLUMN final_bill_number VARCHAR(100) NULL"),
    ("final_bill_date", "ALTER TABLE solar_projects ADD COLUMN final_bill_date DATE NULL"),
    ("final_bill_amount", "ALTER TABLE solar_projects ADD COLUMN final_bill_amount DECIMAL(12,2) NULL"),
    ("dcr_cert_number", "ALTER TABLE solar_projects ADD COLUMN dcr_cert_number VARCHAR(100) NULL"),
    ("dcr_cert_date", "ALTER TABLE solar_projects ADD COLUMN dcr_cert_date DATE NULL"),
    ("meter_number", "ALTER TABLE solar_projects ADD COLUMN meter_number VARCHAR(100) NULL"),
    ("stage_updated_at", "ALTER TABLE solar_projects ADD COLUMN stage_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
]

def auto_migrate_schema(cur, db):
    try:
        cur.execute("SHOW COLUMNS FROM solar_projects")
        existing_cols = {row["Field"] for row in cur.fetchall()}
        for col_name, alter_sql in NEW_COLUMNS_SPEC:
            if col_name not in existing_cols:
                try:
                    cur.execute(alter_sql)
                    db.commit()
                    existing_cols.add(col_name)
                except Exception as col_err:
                    print(f"Notice adding solar column {col_name}:", col_err)
        return existing_cols
    except Exception as ex:
        print("Auto migrate error:", ex)
        return set()

def ensure_solar_projects_schema(get_db_connection):
    db = cur = None
    try:
        db = get_db_connection()
        cur = db.cursor(dictionary=True)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS solar_projects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_code VARCHAR(40) NULL UNIQUE,
                customer_name VARCHAR(180) NOT NULL,
                phone VARCHAR(40),
                email VARCHAR(180),
                address TEXT,
                system_capacity_kw DECIMAL(8,2),
                current_stage VARCHAR(50) NOT NULL DEFAULT 'create_customer',
                deal_amount DECIMAL(12,2) NULL,
                advance_amount DECIMAL(12,2) NULL,
                consumer_number VARCHAR(100) NULL,
                sanction_load_kw DECIMAL(8,2) NULL,
                portal_app_number VARCHAR(100) NULL,
                portal_date DATE NULL,
                payment_type VARCHAR(20) NOT NULL DEFAULT 'direct',
                finance_provider VARCHAR(180),
                finance_status VARCHAR(40) NOT NULL DEFAULT 'not_applicable',
                bank_submission_date DATE NULL,
                bank_reference VARCHAR(100) NULL,
                bank_branch VARCHAR(180) NULL,
                checklist_json LONGTEXT,
                inverter_details VARCHAR(255) NULL,
                panel_details VARCHAR(255) NULL,
                technician_name VARCHAR(180) NULL,
                installation_status VARCHAR(40) NOT NULL DEFAULT 'pending',
                installation_date DATE,
                final_bill_number VARCHAR(100) NULL,
                final_bill_date DATE NULL,
                final_bill_amount DECIMAL(12,2) NULL,
                dcr_cert_number VARCHAR(100) NULL,
                dcr_cert_date DATE NULL,
                discom_status VARCHAR(40) NOT NULL DEFAULT 'pending',
                discom_submission_date DATE,
                discom_reference VARCHAR(180),
                net_meter_status VARCHAR(40) NOT NULL DEFAULT 'pending',
                net_meter_date DATE,
                meter_number VARCHAR(100) NULL,
                subsidy_status VARCHAR(40) NOT NULL DEFAULT 'pending',
                subsidy_applied_date DATE,
                subsidy_received_date DATE,
                subsidy_amount DECIMAL(12,2),
                stage_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_solar_customer(customer_name),
                INDEX idx_solar_stage(current_stage)
            )
        """)
        db.commit()
        auto_migrate_schema(cur, db)

    except Exception as e:
        print("Solar schema error:", e)
    finally:
        if cur:
            try: cur.close()
            except Exception: pass
        if db:
            try:
                if db.is_connected(): db.close()
            except Exception: pass

def clean_date(v):
    return str(v or "").strip()[:10] or None

def clean_float(v):
    try:
        return float(v) if v is not None and str(v).strip() != "" else None
    except (ValueError, TypeError):
        return None

def payload(r):
    if not r:
        return None
    d = dict(r)
    raw = d.pop("checklist_json", None)
    try:
        d["checklist"] = json.loads(raw) if raw else {}
    except Exception:
        d["checklist"] = {}

    date_keys = [
        "installation_date", "discom_submission_date", "net_meter_date",
        "subsidy_applied_date", "subsidy_received_date", "stage_updated_at",
        "final_bill_date", "dcr_cert_date", "bank_submission_date", "portal_date",
        "created_at", "updated_at"
    ]
    for k in date_keys:
        if d.get(k) is not None:
            d[k] = d[k].isoformat() if hasattr(d[k], "isoformat") else str(d[k])

    float_keys = [
        "system_capacity_kw", "deal_amount", "advance_amount", "sanction_load_kw",
        "subsidy_amount", "final_bill_amount"
    ]
    for k in float_keys:
        if d.get(k) is not None:
            d[k] = float(d[k])

    st = d.get("current_stage")
    if st in LEGACY_STAGE_MAP:
        d["current_stage"] = LEGACY_STAGE_MAP[st]
    elif not st or st not in STAGE_KEYS:
        d["current_stage"] = "create_customer"

    return d

@solar_bp.route("/solar-projects", methods=["GET", "POST", "OPTIONS"])
def projects():
    if request.method == "OPTIONS":
        return "", 200

    if request.method == "GET":
        try:
            g.cursor.execute("SELECT * FROM solar_projects ORDER BY updated_at DESC, id DESC")
            rows = g.cursor.fetchall()
            return jsonify(success=True, projects=[payload(r) for r in rows])
        except Exception as e:
            print("Solar list error:", e)
            return jsonify(success=False, message="Solar projects load nahi ho paye: " + str(e)), 500

    d = request.get_json(silent=True) or {}
    name = str(d.get("customer_name") or "").strip()
    payment = str(d.get("payment_type") or "direct").lower()

    if not name:
        return jsonify(success=False, message="Customer name required hai."), 400

    if payment not in ("direct", "finance"):
        return jsonify(success=False, message="Payment type invalid hai."), 400

    stage = str(d.get("current_stage") or "create_customer").strip()
    if stage in LEGACY_STAGE_MAP:
        stage = LEGACY_STAGE_MAP[stage]
    if stage not in STAGE_KEYS:
        stage = "create_customer"

    # Make sure all columns exist
    existing_cols = auto_migrate_schema(g.cursor, g.db)

    field_data = [
        ("customer_name", name),
        ("phone", d.get("phone") or None),
        ("email", d.get("email") or None),
        ("address", d.get("address") or None),
        ("system_capacity_kw", clean_float(d.get("system_capacity_kw"))),
        ("current_stage", stage),
        ("deal_amount", clean_float(d.get("deal_amount"))),
        ("advance_amount", clean_float(d.get("advance_amount"))),
        ("consumer_number", d.get("consumer_number") or None),
        ("sanction_load_kw", clean_float(d.get("sanction_load_kw"))),
        ("portal_app_number", d.get("portal_app_number") or None),
        ("portal_date", clean_date(d.get("portal_date"))),
        ("payment_type", payment),
        ("finance_provider", (d.get("finance_provider") or None) if payment == "finance" else None),
        ("finance_status", (d.get("finance_status") or "pending") if payment == "finance" else "not_applicable"),
        ("bank_submission_date", clean_date(d.get("bank_submission_date"))),
        ("bank_reference", d.get("bank_reference") or None),
        ("bank_branch", d.get("bank_branch") or None),
        ("checklist_json", json.dumps(d.get("checklist") or {}, ensure_ascii=False)),
        ("inverter_details", d.get("inverter_details") or None),
        ("panel_details", d.get("panel_details") or None),
        ("technician_name", d.get("technician_name") or None),
        ("installation_status", d.get("installation_status") or "pending"),
        ("installation_date", clean_date(d.get("installation_date"))),
        ("final_bill_number", d.get("final_bill_number") or None),
        ("final_bill_date", clean_date(d.get("final_bill_date"))),
        ("final_bill_amount", clean_float(d.get("final_bill_amount"))),
        ("dcr_cert_number", d.get("dcr_cert_number") or None),
        ("dcr_cert_date", clean_date(d.get("dcr_cert_date"))),
        ("discom_status", d.get("discom_status") or "pending"),
        ("discom_submission_date", clean_date(d.get("discom_submission_date"))),
        ("discom_reference", d.get("discom_reference") or None),
        ("net_meter_status", d.get("net_meter_status") or "pending"),
        ("net_meter_date", clean_date(d.get("net_meter_date"))),
        ("meter_number", d.get("meter_number") or None),
        ("subsidy_status", d.get("subsidy_status") or "pending"),
        ("subsidy_applied_date", clean_date(d.get("subsidy_applied_date"))),
        ("subsidy_received_date", clean_date(d.get("subsidy_received_date"))),
        ("subsidy_amount", clean_float(d.get("subsidy_amount"))),
        ("notes", d.get("notes") or None),
        ("created_by", getattr(g, "user_id", None))
    ]

    use_fields = [f for f, v in field_data if not existing_cols or f in existing_cols]
    use_vals = [v for f, v in field_data if not existing_cols or f in existing_cols]

    try:
        sql = f"INSERT INTO solar_projects ({','.join(use_fields)}) VALUES ({','.join(['%s']*len(use_fields))})"
        g.cursor.execute(sql, tuple(use_vals))
        pid = g.cursor.lastrowid
        code = f"SOL-{str(pid).zfill(5)}"
        g.cursor.execute("UPDATE solar_projects SET project_code = %s WHERE id = %s", (code, pid))
        g.db.commit()

        g.cursor.execute("SELECT * FROM solar_projects WHERE id = %s", (pid,))
        return jsonify(success=True, project=payload(g.cursor.fetchone())), 201
    except Exception as e:
        try: g.db.rollback()
        except Exception: pass
        print("Solar create error:", e)
        return jsonify(success=False, message="Solar project save nahi ho paya: " + str(e)), 500

@solar_bp.route("/solar-projects/<int:pid>", methods=["GET", "PUT", "DELETE", "OPTIONS"])
def project(pid):
    if request.method == "OPTIONS":
        return "", 200

    g.cursor.execute("SELECT * FROM solar_projects WHERE id = %s", (pid,))
    row = g.cursor.fetchone()
    if not row:
        return jsonify(success=False, message="Solar project nahi mila."), 404

    if request.method == "GET":
        return jsonify(success=True, project=payload(row))

    if request.method == "DELETE":
        if str(getattr(g, "current_user", {}).get("role", "")).lower() != "admin":
            return jsonify(success=False, message="Delete ke liye Admin permission chahiye."), 403
        g.cursor.execute("DELETE FROM solar_projects WHERE id = %s", (pid,))
        g.db.commit()
        return jsonify(success=True, message="Solar project deleted.")

    d = payload(row)
    d.update(request.get_json(silent=True) or {})
    name = str(d.get("customer_name") or "").strip()
    payment = str(d.get("payment_type") or "direct").lower()

    if not name:
        return jsonify(success=False, message="Customer name required hai."), 400

    if payment not in ("direct", "finance"):
        return jsonify(success=False, message="Payment type invalid hai."), 400

    stage = str(d.get("current_stage") or row.get("current_stage") or "create_customer").strip()
    if stage in LEGACY_STAGE_MAP:
        stage = LEGACY_STAGE_MAP[stage]
    if stage not in STAGE_KEYS:
        stage = "create_customer"

    existing_cols = auto_migrate_schema(g.cursor, g.db)

    field_data = [
        ("customer_name", name),
        ("phone", d.get("phone") or None),
        ("email", d.get("email") or None),
        ("address", d.get("address") or None),
        ("system_capacity_kw", clean_float(d.get("system_capacity_kw"))),
        ("current_stage", stage),
        ("deal_amount", clean_float(d.get("deal_amount"))),
        ("advance_amount", clean_float(d.get("advance_amount"))),
        ("consumer_number", d.get("consumer_number") or None),
        ("sanction_load_kw", clean_float(d.get("sanction_load_kw"))),
        ("portal_app_number", d.get("portal_app_number") or None),
        ("portal_date", clean_date(d.get("portal_date"))),
        ("payment_type", payment),
        ("finance_provider", (d.get("finance_provider") or None) if payment == "finance" else None),
        ("finance_status", (d.get("finance_status") or "pending") if payment == "finance" else "not_applicable"),
        ("bank_submission_date", clean_date(d.get("bank_submission_date"))),
        ("bank_reference", d.get("bank_reference") or None),
        ("bank_branch", d.get("bank_branch") or None),
        ("checklist_json", json.dumps(d.get("checklist") or {}, ensure_ascii=False)),
        ("inverter_details", d.get("inverter_details") or None),
        ("panel_details", d.get("panel_details") or None),
        ("technician_name", d.get("technician_name") or None),
        ("installation_status", d.get("installation_status") or "pending"),
        ("installation_date", clean_date(d.get("installation_date"))),
        ("final_bill_number", d.get("final_bill_number") or None),
        ("final_bill_date", clean_date(d.get("final_bill_date"))),
        ("final_bill_amount", clean_float(d.get("final_bill_amount"))),
        ("dcr_cert_number", d.get("dcr_cert_number") or None),
        ("dcr_cert_date", clean_date(d.get("dcr_cert_date"))),
        ("discom_status", d.get("discom_status") or "pending"),
        ("discom_submission_date", clean_date(d.get("discom_submission_date"))),
        ("discom_reference", d.get("discom_reference") or None),
        ("net_meter_status", d.get("net_meter_status") or "pending"),
        ("net_meter_date", clean_date(d.get("net_meter_date"))),
        ("meter_number", d.get("meter_number") or None),
        ("subsidy_status", d.get("subsidy_status") or "pending"),
        ("subsidy_applied_date", clean_date(d.get("subsidy_applied_date"))),
        ("subsidy_received_date", clean_date(d.get("subsidy_received_date"))),
        ("subsidy_amount", clean_float(d.get("subsidy_amount"))),
        ("notes", d.get("notes") or None)
    ]

    use_pairs = [(f, v) for f, v in field_data if not existing_cols or f in existing_cols]
    set_clause = ", ".join([f"{f}=%s" for f, v in use_pairs])
    use_vals = [v for f, v in use_pairs] + [pid]

    try:
        sql = f"UPDATE solar_projects SET {set_clause}, stage_updated_at=CURRENT_TIMESTAMP WHERE id=%s"
        g.cursor.execute(sql, tuple(use_vals))
        g.db.commit()

        g.cursor.execute("SELECT * FROM solar_projects WHERE id = %s", (pid,))
        return jsonify(success=True, project=payload(g.cursor.fetchone()))
    except Exception as e:
        try: g.db.rollback()
        except Exception: pass
        print("Solar update error:", e)
        return jsonify(success=False, message="Solar project update nahi ho paya: " + str(e)), 500

@solar_bp.route("/solar-projects/<int:pid>/stage", methods=["POST", "OPTIONS"])
def update_stage(pid):
    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json(silent=True) or {}
    new_stage = str(data.get("current_stage") or "").strip()
    if new_stage in LEGACY_STAGE_MAP:
        new_stage = LEGACY_STAGE_MAP[new_stage]

    if new_stage not in STAGE_KEYS:
        return jsonify(success=False, message=f"Invalid stage '{new_stage}'."), 400

    try:
        g.cursor.execute(
            "UPDATE solar_projects SET current_stage = %s, stage_updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (new_stage, pid)
        )
        g.db.commit()
        g.cursor.execute("SELECT * FROM solar_projects WHERE id = %s", (pid,))
        updated = g.cursor.fetchone()
        if not updated:
            return jsonify(success=False, message="Solar project nahi mila."), 404
        return jsonify(success=True, project=payload(updated), message=f"Stage changed to {STAGE_LABELS.get(new_stage, new_stage)}")
    except Exception as e:
        try: g.db.rollback()
        except Exception: pass
        return jsonify(success=False, message=str(e)), 500

@solar_bp.route("/solar-dashboard", methods=["GET"])
def solar_dashboard():
    try:
        g.cursor.execute("SELECT * FROM solar_projects")
        ps = [payload(r) for r in g.cursor.fetchall()]

        stage_counts = {k: 0 for k in STAGE_KEYS}
        for p in ps:
            st = p.get("current_stage") or "create_customer"
            if st in stage_counts:
                stage_counts[st] += 1
            else:
                stage_counts["create_customer"] += 1

        stats = {
            "total": len(ps),
            "stage_counts": stage_counts,
            "finance_pending": sum(1 for p in ps if p.get("payment_type") == "finance" and p.get("finance_status") not in ("approved", "disbursed", "complete")),
            "subsidy_received_total": sum(float(p.get("subsidy_amount") or 0) for p in ps if p.get("subsidy_status") == "received"),
            "total_deal_value": sum(float(p.get("deal_amount") or 0) for p in ps)
        }
        return jsonify(success=True, stats=stats, stages=STAGE_LABELS)
    except Exception as e:
        print("Solar dashboard error:", e)
        return jsonify(success=False, message="Dashboard load nahi hua: " + str(e)), 500
