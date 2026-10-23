import json
from flask import Blueprint, request, jsonify, g

solar_bp = Blueprint("solar", __name__)

STAGE_KEYS = ["lead_docs", "portal_feasibility", "installation", "net_metering", "subsidy_completed"]

STAGE_LABELS = {
    "lead_docs": "1. टोकन व दस्तावेज़",
    "portal_feasibility": "2. पोर्टल व डिस्कॉम",
    "installation": "3. प्लांट इंस्टॉलेशन",
    "net_metering": "4. नेट मीटरिंग",
    "subsidy_completed": "5. सब्सिडी व पूर्ण"
}

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
                address TEXT,
                system_capacity_kw DECIMAL(8,2),
                current_stage VARCHAR(50) NOT NULL DEFAULT 'lead_docs',
                deal_amount DECIMAL(12,2) NULL,
                advance_amount DECIMAL(12,2) NULL,
                consumer_number VARCHAR(100) NULL,
                sanction_load_kw DECIMAL(8,2) NULL,
                portal_app_number VARCHAR(100) NULL,
                payment_type VARCHAR(20) NOT NULL DEFAULT 'direct',
                finance_provider VARCHAR(180),
                finance_status VARCHAR(40) NOT NULL DEFAULT 'not_applicable',
                checklist_json LONGTEXT,
                inverter_details VARCHAR(255) NULL,
                panel_details VARCHAR(255) NULL,
                technician_name VARCHAR(180) NULL,
                installation_status VARCHAR(40) NOT NULL DEFAULT 'pending',
                installation_date DATE,
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

        # Check for any missing columns if table already existed
        cur.execute("SHOW COLUMNS FROM solar_projects")
        existing_cols = {row["Field"] for row in cur.fetchall()}

        new_columns = [
            ("current_stage", "ALTER TABLE solar_projects ADD COLUMN current_stage VARCHAR(50) NOT NULL DEFAULT 'lead_docs'"),
            ("deal_amount", "ALTER TABLE solar_projects ADD COLUMN deal_amount DECIMAL(12,2) NULL"),
            ("advance_amount", "ALTER TABLE solar_projects ADD COLUMN advance_amount DECIMAL(12,2) NULL"),
            ("consumer_number", "ALTER TABLE solar_projects ADD COLUMN consumer_number VARCHAR(100) NULL"),
            ("sanction_load_kw", "ALTER TABLE solar_projects ADD COLUMN sanction_load_kw DECIMAL(8,2) NULL"),
            ("portal_app_number", "ALTER TABLE solar_projects ADD COLUMN portal_app_number VARCHAR(100) NULL"),
            ("inverter_details", "ALTER TABLE solar_projects ADD COLUMN inverter_details VARCHAR(255) NULL"),
            ("panel_details", "ALTER TABLE solar_projects ADD COLUMN panel_details VARCHAR(255) NULL"),
            ("technician_name", "ALTER TABLE solar_projects ADD COLUMN technician_name VARCHAR(180) NULL"),
            ("meter_number", "ALTER TABLE solar_projects ADD COLUMN meter_number VARCHAR(100) NULL"),
            ("stage_updated_at", "ALTER TABLE solar_projects ADD COLUMN stage_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        ]

        for col_name, alter_sql in new_columns:
            if col_name not in existing_cols:
                try:
                    cur.execute(alter_sql)
                    db.commit()
                except Exception as col_err:
                    print(f"Notice adding solar column {col_name}:", col_err)

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
        "created_at", "updated_at"
    ]
    for k in date_keys:
        if d.get(k) is not None:
            d[k] = d[k].isoformat() if hasattr(d[k], "isoformat") else str(d[k])

    float_keys = ["system_capacity_kw", "deal_amount", "advance_amount", "sanction_load_kw", "subsidy_amount"]
    for k in float_keys:
        if d.get(k) is not None:
            d[k] = float(d[k])

    if not d.get("current_stage") or d["current_stage"] not in STAGE_KEYS:
        # Infer stage based on completed steps if not explicitly set
        if d.get("subsidy_status") == "received":
            d["current_stage"] = "subsidy_completed"
        elif d.get("net_meter_status") == "installed":
            d["current_stage"] = "net_metering"
        elif d.get("installation_status") == "completed":
            d["current_stage"] = "net_metering"
        elif d.get("discom_status") == "submitted":
            d["current_stage"] = "installation"
        elif d.get("portal_app_number"):
            d["current_stage"] = "portal_feasibility"
        else:
            d["current_stage"] = "lead_docs"

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
            return jsonify(success=False, message="Solar projects load nahi ho paye."), 500

    d = request.get_json(silent=True) or {}
    name = str(d.get("customer_name") or "").strip()
    payment = str(d.get("payment_type") or "direct").lower()

    if not name:
        return jsonify(success=False, message="Customer name required hai."), 400

    if payment not in ("direct", "finance"):
        return jsonify(success=False, message="Payment type invalid hai."), 400

    stage = str(d.get("current_stage") or "lead_docs").strip()
    if stage not in STAGE_KEYS:
        stage = "lead_docs"

    fields = [
        "customer_name", "phone", "address", "system_capacity_kw", "current_stage",
        "deal_amount", "advance_amount", "consumer_number", "sanction_load_kw",
        "portal_app_number", "payment_type", "finance_provider", "finance_status",
        "checklist_json", "inverter_details", "panel_details", "technician_name",
        "installation_status", "installation_date", "discom_status",
        "discom_submission_date", "discom_reference", "net_meter_status",
        "net_meter_date", "meter_number", "subsidy_status", "subsidy_applied_date",
        "subsidy_received_date", "subsidy_amount", "notes", "created_by"
    ]

    vals = [
        name,
        d.get("phone") or None,
        d.get("address") or None,
        clean_float(d.get("system_capacity_kw")),
        stage,
        clean_float(d.get("deal_amount")),
        clean_float(d.get("advance_amount")),
        d.get("consumer_number") or None,
        clean_float(d.get("sanction_load_kw")),
        d.get("portal_app_number") or None,
        payment,
        (d.get("finance_provider") or None) if payment == "finance" else None,
        (d.get("finance_status") or "pending") if payment == "finance" else "not_applicable",
        json.dumps(d.get("checklist") or {}, ensure_ascii=False),
        d.get("inverter_details") or None,
        d.get("panel_details") or None,
        d.get("technician_name") or None,
        d.get("installation_status") or "pending",
        clean_date(d.get("installation_date")),
        d.get("discom_status") or "pending",
        clean_date(d.get("discom_submission_date")),
        d.get("discom_reference") or None,
        d.get("net_meter_status") or "pending",
        clean_date(d.get("net_meter_date")),
        d.get("meter_number") or None,
        d.get("subsidy_status") or "pending",
        clean_date(d.get("subsidy_applied_date")),
        clean_date(d.get("subsidy_received_date")),
        clean_float(d.get("subsidy_amount")),
        d.get("notes") or None,
        getattr(g, "user_id", None)
    ]

    try:
        sql = f"INSERT INTO solar_projects ({','.join(fields)}) VALUES ({','.join(['%s']*len(fields))})"
        g.cursor.execute(sql, tuple(vals))
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
        return jsonify(success=False, message="Solar project save nahi ho paya."), 500

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

    stage = str(d.get("current_stage") or row.get("current_stage") or "lead_docs").strip()
    if stage not in STAGE_KEYS:
        stage = "lead_docs"

    vals = [
        name,
        d.get("phone") or None,
        d.get("address") or None,
        clean_float(d.get("system_capacity_kw")),
        stage,
        clean_float(d.get("deal_amount")),
        clean_float(d.get("advance_amount")),
        d.get("consumer_number") or None,
        clean_float(d.get("sanction_load_kw")),
        d.get("portal_app_number") or None,
        payment,
        (d.get("finance_provider") or None) if payment == "finance" else None,
        (d.get("finance_status") or "pending") if payment == "finance" else "not_applicable",
        json.dumps(d.get("checklist") or {}, ensure_ascii=False),
        d.get("inverter_details") or None,
        d.get("panel_details") or None,
        d.get("technician_name") or None,
        d.get("installation_status") or "pending",
        clean_date(d.get("installation_date")),
        d.get("discom_status") or "pending",
        clean_date(d.get("discom_submission_date")),
        d.get("discom_reference") or None,
        d.get("net_meter_status") or "pending",
        clean_date(d.get("net_meter_date")),
        d.get("meter_number") or None,
        d.get("subsidy_status") or "pending",
        clean_date(d.get("subsidy_applied_date")),
        clean_date(d.get("subsidy_received_date")),
        clean_float(d.get("subsidy_amount")),
        d.get("notes") or None,
        pid
    ]

    try:
        cols = """
            customer_name=%s, phone=%s, address=%s, system_capacity_kw=%s, current_stage=%s,
            deal_amount=%s, advance_amount=%s, consumer_number=%s, sanction_load_kw=%s,
            portal_app_number=%s, payment_type=%s, finance_provider=%s, finance_status=%s,
            checklist_json=%s, inverter_details=%s, panel_details=%s, technician_name=%s,
            installation_status=%s, installation_date=%s, discom_status=%s,
            discom_submission_date=%s, discom_reference=%s, net_meter_status=%s,
            net_meter_date=%s, meter_number=%s, subsidy_status=%s, subsidy_applied_date=%s,
            subsidy_received_date=%s, subsidy_amount=%s, notes=%s,
            stage_updated_at=CURRENT_TIMESTAMP
        """
        sql = f"UPDATE solar_projects SET {cols} WHERE id=%s"
        g.cursor.execute(sql, tuple(vals))
        g.db.commit()

        g.cursor.execute("SELECT * FROM solar_projects WHERE id = %s", (pid,))
        return jsonify(success=True, project=payload(g.cursor.fetchone()))
    except Exception as e:
        try: g.db.rollback()
        except Exception: pass
        print("Solar update error:", e)
        return jsonify(success=False, message="Solar project update nahi ho paya."), 500

@solar_bp.route("/solar-projects/<int:pid>/stage", methods=["POST", "OPTIONS"])
def update_stage(pid):
    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json(silent=True) or {}
    new_stage = str(data.get("current_stage") or "").strip()
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
            st = p.get("current_stage") or "lead_docs"
            if st in stage_counts:
                stage_counts[st] += 1
            else:
                stage_counts["lead_docs"] += 1

        stats = {
            "total": len(ps),
            "stage_lead_docs": stage_counts["lead_docs"],
            "stage_portal_feasibility": stage_counts["portal_feasibility"],
            "stage_installation": stage_counts["installation"],
            "stage_net_metering": stage_counts["net_metering"],
            "stage_subsidy_completed": stage_counts["subsidy_completed"],
            "finance_pending": sum(1 for p in ps if p.get("payment_type") == "finance" and p.get("finance_status") not in ("approved", "disbursed", "complete")),
            "subsidy_received_total": sum(float(p.get("subsidy_amount") or 0) for p in ps if p.get("subsidy_status") == "received"),
            "total_deal_value": sum(float(p.get("deal_amount") or 0) for p in ps)
        }
        return jsonify(success=True, stats=stats, stages=STAGE_LABELS)
    except Exception as e:
        print("Solar dashboard error:", e)
        return jsonify(success=False, message="Dashboard load nahi hua."), 500
