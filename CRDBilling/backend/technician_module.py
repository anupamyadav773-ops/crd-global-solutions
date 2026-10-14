"""
Technician & Employee Management Module for CRD Global Solutions Billing & Service Software.
Modular extension: Zero impact on existing billing, sales, products or service core.
"""

import os
import re
import json
import time
import uuid
import base64
import math
from decimal import Decimal
from collections import defaultdict
from datetime import datetime as _orig_datetime, date as _orig_date, timedelta, timezone
from flask import Blueprint, request, jsonify, g, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

IST_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


class date(_orig_date):
    """Date proxy that defaults .today() to Indian Standard Time (IST)."""
    @classmethod
    def today(cls):
        return _orig_datetime.now(IST_TIMEZONE).date()


class datetime(_orig_datetime):
    """Datetime proxy that defaults .now() to naive Indian Standard Time (IST)."""
    @classmethod
    def now(cls, tz=None):
        if tz is None:
            return _orig_datetime.now(IST_TIMEZONE).replace(tzinfo=None)
        return _orig_datetime.now(tz)


technician_bp = Blueprint("technicians", __name__)


UPLOAD_BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
WORK_PROOF_DIR = os.path.join(UPLOAD_BASE, "work_proofs")
SIGNATURE_DIR = os.path.join(UPLOAD_BASE, "signatures")
EMPLOYEE_PHOTO_DIR = os.path.join(UPLOAD_BASE, "employee_photos")

for directory in (UPLOAD_BASE, WORK_PROOF_DIR, SIGNATURE_DIR, EMPLOYEE_PHOTO_DIR):
    os.makedirs(directory, exist_ok=True)


# ==============================================================================
# SERIALIZATION HELPERS (Safe for timedelta, date, datetime, Decimal)
# ==============================================================================

def serialize_val(v):
    if v is None:
        return None
    if isinstance(v, timedelta):
        total_seconds = int(v.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    if isinstance(v, (datetime, date)):
        return str(v)
    if isinstance(v, Decimal):
        return float(v)
    return v


def serialize_row(row):
    if not row or not isinstance(row, dict):
        return row
    return {k: serialize_val(v) for k, v in row.items()}


def serialize_rows(rows):
    if not rows:
        return []
    return [serialize_row(r) for r in rows]


# ==============================================================================
# SCHEMA MIGRATION & EXTENSIONS (IDEMPOTENT)
# ==============================================================================

def ensure_technician_employee_schema(get_db_connection):
    """
    Safely and idempotently create all new tables and columns required for
    Technician & Employee Management without altering or touching existing tables.
    """
    db = None
    cursor = None
    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL UNIQUE,
                employee_code VARCHAR(30) UNIQUE NOT NULL,
                full_name VARCHAR(120) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                email VARCHAR(120) NULL,
                designation VARCHAR(80) NOT NULL DEFAULT 'Technician',
                department VARCHAR(80) NOT NULL DEFAULT 'Service',
                joining_date DATE NULL,
                salary_type ENUM('Monthly', 'Daily', 'Per_Job') DEFAULT 'Monthly',
                base_salary DECIMAL(10,2) DEFAULT 0.00,
                emergency_contact VARCHAR(100) NULL,
                address TEXT NULL,
                photo_path VARCHAR(255) NULL,
                status ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_emp_user (user_id),
                INDEX idx_emp_status (status)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_devices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                employee_id INT NOT NULL,
                device_id VARCHAR(100) NOT NULL,
                device_name VARCHAR(150) NULL,
                device_os VARCHAR(50) NULL,
                browser_fingerprint VARCHAR(255) NULL,
                status ENUM('Active', 'Revoked', 'Blocked') DEFAULT 'Active',
                authorized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_emp_device (user_id, device_id),
                INDEX idx_device_status (user_id, status)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_device_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                employee_id INT NOT NULL,
                device_id VARCHAR(100) NOT NULL,
                event_type ENUM('Login_Success', 'Login_Blocked_New_Device', 'Logout', 'Admin_Revoked', 'Admin_Authorized') NOT NULL,
                ip_address VARCHAR(50) NULL,
                user_agent TEXT NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_dev_hist_user (user_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                user_id INT NOT NULL,
                attendance_date DATE NOT NULL,
                check_in_time TIME NULL,
                check_in_lat DECIMAL(10,8) NULL,
                check_in_lng DECIMAL(11,8) NULL,
                check_in_address TEXT NULL,
                check_out_time TIME NULL,
                check_out_lat DECIMAL(10,8) NULL,
                check_out_lng DECIMAL(11,8) NULL,
                check_out_address TEXT NULL,
                total_working_minutes INT DEFAULT 0,
                status ENUM('Present', 'Absent', 'Half_Day', 'On_Leave', 'Holiday') DEFAULT 'Present',
                is_corrected TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_emp_att_date (employee_id, attendance_date),
                INDEX idx_att_date (attendance_date)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance_corrections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                attendance_id INT NOT NULL,
                employee_id INT NOT NULL,
                old_check_in TIME NULL,
                new_check_in TIME NULL,
                old_check_out TIME NULL,
                new_check_out TIME NULL,
                old_status VARCHAR(30) NULL,
                new_status VARCHAR(30) NULL,
                correction_reason TEXT NOT NULL,
                corrected_by_user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_att_corr (attendance_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_gps_locations (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                service_job_id INT NULL,
                latitude DECIMAL(10,8) NOT NULL,
                longitude DECIMAL(11,8) NOT NULL,
                accuracy_meters DECIMAL(8,2) NULL,
                speed_kmh DECIMAL(6,2) NULL,
                battery_level INT NULL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_gps_emp_time (employee_id, recorded_at)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS service_job_work_proof (
                id INT AUTO_INCREMENT PRIMARY KEY,
                service_job_id INT NOT NULL,
                technician_id INT NOT NULL,
                before_photo_path VARCHAR(255) NULL,
                after_photo_path VARCHAR(255) NULL,
                customer_signature_path VARCHAR(255) NULL,
                technician_notes TEXT NULL,
                customer_feedback TEXT NULL,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_wp_job (service_job_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS technician_tools (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tool_code VARCHAR(50) UNIQUE NOT NULL,
                tool_name VARCHAR(150) NOT NULL,
                category VARCHAR(80) DEFAULT 'Hand Tool',
                serial_number VARCHAR(100) NULL,
                purchase_date DATE NULL,
                purchase_cost DECIMAL(10,2) DEFAULT 0.00,
                condition_status ENUM('Good', 'Fair', 'Damaged', 'Lost', 'Under_Repair') DEFAULT 'Good',
                assigned_employee_id INT NULL,
                assigned_date DATE NULL,
                return_date DATE NULL,
                remarks TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_tool_emp (assigned_employee_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS technician_inventory (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity_held INT NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_tech_product (employee_id, product_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS technician_inventory_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                product_id INT NOT NULL,
                transaction_type ENUM('Issued_To_Technician', 'Returned_To_Store', 'Damaged_Reported', 'Admin_Adjustment') NOT NULL,
                quantity INT NOT NULL,
                service_job_id INT NULL,
                remarks TEXT NULL,
                issued_by_user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_tech_inv_emp (employee_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_leave_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                leave_type VARCHAR(50) NOT NULL DEFAULT 'Casual Leave',
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                total_days INT NOT NULL DEFAULT 1,
                reason TEXT NOT NULL,
                status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
                admin_remark TEXT NULL,
                reviewed_by_user_id INT NULL,
                reviewed_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_leave_emp (employee_id),
                INDEX idx_leave_dates (start_date, end_date),
                INDEX idx_leave_status (status)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance_geofence_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                office_name VARCHAR(150) NOT NULL DEFAULT 'Main Office / Workshop',
                latitude DECIMAL(10,8) NOT NULL,
                longitude DECIMAL(11,8) NOT NULL,
                radius_meters INT NOT NULL DEFAULT 100,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                office_address TEXT NULL,
                updated_by_user_id INT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS technician_activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NULL,
                user_id INT NULL,
                activity_type VARCHAR(50) NOT NULL,
                action VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                service_job_id INT NULL,
                latitude DECIMAL(10,8) NULL,
                longitude DECIMAL(11,8) NULL,
                location_address TEXT NULL,
                metadata JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_act_emp (employee_id),
                INDEX idx_act_type (activity_type),
                INDEX idx_act_job (service_job_id),
                INDEX idx_act_created (created_at)
            )
        """)

        cursor.execute("SHOW COLUMNS FROM service_jobs")
        existing_sj_cols = {row["Field"] for row in cursor.fetchall()}

        service_job_extensions = {
            "service_type": "VARCHAR(20) NOT NULL DEFAULT 'Shop'",
            "customer_address": "TEXT NULL",
            "technician_name": "VARCHAR(120) DEFAULT NULL",
            "complaint_type": "VARCHAR(80) NOT NULL DEFAULT 'Hardware Repair'",
            "priority": "ENUM('Low', 'Normal', 'High', 'Urgent') NOT NULL DEFAULT 'Normal'",
            "assigned_technician_id": "INT DEFAULT NULL",
            "appointment_date": "DATE DEFAULT NULL",
            "appointment_start_time": "TIME DEFAULT NULL",
            "appointment_end_time": "TIME DEFAULT NULL",
            "estimated_duration_minutes": "INT NOT NULL DEFAULT 60",
            "actual_duration_minutes": "INT NOT NULL DEFAULT 0",
            "assigned_at": "DATETIME DEFAULT NULL",
            "accepted_at": "DATETIME DEFAULT NULL",
            "on_the_way_at": "DATETIME DEFAULT NULL",
            "reached_at": "DATETIME DEFAULT NULL",
            "work_started_at": "DATETIME DEFAULT NULL",
            "completed_at": "DATETIME DEFAULT NULL",
            "cancelled_at": "DATETIME DEFAULT NULL",
            "hold_reason": "TEXT DEFAULT NULL",
            "held_at": "DATETIME DEFAULT NULL",
            "customer_rating": "INT DEFAULT NULL",
            "customer_feedback": "TEXT DEFAULT NULL",
            "job_latitude": "DECIMAL(10,8) NULL",
            "job_longitude": "DECIMAL(11,8) NULL",
            "on_the_way_lat": "DECIMAL(10,8) NULL",
            "on_the_way_lng": "DECIMAL(11,8) NULL",
            "on_the_way_address": "TEXT NULL",
            "reached_lat": "DECIMAL(10,8) NULL",
            "reached_lng": "DECIMAL(11,8) NULL",
            "reached_address": "TEXT NULL",
            "completion_lat": "DECIMAL(10,8) NULL",
            "completion_lng": "DECIMAL(11,8) NULL",
            "completion_address": "TEXT NULL"
        }

        for col_name, col_def in service_job_extensions.items():
            if col_name not in existing_sj_cols:
                cursor.execute(f"ALTER TABLE service_jobs ADD COLUMN {col_name} {col_def}")

        cursor.execute("SHOW COLUMNS FROM service_job_work_proof")
        existing_wp_cols = {row["Field"] for row in cursor.fetchall()}
        if "customer_rating" not in existing_wp_cols:
            cursor.execute("ALTER TABLE service_job_work_proof ADD COLUMN customer_rating INT DEFAULT 5")

        try:
            backfill_technician_activity_logs(cursor, db)
        except Exception as b_err:
            print("Activity log backfill note:", b_err)

        db.commit()
    except Exception as e:
        print("ensure_technician_employee_schema error:", e)
        if db:
            try:
                db.rollback()
            except Exception:
                pass
    finally:
        if cursor:
            cursor.close()
        if db and db.is_connected():
            db.close()


# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def backfill_technician_activity_logs(cursor, db):
    """
    Populates historical activity logs from attendance and service job records
    if the activity log table is empty or newly created.
    """
    try:
        cursor.execute("SELECT COUNT(*) AS cnt FROM technician_activity_logs")
        row = cursor.fetchone()
        count = row["cnt"] if isinstance(row, dict) else (row[0] if row else 0)
        if count > 5:
            return

        # 1. Backfill from employee_attendance
        cursor.execute("""
            SELECT ea.id, ea.employee_id, ea.user_id, ea.attendance_date, ea.check_in_time, ea.check_in_lat, ea.check_in_lng, ea.check_in_address,
                   ea.check_out_time, ea.check_out_lat, ea.check_out_lng, ea.check_out_address, ea.status,
                   e.full_name, e.employee_code
            FROM employee_attendance ea
            JOIN employees e ON e.id = ea.employee_id
            ORDER BY ea.id DESC LIMIT 40
        """)
        att_rows = cursor.fetchall()
        for att in att_rows:
            e_name = att.get("full_name") or "Technician"
            att_date = str(att.get("attendance_date") or "")
            if att.get("check_in_time"):
                t_str = str(att["check_in_time"])[:5]
                ts = f"{att_date} {t_str}:00" if att_date and t_str else None
                cursor.execute("""
                    INSERT INTO technician_activity_logs (employee_id, user_id, activity_type, action, description, latitude, longitude, location_address, created_at)
                    VALUES (%s, %s, 'ATTENDANCE', 'Punch In', %s, %s, %s, %s, COALESCE(%s, NOW()))
                """, (
                    att["employee_id"], att.get("user_id"),
                    f"{e_name} marked attendance (Punch In) at {t_str}",
                    att.get("check_in_lat"), att.get("check_in_lng"), att.get("check_in_address"),
                    ts
                ))
            if att.get("check_out_time"):
                t_str = str(att["check_out_time"])[:5]
                ts = f"{att_date} {t_str}:00" if att_date and t_str else None
                cursor.execute("""
                    INSERT INTO technician_activity_logs (employee_id, user_id, activity_type, action, description, latitude, longitude, location_address, created_at)
                    VALUES (%s, %s, 'ATTENDANCE', 'Punch Out', %s, %s, %s, %s, COALESCE(%s, NOW()))
                """, (
                    att["employee_id"], att.get("user_id"),
                    f"{e_name} completed shift (Punch Out) at {t_str}",
                    att.get("check_out_lat"), att.get("check_out_lng"), att.get("check_out_address"),
                    ts
                ))

        # 2. Backfill from service_jobs
        cursor.execute("""
            SELECT sj.id, sj.service_number, sj.customer_name, sj.assigned_technician_id, sj.technician_name, sj.service_status, sj.created_at, sj.assigned_at, sj.completed_at
            FROM service_jobs sj
            WHERE sj.assigned_technician_id IS NOT NULL
            ORDER BY sj.id DESC LIMIT 30
        """)
        jobs = cursor.fetchall()
        for j in jobs:
            t_name = j.get("technician_name") or "Technician"
            srv_no = j.get("service_number")
            c_name = j.get("customer_name") or "Customer"
            t_id = j.get("assigned_technician_id")
            if j.get("assigned_at"):
                cursor.execute("""
                    INSERT INTO technician_activity_logs (employee_id, activity_type, action, description, service_job_id, created_at)
                    VALUES (%s, 'JOB_STATUS', 'Job Assigned', %s, %s, %s)
                """, (
                    t_id, f"Job #{srv_no} assigned to {t_name} for customer {c_name}", j["id"], j["assigned_at"]
                ))
            if j.get("service_status") == 'Completed' and j.get("completed_at"):
                cursor.execute("""
                    INSERT INTO technician_activity_logs (employee_id, activity_type, action, description, service_job_id, created_at)
                    VALUES (%s, 'JOB_STATUS', 'Job Completed', %s, %s, %s)
                """, (
                    t_id, f"{t_name} successfully completed service Job #{srv_no} ({c_name})", j["id"], j["completed_at"]
                ))
        db.commit()
    except Exception as e:
        print("Backfill activity logs error:", e)


def log_technician_activity(employee_id=None, user_id=None, activity_type="GENERAL", action="", description="", service_job_id=None, latitude=None, longitude=None, location_address=None, metadata=None):
    """
    Safely records an activity / audit event for technicians and field service operations.
    """
    try:
        cur = getattr(g, "cursor", None)
        db = getattr(g, "db", None)
        owns_conn = False
        if cur is None or db is None:
            from backend.app import get_db_connection
            db = get_db_connection()
            cur = db.cursor()
            owns_conn = True

        meta_json = json.dumps(metadata) if metadata is not None else None
        cur.execute(
            """
            INSERT INTO technician_activity_logs 
            (employee_id, user_id, activity_type, action, description, service_job_id, latitude, longitude, location_address, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (employee_id, user_id, activity_type, action, description, service_job_id, latitude, longitude, location_address, meta_json)
        )
        db.commit()
        if owns_conn:
            cur.close()
            db.close()
    except Exception as e:
        print(f"Error logging technician activity [{activity_type} - {action}]:", e)


def get_client_ip():
    if request.headers.get("X-Forwarded-For"):
        return request.headers["X-Forwarded-For"].split(",")[0].strip()
    return request.remote_addr or ""


def save_base64_image(base64_data, target_dir, prefix="img"):
    if not base64_data or not isinstance(base64_data, str):
        return None
    try:
        if "," in base64_data:
            header, base64_data = base64_data.split(",", 1)
        image_bytes = base64.b64decode(base64_data)
        filename = f"{prefix}_{int(time.time())}_{uuid.uuid4().hex[:8]}.png"
        file_path = os.path.join(target_dir, filename)
        with open(file_path, "wb") as f:
            f.write(image_bytes)
        return filename
    except Exception as e:
        print(f"Error saving base64 image: {e}")
        return None


# ==============================================================================
# AUTHENTICATION & SINGLE-DEVICE SECURITY
# ==============================================================================

@technician_bp.route("/api/auth/technician-login", methods=["POST"])
def technician_login():
    try:
        from backend.app import create_auth_token, _login_attempts, _LOGIN_MAX_ATTEMPTS, _LOGIN_LOCKOUT_SECONDS
    except ImportError:
        from app import create_auth_token, _login_attempts, _LOGIN_MAX_ATTEMPTS, _LOGIN_LOCKOUT_SECONDS

    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    device_id = (data.get("device_id") or "").strip()
    device_name = (data.get("device_name") or "Mobile Device").strip()
    device_os = (data.get("device_os") or "Android/Web").strip()
    browser_fp = (data.get("browser_fingerprint") or "").strip()

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required."}), 400

    if not device_id:
        return jsonify({"success": False, "message": "Device identifier is required for technician login."}), 400

    key = f"tech_{username.lower()}"
    now = time.time()
    _login_attempts[key] = [t for t in _login_attempts[key] if now - t < _LOGIN_LOCKOUT_SECONDS]
    if len(_login_attempts[key]) >= _LOGIN_MAX_ATTEMPTS:
        remaining = int(_LOGIN_LOCKOUT_SECONDS - (now - _login_attempts[key][0]))
        return jsonify({
            "success": False,
            "message": f"Too many failed login attempts. Try again in {remaining} seconds."
        }), 429

    g.cursor.execute(
        """
        SELECT u.id, u.username, u.full_name, u.role, u.status, u.password,
               e.id AS employee_id, e.employee_code, e.phone, e.designation, e.department, e.status AS employee_status
        FROM users u
        LEFT JOIN employees e ON e.user_id = u.id
        WHERE u.username = %s
        LIMIT 1
        """,
        (username,)
    )
    user = g.cursor.fetchone()

    if not user:
        _login_attempts[key].append(time.time())
        return jsonify({"success": False, "message": "Invalid username or password."}), 401

    stored_password = str(user.get("password") or "")
    is_hashed = stored_password.startswith(("pbkdf2:", "scrypt:"))
    password_ok = check_password_hash(stored_password, password) if is_hashed else (stored_password == password)

    if not password_ok:
        _login_attempts[key].append(time.time())
        return jsonify({"success": False, "message": "Invalid username or password."}), 401

    if str(user.get("status") or "").lower() != "active":
        return jsonify({"success": False, "message": "Your user account has been disabled."}), 403

    if user.get("employee_status") and str(user.get("employee_status")).lower() != "active":
        return jsonify({"success": False, "message": "Your employee profile is inactive. Contact Admin."}), 403

    user_role = str(user.get("role") or "").strip().lower()
    designation = str(user.get("designation") or "").strip().lower()
    if user_role not in ("technician", "admin") and "technician" not in designation:
        return jsonify({
            "success": False,
            "message": "Yeh mobile app sirf Field Technicians ke liye hai."
        }), 403

    # Ensure Technician login is strictly allowed from the Mobile App (not ordinary browser/desktop)
    raw_ua = request.headers.get("User-Agent", "")
    is_app_header = "PariTechnicianApp" in raw_ua
    is_app_body = bool(data.get("is_app"))
    # Also check if user-agent indicates mobile browser or desktop
    is_desktop_browser = any(d in raw_ua for d in ["Windows NT", "Macintosh", "X11", "Linux x86_64"]) and not any(m in raw_ua for m in ["Android", "iPhone", "Mobile"])

    if user_role == "technician" and (is_desktop_browser or (not is_app_header and not is_app_body and "Android" not in raw_ua and "iPhone" not in raw_ua)):
        return jsonify({
            "success": False,
            "message": "Technicians can only login via Pari Technician Mobile App (APK). Browser/Desktop login is not allowed."
        }), 403

    _login_attempts.pop(key, None)

    user_id = user["id"]
    employee_id = user["employee_id"] or 0

    if not employee_id:
        g.cursor.execute(
            """
            INSERT INTO employees (user_id, employee_code, full_name, phone, designation, department)
            VALUES (%s, %s, %s, %s, %s, 'Service')
            """,
            (user_id, f"EMP-{user_id:04d}", user["full_name"], "N/A", user["role"])
        )
        g.db.commit()
        employee_id = g.cursor.lastrowid

    ip_addr = get_client_ip()
    user_agent = request.headers.get("User-Agent", "")[:250]

    g.cursor.execute(
        "SELECT id, device_id, device_name, status FROM employee_devices WHERE user_id = %s AND status = 'Active' LIMIT 1",
        (user_id,)
    )
    active_device = g.cursor.fetchone()

    if active_device:
        if active_device["device_id"] != device_id:
            g.cursor.execute(
                """
                INSERT INTO employee_device_history (user_id, employee_id, device_id, event_type, ip_address, user_agent, notes)
                VALUES (%s, %s, %s, 'Login_Blocked_New_Device', %s, %s, %s)
                """,
                (user_id, employee_id, device_id, ip_addr, user_agent,
                 f"Blocked login attempt from new device '{device_name}'. Active device is '{active_device['device_name']}'")
            )
            g.db.commit()
            return jsonify({
                "success": False,
                "device_blocked": True,
                "active_device_name": active_device["device_name"],
                "message": (
                    f"Device Not Authorized! This technician ID is currently locked to another active device "
                    f"('{active_device['device_name']}'). Please contact Admin to release or authorize this new device."
                )
            }), 403
        else:
            g.cursor.execute(
                """
                UPDATE employee_devices
                SET last_login_at = CURRENT_TIMESTAMP, last_active_at = CURRENT_TIMESTAMP,
                    device_name = %s, device_os = %s
                WHERE id = %s
                """,
                (device_name, device_os, active_device["id"])
            )
    else:
        g.cursor.execute(
            """
            INSERT INTO employee_devices (user_id, employee_id, device_id, device_name, device_os, browser_fingerprint, status, authorized_at, last_login_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE status = 'Active', last_login_at = CURRENT_TIMESTAMP, last_active_at = CURRENT_TIMESTAMP,
                                    device_name = VALUES(device_name), device_os = VALUES(device_os)
            """,
            (user_id, employee_id, device_id, device_name, device_os, browser_fp)
        )

    g.cursor.execute(
        """
        INSERT INTO employee_device_history (user_id, employee_id, device_id, event_type, ip_address, user_agent, notes)
        VALUES (%s, %s, %s, 'Login_Success', %s, %s, %s)
        """,
        (user_id, employee_id, device_id, ip_addr, user_agent, f"Authorized login on {device_name}")
    )
    g.db.commit()

    token = create_auth_token(user)
    return jsonify({
        "success": True,
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"]
        },
        "employee": {
            "id": employee_id,
            "code": user.get("employee_code") or f"EMP-{user_id:04d}",
            "phone": user.get("phone") or "",
            "designation": user.get("designation") or "Technician"
        }
    })


# ==============================================================================
# DEVICE MANAGEMENT (ADMIN)
# ==============================================================================

@technician_bp.route("/api/devices", methods=["GET"])
def list_devices():
    g.cursor.execute(
        """
        SELECT ed.id, ed.user_id, ed.employee_id, ed.device_id, ed.device_name, ed.device_os,
               ed.status, ed.authorized_at, ed.last_login_at, ed.last_active_at,
               u.username, u.full_name, e.employee_code, e.phone
        FROM employee_devices ed
        JOIN users u ON u.id = ed.user_id
        LEFT JOIN employees e ON e.id = ed.employee_id
        ORDER BY ed.last_active_at DESC
        """
    )
    devices = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "devices": devices})


@technician_bp.route("/api/devices/<int:device_id>/revoke", methods=["POST"])
def revoke_device(device_id):
    g.cursor.execute(
        "SELECT id, user_id, employee_id, device_id, device_name FROM employee_devices WHERE id = %s",
        (device_id,)
    )
    dev = g.cursor.fetchone()
    if not dev:
        return jsonify({"success": False, "message": "Device not found."}), 404

    g.cursor.execute("UPDATE employee_devices SET status = 'Revoked' WHERE id = %s", (device_id,))
    g.cursor.execute(
        """
        INSERT INTO employee_device_history (user_id, employee_id, device_id, event_type, notes)
        VALUES (%s, %s, %s, 'Admin_Revoked', %s)
        """,
        (dev["user_id"], dev["employee_id"], dev["device_id"], f"Device '{dev['device_name']}' revoked by Admin")
    )
    g.db.commit()
    return jsonify({"success": True, "message": f"Device '{dev['device_name']}' released successfully."})


@technician_bp.route("/api/devices/<int:device_id>/authorize", methods=["POST"])
def authorize_device(device_id):
    g.cursor.execute(
        "SELECT id, user_id, employee_id, device_id, device_name FROM employee_devices WHERE id = %s",
        (device_id,)
    )
    dev = g.cursor.fetchone()
    if not dev:
        return jsonify({"success": False, "message": "Device not found."}), 404

    g.cursor.execute("UPDATE employee_devices SET status = 'Revoked' WHERE user_id = %s", (dev["user_id"],))
    g.cursor.execute("UPDATE employee_devices SET status = 'Active' WHERE id = %s", (device_id,))
    g.cursor.execute(
        """
        INSERT INTO employee_device_history (user_id, employee_id, device_id, event_type, notes)
        VALUES (%s, %s, %s, 'Admin_Authorized', %s)
        """,
        (dev["user_id"], dev["employee_id"], dev["device_id"], f"Device '{dev['device_name']}' authorized by Admin")
    )
    g.db.commit()
    return jsonify({"success": True, "message": f"Device '{dev['device_name']}' is now the authorized active device."})


@technician_bp.route("/api/devices/history", methods=["GET"])
def device_history():
    limit = min(int(request.args.get("limit", 100)), 200)
    g.cursor.execute(
        """
        SELECT edh.id, edh.user_id, edh.employee_id, edh.device_id, edh.event_type,
               edh.ip_address, edh.user_agent, edh.notes, edh.created_at,
               u.username, u.full_name, e.employee_code
        FROM employee_device_history edh
        LEFT JOIN users u ON u.id = edh.user_id
        LEFT JOIN employees e ON e.id = edh.employee_id
        ORDER BY edh.created_at DESC
        LIMIT %s
        """,
        (limit,)
    )
    history = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "history": history})


# ==============================================================================
# EMPLOYEE DIRECTORY & MANAGEMENT (ADMIN)
# ==============================================================================

@technician_bp.route("/api/employees", methods=["GET"])
def list_employees():
    status = request.args.get("status")
    designation = request.args.get("designation")
    search = (request.args.get("search") or "").strip()

    sql = """
        SELECT e.*, u.username, u.role AS user_role,
               (SELECT COUNT(*) FROM service_jobs sj WHERE sj.assigned_technician_id = e.id AND sj.service_status NOT IN ('Delivered', 'Cancelled')) AS active_jobs_count,
               (SELECT COUNT(*) FROM technician_tools tt WHERE tt.assigned_employee_id = e.id) AS assigned_tools_count,
               (SELECT ed.device_name FROM employee_devices ed WHERE ed.user_id = e.user_id AND ed.status = 'Active' LIMIT 1) AS active_device_name
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        WHERE 1=1
    """
    params = []
    if status:
        sql += " AND e.status = %s"
        params.append(status)
    if designation:
        sql += " AND e.designation = %s"
        params.append(designation)
    if search:
        sql += " AND (e.full_name LIKE %s OR e.phone LIKE %s OR e.employee_code LIKE %s OR e.email LIKE %s)"
        like = f"%{search}%"
        params.extend([like, like, like, like])

    sql += " ORDER BY e.id DESC"
    g.cursor.execute(sql, params)
    employees = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "employees": employees})


@technician_bp.route("/api/employees", methods=["POST"])
def create_employee():
    data = request.get_json() or {}
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    email = (data.get("email") or "").strip() or None
    designation = (data.get("designation") or "Technician").strip()
    department = (data.get("department") or "Service").strip()
    joining_date = data.get("joining_date") or None
    salary_type = data.get("salary_type") or "Monthly"
    base_salary = float(data.get("base_salary") or 0.0)
    emergency_contact = (data.get("emergency_contact") or "").strip() or None
    address = (data.get("address") or "").strip() or None
    create_login = bool(data.get("create_login"))
    login_username = (data.get("username") or "").strip()
    login_password = (data.get("password") or "").strip()

    if not full_name or not phone:
        return jsonify({"success": False, "message": "Full Name and Phone are required."}), 400

    employee_code = (data.get("employee_code") or "").strip()
    if not employee_code:
        g.cursor.execute("SELECT MAX(id) AS max_id FROM employees")
        max_id = (g.cursor.fetchone() or {}).get("max_id") or 0
        employee_code = f"EMP-{(max_id + 1):04d}"

    user_id = None
    if create_login:
        if not login_username or not login_password:
            return jsonify({"success": False, "message": "Username and password are required to create a login account."}), 400

        g.cursor.execute("SELECT id FROM users WHERE username = %s LIMIT 1", (login_username,))
        if g.cursor.fetchone():
            return jsonify({"success": False, "message": f"Username '{login_username}' is already taken."}), 400

        hashed_pwd = generate_password_hash(login_password)
        user_role = "Technician" if designation.lower() == "technician" else "Staff"
        g.cursor.execute(
            """
            INSERT INTO users (username, password, full_name, role, status)
            VALUES (%s, %s, %s, %s, 'Active')
            """,
            (login_username, hashed_pwd, full_name, user_role)
        )
        user_id = g.cursor.lastrowid

    g.cursor.execute(
        """
        INSERT INTO employees (user_id, employee_code, full_name, phone, email, designation, department,
                               joining_date, salary_type, base_salary, emergency_contact, address, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Active')
        """,
        (user_id, employee_code, full_name, phone, email, designation, department,
         joining_date, salary_type, base_salary, emergency_contact, address)
    )
    employee_id = g.cursor.lastrowid
    g.db.commit()

    return jsonify({
        "success": True,
        "message": f"Employee {full_name} created successfully.",
        "employee_id": employee_id,
        "employee_code": employee_code
    }), 201


@technician_bp.route("/api/employees/<int:emp_id>", methods=["GET"])
def get_employee(emp_id):
    g.cursor.execute(
        """
        SELECT e.*, u.username, u.role AS user_role,
               (SELECT ed.device_name FROM employee_devices ed WHERE ed.user_id = e.user_id AND ed.status = 'Active' LIMIT 1) AS active_device_name,
               (SELECT ed.device_id FROM employee_devices ed WHERE ed.user_id = e.user_id AND ed.status = 'Active' LIMIT 1) AS active_device_id
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        WHERE e.id = %s
        LIMIT 1
        """,
        (emp_id,)
    )
    emp = serialize_row(g.cursor.fetchone())
    if not emp:
        return jsonify({"success": False, "message": "Employee not found."}), 404
    return jsonify({"success": True, "employee": emp})


@technician_bp.route("/api/employees/<int:emp_id>/login-credentials", methods=["GET"])
def get_employee_login_credentials(emp_id):
    g.cursor.execute(
        """
        SELECT e.id AS employee_id, e.employee_code, e.full_name, e.phone, e.designation, e.department,
               e.user_id, u.username, u.role AS user_role, u.status AS user_status,
               (SELECT ed.device_name FROM employee_devices ed WHERE ed.user_id = e.user_id AND ed.status = 'Active' LIMIT 1) AS active_device_name,
               (SELECT ed.device_id FROM employee_devices ed WHERE ed.user_id = e.user_id AND ed.status = 'Active' LIMIT 1) AS active_device_id
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        WHERE e.id = %s
        LIMIT 1
        """,
        (emp_id,)
    )
    row = serialize_row(g.cursor.fetchone())
    if not row:
        return jsonify({"success": False, "message": "Employee not found."}), 404
    has_login = bool(row.get("user_id") and row.get("username"))
    return jsonify({
        "success": True,
        "employee_id": emp_id,
        "has_login": has_login,
        "credentials": row
    })


@technician_bp.route("/api/employees/<int:emp_id>/reset-password", methods=["POST"])
def reset_employee_password(emp_id):
    data = request.get_json() or {}
    new_password = (data.get("password") or "").strip()
    username = (data.get("username") or "").strip()

    if not new_password or len(new_password) < 4:
        return jsonify({"success": False, "message": "Password must be at least 4 characters long."}), 400

    g.cursor.execute("SELECT id, user_id, full_name, designation, phone FROM employees WHERE id = %s LIMIT 1", (emp_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee not found."}), 404

    hashed = generate_password_hash(new_password)
    user_id = emp.get("user_id")

    if user_id:
        g.cursor.execute("SELECT id, username FROM users WHERE id = %s LIMIT 1", (user_id,))
        user_row = g.cursor.fetchone()
        if user_row:
            if username and username != user_row["username"]:
                g.cursor.execute("SELECT id FROM users WHERE username = %s AND id != %s LIMIT 1", (username, user_id))
                if g.cursor.fetchone():
                    return jsonify({"success": False, "message": f"Username '{username}' already taken."}), 409
                g.cursor.execute("UPDATE users SET username = %s, password = %s, status = 'Active' WHERE id = %s", (username, hashed, user_id))
            else:
                g.cursor.execute("UPDATE users SET password = %s, status = 'Active' WHERE id = %s", (hashed, user_id))
                username = user_row["username"]
            g.db.commit()
            return jsonify({
                "success": True,
                "message": f"Password for '{username}' updated successfully!",
                "username": username
            })

    # If no linked user exists, create one
    if not username:
        base_name = re.sub(r'[^a-zA-Z0-9]', '', (emp.get("full_name") or "tech").lower())[:8] or "tech"
        username = f"{base_name}_{emp['id']}"

    g.cursor.execute("SELECT id FROM users WHERE username = %s LIMIT 1", (username,))
    if g.cursor.fetchone():
        return jsonify({"success": False, "message": f"Username '{username}' already exists. Please choose a different one."}), 409

    role = "Technician" if "tech" in (emp.get("designation") or "").lower() else "Staff"
    g.cursor.execute(
        "INSERT INTO users (username, password, full_name, role, status) VALUES (%s, %s, %s, %s, 'Active')",
        (username, hashed, emp["full_name"], role)
    )
    new_user_id = g.cursor.lastrowid
    g.cursor.execute("UPDATE employees SET user_id = %s WHERE id = %s", (new_user_id, emp_id))
    g.db.commit()

    return jsonify({
        "success": True,
        "message": f"New login account created! Username: {username}",
        "username": username
    })


@technician_bp.route("/api/employees/<int:emp_id>/release-device", methods=["POST"])
def release_employee_device(emp_id):
    g.cursor.execute("SELECT id, user_id, full_name FROM employees WHERE id = %s LIMIT 1", (emp_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee not found."}), 404
    user_id = emp.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Employee has no linked user account."}), 400

    g.cursor.execute("UPDATE employee_devices SET status = 'Revoked' WHERE user_id = %s", (user_id,))
    g.cursor.execute(
        """
        INSERT INTO employee_device_history (user_id, employee_id, device_id, event_type, notes)
        VALUES (%s, %s, 'N/A', 'Admin_Revoked_From_Employee_Panel', %s)
        """,
        (user_id, emp_id, f"All devices released for {emp['full_name']} by Admin.")
    )
    g.db.commit()
    return jsonify({
        "success": True,
        "message": f"Device lock for {emp['full_name']} released successfully! Technician can now log in from any phone."
    })


@technician_bp.route("/api/employees/<int:emp_id>", methods=["PUT"])
def update_employee(emp_id):
    data = request.get_json() or {}
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    email = (data.get("email") or "").strip() or None
    designation = (data.get("designation") or "Technician").strip()
    department = (data.get("department") or "Service").strip()
    joining_date = data.get("joining_date") or None
    salary_type = data.get("salary_type") or "Monthly"
    base_salary = float(data.get("base_salary") or 0.0)
    emergency_contact = (data.get("emergency_contact") or "").strip() or None
    address = (data.get("address") or "").strip() or None
    status = data.get("status") or "Active"

    if not full_name or not phone:
        return jsonify({"success": False, "message": "Full Name and Phone are required."}), 400

    g.cursor.execute(
        """
        UPDATE employees
        SET full_name = %s, phone = %s, email = %s, designation = %s, department = %s,
            joining_date = %s, salary_type = %s, base_salary = %s, emergency_contact = %s,
            address = %s, status = %s
        WHERE id = %s
        """,
        (full_name, phone, email, designation, department, joining_date, salary_type,
         base_salary, emergency_contact, address, status, emp_id)
    )

    g.cursor.execute("SELECT user_id FROM employees WHERE id = %s", (emp_id,))
    emp_row = g.cursor.fetchone()
    if emp_row and emp_row.get("user_id"):
        g.cursor.execute(
            "UPDATE users SET full_name = %s WHERE id = %s",
            (full_name, emp_row["user_id"])
        )

    g.db.commit()
    return jsonify({"success": True, "message": "Employee updated successfully."})


@technician_bp.route("/api/employees/<int:emp_id>", methods=["DELETE"])
def delete_employee(emp_id):
    g.cursor.execute("SELECT COUNT(*) AS job_count FROM service_jobs WHERE assigned_technician_id = %s", (emp_id,))
    cnt = g.cursor.fetchone()["job_count"]
    if cnt > 0:
        g.cursor.execute("UPDATE employees SET status = 'Inactive' WHERE id = %s", (emp_id,))
        g.db.commit()
        return jsonify({"success": True, "message": "Employee has associated service jobs. Marked as Inactive instead of deleting."})

    g.cursor.execute("DELETE FROM employees WHERE id = %s", (emp_id,))
    g.db.commit()
    return jsonify({"success": True, "message": "Employee deleted successfully."})


# ==============================================================================
# SCHEDULING & REAL-TIME AVAILABILITY CALCULATION
# ==============================================================================

@technician_bp.route("/api/technicians/availability", methods=["GET"])
@technician_bp.route("/technicians/availability", methods=["GET"])
def check_technician_availability():
    target_date = request.args.get("date") or str(date.today())
    start_time_str = request.args.get("start_time") or "09:00"
    duration_minutes = int(request.args.get("duration_minutes") or 60)

    try:
        t_start = datetime.strptime(f"{target_date} {start_time_str}", "%Y-%m-%d %H:%M")
    except ValueError:
        try:
            t_start = datetime.strptime(f"{target_date} {start_time_str}", "%Y-%m-%d %H:%M:%S")
        except ValueError:
            t_start = datetime.strptime(f"{target_date} 09:00", "%Y-%m-%d %H:%M")

    t_end = t_start + timedelta(minutes=duration_minutes)
    req_start_time = t_start.strftime("%H:%M:%S")
    req_end_time = t_end.strftime("%H:%M:%S")

    g.cursor.execute(
        """
        SELECT e.id AS employee_id, e.employee_code, e.full_name, e.phone, e.designation,
               (SELECT ea.status FROM employee_attendance ea WHERE ea.employee_id = e.id AND ea.attendance_date = %s LIMIT 1) AS attendance_status,
               (SELECT ea.check_in_time FROM employee_attendance ea WHERE ea.employee_id = e.id AND ea.attendance_date = %s LIMIT 1) AS check_in_time
        FROM employees e
        WHERE e.status = 'Active' AND LOWER(e.designation) = 'technician'
        ORDER BY e.full_name ASC
        """,
        (target_date, target_date)
    )
    technicians = serialize_rows(g.cursor.fetchall())

    result = []
    for tech in technicians:
        emp_id = tech["employee_id"]

        g.cursor.execute(
            """
            SELECT id, service_number, customer_name, appointment_date, appointment_start_time,
                   appointment_end_time, estimated_duration_minutes, service_status
            FROM service_jobs
            WHERE assigned_technician_id = %s
              AND (appointment_date = %s OR (appointment_date IS NULL AND DATE(created_at) = %s))
              AND service_status NOT IN ('Delivered', 'Cancelled')
            ORDER BY appointment_start_time ASC
            """,
            (emp_id, target_date, target_date)
        )
        assigned_jobs = serialize_rows(g.cursor.fetchall())

        conflict_job = None
        for job in assigned_jobs:
            j_start_val = job.get("appointment_start_time")
            j_end_val = job.get("appointment_end_time")
            if not j_start_val:
                continue

            j_start_str = str(j_start_val)
            if len(j_start_str) == 5:
                j_start_str += ":00"
            j_end_str = str(j_end_val) if j_end_val else ""
            if not j_end_str:
                dur = job.get("estimated_duration_minutes") or 60
                j_start_dt = datetime.strptime(f"{target_date} {j_start_str}", "%Y-%m-%d %H:%M:%S")
                j_end_str = (j_start_dt + timedelta(minutes=dur)).strftime("%H:%M:%S")

            if max(req_start_time, j_start_str) < min(req_end_time, j_end_str):
                conflict_job = {
                    "id": job["id"],
                    "service_number": job["service_number"],
                    "customer_name": job.get("customer_name") or "",
                    "start_time": j_start_str[:5],
                    "end_time": j_end_str[:5],
                    "status": job.get("service_status")
                }
                break

        # Check approved leave on target_date
        g.cursor.execute(
            """
            SELECT id, leave_type, reason, start_date, end_date
            FROM employee_leave_requests
            WHERE employee_id = %s
              AND status = 'Approved'
              AND %s BETWEEN start_date AND end_date
            LIMIT 1
            """,
            (emp_id, target_date)
        )
        approved_leave = g.cursor.fetchone()

        att_status = tech.get("attendance_status")
        if approved_leave:
            badge = "danger"
            label = f"🏖️ On Leave ({approved_leave['leave_type']}: छुट्टी पर है)"
            is_available = False
        elif conflict_job:
            badge = "danger"
            label = f"🔴 Busy (Job #{conflict_job['service_number']} at {conflict_job['start_time']}-{conflict_job['end_time']})"
            is_available = False
        elif target_date == str(date.today()) and att_status != "Present":
            badge = "warning"
            label = "⚪ Not Checked In"
            is_available = False
        else:
            badge = "success"
            label = "🟢 Available"
            is_available = True

        result.append({
            "employee_id": emp_id,
            "employee_code": tech["employee_code"],
            "full_name": tech["full_name"],
            "phone": tech["phone"],
            "attendance_status": ("On_Leave" if approved_leave else (att_status or "Not Marked")),
            "is_available": is_available,
            "is_on_leave": bool(approved_leave),
            "leave_details": serialize_row(approved_leave) if approved_leave else None,
            "badge": badge,
            "label": label,
            "conflict_job": conflict_job,
            "assigned_jobs_count": len(assigned_jobs),
            "assigned_jobs": assigned_jobs
        })

    return jsonify({
        "success": True,
        "date": target_date,
        "slot_start": req_start_time[:5],
        "slot_end": req_end_time[:5],
        "duration_minutes": duration_minutes,
        "technicians": result
    })


@technician_bp.route("/api/technicians/schedule", methods=["GET"])
@technician_bp.route("/technicians/schedule", methods=["GET"])
def technician_schedule():
    target_date = request.args.get("date") or str(date.today())
    now = datetime.now()
    is_today = (target_date == str(date.today()))

    g.cursor.execute(
        """
        SELECT sj.id, sj.service_number, sj.customer_name,
               sj.customer_mobile AS phone, sj.customer_mobile,
               sj.complaint AS reported_issue, sj.complaint,
               COALESCE(NULLIF(sj.customer_address, ''), '') AS customer_address,
               COALESCE(sj.service_type, 'Field') AS service_type,
               sj.appointment_date, sj.appointment_start_time, sj.appointment_end_time,
               sj.estimated_duration_minutes, sj.actual_duration_minutes, sj.service_status,
               sj.priority, sj.complaint_type, sj.notes,
               sj.work_started_at, sj.on_the_way_at,
               e.id AS technician_id, e.full_name AS technician_name
        FROM service_jobs sj
        LEFT JOIN employees e ON e.id = sj.assigned_technician_id
        WHERE sj.appointment_date = %s
           OR (sj.appointment_date IS NULL AND DATE(sj.created_at) = %s AND sj.assigned_technician_id IS NOT NULL)
        ORDER BY sj.appointment_start_time ASC, sj.id ASC
        """,
        (target_date, target_date)
    )
    raw_jobs = serialize_rows(g.cursor.fetchall())

    # Detect live running overtime on today's active jobs to compute live delays for subsequent jobs
    tech_active_delay = {}
    if is_today:
        for j in raw_jobs:
            st = j.get("service_status")
            tid = j.get("technician_id")
            if not tid or st not in ("On the Way", "Reached Site", "In Progress"):
                continue

            dur = int(j.get("estimated_duration_minutes") or 60)
            sched_end = None
            if j.get("appointment_end_time"):
                try:
                    e_str = str(j["appointment_end_time"])[:8]
                    sched_end = datetime.strptime(f"{target_date} {e_str}", "%Y-%m-%d %H:%M:%S" if len(e_str) > 5 else "%Y-%m-%d %H:%M")
                except Exception: pass
            if not sched_end and j.get("appointment_start_time"):
                try:
                    s_str = str(j["appointment_start_time"])[:8]
                    s_dt = datetime.strptime(f"{target_date} {s_str}", "%Y-%m-%d %H:%M:%S" if len(s_str) > 5 else "%Y-%m-%d %H:%M")
                    sched_end = s_dt + timedelta(minutes=dur)
                except Exception: pass
            if not sched_end and j.get("work_started_at"):
                try:
                    w_st = j["work_started_at"]
                    if isinstance(w_st, str): w_st = datetime.strptime(w_st[:19], "%Y-%m-%d %H:%M:%S")
                    sched_end = w_st + timedelta(minutes=dur)
                except Exception: pass

            if sched_end and now > sched_end:
                delay_mins = int((now - sched_end).total_seconds() / 60)
                if delay_mins >= 3:
                    tech_active_delay[tid] = {
                        "active_job_id": j["id"],
                        "active_job_number": j.get("service_number"),
                        "delay_minutes": delay_mins,
                        "sched_start": j.get("appointment_start_time")
                    }

    # Annotate jobs with live delay info
    for j in raw_jobs:
        tid = j.get("technician_id")
        j_notes = str(j.get("notes") or "")
        j["was_auto_rescheduled"] = "[Auto-Rescheduled" in j_notes
        j["live_delay_minutes"] = 0
        j["is_delayed"] = False
        j["live_adjusted_start_time"] = None
        j["live_adjusted_start_ampm"] = None

        if tid in tech_active_delay:
            active_info = tech_active_delay[tid]
            if j["id"] != active_info["active_job_id"] and j.get("service_status") in ("Assigned", "Pending", "Scheduled", "On the Way"):
                d_mins = active_info["delay_minutes"]
                j["live_delay_minutes"] = d_mins
                j["is_delayed"] = True
                s_val = j.get("appointment_start_time")
                if s_val:
                    try:
                        s_str = str(s_val)[:8]
                        orig_dt = datetime.strptime(f"{target_date} {s_str}", "%Y-%m-%d %H:%M:%S" if len(s_str) > 5 else "%Y-%m-%d %H:%M")
                        adj_dt = orig_dt + timedelta(minutes=d_mins)
                        j["live_adjusted_start_time"] = adj_dt.strftime("%H:%M")
                        j["live_adjusted_start_ampm"] = adj_dt.strftime("%I:%M %p").lstrip("0")
                    except Exception: pass

    return jsonify({"success": True, "date": target_date, "jobs": raw_jobs})


# ==============================================================================
# NEXT AVAILABLE SLOT ENGINE (Across Multiple Days)
# ==============================================================================
def find_technician_next_available_slot(technician_id, duration_minutes=60, buffer_minutes=30, max_days=14):
    """
    Scans forward from today day-by-day (up to max_days) to find the first realistic,
    non-conflicting open slot for a technician.
    Considers:
    - Working hours: 09:30 to 18:30 (9:30 AM to 6:30 PM).
    - Approved leave requests (skips day if on leave).
    - Current active/ongoing jobs today (work_started_at, on_the_way_at, etc.).
    - All other scheduled jobs on that day (appointment_start_time, appointment_end_time).
    - Travel buffer (buffer_minutes, default 30 mins).
    """
    now = datetime.now()
    today = date.today()
    work_start_h, work_start_m = 9, 30
    work_end_h, work_end_m = 18, 30

    try:
        duration_minutes = max(15, int(duration_minutes))
    except (ValueError, TypeError):
        duration_minutes = 60

    # 1. Fetch technician info
    g.cursor.execute("SELECT id, full_name, phone FROM employees WHERE id = %s LIMIT 1", (technician_id,))
    tech = g.cursor.fetchone()
    if not tech:
        return None
    tech_name = tech["full_name"]

    # 2. Fetch approved leaves for this technician for the next max_days
    end_scan_date = today + timedelta(days=max_days)
    g.cursor.execute(
        """
        SELECT start_date, end_date, leave_type, reason
        FROM employee_leave_requests
        WHERE employee_id = %s
          AND status = 'Approved'
          AND end_date >= %s
          AND start_date <= %s
        """,
        (technician_id, str(today), str(end_scan_date))
    )
    leave_rows = serialize_rows(g.cursor.fetchall())

    def get_leave_for_date(check_d):
        chk_str = str(check_d)
        for lr in leave_rows:
            s = lr.get("start_date")
            e = lr.get("end_date")
            if s and e:
                s_str = str(s)[:10]
                e_str = str(e)[:10]
                if s_str <= chk_str <= e_str:
                    return lr
        return None

    # 3. Fetch all assigned/active jobs for the scan window
    g.cursor.execute(
        """
        SELECT id, service_number, service_status, appointment_date,
               appointment_start_time, appointment_end_time,
               estimated_duration_minutes, actual_duration_minutes,
               work_started_at, on_the_way_at, created_at
        FROM service_jobs
        WHERE assigned_technician_id = %s
          AND service_status NOT IN ('Cancelled', 'Delivered', 'Closed')
          AND (
              (appointment_date >= %s AND appointment_date <= %s)
              OR (appointment_date IS NULL AND DATE(created_at) = %s)
              OR (DATE(work_started_at) = %s)
          )
        ORDER BY appointment_date ASC, appointment_start_time ASC, id ASC
        """,
        (technician_id, str(today), str(end_scan_date), str(today), str(today))
    )
    all_jobs = serialize_rows(g.cursor.fetchall())

    jobs_by_date = defaultdict(list)
    for j in all_jobs:
        jd = j.get("appointment_date")
        if not jd:
            c_at = j.get("created_at")
            jd = str(c_at)[:10] if c_at else str(today)
        else:
            jd = str(jd)[:10]
        jobs_by_date[jd].append(j)

    skipped_reasons = []

    for day_idx in range(max_days + 1):
        target_d = today + timedelta(days=day_idx)
        target_d_str = str(target_d)

        # Check if on leave
        leave = get_leave_for_date(target_d)
        if leave:
            l_type = leave.get("leave_type") or "Leave"
            skipped_reasons.append(f"{target_d.strftime('%d %b')} (On {l_type})")
            continue

        day_work_start = datetime(target_d.year, target_d.month, target_d.day, work_start_h, work_start_m)
        day_work_end = datetime(target_d.year, target_d.month, target_d.day, work_end_h, work_end_m)

        if day_idx == 0:
            # Today: cannot start earlier than now + buffer
            earliest_dt = now + timedelta(minutes=buffer_minutes)
            if earliest_dt < day_work_start:
                earliest_dt = day_work_start

            # If technician currently has an active ongoing job right now
            for j in jobs_by_date.get(target_d_str, []):
                st = j.get("service_status")
                if st in ("On the Way", "Reached Site", "In Progress"):
                    j_dur = int(j.get("estimated_duration_minutes") or 60)
                    if j.get("work_started_at"):
                        w_st = j["work_started_at"]
                        if isinstance(w_st, str):
                            try: w_st = datetime.strptime(w_st[:19], "%Y-%m-%d %H:%M:%S")
                            except Exception: w_st = now
                        est_finish = w_st + timedelta(minutes=j_dur)
                    elif j.get("on_the_way_at"):
                        otw = j["on_the_way_at"]
                        if isinstance(otw, str):
                            try: otw = datetime.strptime(otw[:19], "%Y-%m-%d %H:%M:%S")
                            except Exception: otw = now
                        est_finish = otw + timedelta(minutes=j_dur + 25)
                    else:
                        est_finish = now + timedelta(minutes=45)

                    if est_finish < now:
                        est_finish = now + timedelta(minutes=15)

                    free_with_travel = est_finish + timedelta(minutes=buffer_minutes)
                    if free_with_travel > earliest_dt:
                        earliest_dt = free_with_travel

            # Round earliest_dt up to next 5 minutes
            rem = earliest_dt.minute % 5
            if rem != 0:
                earliest_dt += timedelta(minutes=(5 - rem))

            if earliest_dt + timedelta(minutes=duration_minutes) > day_work_end:
                skipped_reasons.append(f"{target_d.strftime('%d %b')} (Today business hours ended)")
                continue
        else:
            earliest_dt = day_work_start

        # Collect occupied intervals for target_d
        occupied = []
        for j in jobs_by_date.get(target_d_str, []):
            st = j.get("service_status")
            if st in ("Cancelled", "Delivered", "Closed"):
                continue

            j_start_str = j.get("appointment_start_time")
            if not j_start_str:
                continue

            try:
                j_s_str = str(j_start_str)[:8]
                j_st_dt = datetime.strptime(f"{target_d_str} {j_s_str}", "%Y-%m-%d %H:%M:%S" if len(j_s_str) > 5 else "%Y-%m-%d %H:%M")
            except Exception:
                continue

            j_dur = int(j.get("estimated_duration_minutes") or 60)
            j_end_str = j.get("appointment_end_time")
            if j_end_str:
                try:
                    j_e_str = str(j_end_str)[:8]
                    j_et_dt = datetime.strptime(f"{target_d_str} {j_e_str}", "%Y-%m-%d %H:%M:%S" if len(j_e_str) > 5 else "%Y-%m-%d %H:%M")
                except Exception:
                    j_et_dt = j_st_dt + timedelta(minutes=j_dur)
            else:
                j_et_dt = j_st_dt + timedelta(minutes=j_dur)

            occupied.append((j_st_dt, j_et_dt + timedelta(minutes=buffer_minutes)))

        occupied.sort(key=lambda x: x[0])

        # Scan for gap of size duration_minutes
        curr_candidate = earliest_dt
        found_slot = None

        while curr_candidate + timedelta(minutes=duration_minutes) <= day_work_end:
            candidate_end = curr_candidate + timedelta(minutes=duration_minutes)
            conflict = False

            for occ_start, occ_end in occupied:
                if max(curr_candidate, occ_start) < min(candidate_end, occ_end):
                    conflict = True
                    curr_candidate = occ_end
                    rem = curr_candidate.minute % 5
                    if rem != 0:
                        curr_candidate += timedelta(minutes=(5 - rem))
                    break

            if not conflict:
                found_slot = curr_candidate
                break

        if found_slot:
            reach_date_str = found_slot.strftime("%Y-%m-%d")
            reach_time_str = found_slot.strftime("%H:%M")
            reach_ampm = found_slot.strftime("%I:%M %p").lstrip("0")
            day_label = "Today" if day_idx == 0 else ("Tomorrow" if day_idx == 1 else found_slot.strftime("%d %b %Y"))

            if day_idx == 0:
                notice = f"⚡ {tech_name} is available Today at {reach_ampm}."
            elif day_idx == 1:
                skip_msg = f" (Busy today)" if skipped_reasons else ""
                notice = f"⚡ {tech_name} next free slot: Tomorrow ({day_label}) at {reach_ampm}{skip_msg}."
            else:
                skip_msg = f" (Busy/Leave on: {', '.join(skipped_reasons)})" if skipped_reasons else ""
                notice = f"⚡ {tech_name} next free slot: {day_label} at {reach_ampm}{skip_msg}."

            return {
                "technician_id": technician_id,
                "full_name": tech_name,
                "suggested_reach_date": reach_date_str,
                "suggested_reach_time": reach_time_str,
                "suggested_reach_time_ampm": f"{day_label} {reach_ampm}",
                "formatted_slot": f"{reach_date_str} {reach_time_str}",
                "days_ahead": day_idx,
                "is_today": day_idx == 0,
                "notice": notice,
                "duration_minutes": duration_minutes
            }
        else:
            skipped_reasons.append(f"{target_d.strftime('%d %b')} (Fully booked: {len(occupied)} jobs)")

    # Fallback
    fallback_d = today + timedelta(days=1)
    return {
        "technician_id": technician_id,
        "full_name": tech_name,
        "suggested_reach_date": str(fallback_d),
        "suggested_reach_time": "10:30",
        "suggested_reach_time_ampm": f"{fallback_d.strftime('%d %b')} 10:30 AM",
        "formatted_slot": f"{fallback_d} 10:30",
        "days_ahead": 1,
        "is_today": False,
        "notice": f"⚡ {tech_name} is heavily booked. Earliest slot: {fallback_d.strftime('%d %b')} at 10:30 AM.",
        "duration_minutes": duration_minutes
    }


# ==============================================================================
# CASCADE SCHEDULE RESCHEDULING (Ripple effect on Delay or Early Finish)
# ==============================================================================
def cascade_technician_schedule_shift(completed_job_id, delta_minutes=None, actual_finish_dt=None):
    """
    When a technician completes a job earlier or later than scheduled:
    Shifts the scheduled reach time (appointment_start_time & appointment_end_time)
    of all subsequent pending/assigned jobs for that technician on that day.
    """
    g.cursor.execute(
        """
        SELECT id, service_number, customer_name, assigned_technician_id,
               appointment_date, appointment_start_time, appointment_end_time,
               estimated_duration_minutes, actual_duration_minutes,
               work_started_at, created_at, service_status
        FROM service_jobs
        WHERE id = %s
        LIMIT 1
        """,
        (completed_job_id,)
    )
    job = g.cursor.fetchone()
    if not job:
        return {"shifted_count": 0, "message": "Job not found"}

    tech_id = job.get("assigned_technician_id")
    if not tech_id:
        return {"shifted_count": 0, "message": "No technician assigned"}

    app_date = job.get("appointment_date")
    if not app_date:
        app_date = str(job.get("created_at") or date.today())[:10]
    else:
        app_date = str(app_date)[:10]

    now = actual_finish_dt or datetime.now()

    # Determine delta_minutes if not explicitly provided
    if delta_minutes is None:
        dur = int(job.get("estimated_duration_minutes") or 60)
        scheduled_end_dt = None

        if job.get("appointment_end_time"):
            try:
                e_str = str(job["appointment_end_time"])[:8]
                scheduled_end_dt = datetime.strptime(f"{app_date} {e_str}", "%Y-%m-%d %H:%M:%S" if len(e_str) > 5 else "%Y-%m-%d %H:%M")
            except Exception:
                scheduled_end_dt = None

        if not scheduled_end_dt and job.get("appointment_start_time"):
            try:
                s_str = str(job["appointment_start_time"])[:8]
                s_dt = datetime.strptime(f"{app_date} {s_str}", "%Y-%m-%d %H:%M:%S" if len(s_str) > 5 else "%Y-%m-%d %H:%M")
                scheduled_end_dt = s_dt + timedelta(minutes=dur)
            except Exception:
                scheduled_end_dt = None

        if not scheduled_end_dt and job.get("work_started_at"):
            w_st = job["work_started_at"]
            if isinstance(w_st, str):
                try: w_st = datetime.strptime(w_st[:19], "%Y-%m-%d %H:%M:%S")
                except Exception: w_st = now
            scheduled_end_dt = w_st + timedelta(minutes=dur)

        if scheduled_end_dt:
            delta_minutes = int((now - scheduled_end_dt).total_seconds() / 60)
        else:
            delta_minutes = 0

    # Only shift if meaningful difference (at least 3 minutes)
    if abs(delta_minutes) < 3:
        return {"shifted_count": 0, "delta_minutes": delta_minutes, "message": "Delta within 3m threshold (no shift needed)"}

    # Fetch subsequent jobs on the same day for this technician
    ref_time = job.get("appointment_start_time")
    if ref_time:
        ref_time_str = str(ref_time)[:8]
    else:
        ref_time_str = "00:00:00"

    g.cursor.execute(
        """
        SELECT id, service_number, customer_name, appointment_date,
               appointment_start_time, appointment_end_time, estimated_duration_minutes, service_status
        FROM service_jobs
        WHERE assigned_technician_id = %s
          AND appointment_date = %s
          AND id != %s
          AND service_status IN ('Assigned', 'Pending', 'Scheduled', 'On the Way')
          AND (appointment_start_time >= %s OR appointment_start_time IS NULL)
        ORDER BY appointment_start_time ASC, id ASC
        """,
        (tech_id, app_date, completed_job_id, ref_time_str)
    )
    subsequent_jobs = serialize_rows(g.cursor.fetchall())

    shifted_jobs = []
    job_no = job.get("service_number") or f"Job #{completed_job_id}"

    for sub in subsequent_jobs:
        sub_id = sub["id"]
        sub_start_raw = sub.get("appointment_start_time")
        if not sub_start_raw:
            continue

        try:
            sub_s_str = str(sub_start_raw)[:8]
            old_start_dt = datetime.strptime(f"{app_date} {sub_s_str}", "%Y-%m-%d %H:%M:%S" if len(sub_s_str) > 5 else "%Y-%m-%d %H:%M")
        except Exception:
            continue

        dur_mins = int(sub.get("estimated_duration_minutes") or 60)
        new_start_dt = old_start_dt + timedelta(minutes=delta_minutes)

        # Do not shift earlier than current time + 15 mins travel
        min_allowed = now + timedelta(minutes=15)
        if delta_minutes < 0 and new_start_dt < min_allowed:
            new_start_dt = min_allowed
            rem = new_start_dt.minute % 5
            if rem != 0:
                new_start_dt += timedelta(minutes=(5 - rem))

        new_end_dt = new_start_dt + timedelta(minutes=dur_mins)

        new_start_str = new_start_dt.strftime("%H:%M:00")
        new_end_str = new_end_dt.strftime("%H:%M:00")

        shift_sign = "+" if delta_minutes > 0 else ""
        shift_note = f"\n[Auto-Rescheduled: Shifted by {shift_sign}{delta_minutes}m due to Job #{job_no} finish at {now.strftime('%I:%M %p')}]"

        g.cursor.execute(
            """
            UPDATE service_jobs
            SET appointment_start_time = %s,
                appointment_end_time = %s,
                notes = CONCAT(COALESCE(notes, ''), %s)
            WHERE id = %s
            """,
            (new_start_str, new_end_str, shift_note, sub_id)
        )

        shifted_jobs.append({
            "id": sub_id,
            "service_number": sub.get("service_number"),
            "old_start": sub_s_str[:5],
            "new_start": new_start_dt.strftime("%H:%M"),
            "new_start_ampm": new_start_dt.strftime("%I:%M %p").lstrip("0")
        })

    g.db.commit()

    if shifted_jobs:
        delta_label = f"+{delta_minutes} min late" if delta_minutes > 0 else f"{delta_minutes} min early"
        log_msg = f"Cascade shifted {len(shifted_jobs)} subsequent job(s) by {delta_label} after #{job_no} completed."
        try:
            log_technician_activity(
                employee_id=tech_id,
                activity_type="SCHEDULE_CASCADE_SHIFT",
                description=log_msg,
                meta_data={"completed_job_id": completed_job_id, "delta_minutes": delta_minutes, "shifted_jobs": shifted_jobs}
            )
        except Exception:
            pass

    return {
        "success": True,
        "delta_minutes": delta_minutes,
        "shifted_count": len(shifted_jobs),
        "shifted_jobs": shifted_jobs
    }


# ==============================================================================
# ROUTE: GET NEXT AVAILABLE SLOT FOR A SPECIFIC TECHNICIAN
# ==============================================================================
@technician_bp.route("/api/technicians/<int:tech_id>/next-available-slot", methods=["GET"])
def get_technician_next_available_slot_endpoint(tech_id):
    duration = request.args.get("duration_minutes") or 60
    slot = find_technician_next_available_slot(tech_id, duration_minutes=duration)
    if not slot:
        return jsonify({"success": False, "message": "Technician not found"}), 404
    return jsonify({"success": True, "slot": slot})


# ==============================================================================
# ROUTE: REAL-TIME AVAILABILITY STATUS & REACH TIMES (All Technicians)
# ==============================================================================
@technician_bp.route("/api/technicians/availability-status", methods=["GET"])
def get_technicians_availability_status():
    """
    Returns real-time availability and auto-calculated reach times for all active field technicians.
    Scans forward multi-day slots so if technician is busy for next 2 days, next free slot is shown.
    """
    now = datetime.now()
    duration = request.args.get("duration_minutes") or 60

    # 1. Fetch active technicians
    g.cursor.execute(
        """
        SELECT id, employee_code, full_name, phone, designation, department
        FROM employees
        WHERE status = 'Active'
        ORDER BY full_name ASC
        """
    )
    techs = serialize_rows(g.cursor.fetchall())

    results = []
    today = date.today()
    today_str = str(today)

    for t in techs:
        tid = t["id"]
        t_name = t["full_name"]

        # 1. Check today's active job
        g.cursor.execute(
            """
            SELECT id, service_number, service_status, priority,
                   appointment_date, appointment_start_time, appointment_end_time,
                   on_the_way_at, reached_at, work_started_at,
                   estimated_duration_minutes, created_at
            FROM service_jobs
            WHERE assigned_technician_id = %s
              AND service_status IN ('Assigned', 'Travel', 'On the Way', 'Reached Site', 'In Progress')
              AND (appointment_date = %s OR (appointment_date IS NULL AND DATE(created_at) = %s) OR DATE(work_started_at) = %s)
            ORDER BY id DESC
            LIMIT 1
            """,
            (tid, today_str, today_str, today_str)
        )
        active_job = g.cursor.fetchone()

        # 2. Check today's approved leave
        g.cursor.execute(
            """
            SELECT employee_id, leave_type, reason
            FROM employee_leave_requests
            WHERE employee_id = %s
              AND status = 'Approved'
              AND %s BETWEEN start_date AND end_date
            LIMIT 1
            """,
            (tid, today_str)
        )
        leave = g.cursor.fetchone()

        # 3. Calculate smart multi-day next available slot
        slot = find_technician_next_available_slot(tid, duration_minutes=duration) or {}

        is_on_leave = bool(leave)
        is_busy = bool(active_job)

        reach_date_str = slot.get("suggested_reach_date") or today_str
        reach_time_str = slot.get("suggested_reach_time") or "10:30"
        reach_time_ampm = slot.get("suggested_reach_time_ampm") or "10:30 AM"
        days_ahead = slot.get("days_ahead", 0)

        if is_on_leave:
            l_type = leave.get("leave_type") or "Leave"
            status_label = f"🏖️ On Leave ({l_type})"
            dropdown_text = f"🏖️ {t_name} — On Leave (Next Free: {reach_time_ampm})"
            status_code = "ON_LEAVE"
        elif is_busy:
            j_no = active_job.get("service_number") or f"Job #{active_job['id']}"
            j_st = active_job.get("service_status")
            status_label = f"🔴 Busy (Job #{j_no} - {j_st})"
            if days_ahead == 0:
                dropdown_text = f"🔴 {t_name} — Busy (Free ~{reach_time_ampm})"
            else:
                dropdown_text = f"🔴 {t_name} — Busy (Next Free: {reach_time_ampm})"
            status_code = "BUSY"
        else:
            if days_ahead == 0:
                status_label = "🟢 Free / Available Now"
                dropdown_text = f"🟢 {t_name} — Available Now (Can reach ~{reach_time_ampm})"
            else:
                status_label = f"🟡 Available from {reach_time_ampm}"
                dropdown_text = f"🟡 {t_name} — Next Free: {reach_time_ampm}"
            status_code = "FREE"

        results.append({
            "id": tid,
            "full_name": t_name,
            "employee_code": t.get("employee_code", ""),
            "phone": t.get("phone", ""),
            "is_busy": is_busy,
            "is_on_leave": is_on_leave,
            "status": status_code,
            "status_label": status_label,
            "current_job_number": active_job.get("service_number") if active_job else None,
            "current_job_status": active_job.get("service_status") if active_job else None,
            "suggested_reach_date": reach_date_str,
            "suggested_reach_time": reach_time_str,
            "suggested_reach_time_ampm": reach_time_ampm,
            "days_ahead": days_ahead,
            "notice": slot.get("notice") or f"Technician estimated reach: {reach_time_ampm}.",
            "dropdown_text": dropdown_text
        })

    return jsonify({
        "success": True,
        "current_time": now.strftime("%I:%M %p").lstrip("0"),
        "technicians": results
    })


@technician_bp.route("/api/services/<int:job_id>/assign", methods=["POST"])
def assign_service_job(job_id):
    try:
        data = request.get_json() or {}
        technician_id = data.get("technician_id")
        appointment_date = data.get("appointment_date") or str(date.today())
        start_time_str = data.get("appointment_start_time") or "10:00"
        duration_minutes = int(data.get("estimated_duration_minutes") or 60)
        priority = str(data.get("priority") or "Normal").strip()
        complaint_type = str(data.get("complaint_type") or "Hardware Repair").strip()

        if not technician_id:
            return jsonify({"success": False, "message": "Technician select karna zaroori hai."}), 400

        # 1. Fetch Job
        g.cursor.execute("SELECT id, service_number, customer_name, service_status FROM service_jobs WHERE id = %s", (job_id,))
        job = g.cursor.fetchone()
        if not job:
            return jsonify({"success": False, "message": f"Service complaint #{job_id} nahi mili."}), 404

        # 2. Fetch Technician
        g.cursor.execute("SELECT id, full_name FROM employees WHERE id = %s", (technician_id,))
        tech_row = g.cursor.fetchone()
        if not tech_row:
            return jsonify({"success": False, "message": "Technician profile nahi mili."}), 404
        tech_name = tech_row.get("full_name") or "Technician"

        # 3. Normalize priority
        valid_priorities = {"Low", "Normal", "High", "Urgent"}
        if priority not in valid_priorities:
            priority = "Normal"

        # 4. Normalize appointment_date
        if appointment_date and len(str(appointment_date)) >= 10:
            appointment_date = str(appointment_date)[:10]
        else:
            appointment_date = str(date.today())

        # 5. Parse appointment_start_time
        start_time_raw = str(start_time_str).strip()
        parsed_time = None
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M%p"):
            try:
                if "%Y" in fmt:
                    parsed_time = datetime.strptime(f"{appointment_date} {start_time_raw}", fmt)
                else:
                    t_val = datetime.strptime(start_time_raw, fmt).time()
                    d_val = datetime.strptime(appointment_date, "%Y-%m-%d").date()
                    parsed_time = datetime.combine(d_val, t_val)
                break
            except ValueError:
                pass

        if not parsed_time:
            parsed_time = datetime.combine(datetime.strptime(appointment_date, "%Y-%m-%d").date(), datetime.strptime("10:00:00", "%H:%M:%S").time())

        t_start = parsed_time
        t_end = t_start + timedelta(minutes=duration_minutes)
        start_time = t_start.strftime("%H:%M:%S")
        end_time = t_end.strftime("%H:%M:%S")

        # 6. Strict check: Block assignment if technician has approved leave on appointment_date
        g.cursor.execute(
            """
            SELECT id, leave_type, reason, start_date, end_date
            FROM employee_leave_requests
            WHERE employee_id = %s
              AND status = 'Approved'
              AND %s BETWEEN start_date AND end_date
            LIMIT 1
            """,
            (technician_id, appointment_date)
        )
        leave_conflict = g.cursor.fetchone()
        if leave_conflict:
            l_type = leave_conflict.get("leave_type") or "Leave"
            return jsonify({
                "success": False,
                "message": f"Technician '{tech_name}' {appointment_date} ko chhutti ({l_type}) par hain. Kripya doosri date ya technician chunein."
            }), 400

        # 7. Update service_jobs
        g.cursor.execute(
            """
            UPDATE service_jobs
            SET assigned_technician_id = %s,
                technician = %s,
                technician_name = %s,
                service_type = 'Field',
                appointment_date = %s,
                appointment_start_time = %s,
                appointment_end_time = %s,
                estimated_duration_minutes = %s,
                priority = %s,
                complaint_type = %s,
                assigned_at = CURRENT_TIMESTAMP,
                service_status = IF(service_status IN ('Pending', 'Received'), 'Assigned', service_status)
            WHERE id = %s
            """,
            (technician_id, tech_name, tech_name, appointment_date, start_time, end_time, duration_minutes, priority, complaint_type, job_id)
        )
        g.db.commit()

        service_no = job.get("service_number") or f"JOB-{job_id}"
        user_id = getattr(g, "user_id", None)
        if not user_id and getattr(g, "current_user", None):
            user_id = g.current_user.get("id")

        try:
            log_technician_activity(
                employee_id=technician_id,
                user_id=user_id,
                activity_type="JOB_STATUS",
                action="Job Assigned",
                description=f"Job #{service_no} assigned to {tech_name} on {appointment_date} ({start_time[:5]} - {end_time[:5]})",
                service_job_id=job_id
            )
        except Exception as e:
            print(f"Warning: could not log technician activity: {e}")

        return jsonify({
            "success": True,
            "message": f"Complaint #{service_no} सफलतापूर्वक '{tech_name}' ko assign ho gayi hai ({appointment_date} {start_time[:5]} - {end_time[:5]}).",
            "service_number": service_no,
            "appointment_date": appointment_date,
            "start_time": start_time[:5],
            "end_time": end_time[:5]
        })

    except Exception as e:
        if getattr(g, "db", None) and g.db.is_connected():
            try:
                g.db.rollback()
            except Exception:
                pass
        print(f"Error in assign_service_job: {e}")
        return jsonify({"success": False, "message": f"Technician assign nahi ho paya: {str(e)}"}), 500


# ==============================================================================
# TECHNICIAN LEAVE APPLICATION & ADMIN APPROVAL
# ==============================================================================

@technician_bp.route("/api/tech/leave/apply", methods=["POST"])
def technician_apply_leave():
    user_id = g.user_id
    g.cursor.execute("SELECT id, full_name FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee profile not found."}), 404
    emp_id = emp["id"]

    data = request.get_json() or {}
    leave_type = (data.get("leave_type") or "Casual Leave").strip()
    start_date_str = (data.get("start_date") or "").strip()
    end_date_str = (data.get("end_date") or start_date_str).strip()
    reason = (data.get("reason") or "").strip()

    if not start_date_str or not end_date_str:
        return jsonify({"success": False, "message": "Start date and End date are required."}), 400

    if not reason:
        return jsonify({"success": False, "message": "Please specify a reason for leave (छुट्टी का कारण लिखना आवश्यक है)."}), 400

    try:
        d_start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        d_end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"success": False, "message": "Invalid date format. Use YYYY-MM-DD."}), 400

    if d_end < d_start:
        return jsonify({"success": False, "message": "End date cannot be earlier than start date."}), 400

    total_days = (d_end - d_start).days + 1

    # Check for overlapping pending or approved leave requests
    g.cursor.execute(
        """
        SELECT id, start_date, end_date, status
        FROM employee_leave_requests
        WHERE employee_id = %s
          AND status IN ('Pending', 'Approved')
          AND NOT (end_date < %s OR start_date > %s)
        LIMIT 1
        """,
        (emp_id, str(d_start), str(d_end))
    )
    overlap = g.cursor.fetchone()
    if overlap:
        return jsonify({
            "success": False,
            "message": f"You already have a {overlap['status']} leave request from {overlap['start_date']} to {overlap['end_date']}."
        }), 400

    g.cursor.execute(
        """
        INSERT INTO employee_leave_requests (
            employee_id, leave_type, start_date, end_date, total_days, reason, status
        ) VALUES (%s, %s, %s, %s, %s, %s, 'Pending')
        """,
        (emp_id, leave_type, str(d_start), str(d_end), total_days, reason)
    )
    g.db.commit()
    req_id = g.cursor.lastrowid

    return jsonify({
        "success": True,
        "message": f"Leave application for {total_days} day(s) submitted successfully. Waiting for Admin/Manager approval.",
        "request_id": req_id,
        "total_days": total_days
    }), 201


@technician_bp.route("/api/tech/leave/my-requests", methods=["GET"])
def technician_my_leave_requests():
    user_id = g.user_id
    g.cursor.execute("SELECT id FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee profile not found."}), 404
    emp_id = emp["id"]

    g.cursor.execute(
        """
        SELECT lr.*, u.full_name AS reviewed_by_name
        FROM employee_leave_requests lr
        LEFT JOIN users u ON u.id = lr.reviewed_by_user_id
        WHERE lr.employee_id = %s
        ORDER BY lr.id DESC
        """,
        (emp_id,)
    )
    requests_list = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "requests": requests_list})


@technician_bp.route("/api/admin/leave-requests", methods=["GET"])
def admin_get_leave_requests():
    status_filter = (request.args.get("status") or "").strip()
    query = """
        SELECT lr.*, e.employee_code, e.full_name AS employee_name, e.phone, e.designation,
               u.full_name AS reviewed_by_name, u.username AS reviewed_by_username
        FROM employee_leave_requests lr
        JOIN employees e ON e.id = lr.employee_id
        LEFT JOIN users u ON u.id = lr.reviewed_by_user_id
    """
    params = []
    if status_filter:
        query += " WHERE lr.status = %s"
        params.append(status_filter)

    query += " ORDER BY FIELD(lr.status, 'Pending', 'Approved', 'Rejected'), lr.id DESC"

    g.cursor.execute(query, tuple(params))
    rows = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "requests": rows})


@technician_bp.route("/api/admin/leave-requests/<int:req_id>/action", methods=["POST"])
def admin_action_leave_request(req_id):
    data = request.get_json() or {}
    action = (data.get("action") or "").strip().lower()
    admin_remark = (data.get("admin_remark") or "").strip()
    reviewer_user_id = g.user_id

    if action not in ("approve", "reject"):
        return jsonify({"success": False, "message": "Invalid action. Use 'approve' or 'reject'."}), 400

    g.cursor.execute("SELECT * FROM employee_leave_requests WHERE id = %s LIMIT 1", (req_id,))
    leave_req = g.cursor.fetchone()
    if not leave_req:
        return jsonify({"success": False, "message": "Leave request not found."}), 404

    new_status = "Approved" if action == "approve" else "Rejected"

    g.cursor.execute(
        """
        UPDATE employee_leave_requests
        SET status = %s,
            admin_remark = %s,
            reviewed_by_user_id = %s,
            reviewed_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """,
        (new_status, admin_remark, reviewer_user_id, req_id)
    )

    # If approved, populate employee_attendance with status='On_Leave' for the date range
    if action == "approve":
        emp_id = leave_req["employee_id"]
        start_date = leave_req["start_date"]
        end_date = leave_req["end_date"]
        
        g.cursor.execute("SELECT user_id FROM employees WHERE id = %s LIMIT 1", (emp_id,))
        emp_row = g.cursor.fetchone()
        emp_user_id = emp_row["user_id"] if (emp_row and emp_row.get("user_id")) else reviewer_user_id

        # Calculate all dates in range
        cur_d = start_date
        while cur_d <= end_date:
            g.cursor.execute(
                """
                INSERT INTO employee_attendance (employee_id, user_id, attendance_date, status, is_corrected)
                VALUES (%s, %s, %s, 'On_Leave', 1)
                ON DUPLICATE KEY UPDATE status = 'On_Leave', is_corrected = 1
                """,
                (emp_id, emp_user_id, str(cur_d))
            )
            cur_d += timedelta(days=1)

    g.db.commit()

    return jsonify({
        "success": True,
        "message": f"Leave request #{req_id} has been {new_status} successfully.",
        "status": new_status
    })


# ==============================================================================
# ATTENDANCE & GPS TRACKING
# ==============================================================================

@technician_bp.route("/api/tech/attendance/today", methods=["GET"])
def get_my_today_attendance():
    user_id = g.user_id
    today = str(date.today())

    g.cursor.execute("SELECT id FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee profile not found."}), 404

    g.cursor.execute(
        """
        SELECT id, attendance_date, check_in_time, check_in_lat, check_in_lng, check_in_address,
               check_out_time, check_out_lat, check_out_lng, check_out_address,
               total_working_minutes, status, is_corrected
        FROM employee_attendance
        WHERE employee_id = %s AND attendance_date = %s
        LIMIT 1
        """,
        (emp["id"], today)
    )
    att = serialize_row(g.cursor.fetchone())

    # Check if geofence is active
    g.cursor.execute("SELECT is_active, office_name, radius_meters FROM attendance_geofence_settings WHERE is_active = 1 LIMIT 1")
    geo_setting = g.cursor.fetchone()

    return jsonify({
        "success": True,
        "today": today,
        "has_checked_in": bool(att and att["check_in_time"]),
        "has_checked_out": bool(att and att["check_out_time"]),
        "attendance": att,
        "geofence_active": bool(geo_setting),
        "geofence_info": serialize_row(geo_setting) if geo_setting else None
    })


@technician_bp.route("/api/tech/attendance/history", methods=["GET"])
def get_my_attendance_history():
    user_id = g.user_id
    month_param = (request.args.get("month") or "").strip()
    now = datetime.now()
    if not month_param or len(month_param) != 7:
        month_param = now.strftime("%Y-%m")

    g.cursor.execute("SELECT id, full_name FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee profile not found."}), 404
    emp_id = emp["id"]

    try:
        year, month = map(int, month_param.split("-"))
    except ValueError:
        year, month = now.year, now.month
        month_param = f"{year:04d}-{month:02d}"

    if month == 12:
        next_month_date = date(year + 1, 1, 1)
    else:
        next_month_date = date(year, month + 1, 1)
    total_days_in_month = (next_month_date - date(year, month, 1)).days

    # Query all attendance records for this month
    g.cursor.execute(
        """
        SELECT id, attendance_date, check_in_time, check_out_time, total_working_minutes,
               status, check_in_address, is_corrected
        FROM employee_attendance
        WHERE employee_id = %s AND attendance_date >= %s AND attendance_date < %s
        ORDER BY attendance_date DESC
        """,
        (emp_id, f"{month_param}-01", str(next_month_date))
    )
    rows = g.cursor.fetchall()
    records_by_date = {}
    for r in rows:
        d_str = str(r["attendance_date"])
        records_by_date[d_str] = serialize_row(r)

    # Query approved leaves for this month
    g.cursor.execute(
        """
        SELECT start_date, end_date, leave_type, reason
        FROM employee_leave_requests
        WHERE employee_id = %s
          AND status = 'Approved'
          AND end_date >= %s AND start_date < %s
        """,
        (emp_id, f"{month_param}-01", str(next_month_date))
    )
    approved_leaves = g.cursor.fetchall()

    today = date.today()
    max_day = min(total_days_in_month, today.day if (year == today.year and month == today.month) else total_days_in_month)

    days_list = []
    present_count = 0
    absent_count = 0
    half_day_count = 0
    leave_count = 0
    total_working_mins = 0

    for d in range(max_day, 0, -1):
        cur_date = date(year, month, d)
        date_str = cur_date.strftime("%Y-%m-%d")
        day_name = cur_date.strftime("%a")
        is_sunday = cur_date.weekday() == 6

        # Check if this date falls within any approved leave
        matched_leave = None
        for lv in approved_leaves:
            lv_start = lv["start_date"] if isinstance(lv["start_date"], date) else datetime.strptime(str(lv["start_date"])[:10], "%Y-%m-%d").date()
            lv_end = lv["end_date"] if isinstance(lv["end_date"], date) else datetime.strptime(str(lv["end_date"])[:10], "%Y-%m-%d").date()
            if lv_start <= cur_date <= lv_end:
                matched_leave = lv
                break

        rec = records_by_date.get(date_str)
        if rec and rec.get("check_in_time"):
            if not rec.get("check_out_time") and cur_date == today:
                status = "On Duty"
            else:
                status = rec.get("status") or "Present"

            if status in ("Present", "On Duty"):
                present_count += 1
            elif status == "Half Day":
                half_day_count += 1
            mins = int(rec.get("total_working_minutes") or 0)
            total_working_mins += mins
            days_list.append({
                "date": date_str,
                "day_name": day_name,
                "status": status,
                "check_in": str(rec["check_in_time"])[:5],
                "check_out": str(rec["check_out_time"])[:5] if rec.get("check_out_time") else ("In Progress" if cur_date == today else "--:--"),
                "working_minutes": mins,
                "is_sunday": is_sunday,
                "is_today": (cur_date == today),
                "is_corrected": bool(rec.get("is_corrected"))
            })
        elif matched_leave or (rec and rec.get("status") == "On_Leave"):
            status = "On Leave"
            leave_count += 1
            days_list.append({
                "date": date_str,
                "day_name": day_name,
                "status": "On Leave",
                "leave_type": matched_leave["leave_type"] if matched_leave else "Approved Leave",
                "check_in": "--:--",
                "check_out": "--:--",
                "working_minutes": 0,
                "is_sunday": is_sunday,
                "is_today": (cur_date == today),
                "is_corrected": False
            })
        else:
            status = "Weekly Off" if is_sunday else "Absent"
            if not is_sunday and cur_date <= today:
                absent_count += 1
            days_list.append({
                "date": date_str,
                "day_name": day_name,
                "status": status,
                "check_in": "--:--",
                "check_out": "--:--",
                "working_minutes": 0,
                "is_sunday": is_sunday,
                "is_today": (cur_date == today),
                "is_corrected": False
            })

    month_name = datetime(year, month, 1).strftime("%B %Y")

    return jsonify({
        "success": True,
        "month": month_param,
        "month_label": month_name,
        "summary": {
            "total_days": max_day,
            "present_days": present_count,
            "absent_days": absent_count,
            "half_days": half_day_count,
            "leave_days": leave_count,
            "total_hours": round(total_working_mins / 60, 1),
            "total_working_hours": round(total_working_mins / 60, 1)
        },
        "days": days_list,
        "records": days_list
    })


# ==============================================================================
# GEOFENCING / OFFICE LOCATION-BASED ATTENDANCE RESTRICTION
# ==============================================================================

def calculate_geodesic_distance_meters(lat1, lon1, lat2, lon2):
    """
    Calculate geodesic distance between two points in meters using Haversine formula.
    """
    try:
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except (TypeError, ValueError):
        return None

    R = 6371000.0  # Earth's mean radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c


def check_attendance_geofence(lat, lng):
    """
    Verifies if (lat, lng) falls within any active geofence boundary.
    Returns: (is_allowed: bool, violation_details: dict or None)
    """
    g.cursor.execute(
        """
        SELECT id, office_name, latitude, longitude, radius_meters, is_active, office_address
        FROM attendance_geofence_settings
        WHERE is_active = 1
        """
    )
    geofences = g.cursor.fetchall()
    if not geofences:
        # Geofencing is either disabled or no active office location configured
        return True, None

    if lat is None or lng is None:
        return False, {
            "geofence_violation": True,
            "message": "GPS location is required for attendance. Please turn on device location (उपस्थिति दर्ज करने के लिए लोकेशन ऑन करें)।",
            "distance_meters": None,
            "allowed_radius": geofences[0]["radius_meters"]
        }

    closest_fence = None
    min_dist = float("inf")

    for fence in geofences:
        f_lat = fence["latitude"]
        f_lng = fence["longitude"]
        dist = calculate_geodesic_distance_meters(lat, lng, f_lat, f_lng)
        if dist is not None and dist < min_dist:
            min_dist = dist
            closest_fence = fence

    if closest_fence is None:
        return True, None

    allowed_radius = int(closest_fence["radius_meters"] or 100)
    if min_dist <= allowed_radius:
        return True, None

    # Outside radius!
    dist_rounded = int(round(min_dist))
    office_name = closest_fence["office_name"] or "Office / Workshop"
    return False, {
        "geofence_violation": True,
        "message": f"🚫 Attendance Rejected: You are {dist_rounded}m away from {office_name}. Allowed radius is {allowed_radius}m (आप निर्धारित स्थान से {dist_rounded} मीटर दूर हैं। उपस्थिति सिर्फ ऑफिस के {allowed_radius}m दायरे के अंदर से ही लग सकती है)।",
        "distance_meters": dist_rounded,
        "allowed_radius": allowed_radius,
        "office_name": office_name
    }


@technician_bp.route("/api/admin/geofence-settings", methods=["GET"])
def get_geofence_settings():
    g.cursor.execute("SELECT * FROM attendance_geofence_settings ORDER BY id ASC LIMIT 1")
    setting = g.cursor.fetchone()
    if not setting:
        return jsonify({
            "success": True,
            "configured": False,
            "settings": {
                "id": None,
                "office_name": "Main Office / Workshop",
                "latitude": None,
                "longitude": None,
                "radius_meters": 100,
                "is_active": 0,
                "office_address": ""
            }
        })
    return jsonify({
        "success": True,
        "configured": True,
        "settings": serialize_row(setting)
    })


@technician_bp.route("/api/admin/geofence-settings", methods=["POST"])
def save_geofence_settings():
    data = request.get_json() or {}
    office_name = (data.get("office_name") or "Main Office / Workshop").strip()
    lat = data.get("latitude")
    lng = data.get("longitude")
    radius = int(data.get("radius_meters") or 100)
    is_active = 1 if data.get("is_active") in (1, True, "1", "true") else 0
    address = (data.get("office_address") or "").strip()
    user_id = g.user_id

    if is_active and (lat is None or lng is None):
        return jsonify({
            "success": False,
            "message": "Latitude and Longitude are required to enable geofencing (लोकेशन अक्षांश एवं देशान्तर आवश्यक हैं)."
        }), 400

    try:
        if lat is not None:
            lat = float(lat)
        if lng is not None:
            lng = float(lng)
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Invalid latitude/longitude values."}), 400

    g.cursor.execute("SELECT id FROM attendance_geofence_settings ORDER BY id ASC LIMIT 1")
    existing = g.cursor.fetchone()

    if existing:
        g.cursor.execute(
            """
            UPDATE attendance_geofence_settings
            SET office_name = %s, latitude = %s, longitude = %s, radius_meters = %s,
                is_active = %s, office_address = %s, updated_by_user_id = %s
            WHERE id = %s
            """,
            (office_name, lat, lng, radius, is_active, address, user_id, existing["id"])
        )
    else:
        g.cursor.execute(
            """
            INSERT INTO attendance_geofence_settings (
                office_name, latitude, longitude, radius_meters, is_active, office_address, updated_by_user_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (office_name, lat, lng, radius, is_active, address, user_id)
        )

    g.db.commit()

    return jsonify({
        "success": True,
        "message": "Geofence settings updated successfully (लोकेशन दायरा सफलतापूर्वक सुरक्षित हुआ)!",
        "settings": {
            "office_name": office_name,
            "latitude": lat,
            "longitude": lng,
            "radius_meters": radius,
            "is_active": is_active,
            "office_address": address
        }
    })


@technician_bp.route("/api/tech/attendance/check-in", methods=["POST"])
def technician_check_in():
    user_id = g.user_id
    data = request.get_json() or {}
    lat = data.get("latitude")
    lng = data.get("longitude")
    addr = (data.get("address") or "").strip()
    today = str(date.today())

    # Geofence boundary verification
    allowed, violation = check_attendance_geofence(lat, lng)
    if not allowed:
        log_technician_activity(
            user_id=user_id,
            activity_type="GEOFENCE_ALERT",
            action="Check-in Blocked",
            description=f"Attendance punch-in blocked outside geofence boundary ({violation.get('distance_meters')}m from office)",
            latitude=lat,
            longitude=lng
        )
        return jsonify({
            "success": False,
            "geofence_violation": True,
            "message": violation["message"],
            "distance_meters": violation.get("distance_meters"),
            "allowed_radius": violation.get("allowed_radius")
        }), 400

    g.cursor.execute("SELECT id, full_name FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee profile not found."}), 404
    emp_id = emp["id"]

    g.cursor.execute(
        "SELECT id, check_in_time FROM employee_attendance WHERE employee_id = %s AND attendance_date = %s",
        (emp_id, today)
    )
    existing = g.cursor.fetchone()
    if existing and existing.get("check_in_time"):
        return jsonify({
            "success": True,
            "message": "Already checked in today.",
            "check_in_time": serialize_val(existing["check_in_time"])[:5]
        })

    now_time = datetime.now().strftime("%H:%M:%S")
    g.cursor.execute(
        """
        INSERT INTO employee_attendance (employee_id, user_id, attendance_date, check_in_time, check_in_lat, check_in_lng, check_in_address, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'Present')
        ON DUPLICATE KEY UPDATE check_in_time = VALUES(check_in_time), check_in_lat = VALUES(check_in_lat),
                                check_in_lng = VALUES(check_in_lng), check_in_address = VALUES(check_in_address),
                                status = 'Present'
        """,
        (emp_id, user_id, today, now_time, lat, lng, addr)
    )
    g.db.commit()

    log_technician_activity(
        employee_id=emp_id,
        user_id=user_id,
        activity_type="ATTENDANCE",
        action="Punch In",
        description=f"{emp.get('full_name', 'Technician')} marked attendance (Punch In) at {now_time[:5]}",
        latitude=lat,
        longitude=lng,
        location_address=addr
    )

    return jsonify({
        "success": True,
        "message": "Check-in recorded successfully with GPS location.",
        "check_in_time": now_time[:5]
    })


@technician_bp.route("/api/tech/attendance/check-out", methods=["POST"])
def technician_check_out():
    user_id = g.user_id
    data = request.get_json() or {}
    lat = data.get("latitude")
    lng = data.get("longitude")
    addr = (data.get("address") or "").strip()
    today = str(date.today())

    # Geofence boundary verification
    allowed, violation = check_attendance_geofence(lat, lng)
    if not allowed:
        log_technician_activity(
            user_id=user_id,
            activity_type="GEOFENCE_ALERT",
            action="Check-out Blocked",
            description=f"Attendance punch-out blocked outside geofence boundary ({violation.get('distance_meters')}m from office)",
            latitude=lat,
            longitude=lng
        )
        return jsonify({
            "success": False,
            "geofence_violation": True,
            "message": violation["message"],
            "distance_meters": violation.get("distance_meters"),
            "allowed_radius": violation.get("allowed_radius")
        }), 400

    g.cursor.execute("SELECT id, full_name FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee profile not found."}), 404
    emp_id = emp["id"]

    g.cursor.execute(
        "SELECT id, check_in_time FROM employee_attendance WHERE employee_id = %s AND attendance_date = %s",
        (emp_id, today)
    )
    att = g.cursor.fetchone()
    if not att or not att.get("check_in_time"):
        return jsonify({"success": False, "message": "Cannot check out without checking in first."}), 400

    now_time = datetime.now().strftime("%H:%M:%S")
    check_in_str = serialize_val(att['check_in_time'])
    check_in_dt = datetime.strptime(f"{today} {check_in_str}", "%Y-%m-%d %H:%M:%S")
    check_out_dt = datetime.strptime(f"{today} {now_time}", "%Y-%m-%d %H:%M:%S")
    working_mins = max(0, int((check_out_dt - check_in_dt).total_seconds() / 60))

    g.cursor.execute(
        """
        UPDATE employee_attendance
        SET check_out_time = %s, check_out_lat = %s, check_out_lng = %s, check_out_address = %s,
            total_working_minutes = %s
        WHERE id = %s
        """,
        (now_time, lat, lng, addr, working_mins, att["id"])
    )
    g.db.commit()

    log_technician_activity(
        employee_id=emp_id,
        user_id=user_id,
        activity_type="ATTENDANCE",
        action="Punch Out",
        description=f"{emp.get('full_name', 'Technician')} completed shift (Punch Out) at {now_time[:5]} ({working_mins} mins worked)",
        latitude=lat,
        longitude=lng,
        location_address=addr
    )

    return jsonify({
        "success": True,
        "message": "Check-out recorded successfully.",
        "check_out_time": now_time[:5],
        "working_minutes": working_mins
    })


@technician_bp.route("/api/tech/gps/ping", methods=["POST"])
def technician_gps_ping():
    user_id = g.user_id
    data = request.get_json() or {}
    lat = data.get("latitude")
    lng = data.get("longitude")
    job_id = data.get("service_job_id") or None
    acc = data.get("accuracy_meters")
    spd = data.get("speed_kmh")
    bat = data.get("battery_level")

    if lat is None or lng is None:
        return jsonify({"success": False, "message": "Coordinates required."}), 400

    g.cursor.execute("SELECT id FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee not found."}), 404

    g.cursor.execute(
        """
        INSERT INTO employee_gps_locations (employee_id, service_job_id, latitude, longitude, accuracy_meters, speed_kmh, battery_level)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (emp["id"], job_id, lat, lng, acc, spd, bat)
    )
    g.db.commit()
    return jsonify({"success": True})


@technician_bp.route("/api/attendance", methods=["GET"])
def list_attendance():
    target_date = request.args.get("date") or str(date.today())
    emp_id = request.args.get("employee_id")

    sql = """
        SELECT ea.*, e.employee_code, e.full_name, e.phone, e.designation,
               (SELECT COUNT(*) FROM attendance_corrections ac WHERE ac.attendance_id = ea.id) AS corrections_count
        FROM employees e
        LEFT JOIN employee_attendance ea ON ea.employee_id = e.id AND ea.attendance_date = %s
        WHERE e.status = 'Active'
    """
    params = [target_date]
    if emp_id:
        sql += " AND e.id = %s"
        params.append(emp_id)

    sql += " ORDER BY e.full_name ASC"
    g.cursor.execute(sql, params)
    records = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "date": target_date, "attendance": records})


@technician_bp.route("/api/attendance/<int:att_id>/correct", methods=["POST"])
def correct_attendance(att_id):
    data = request.get_json() or {}
    reason = (data.get("correction_reason") or "").strip()
    new_check_in = data.get("new_check_in") or None
    new_check_out = data.get("new_check_out") or None
    new_status = data.get("new_status") or "Present"

    if not reason or len(reason) < 5:
        return jsonify({"success": False, "message": "A detailed correction reason (minimum 5 characters) is required."}), 400

    g.cursor.execute("SELECT * FROM employee_attendance WHERE id = %s", (att_id,))
    curr = g.cursor.fetchone()
    if not curr:
        return jsonify({"success": False, "message": "Attendance record not found."}), 404

    working_mins = curr.get("total_working_minutes") or 0
    if new_check_in and new_check_out:
        try:
            t1 = datetime.strptime(str(new_check_in)[:5], "%H:%M")
            t2 = datetime.strptime(str(new_check_out)[:5], "%H:%M")
            working_mins = max(0, int((t2 - t1).total_seconds() / 60))
        except Exception:
            pass

    g.cursor.execute(
        """
        INSERT INTO attendance_corrections (attendance_id, employee_id, old_check_in, new_check_in,
                                           old_check_out, new_check_out, old_status, new_status,
                                           correction_reason, corrected_by_user_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (att_id, curr["employee_id"], curr.get("check_in_time"), new_check_in,
         curr.get("check_out_time"), new_check_out, curr.get("status"), new_status,
         reason, g.user_id)
    )

    g.cursor.execute(
        """
        UPDATE employee_attendance
        SET check_in_time = %s, check_out_time = %s, status = %s,
            total_working_minutes = %s, is_corrected = 1
        WHERE id = %s
        """,
        (new_check_in, new_check_out, new_status, working_mins, att_id)
    )
    g.db.commit()

    return jsonify({"success": True, "message": "Attendance corrected successfully and audit trail logged."})


@technician_bp.route("/api/attendance/<int:att_id>/history", methods=["GET"])
def attendance_history(att_id):
    g.cursor.execute(
        """
        SELECT ac.*, u.username AS corrected_by_username, u.full_name AS corrected_by_name
        FROM attendance_corrections ac
        JOIN users u ON u.id = ac.corrected_by_user_id
        WHERE ac.attendance_id = %s
        ORDER BY ac.created_at DESC
        """,
        (att_id,)
    )
    history = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "history": history})



# ==============================================================================
# COMPREHENSIVE ATTENDANCE REPORTS (Admin Portal)
# 1. Daily report
# 2. Monthly report
# 3. Employee-wise report
# 4. Working-hours report
# 5. Leave/absence report
# ==============================================================================

@technician_bp.route("/api/admin/attendance-reports", methods=["GET"])
def admin_attendance_reports():
    report_type = (request.args.get("report_type") or "daily").strip().lower()
    
    # 0. Active employees list for frontend filters
    g.cursor.execute("SELECT id, employee_code, full_name, designation, department, phone FROM employees WHERE status = 'Active' ORDER BY full_name ASC")
    employees_list = serialize_rows(g.cursor.fetchall())
    
    today = date.today()
    today_str = str(today)

    # --------------------------------------------------------------------------
    # 1. DAILY REPORT
    # --------------------------------------------------------------------------
    if report_type == "daily":
        target_date_str = (request.args.get("date") or today_str).strip()
        try:
            target_date = datetime.strptime(target_date_str[:10], "%Y-%m-%d").date()
        except Exception:
            target_date = today
            target_date_str = today_str
            
        is_sunday = (target_date.weekday() == 6)
        emp_filter = request.args.get("employee_id")

        sql = """
            SELECT e.id AS employee_id, e.employee_code, e.full_name, e.phone, e.designation, e.department,
                   ea.id AS attendance_id, ea.attendance_date, ea.check_in_time, ea.check_out_time,
                   ea.check_in_lat, ea.check_in_lng, ea.check_in_address,
                   ea.check_out_lat, ea.check_out_lng, ea.check_out_address,
                   ea.total_working_minutes, ea.status AS recorded_status, ea.is_corrected,
                   (SELECT lr.leave_type FROM employee_leave_requests lr 
                    WHERE lr.employee_id = e.id AND lr.status = 'Approved' 
                      AND %s BETWEEN lr.start_date AND lr.end_date LIMIT 1) AS approved_leave_type
            FROM employees e
            LEFT JOIN employee_attendance ea ON ea.employee_id = e.id AND ea.attendance_date = %s
            WHERE e.status = 'Active'
        """
        params = [target_date_str, target_date_str]
        if emp_filter and emp_filter != "all":
            sql += " AND e.id = %s"
            params.append(emp_filter)
        sql += " ORDER BY e.full_name ASC"

        g.cursor.execute(sql, params)
        raw_rows = g.cursor.fetchall()

        records = []
        present_cnt = 0
        half_day_cnt = 0
        leave_cnt = 0
        absent_cnt = 0
        weekly_off_cnt = 0
        total_mins_clocked = 0
        late_checkin_cnt = 0

        for r in raw_rows:
            r = serialize_row(r)
            check_in = r.get("check_in_time")
            check_out = r.get("check_out_time")
            working_mins = int(r.get("total_working_minutes") or 0)
            approved_leave = r.get("approved_leave_type")

            # Determine daily status
            if check_in:
                if not check_out and target_date == today:
                    status = "On Duty"
                else:
                    status = r.get("recorded_status") or "Present"
            elif approved_leave or r.get("recorded_status") == "On_Leave":
                status = "On Leave"
            elif is_sunday:
                status = "Weekly Off"
            elif target_date <= today:
                status = "Absent"
            else:
                status = "Upcoming"

            # Check late arrival (after 09:30 AM)
            is_late = False
            if check_in:
                c_str = str(check_in)[:5]
                if c_str > "09:30":
                    is_late = True
                    late_checkin_cnt += 1

            if status in ("Present", "On Duty"):
                present_cnt += 1
            elif status in ("Half_Day", "Half Day"):
                half_day_cnt += 1
            elif status == "On Leave":
                leave_cnt += 1
            elif status == "Weekly Off":
                weekly_off_cnt += 1
            elif status == "Absent":
                absent_cnt += 1

            total_mins_clocked += working_mins

            records.append({
                "employee_id": r["employee_id"],
                "employee_code": r["employee_code"],
                "full_name": r["full_name"],
                "phone": r["phone"],
                "designation": r["designation"],
                "department": r["department"],
                "attendance_id": r.get("attendance_id"),
                "date": target_date_str,
                "status": status,
                "check_in_time": str(check_in)[:5] if check_in else "--:--",
                "check_out_time": str(check_out)[:5] if check_out else ("In Progress" if (status == "On Duty") else "--:--"),
                "check_in_address": r.get("check_in_address") or "N/A",
                "check_out_address": r.get("check_out_address") or "N/A",
                "working_minutes": working_mins,
                "working_hours_formatted": f"{working_mins // 60}h {working_mins % 60}m" if working_mins > 0 else "--",
                "is_late": is_late,
                "is_corrected": bool(r.get("is_corrected")),
                "leave_type": approved_leave
            })

        total_staff = len(records)
        active_attendance_count = present_cnt + half_day_cnt
        avg_mins = (total_mins_clocked // active_attendance_count) if active_attendance_count > 0 else 0

        summary = {
            "date": target_date_str,
            "total_staff": total_staff,
            "present_count": present_cnt,
            "half_day_count": half_day_cnt,
            "leave_count": leave_cnt,
            "absent_count": absent_cnt,
            "weekly_off_count": weekly_off_cnt,
            "late_count": late_checkin_cnt,
            "total_hours_formatted": f"{total_mins_clocked // 60}h {total_mins_clocked % 60}m",
            "avg_hours_formatted": f"{avg_mins // 60}h {avg_mins % 60}m"
        }

        return jsonify({
            "success": True,
            "report_type": "daily",
            "date": target_date_str,
            "summary": summary,
            "records": records,
            "employees": employees_list
        })

    # --------------------------------------------------------------------------
    # 2. MONTHLY REPORT
    # --------------------------------------------------------------------------
    elif report_type == "monthly":
        month_param = (request.args.get("month") or today.strftime("%Y-%m")).strip()[:7]
        try:
            year, m = map(int, month_param.split("-"))
        except Exception:
            year, m = today.year, today.month
            month_param = f"{year:04d}-{m:02d}"

        start_date = date(year, m, 1)
        if m == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, m + 1, 1) - timedelta(days=1)

        total_days_in_month = (end_date - start_date).days + 1
        effective_end = min(end_date, today)
        days_elapsed = max(0, (effective_end - start_date).days + 1) if effective_end >= start_date else 0

        # Query all attendance for active employees for the month
        g.cursor.execute(
            """
            SELECT ea.employee_id, ea.attendance_date, ea.check_in_time, ea.check_out_time,
                   ea.total_working_minutes, ea.status
            FROM employee_attendance ea
            WHERE ea.attendance_date BETWEEN %s AND %s
            """,
            (str(start_date), str(end_date))
        )
        att_rows = g.cursor.fetchall()
        # Group by employee_id -> date_str
        att_by_emp = {}
        for row in att_rows:
            e_id = row["employee_id"]
            if e_id not in att_by_emp:
                att_by_emp[e_id] = {}
            att_by_emp[e_id][str(row["attendance_date"])] = row

        # Query approved leaves for the month
        g.cursor.execute(
            """
            SELECT employee_id, start_date, end_date, leave_type
            FROM employee_leave_requests
            WHERE status = 'Approved' AND end_date >= %s AND start_date <= %s
            """,
            (str(start_date), str(end_date))
        )
        leaves_rows = g.cursor.fetchall()
        leaves_by_emp = {}
        for lrow in leaves_rows:
            e_id = lrow["employee_id"]
            if e_id not in leaves_by_emp:
                leaves_by_emp[e_id] = []
            leaves_by_emp[e_id].append(lrow)

        emp_filter = request.args.get("employee_id")
        filtered_employees = [e for e in employees_list if not emp_filter or emp_filter == "all" or str(e["id"]) == str(emp_filter)]

        records = []
        overall_total_hours = 0
        overall_present_mandays = 0
        overall_leave_mandays = 0
        overall_attendance_pct_sum = 0

        for emp in filtered_employees:
            e_id = emp["id"]
            emp_att = att_by_emp.get(e_id, {})
            emp_leaves = leaves_by_emp.get(e_id, [])

            present_days = 0
            half_days = 0
            leave_days = 0
            sundays = 0
            absent_days = 0
            total_emp_mins = 0

            for d in range(1, days_elapsed + 1):
                cur_d = date(year, m, d)
                cur_d_str = str(cur_d)
                is_sun = (cur_d.weekday() == 6)

                if is_sun:
                    sundays += 1
                    continue

                # Check approved leave
                is_on_leave = False
                for lv in emp_leaves:
                    l_start = lv["start_date"] if isinstance(lv["start_date"], date) else datetime.strptime(str(lv["start_date"])[:10], "%Y-%m-%d").date()
                    l_end = lv["end_date"] if isinstance(lv["end_date"], date) else datetime.strptime(str(lv["end_date"])[:10], "%Y-%m-%d").date()
                    if l_start <= cur_d <= l_end:
                        is_on_leave = True
                        break

                rec = emp_att.get(cur_d_str)
                if rec and rec.get("check_in_time"):
                    st = rec.get("status") or "Present"
                    if st in ("Half_Day", "Half Day"):
                        half_days += 1
                    else:
                        present_days += 1
                    total_emp_mins += int(rec.get("total_working_minutes") or 0)
                elif is_on_leave or (rec and rec.get("status") == "On_Leave"):
                    leave_days += 1
                else:
                    absent_days += 1

            workable_days = max(0, days_elapsed - sundays - leave_days)
            att_pct = round(((present_days + 0.5 * half_days) / workable_days * 100), 1) if workable_days > 0 else 100.0
            emp_hours = round(total_emp_mins / 60, 1)
            active_days = present_days + half_days
            avg_daily_hours = round(emp_hours / active_days, 1) if active_days > 0 else 0.0

            overall_total_hours += emp_hours
            overall_present_mandays += present_days
            overall_leave_mandays += leave_days
            overall_attendance_pct_sum += att_pct

            records.append({
                "employee_id": e_id,
                "employee_code": emp["employee_code"],
                "full_name": emp["full_name"],
                "designation": emp["designation"],
                "department": emp["department"],
                "total_month_days": total_days_in_month,
                "days_elapsed": days_elapsed,
                "workable_days": workable_days,
                "present_days": present_days,
                "half_days": half_days,
                "leave_days": leave_days,
                "absent_days": absent_days,
                "sundays": sundays,
                "total_hours": emp_hours,
                "total_hours_formatted": f"{total_emp_mins // 60}h {total_emp_mins % 60}m",
                "avg_daily_hours": avg_daily_hours,
                "attendance_pct": att_pct
            })

        emp_count = len(records)
        summary = {
            "month": month_param,
            "total_days_in_month": total_days_in_month,
            "days_elapsed": days_elapsed,
            "total_staff": emp_count,
            "avg_attendance_pct": round(overall_attendance_pct_sum / emp_count, 1) if emp_count > 0 else 0.0,
            "total_hours_clocked": round(overall_total_hours, 1),
            "total_present_mandays": overall_present_mandays,
            "total_leave_mandays": overall_leave_mandays
        }

        return jsonify({
            "success": True,
            "report_type": "monthly",
            "month": month_param,
            "summary": summary,
            "records": records,
            "employees": employees_list
        })

    # --------------------------------------------------------------------------
    # 3. EMPLOYEE-WISE REPORT
    # --------------------------------------------------------------------------
    elif report_type == "employee_wise":
        emp_id = request.args.get("employee_id")
        if not emp_id and employees_list:
            emp_id = employees_list[0]["id"]

        from_date_str = (request.args.get("from_date") or "").strip()
        to_date_str = (request.args.get("to_date") or "").strip()

        if not from_date_str or not to_date_str:
            month_param = (request.args.get("month") or today.strftime("%Y-%m")).strip()[:7]
            try:
                year, m = map(int, month_param.split("-"))
            except Exception:
                year, m = today.year, today.month
            start_date = date(year, m, 1)
            if m == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, m + 1, 1) - timedelta(days=1)
            from_date_str = str(start_date)
            to_date_str = str(min(end_date, today))
            
        try:
            start_date = datetime.strptime(from_date_str[:10], "%Y-%m-%d").date()
            end_date = datetime.strptime(to_date_str[:10], "%Y-%m-%d").date()
        except Exception:
            start_date = date(today.year, today.month, 1)
            end_date = today
            from_date_str = str(start_date)
            to_date_str = str(end_date)

        # Get employee details
        g.cursor.execute("SELECT * FROM employees WHERE id = %s LIMIT 1", (emp_id,))
        emp_detail = serialize_row(g.cursor.fetchone())
        if not emp_detail:
            return jsonify({"success": False, "message": "Employee not found."}), 404

        # Attendance rows for this range
        g.cursor.execute(
            """
            SELECT ea.*,
                   (SELECT COUNT(*) FROM attendance_corrections ac WHERE ac.attendance_id = ea.id) AS corrections_count
            FROM employee_attendance ea
            WHERE ea.employee_id = %s AND ea.attendance_date BETWEEN %s AND %s
            ORDER BY ea.attendance_date DESC
            """,
            (emp_id, str(start_date), str(end_date))
        )
        att_rows = g.cursor.fetchall()
        att_map = {str(r["attendance_date"]): serialize_row(r) for r in att_rows}

        # Approved leaves
        g.cursor.execute(
            """
            SELECT * FROM employee_leave_requests
            WHERE employee_id = %s AND status = 'Approved'
              AND end_date >= %s AND start_date <= %s
            """,
            (emp_id, str(start_date), str(end_date))
        )
        leave_rows = serialize_rows(g.cursor.fetchall())

        day_count = (end_date - start_date).days + 1
        days_list = []
        present_cnt = 0
        half_day_cnt = 0
        leave_cnt = 0
        absent_cnt = 0
        sundays_cnt = 0
        total_mins = 0
        overtime_mins = 0
        late_cnt = 0

        # Loop from end_date down to start_date (reverse chronological)
        for i in range(day_count - 1, -1, -1):
            cur_d = start_date + timedelta(days=i)
            cur_d_str = str(cur_d)
            is_sun = (cur_d.weekday() == 6)
            day_name = cur_d.strftime("%a")

            # Check leave match
            matched_leave = None
            for lv in leave_rows:
                l_start = datetime.strptime(str(lv["start_date"])[:10], "%Y-%m-%d").date()
                l_end = datetime.strptime(str(lv["end_date"])[:10], "%Y-%m-%d").date()
                if l_start <= cur_d <= l_end:
                    matched_leave = lv
                    break

            rec = att_map.get(cur_d_str)
            check_in = rec.get("check_in_time") if rec else None
            check_out = rec.get("check_out_time") if rec else None
            mins = int(rec.get("total_working_minutes") or 0) if rec else 0

            is_late = False
            if check_in and str(check_in)[:5] > "09:30":
                is_late = True
                late_cnt += 1

            if check_in:
                if not check_out and cur_d == today:
                    status = "On Duty"
                else:
                    status = rec.get("status") or "Present"
                if status in ("Present", "On Duty"):
                    present_cnt += 1
                elif status in ("Half_Day", "Half Day"):
                    half_day_cnt += 1
                total_mins += mins
                if mins > 480:
                    overtime_mins += (mins - 480)
            elif matched_leave or (rec and rec.get("status") == "On_Leave"):
                status = "On Leave"
                leave_cnt += 1
            elif is_sun:
                status = "Weekly Off"
                sundays_cnt += 1
            elif cur_d <= today:
                status = "Absent"
                absent_cnt += 1
            else:
                status = "Upcoming"

            days_list.append({
                "date": cur_d_str,
                "day_name": day_name,
                "status": status,
                "check_in": str(check_in)[:5] if check_in else "--:--",
                "check_out": str(check_out)[:5] if check_out else ("In Progress" if status == "On Duty" else "--:--"),
                "check_in_address": rec.get("check_in_address") if rec else "--",
                "check_out_address": rec.get("check_out_address") if rec else "--",
                "working_minutes": mins,
                "working_hours_formatted": f"{mins // 60}h {mins % 60}m" if mins > 0 else "--",
                "overtime_minutes": max(0, mins - 480),
                "is_late": is_late,
                "is_sunday": is_sun,
                "is_corrected": bool(rec.get("is_corrected")) if rec else False,
                "corrections_count": rec.get("corrections_count", 0) if rec else 0,
                "leave_type": matched_leave.get("leave_type") if matched_leave else None
            })

        workable_days = max(0, day_count - sundays_cnt - leave_cnt)
        att_pct = round(((present_cnt + 0.5 * half_day_cnt) / workable_days * 100), 1) if workable_days > 0 else 100.0
        active_days = present_cnt + half_day_cnt
        avg_daily_hours = round((total_mins / 60) / active_days, 1) if active_days > 0 else 0.0

        summary = {
            "employee": emp_detail,
            "from_date": from_date_str,
            "to_date": to_date_str,
            "total_days": day_count,
            "workable_days": workable_days,
            "present_days": present_cnt,
            "half_days": half_day_cnt,
            "leave_days": leave_cnt,
            "absent_days": absent_cnt,
            "sundays": sundays_cnt,
            "late_days": late_cnt,
            "total_hours": round(total_mins / 60, 1),
            "total_hours_formatted": f"{total_mins // 60}h {total_mins % 60}m",
            "overtime_hours": round(overtime_mins / 60, 1),
            "overtime_formatted": f"{overtime_mins // 60}h {overtime_mins % 60}m",
            "avg_daily_hours": avg_daily_hours,
            "attendance_pct": att_pct
        }

        return jsonify({
            "success": True,
            "report_type": "employee_wise",
            "summary": summary,
            "records": days_list,
            "employees": employees_list
        })

    # --------------------------------------------------------------------------
    # 4. WORKING-HOURS REPORT
    # --------------------------------------------------------------------------
    elif report_type == "working_hours":
        from_date_str = (request.args.get("from_date") or "").strip()
        to_date_str = (request.args.get("to_date") or "").strip()

        if not from_date_str or not to_date_str:
            month_param = (request.args.get("month") or today.strftime("%Y-%m")).strip()[:7]
            try:
                year, m = map(int, month_param.split("-"))
            except Exception:
                year, m = today.year, today.month
            start_date = date(year, m, 1)
            if m == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, m + 1, 1) - timedelta(days=1)
            from_date_str = str(start_date)
            to_date_str = str(min(end_date, today))
        else:
            try:
                start_date = datetime.strptime(from_date_str[:10], "%Y-%m-%d").date()
                end_date = datetime.strptime(to_date_str[:10], "%Y-%m-%d").date()
            except Exception:
                start_date = date(today.year, today.month, 1)
                end_date = today
                from_date_str = str(start_date)
                to_date_str = str(end_date)

        emp_filter = request.args.get("employee_id")
        filtered_employees = [e for e in employees_list if not emp_filter or emp_filter == "all" or str(e["id"]) == str(emp_filter)]

        # Fetch all attendance rows in date range
        g.cursor.execute(
            """
            SELECT employee_id, attendance_date, check_in_time, check_out_time, total_working_minutes, status
            FROM employee_attendance
            WHERE attendance_date BETWEEN %s AND %s
            """,
            (from_date_str, to_date_str)
        )
        all_att = g.cursor.fetchall()
        att_by_emp = {}
        for r in all_att:
            e_id = r["employee_id"]
            if e_id not in att_by_emp:
                att_by_emp[e_id] = []
            att_by_emp[e_id].append(r)

        records = []
        tot_clocked_hours = 0
        tot_expected_hours = 0
        tot_overtime_hours = 0
        tot_shortfall_hours = 0
        tot_late_arrivals = 0

        for emp in filtered_employees:
            e_id = emp["id"]
            att_list = att_by_emp.get(e_id, [])

            days_worked = 0
            emp_clocked_mins = 0
            emp_overtime_mins = 0
            emp_shortfall_mins = 0
            emp_late_count = 0

            for rec in att_list:
                cin = rec.get("check_in_time")
                cout = rec.get("check_out_time")
                mins = int(rec.get("total_working_minutes") or 0)
                st = rec.get("status") or "Present"

                if cin:
                    days_worked += 1
                    emp_clocked_mins += mins

                    # Late arrival check
                    if str(cin)[:5] > "09:30":
                        emp_late_count += 1

                    # Overtime or shortfall based on 8h (480 mins)
                    if mins > 480:
                        emp_overtime_mins += (mins - 480)
                    elif mins < 480 and cout:
                        emp_shortfall_mins += (480 - mins)

            expected_mins = days_worked * 480
            expected_hrs = round(expected_mins / 60, 1)
            clocked_hrs = round(emp_clocked_mins / 60, 1)
            ot_hrs = round(emp_overtime_mins / 60, 1)
            short_hrs = round(emp_shortfall_mins / 60, 1)
            avg_daily_hrs = round(clocked_hrs / days_worked, 1) if days_worked > 0 else 0.0

            compliance_pct = round((clocked_hrs / expected_hrs * 100), 1) if expected_hrs > 0 else (100.0 if days_worked == 0 else 0.0)

            if compliance_pct >= 105.0:
                badge_status = "Overtime"
                badge_class = "success"
            elif compliance_pct >= 90.0:
                badge_status = "Optimal"
                badge_class = "info"
            else:
                badge_status = "Under Hours"
                badge_class = "warning"

            tot_clocked_hours += clocked_hrs
            tot_expected_hours += expected_hrs
            tot_overtime_hours += ot_hrs
            tot_shortfall_hours += short_hrs
            tot_late_arrivals += emp_late_count

            records.append({
                "employee_id": e_id,
                "employee_code": emp["employee_code"],
                "full_name": emp["full_name"],
                "designation": emp["designation"],
                "department": emp["department"],
                "days_worked": days_worked,
                "expected_hours": expected_hrs,
                "clocked_hours": clocked_hrs,
                "clocked_hours_formatted": f"{emp_clocked_mins // 60}h {emp_clocked_mins % 60}m",
                "overtime_hours": ot_hrs,
                "overtime_formatted": f"{emp_overtime_mins // 60}h {emp_overtime_mins % 60}m",
                "shortfall_hours": short_hrs,
                "shortfall_formatted": f"{emp_shortfall_mins // 60}h {emp_shortfall_mins % 60}m",
                "late_count": emp_late_count,
                "avg_daily_hours": avg_daily_hrs,
                "compliance_pct": compliance_pct,
                "badge_status": badge_status,
                "badge_class": badge_class
            })

        summary = {
            "from_date": from_date_str,
            "to_date": to_date_str,
            "total_staff": len(records),
            "total_expected_hours": round(tot_expected_hours, 1),
            "total_clocked_hours": round(tot_clocked_hours, 1),
            "total_overtime_hours": round(tot_overtime_hours, 1),
            "total_shortfall_hours": round(tot_shortfall_hours, 1),
            "total_late_arrivals": tot_late_arrivals,
            "avg_compliance_pct": round(tot_clocked_hours / tot_expected_hours * 100, 1) if tot_expected_hours > 0 else 100.0
        }

        return jsonify({
            "success": True,
            "report_type": "working_hours",
            "summary": summary,
            "records": records,
            "employees": employees_list
        })

    # --------------------------------------------------------------------------
    # 5. LEAVE / ABSENCE REPORT
    # --------------------------------------------------------------------------
    elif report_type == "leaves":
        from_date_str = (request.args.get("from_date") or "").strip()
        to_date_str = (request.args.get("to_date") or "").strip()

        if not from_date_str or not to_date_str:
            month_param = (request.args.get("month") or today.strftime("%Y-%m")).strip()[:7]
            try:
                year, m = map(int, month_param.split("-"))
            except Exception:
                year, m = today.year, today.month
            start_date = date(year, m, 1)
            if m == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, m + 1, 1) - timedelta(days=1)
            from_date_str = str(start_date)
            to_date_str = str(min(end_date, today))
        else:
            try:
                start_date = datetime.strptime(from_date_str[:10], "%Y-%m-%d").date()
                end_date = datetime.strptime(to_date_str[:10], "%Y-%m-%d").date()
            except Exception:
                start_date = date(today.year, today.month, 1)
                end_date = today
                from_date_str = str(start_date)
                to_date_str = str(end_date)

        emp_filter = request.args.get("employee_id")
        status_filter = (request.args.get("status") or "all").strip().lower()

        # 1. Fetch leave applications
        sql_leaves = """
            SELECT lr.*, e.employee_code, e.full_name, e.designation, e.department, e.phone,
                   u.username AS reviewer_username, u.full_name AS reviewer_name
            FROM employee_leave_requests lr
            JOIN employees e ON e.id = lr.employee_id
            LEFT JOIN users u ON u.id = lr.reviewed_by_user_id
            WHERE lr.end_date >= %s AND lr.start_date <= %s
        """
        params_leaves = [from_date_str, to_date_str]
        if emp_filter and emp_filter != "all":
            sql_leaves += " AND lr.employee_id = %s"
            params_leaves.append(emp_filter)
        if status_filter and status_filter != "all" and status_filter != "unexcused":
            sql_leaves += " AND LOWER(lr.status) = %s"
            params_leaves.append(status_filter)
        sql_leaves += " ORDER BY lr.start_date DESC"

        g.cursor.execute(sql_leaves, params_leaves)
        leave_applications = serialize_rows(g.cursor.fetchall())

        # 2. Fetch unexcused absences (Absent status in employee_attendance without approved leave)
        unexcused_absences = []
        if status_filter in ("all", "unexcused", "absent"):
            sql_abs = """
                SELECT ea.id AS attendance_id, ea.employee_id, ea.attendance_date, ea.status,
                       e.employee_code, e.full_name, e.designation, e.department, e.phone
                FROM employee_attendance ea
                JOIN employees e ON e.id = ea.employee_id
                WHERE ea.attendance_date BETWEEN %s AND %s
                  AND ea.status = 'Absent'
                  AND e.status = 'Active'
            """
            params_abs = [from_date_str, to_date_str]
            if emp_filter and emp_filter != "all":
                sql_abs += " AND ea.employee_id = %s"
                params_abs.append(emp_filter)
            sql_abs += " ORDER BY ea.attendance_date DESC"

            g.cursor.execute(sql_abs, params_abs)
            abs_rows = serialize_rows(g.cursor.fetchall())

            for ab in abs_rows:
                unexcused_absences.append({
                    "id": f"abs_{ab['attendance_id']}",
                    "record_type": "Unexcused Absence",
                    "employee_id": ab["employee_id"],
                    "employee_code": ab["employee_code"],
                    "full_name": ab["full_name"],
                    "designation": ab["designation"],
                    "department": ab["department"],
                    "leave_type": "Unexcused Absence",
                    "start_date": ab["attendance_date"],
                    "end_date": ab["attendance_date"],
                    "total_days": 1,
                    "reason": "Absent with no approved leave request.",
                    "status": "Unexcused",
                    "admin_remark": "Auto-flagged from daily attendance",
                    "reviewer_name": "System",
                    "created_at": ab["attendance_date"]
                })

        # Combine or keep clean list
        combined_records = []
        approved_cnt = 0
        pending_cnt = 0
        rejected_cnt = 0

        for req in leave_applications:
            req["record_type"] = "Leave Request"
            st = req.get("status")
            if st == "Approved":
                approved_cnt += 1
            elif st == "Pending":
                pending_cnt += 1
            elif st == "Rejected":
                rejected_cnt += 1
            combined_records.append(req)

        if status_filter not in ("pending", "approved", "rejected"):
            combined_records.extend(unexcused_absences)

        # Sort all combined by start_date DESC
        combined_records.sort(key=lambda x: str(x.get("start_date") or ""), reverse=True)

        summary = {
            "from_date": from_date_str,
            "to_date": to_date_str,
            "total_requests": len(leave_applications),
            "approved_count": approved_cnt,
            "pending_count": pending_cnt,
            "rejected_count": rejected_cnt,
            "unexcused_absences_count": len(unexcused_absences),
            "total_records": len(combined_records)
        }

        return jsonify({
            "success": True,
            "report_type": "leaves",
            "summary": summary,
            "records": combined_records,
            "employees": employees_list
        })

    else:
        return jsonify({"success": False, "message": f"Invalid report_type '{report_type}'."}), 400


# ==============================================================================
# TECHNICIAN PERFORMANCE DASHBOARD & METRICS (Admin Portal)
# 1. Total jobs
# 2. Completed jobs
# 3. Pending jobs
# 4. Delayed jobs
# 5. Average job duration
# 6. Working hours
# 7. Customer feedback & ratings
# ==============================================================================

@technician_bp.route("/api/admin/technician-performance", methods=["GET"])
def admin_technician_performance():
    today = date.today()
    now_dt = datetime.now()
    time_range = (request.args.get("time_range") or "this_month").strip().lower()
    from_date_str = (request.args.get("from_date") or "").strip()
    to_date_str = (request.args.get("to_date") or "").strip()

    if time_range == "today":
        start_date = today
        end_date = today
    elif time_range == "this_week":
        start_date = today - timedelta(days=today.weekday())
        end_date = today
    elif time_range == "this_month":
        start_date = today.replace(day=1)
        end_date = today
    elif time_range == "last_month":
        first_this_month = today.replace(day=1)
        end_date = first_this_month - timedelta(days=1)
        start_date = end_date.replace(day=1)
    elif time_range == "all":
        start_date = date(2020, 1, 1)
        end_date = today + timedelta(days=365)
    elif time_range == "custom" and from_date_str and to_date_str:
        try:
            start_date = datetime.strptime(from_date_str[:10], "%Y-%m-%d").date()
            end_date = datetime.strptime(to_date_str[:10], "%Y-%m-%d").date()
        except Exception:
            start_date = today.replace(day=1)
            end_date = today
    else:
        start_date = today.replace(day=1)
        end_date = today

    start_date_str = str(start_date)
    end_date_str = str(end_date)

    # 1. Fetch technicians
    emp_sql = "SELECT id, employee_code, full_name, designation, department, phone, photo_path FROM employees WHERE status = 'Active'"
    emp_params = []
    emp_id_filter = request.args.get("employee_id")
    if emp_id_filter and emp_id_filter != "all":
        emp_sql += " AND id = %s"
        emp_params.append(emp_id_filter)
    dept_filter = request.args.get("department")
    if dept_filter and dept_filter != "all":
        emp_sql += " AND department = %s"
        emp_params.append(dept_filter)
    emp_sql += " ORDER BY full_name ASC"
    g.cursor.execute(emp_sql, emp_params)
    technicians = serialize_rows(g.cursor.fetchall())

    # 2. Fetch service jobs
    jobs_sql = """
        SELECT sj.id, sj.service_number, sj.service_type, sj.customer_name, sj.customer_mobile,
               sj.assigned_technician_id, sj.technician_name, sj.service_status, sj.priority,
               sj.appointment_date, sj.appointment_start_time, sj.appointment_end_time,
               sj.expected_delivery_date, sj.estimated_duration_minutes, sj.actual_duration_minutes,
               sj.assigned_at, sj.work_started_at, sj.completed_at, sj.created_at,
               sj.customer_rating, sj.customer_feedback,
               wp.customer_rating AS wp_rating, wp.customer_feedback AS wp_feedback,
               wp.customer_signature_path, wp.submitted_at AS proof_time
        FROM service_jobs sj
        LEFT JOIN service_job_work_proof wp ON wp.service_job_id = sj.id
        WHERE (
            (sj.appointment_date BETWEEN %s AND %s)
            OR (sj.appointment_date IS NULL AND DATE(sj.created_at) BETWEEN %s AND %s)
            OR (sj.completed_at IS NOT NULL AND DATE(sj.completed_at) BETWEEN %s AND %s)
        )
    """
    g.cursor.execute(jobs_sql, (start_date_str, end_date_str, start_date_str, end_date_str, start_date_str, end_date_str))
    all_jobs = serialize_rows(g.cursor.fetchall())

    # Group jobs by assigned_technician_id
    jobs_by_tech = {}
    unassigned_jobs = []
    all_feedbacks = []

    for job in all_jobs:
        tid = job.get("assigned_technician_id")
        if tid:
            if tid not in jobs_by_tech:
                jobs_by_tech[tid] = []
            jobs_by_tech[tid].append(job)
        else:
            unassigned_jobs.append(job)

        # Check feedback
        f_text = job.get("wp_feedback") or job.get("customer_feedback")
        f_rating = job.get("wp_rating") or job.get("customer_rating")
        if f_text or f_rating:
            all_feedbacks.append({
                "job_id": job["id"],
                "service_number": job["service_number"],
                "customer_name": job.get("customer_name") or "Customer",
                "customer_mobile": job.get("customer_mobile"),
                "technician_name": job.get("technician_name") or "Technician",
                "technician_id": tid,
                "rating": int(f_rating) if f_rating else 5,
                "feedback": f_text or "No comment",
                "date": str(job.get("completed_at") or job.get("proof_time") or job.get("created_at"))[:10]
            })

    # Sort feedbacks by date DESC
    all_feedbacks.sort(key=lambda x: str(x.get("date") or ""), reverse=True)

    # 3. Fetch attendance working minutes in this range
    g.cursor.execute(
        """
        SELECT employee_id, SUM(total_working_minutes) AS total_mins, COUNT(DISTINCT attendance_date) AS days_present
        FROM employee_attendance
        WHERE attendance_date BETWEEN %s AND %s AND status IN ('Present', 'Half_Day')
        GROUP BY employee_id
        """,
        (start_date_str, end_date_str)
    )
    att_rows = g.cursor.fetchall()
    att_by_tech = {r["employee_id"]: r for r in att_rows}

    # 4. Calculate metrics for each technician
    tech_scorecards = []
    tot_all_jobs = 0
    tot_completed = 0
    tot_pending = 0
    tot_delayed = 0
    tot_duration_sum = 0
    tot_duration_count = 0
    tot_working_mins_sum = 0
    ratings_sum = 0
    ratings_count = 0

    for emp in technicians:
        tid = emp["id"]
        t_jobs = jobs_by_tech.get(tid, [])
        t_att = att_by_tech.get(tid, {})

        total_jobs_cnt = len(t_jobs)
        completed_cnt = 0
        pending_cnt = 0
        delayed_cnt = 0
        dur_mins_sum = 0
        dur_count = 0
        t_ratings = []
        t_feedbacks = []

        for j in t_jobs:
            st = (j.get("service_status") or "").strip()
            app_date = j.get("appointment_date")
            comp_at = j.get("completed_at")
            started_at = j.get("work_started_at")
            actual_dur = int(j.get("actual_duration_minutes") or 0)

            # Feedback
            rating = j.get("wp_rating") or j.get("customer_rating")
            fb = j.get("wp_feedback") or j.get("customer_feedback")
            if rating:
                try:
                    r_val = int(rating)
                    t_ratings.append(r_val)
                    ratings_sum += r_val
                    ratings_count += 1
                except Exception:
                    pass
            if fb or rating:
                t_feedbacks.append({
                    "job_id": j["id"],
                    "service_number": j["service_number"],
                    "customer_name": j.get("customer_name") or "Customer",
                    "rating": int(rating) if rating else 5,
                    "feedback": fb or "No comment",
                    "date": str(comp_at or j.get("created_at"))[:10]
                })

            # Completed vs Pending
            if st in ("Completed", "Delivered"):
                completed_cnt += 1

                # Duration
                if actual_dur > 0 and actual_dur <= 480:
                    dur = actual_dur
                elif started_at and comp_at:
                    try:
                        s_dt = datetime.strptime(str(started_at)[:19], "%Y-%m-%d %H:%M:%S")
                        c_dt = datetime.strptime(str(comp_at)[:19], "%Y-%m-%d %H:%M:%S")
                        diff_mins = int((c_dt - s_dt).total_seconds() / 60)
                        dur = max(5, min(diff_mins, 240))
                    except Exception:
                        dur = int(j.get("estimated_duration_minutes") or 45)
                else:
                    dur = int(j.get("estimated_duration_minutes") or 45)

                dur_mins_sum += dur
                dur_count += 1
                tot_duration_sum += dur
                tot_duration_count += 1

                # Delay check on completed job
                if app_date and comp_at:
                    try:
                        c_d = datetime.strptime(str(comp_at)[:10], "%Y-%m-%d").date()
                        a_d = app_date if isinstance(app_date, date) else datetime.strptime(str(app_date)[:10], "%Y-%m-%d").date()
                        if c_d > a_d:
                            delayed_cnt += 1
                    except Exception:
                        pass

            elif st not in ("Cancelled",):
                pending_cnt += 1

                # Delay check on active/pending job
                if app_date:
                    try:
                        a_d = app_date if isinstance(app_date, date) else datetime.strptime(str(app_date)[:10], "%Y-%m-%d").date()
                        if a_d < today:
                            delayed_cnt += 1
                        elif a_d == today and j.get("appointment_end_time"):
                            end_t_str = str(j.get("appointment_end_time"))[:5]
                            now_t_str = now_dt.strftime("%H:%M")
                            if now_t_str > end_t_str:
                                delayed_cnt += 1
                    except Exception:
                        pass

        tot_all_jobs += total_jobs_cnt
        tot_completed += completed_cnt
        tot_pending += pending_cnt
        tot_delayed += delayed_cnt

        comp_rate = round((completed_cnt / total_jobs_cnt * 100), 1) if total_jobs_cnt > 0 else 0.0
        avg_dur_mins = (dur_mins_sum // dur_count) if dur_count > 0 else 0
        if avg_dur_mins >= 60:
            avg_dur_str = f"{avg_dur_mins // 60}h {avg_dur_mins % 60}m"
        elif avg_dur_mins > 0:
            avg_dur_str = f"{avg_dur_mins}m"
        else:
            avg_dur_str = "--"

        work_mins = int(t_att.get("total_mins") or 0)
        tot_working_mins_sum += work_mins
        work_hours = round(work_mins / 60, 1)
        work_hours_str = f"{work_mins // 60}h {work_mins % 60}m"

        avg_rating = round(sum(t_ratings) / len(t_ratings), 1) if t_ratings else None

        # Performance Status Badge
        if total_jobs_cnt > 0 and comp_rate >= 80 and (avg_rating is None or avg_rating >= 4.5):
            badge = "Top Performer"
            badge_class = "gold"
        elif total_jobs_cnt > 0 and comp_rate >= 60:
            badge = "On Track"
            badge_class = "green"
        elif total_jobs_cnt > 0:
            badge = "Needs Focus"
            badge_class = "orange"
        else:
            badge = "No Jobs Yet"
            badge_class = "gray"

        tech_scorecards.append({
            "employee_id": tid,
            "employee_code": emp["employee_code"],
            "full_name": emp["full_name"],
            "designation": emp["designation"],
            "department": emp["department"],
            "phone": emp["phone"],
            "photo_path": emp.get("photo_path"),
            "total_jobs": total_jobs_cnt,
            "completed_jobs": completed_cnt,
            "pending_jobs": pending_cnt,
            "delayed_jobs": delayed_cnt,
            "completion_rate": comp_rate,
            "avg_duration_minutes": avg_dur_mins,
            "avg_duration_formatted": avg_dur_str,
            "working_hours": work_hours,
            "working_hours_formatted": work_hours_str,
            "days_present": int(t_att.get("days_present") or 0),
            "avg_rating": avg_rating if avg_rating is not None else 5.0,
            "has_rating": (avg_rating is not None),
            "feedback_count": len(t_ratings),
            "feedbacks": t_feedbacks[:5],
            "performance_badge": badge,
            "badge_class": badge_class
        })

    # Sort scorecards: highest completed jobs, highest rating
    tech_scorecards.sort(key=lambda x: (x["completed_jobs"], x["avg_rating"] or 0), reverse=True)

    # Add ranks
    for i, sc in enumerate(tech_scorecards):
        sc["rank"] = i + 1

    overall_avg_dur_mins = (tot_duration_sum // tot_duration_count) if tot_duration_count > 0 else 0
    if overall_avg_dur_mins >= 60:
        overall_avg_dur_str = f"{overall_avg_dur_mins // 60}h {overall_avg_dur_mins % 60}m"
    elif overall_avg_dur_mins > 0:
        overall_avg_dur_str = f"{overall_avg_dur_mins}m"
    else:
        overall_avg_dur_str = "--"

    overall_comp_rate = round((tot_completed / tot_all_jobs * 100), 1) if tot_all_jobs > 0 else 0.0
    overall_avg_rating = round((ratings_sum / ratings_count), 1) if ratings_count > 0 else 5.0

    summary = {
        "time_range": time_range,
        "from_date": start_date_str,
        "to_date": end_date_str,
        "total_technicians": len(technicians),
        "total_jobs": tot_all_jobs,
        "completed_jobs": tot_completed,
        "pending_jobs": tot_pending,
        "delayed_jobs": tot_delayed,
        "completion_rate": overall_comp_rate,
        "avg_job_duration_mins": overall_avg_dur_mins,
        "avg_job_duration_formatted": overall_avg_dur_str,
        "total_working_hours": round(tot_working_mins_sum / 60, 1),
        "total_working_hours_formatted": f"{tot_working_mins_sum // 60}h {tot_working_mins_sum % 60}m",
        "avg_customer_rating": overall_avg_rating,
        "total_feedbacks_count": len(all_feedbacks)
    }

    return jsonify({
        "success": True,
        "summary": summary,
        "technicians": tech_scorecards,
        "recent_feedbacks": all_feedbacks[:10],
        "all_technicians_list": technicians
    })


@technician_bp.route("/api/admin/technician-performance/<int:employee_id>", methods=["GET"])
def admin_technician_detail_performance(employee_id):
    g.cursor.execute("SELECT * FROM employees WHERE id = %s LIMIT 1", (employee_id,))
    emp = serialize_row(g.cursor.fetchone())
    if not emp:
        return jsonify({"success": False, "message": "Employee not found."}), 404

    # Fetch technician's jobs
    g.cursor.execute(
        """
        SELECT sj.*,
               wp.customer_rating AS wp_rating, wp.customer_feedback AS wp_feedback,
               wp.customer_signature_path, wp.submitted_at AS proof_time
        FROM service_jobs sj
        LEFT JOIN service_job_work_proof wp ON wp.service_job_id = sj.id
        WHERE sj.assigned_technician_id = %s
        ORDER BY sj.created_at DESC
        """,
        (employee_id,)
    )
    jobs = serialize_rows(g.cursor.fetchall())

    # Fetch attendance
    g.cursor.execute(
        """
        SELECT attendance_date, check_in_time, check_out_time, total_working_minutes, status
        FROM employee_attendance
        WHERE employee_id = %s
        ORDER BY attendance_date DESC LIMIT 30
        """,
        (employee_id,)
    )
    attendance = serialize_rows(g.cursor.fetchall())

    return jsonify({
        "success": True,
        "employee": emp,
        "jobs": jobs,
        "attendance": attendance
    })


@technician_bp.route("/api/admin/jobs/<int:job_id>/customer-feedback", methods=["POST"])
def admin_record_customer_feedback(job_id):
    data = request.get_json() or {}
    rating_raw = data.get("customer_rating")
    feedback = (data.get("customer_feedback") or "").strip()

    try:
        rating = max(1, min(5, int(rating_raw))) if rating_raw is not None else 5
    except Exception:
        rating = 5

    g.cursor.execute("SELECT id, assigned_technician_id, service_number FROM service_jobs WHERE id = %s LIMIT 1", (job_id,))
    job = g.cursor.fetchone()
    if not job:
        return jsonify({"success": False, "message": "Service job not found."}), 404

    tech_id = job.get("assigned_technician_id") or 0

    # Update service_jobs
    g.cursor.execute(
        "UPDATE service_jobs SET customer_rating = %s, customer_feedback = %s WHERE id = %s",
        (rating, feedback, job_id)
    )

    # Upsert service_job_work_proof
    g.cursor.execute(
        """
        INSERT INTO service_job_work_proof (service_job_id, technician_id, customer_feedback, customer_rating)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE customer_feedback = VALUES(customer_feedback),
                                customer_rating = VALUES(customer_rating)
        """,
        (job_id, tech_id, feedback, rating)
    )
    g.db.commit()

    return jsonify({"success": True, "message": "Customer feedback and rating recorded successfully."})


@technician_bp.route("/api/technicians/live-locations", methods=["GET"])
def live_technician_locations():
    today_str = str(date.today())

    # 1. Fetch office geofence location
    g.cursor.execute("SELECT office_name, latitude, longitude, radius_meters, is_active, office_address FROM attendance_geofence_settings WHERE is_active = 1 LIMIT 1")
    office = g.cursor.fetchone()
    if not office:
        g.cursor.execute("SELECT office_name, latitude, longitude, radius_meters, is_active, office_address FROM attendance_geofence_settings ORDER BY id ASC LIMIT 1")
        office = g.cursor.fetchone()
    office_geofence = serialize_row(office) if office else None

    # 2. Fetch all active technicians with their latest GPS ping, attendance, and active job
    g.cursor.execute(
        """
        SELECT 
            e.id AS employee_id,
            e.employee_code,
            e.full_name,
            e.phone,
            e.designation,
            
            -- Location from GPS ping or fallback to check-in
            COALESCE(gl.latitude, ea.check_in_lat) AS latitude,
            COALESCE(gl.longitude, ea.check_in_lng) AS longitude,
            gl.accuracy_meters,
            gl.speed_kmh,
            gl.battery_level,
            COALESCE(gl.recorded_at, ea.check_in_time) AS last_location_time,
            CASE 
                WHEN gl.id IS NOT NULL THEN 'GPS_PING'
                WHEN ea.check_in_lat IS NOT NULL THEN 'CHECK_IN'
                ELSE 'NONE'
            END AS location_source,
            
            -- Attendance info for today
            ea.status AS attendance_status,
            ea.check_in_time,
            ea.check_out_time,
            
            -- Current active field service job
            active_job.id AS active_job_id,
            active_job.service_number AS active_job_number,
            active_job.customer_name AS active_job_customer,
            active_job.customer_mobile AS active_job_mobile,
            active_job.customer_address AS active_job_address,
            active_job.complaint AS active_job_complaint,
            active_job.service_status AS active_job_status,
            active_job.priority AS active_job_priority
        FROM employees e
        -- Latest GPS ping in the last 24 hours
        LEFT JOIN (
            SELECT employee_id, MAX(id) AS max_id
            FROM employee_gps_locations
            WHERE recorded_at >= NOW() - INTERVAL 24 HOUR
            GROUP BY employee_id
        ) latest_gps ON latest_gps.employee_id = e.id
        LEFT JOIN employee_gps_locations gl ON gl.id = latest_gps.max_id
        
        -- Today's attendance
        LEFT JOIN employee_attendance ea ON ea.employee_id = e.id AND ea.attendance_date = %s
        
        -- Current active job (Assigned, Travel, or In Progress)
        LEFT JOIN (
            SELECT sj1.*
            FROM service_jobs sj1
            INNER JOIN (
                SELECT assigned_technician_id, MAX(id) AS max_job_id
                FROM service_jobs
                WHERE service_status IN ('Assigned', 'Travel', 'In Progress')
                GROUP BY assigned_technician_id
            ) mj ON mj.max_job_id = sj1.id
        ) active_job ON active_job.assigned_technician_id = e.id
        
        WHERE e.status = 'Active'
        ORDER BY 
            CASE 
                WHEN active_job.service_status = 'Travel' THEN 1
                WHEN active_job.service_status = 'In Progress' THEN 2
                WHEN ea.status = 'Present' AND ea.check_out_time IS NULL THEN 3
                ELSE 4
            END,
            e.full_name ASC
        """,
        (today_str,)
    )
    raw_technicians = serialize_rows(g.cursor.fetchall())

    technicians = []
    for tech in raw_technicians:
        has_location = tech.get("latitude") is not None and tech.get("longitude") is not None
        job_status = tech.get("active_job_status")
        att_status = tech.get("attendance_status")
        checked_out = tech.get("check_out_time") is not None

        if job_status == "Travel":
            tech["status_badge"] = "Traveling"
            tech["status_color"] = "warning"
        elif job_status == "In Progress":
            tech["status_badge"] = "On Job"
            tech["status_color"] = "success"
        elif att_status == "Present" and not checked_out:
            tech["status_badge"] = "On Duty"
            tech["status_color"] = "info"
        elif checked_out:
            tech["status_badge"] = "Checked Out"
            tech["status_color"] = "secondary"
        else:
            tech["status_badge"] = "Offline"
            tech["status_color"] = "dark"

        tech["has_location"] = has_location
        technicians.append(tech)

    return jsonify({
        "success": True,
        "date": today_str,
        "office_geofence": office_geofence,
        "technicians": technicians,
        "total_technicians": len(technicians),
        "online_count": sum(1 for t in technicians if t["has_location"]),
        "active_jobs_count": sum(1 for t in technicians if t.get("active_job_status") in ("Travel", "In Progress"))
    })


@technician_bp.route("/api/technicians/activity-logs", methods=["GET"])
def list_technician_activity_logs():
    emp_id = request.args.get("employee_id")
    act_type = (request.args.get("activity_type") or "").strip()
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    date_val = request.args.get("date")
    search = (request.args.get("search") or "").strip()
    limit = min(100, max(1, int(request.args.get("limit") or 50)))
    offset = max(0, int(request.args.get("offset") or 0))

    where_clauses = ["1=1"]
    params = []

    if emp_id:
        where_clauses.append("al.employee_id = %s")
        params.append(emp_id)

    if act_type and act_type.upper() != "ALL":
        where_clauses.append("al.activity_type = %s")
        params.append(act_type.upper())

    if date_val:
        where_clauses.append("DATE(al.created_at) = %s")
        params.append(date_val)
    else:
        if start_date:
            where_clauses.append("DATE(al.created_at) >= %s")
            params.append(start_date)
        if end_date:
            where_clauses.append("DATE(al.created_at) <= %s")
            params.append(end_date)

    if search:
        search_like = f"%{search}%"
        where_clauses.append("(al.description LIKE %s OR al.action LIKE %s OR e.full_name LIKE %s OR e.employee_code LIKE %s OR sj.service_number LIKE %s)")
        params.extend([search_like, search_like, search_like, search_like, search_like])

    where_str = " AND ".join(where_clauses)

    # 1. Total count matching filters
    count_sql = f"""
        SELECT COUNT(*) AS total_count
        FROM technician_activity_logs al
        LEFT JOIN employees e ON e.id = al.employee_id
        LEFT JOIN service_jobs sj ON sj.id = al.service_job_id
        WHERE {where_str}
    """
    g.cursor.execute(count_sql, params)
    cnt_res = g.cursor.fetchone()
    total_records = cnt_res["total_count"] if cnt_res else 0

    # 2. Today's summary statistics
    g.cursor.execute(
        """
        SELECT 
            COUNT(*) AS today_total,
            SUM(CASE WHEN activity_type = 'ATTENDANCE' THEN 1 ELSE 0 END) AS today_attendance,
            SUM(CASE WHEN activity_type = 'JOB_STATUS' THEN 1 ELSE 0 END) AS today_jobs,
            SUM(CASE WHEN activity_type IN ('DEVICE_SECURITY', 'GEOFENCE_ALERT') THEN 1 ELSE 0 END) AS today_alerts
        FROM technician_activity_logs
        WHERE DATE(created_at) = %s
        """,
        (str(date.today()),)
    )
    summary_raw = g.cursor.fetchone() or {}
    summary_stats = {
        "today_total": int(summary_raw.get("today_total") or 0),
        "today_attendance": int(summary_raw.get("today_attendance") or 0),
        "today_jobs": int(summary_raw.get("today_jobs") or 0),
        "today_alerts": int(summary_raw.get("today_alerts") or 0)
    }

    # 3. Log data query
    data_sql = f"""
        SELECT al.id, al.employee_id, al.user_id, al.activity_type, al.action, al.description,
               al.service_job_id, al.latitude, al.longitude, al.location_address, al.metadata, al.created_at,
               e.full_name AS employee_name, e.employee_code, e.phone AS employee_phone, e.designation,
               u.username AS triggered_by_username,
               sj.service_number, sj.customer_name, sj.service_status AS job_current_status
        FROM technician_activity_logs al
        LEFT JOIN employees e ON e.id = al.employee_id
        LEFT JOIN users u ON u.id = al.user_id
        LEFT JOIN service_jobs sj ON sj.id = al.service_job_id
        WHERE {where_str}
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT %s OFFSET %s
    """
    data_params = list(params) + [limit, offset]
    g.cursor.execute(data_sql, data_params)
    records = serialize_rows(g.cursor.fetchall())

    return jsonify({
        "success": True,
        "total": total_records,
        "limit": limit,
        "offset": offset,
        "summary": summary_stats,
        "logs": records
    })


# ==============================================================================
# GPS LOCATION HISTORY & ROUTE TRACKING (ADMIN)
# Check-in, Job Location, On-the-way, Reached, Completion, Breadcrumb Trail
# ==============================================================================

@technician_bp.route("/api/admin/technician-gps-history", methods=["GET"])
def admin_technician_gps_history():
    today = date.today()
    target_date_str = (request.args.get("date") or str(today)).strip()
    try:
        target_date = datetime.strptime(target_date_str[:10], "%Y-%m-%d").date()
    except Exception:
        target_date = today
        target_date_str = str(today)

    emp_id_param = request.args.get("employee_id")
    job_id_filter = request.args.get("service_job_id")

    # 1. Fetch all active technicians for selector
    g.cursor.execute("SELECT id, employee_code, full_name, designation, phone, photo_path FROM employees WHERE status = 'Active' ORDER BY full_name ASC")
    technicians_list = serialize_rows(g.cursor.fetchall())

    if not technicians_list:
        return jsonify({
            "success": True,
            "date": target_date_str,
            "employee": None,
            "technicians_list": [],
            "attendance": None,
            "milestones": [],
            "trail": [],
            "jobs_handled": [],
            "summary": {"total_distance_km": 0, "total_points": 0, "active_jobs_count": 0}
        })

    # Pick target technician
    target_emp_id = None
    if emp_id_param and emp_id_param != "all":
        try:
            target_emp_id = int(emp_id_param)
        except ValueError:
            target_emp_id = None

    if not target_emp_id:
        target_emp_id = technicians_list[0]["id"]

    # Employee profile
    g.cursor.execute("SELECT id, employee_code, full_name, designation, department, phone, email, photo_path FROM employees WHERE id = %s", (target_emp_id,))
    emp_record = serialize_row(g.cursor.fetchone())

    # 2. Fetch Attendance for this day
    g.cursor.execute(
        """
        SELECT id, employee_id, attendance_date, check_in_time, check_in_lat, check_in_lng, check_in_address,
               check_out_time, check_out_lat, check_out_lng, check_out_address, status, total_working_minutes
        FROM employee_attendance
        WHERE employee_id = %s AND attendance_date = %s
        LIMIT 1
        """,
        (target_emp_id, target_date_str)
    )
    attendance_raw = g.cursor.fetchone()
    attendance_record = serialize_row(attendance_raw) if attendance_raw else None

    # 3. Fetch Service Jobs for this technician on target date
    jobs_sql = """
        SELECT sj.id, sj.service_number, sj.service_type, sj.customer_name, sj.customer_mobile,
               sj.customer_address, sj.complaint, sj.priority, sj.service_status,
               sj.appointment_date, sj.appointment_start_time, sj.appointment_end_time,
               sj.job_latitude, sj.job_longitude,
               sj.assigned_at, sj.accepted_at,
               sj.on_the_way_at, sj.on_the_way_lat, sj.on_the_way_lng, sj.on_the_way_address,
               sj.reached_at, sj.reached_lat, sj.reached_lng, sj.reached_address,
               sj.work_started_at,
               sj.completed_at, sj.completion_lat, sj.completion_lng, sj.completion_address,
               sj.customer_rating, sj.customer_feedback,
               wp.before_photo_path, wp.after_photo_path, wp.customer_signature_path, wp.submitted_at AS proof_time
        FROM service_jobs sj
        LEFT JOIN service_job_work_proof wp ON wp.service_job_id = sj.id
        WHERE sj.assigned_technician_id = %s
          AND (
              sj.appointment_date = %s
              OR DATE(sj.created_at) = %s
              OR DATE(sj.on_the_way_at) = %s
              OR DATE(sj.reached_at) = %s
              OR DATE(sj.completed_at) = %s
          )
    """
    job_params = [target_emp_id, target_date_str, target_date_str, target_date_str, target_date_str, target_date_str]
    if job_id_filter:
        jobs_sql += " AND sj.id = %s"
        job_params.append(job_id_filter)
    jobs_sql += " ORDER BY sj.id ASC"

    g.cursor.execute(jobs_sql, job_params)
    jobs_handled = serialize_rows(g.cursor.fetchall())

    # 4. Fetch Raw GPS Pings
    pings_sql = """
        SELECT id, employee_id, service_job_id, latitude, longitude, accuracy_meters, speed_kmh, battery_level, recorded_at
        FROM employee_gps_locations
        WHERE employee_id = %s AND DATE(recorded_at) = %s
    """
    pings_params = [target_emp_id, target_date_str]
    if job_id_filter:
        pings_sql += " AND service_job_id = %s"
        pings_params.append(job_id_filter)
    pings_sql += " ORDER BY recorded_at ASC"
    g.cursor.execute(pings_sql, pings_params)
    gps_pings = serialize_rows(g.cursor.fetchall())

    # 5. Fetch Activity logs with location for this day
    act_sql = """
        SELECT id, activity_type, action, description, service_job_id, latitude, longitude, location_address, created_at
        FROM technician_activity_logs
        WHERE employee_id = %s AND DATE(created_at) = %s
          AND latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY created_at ASC
    """
    g.cursor.execute(act_sql, (target_emp_id, target_date_str))
    activity_pings = serialize_rows(g.cursor.fetchall())

    # 6. Build Structured Milestone Checkpoints
    # The 5 Key Milestones requested:
    # 1. Check-in location
    # 2. Job location
    # 3. On-the-way location
    # 4. Reached location
    # 5. Completion location
    milestones = []

    # Milestone 1: Check-in location
    if attendance_record and attendance_record.get("check_in_lat") and attendance_record.get("check_in_lng"):
        milestones.append({
            "milestone_key": "check_in",
            "type": "CHECK_IN",
            "badge_color": "green",
            "icon": "punch-in",
            "title": "Check-in Location (Punch In)",
            "subtitle": f"Status: {attendance_record.get('status', 'Present')}",
            "timestamp": f"{target_date_str} {attendance_record.get('check_in_time', '')}".strip(),
            "time_str": str(attendance_record.get("check_in_time") or "")[:5],
            "latitude": float(attendance_record["check_in_lat"]),
            "longitude": float(attendance_record["check_in_lng"]),
            "address": attendance_record.get("check_in_address") or "Office / Workshop Geofence",
            "job_id": None,
            "job_number": None,
            "details": f"Shift marked present at {attendance_record.get('check_in_time')}"
        })
    else:
        # Check if activity log has Punch In
        for act in activity_pings:
            if act.get("action") == "Punch In" and act.get("latitude") and act.get("longitude"):
                milestones.append({
                    "milestone_key": "check_in",
                    "type": "CHECK_IN",
                    "badge_color": "green",
                    "icon": "punch-in",
                    "title": "Check-in Location (Punch In)",
                    "subtitle": "Shift Started",
                    "timestamp": str(act["created_at"]),
                    "time_str": str(act["created_at"])[11:16],
                    "latitude": float(act["latitude"]),
                    "longitude": float(act["longitude"]),
                    "address": act.get("location_address") or "Office / Workshop",
                    "job_id": None,
                    "job_number": None,
                    "details": act.get("description")
                })
                break

    # Milestones per job: Job Location, On-the-way, Reached, Completion
    for j in jobs_handled:
        job_id = j["id"]
        job_no = j.get("service_number", f"Job #{job_id}")
        cust_name = j.get("customer_name", "Customer")
        cust_addr = j.get("customer_address") or "Customer Address Not Provided"

        # 2. Job Location (Customer destination)
        job_lat = j.get("job_latitude") or j.get("reached_lat") or j.get("completion_lat")
        job_lng = j.get("job_longitude") or j.get("reached_lng") or j.get("completion_lng")
        if job_lat and job_lng:
            milestones.append({
                "milestone_key": f"job_loc_{job_id}",
                "type": "JOB_LOCATION",
                "badge_color": "blue",
                "icon": "job-destination",
                "title": f"Job Location (#{job_no})",
                "subtitle": cust_name,
                "timestamp": str(j.get("appointment_date") or target_date_str) + " " + str(j.get("appointment_start_time") or "09:00:00"),
                "time_str": str(j.get("appointment_start_time") or "")[:5] or "Scheduled",
                "latitude": float(job_lat),
                "longitude": float(job_lng),
                "address": cust_addr,
                "job_id": job_id,
                "job_number": job_no,
                "customer_name": cust_name,
                "customer_mobile": j.get("customer_mobile"),
                "details": f"Complaint: {j.get('complaint', 'Service Request')} | Priority: {j.get('priority', 'Normal')}"
            })

        # 3. On-the-way Location
        otw_lat = j.get("on_the_way_lat")
        otw_lng = j.get("on_the_way_lng")
        otw_time = j.get("on_the_way_at")
        if not otw_lat or not otw_lng:
            # check activity logs
            for act in activity_pings:
                if act.get("service_job_id") == job_id and "On the Way" in str(act.get("action")):
                    otw_lat = act.get("latitude")
                    otw_lng = act.get("longitude")
                    otw_time = act.get("created_at")
                    break

        if otw_lat and otw_lng:
            milestones.append({
                "milestone_key": f"otw_{job_id}",
                "type": "ON_THE_WAY",
                "badge_color": "orange",
                "icon": "on-the-way",
                "title": f"On-the-way Location (#{job_no})",
                "subtitle": f"Heading to {cust_name}",
                "timestamp": str(otw_time or ""),
                "time_str": str(otw_time)[11:16] if otw_time else "En Route",
                "latitude": float(otw_lat),
                "longitude": float(otw_lng),
                "address": j.get("on_the_way_address") or "Departed from previous location",
                "job_id": job_id,
                "job_number": job_no,
                "customer_name": cust_name,
                "details": f"Technician started travel for #{job_no}"
            })

        # 4. Reached Location
        r_lat = j.get("reached_lat")
        r_lng = j.get("reached_lng")
        r_time = j.get("reached_at")
        if not r_lat or not r_lng:
            for act in activity_pings:
                if act.get("service_job_id") == job_id and "Reached Site" in str(act.get("action")):
                    r_lat = act.get("latitude")
                    r_lng = act.get("longitude")
                    r_time = act.get("created_at")
                    break

        if r_lat and r_lng:
            milestones.append({
                "milestone_key": f"reached_{job_id}",
                "type": "REACHED",
                "badge_color": "purple",
                "icon": "reached",
                "title": f"Reached Location (#{job_no})",
                "subtitle": f"Arrived at {cust_name}",
                "timestamp": str(r_time or ""),
                "time_str": str(r_time)[11:16] if r_time else "Arrived",
                "latitude": float(r_lat),
                "longitude": float(r_lng),
                "address": j.get("reached_address") or cust_addr,
                "job_id": job_id,
                "job_number": job_no,
                "customer_name": cust_name,
                "details": f"Technician arrived at site and ready to start inspection"
            })

        # 5. Completion Location
        c_lat = j.get("completion_lat")
        c_lng = j.get("completion_lng")
        c_time = j.get("completed_at") or j.get("proof_time")
        if not c_lat or not c_lng:
            for act in activity_pings:
                if act.get("service_job_id") == job_id and ("Completed" in str(act.get("action")) or "Proof Uploaded" in str(act.get("action"))):
                    c_lat = act.get("latitude")
                    c_lng = act.get("longitude")
                    c_time = act.get("created_at")
                    break

        if c_lat and c_lng:
            milestones.append({
                "milestone_key": f"comp_{job_id}",
                "type": "COMPLETION",
                "badge_color": "emerald",
                "icon": "completion",
                "title": f"Completion Location (#{job_no})",
                "subtitle": f"Done for {cust_name}",
                "timestamp": str(c_time or ""),
                "time_str": str(c_time)[11:16] if c_time else "Done",
                "latitude": float(c_lat),
                "longitude": float(c_lng),
                "address": j.get("completion_address") or cust_addr,
                "job_id": job_id,
                "job_number": job_no,
                "customer_name": cust_name,
                "rating": j.get("customer_rating"),
                "feedback": j.get("customer_feedback"),
                "before_photo": j.get("before_photo_path"),
                "after_photo": j.get("after_photo_path"),
                "signature": j.get("customer_signature_path"),
                "details": f"Job finalized with customer rating {j.get('customer_rating', 5)}★"
            })

    # Milestone 6: Check-out location (if punched out)
    if attendance_record and attendance_record.get("check_out_lat") and attendance_record.get("check_out_lng"):
        milestones.append({
            "milestone_key": "check_out",
            "type": "CHECK_OUT",
            "badge_color": "red",
            "icon": "punch-out",
            "title": "Check-out Location (Punch Out)",
            "subtitle": f"Hours Worked: {round((attendance_record.get('total_working_minutes') or 0)/60, 1)} hrs",
            "timestamp": f"{target_date_str} {attendance_record.get('check_out_time', '')}".strip(),
            "time_str": str(attendance_record.get("check_out_time") or "")[:5],
            "latitude": float(attendance_record["check_out_lat"]),
            "longitude": float(attendance_record["check_out_lng"]),
            "address": attendance_record.get("check_out_address") or "Office / Gate",
            "job_id": None,
            "job_number": None,
            "working_minutes": attendance_record.get("total_working_minutes"),
            "details": f"Shift completed at {attendance_record.get('check_out_time')}"
        })
    else:
        for act in activity_pings:
            if act.get("action") == "Punch Out" and act.get("latitude") and act.get("longitude"):
                milestones.append({
                    "milestone_key": "check_out",
                    "type": "CHECK_OUT",
                    "badge_color": "red",
                    "icon": "punch-out",
                    "title": "Check-out Location (Punch Out)",
                    "subtitle": "Shift Finished",
                    "timestamp": str(act["created_at"]),
                    "time_str": str(act["created_at"])[11:16],
                    "latitude": float(act["latitude"]),
                    "longitude": float(act["longitude"]),
                    "address": act.get("location_address") or "Office / Gate",
                    "job_id": None,
                    "job_number": None,
                    "details": act.get("description")
                })
                break

    # Sort milestones chronologically
    milestones.sort(key=lambda m: str(m.get("timestamp") or ""))

    # 7. Build Continuous Breadcrumb Route (Trail)
    # Collect raw GPS pings + milestone coordinates into sorted points
    trail_points = []
    seen_points = set()

    for p in gps_pings:
        lat = float(p["latitude"])
        lng = float(p["longitude"])
        time_str = str(p["recorded_at"])
        key = (round(lat, 5), round(lng, 5), time_str[:16])
        if key not in seen_points:
            seen_points.add(key)
            trail_points.append({
                "lat": lat,
                "lng": lng,
                "time": time_str,
                "time_short": time_str[11:16],
                "speed_kmh": float(p.get("speed_kmh") or 0.0),
                "battery": p.get("battery_level"),
                "accuracy": float(p.get("accuracy_meters") or 10.0),
                "job_id": p.get("service_job_id"),
                "point_type": "GPS_PING",
                "label": f"Ping at {time_str[11:16]}"
            })

    # Also add milestone coordinates if not redundant
    for m in milestones:
        lat = float(m["latitude"])
        lng = float(m["longitude"])
        time_str = str(m.get("timestamp") or "")
        key = (round(lat, 5), round(lng, 5), time_str[:16])
        if key not in seen_points:
            seen_points.add(key)
            trail_points.append({
                "lat": lat,
                "lng": lng,
                "time": time_str,
                "time_short": time_str[11:16] if len(time_str) >= 16 else m.get("time_str", ""),
                "speed_kmh": 0.0,
                "battery": None,
                "accuracy": 5.0,
                "job_id": m.get("job_id"),
                "point_type": m["type"],
                "label": m["title"]
            })

    # Sort trail chronologically
    trail_points.sort(key=lambda pt: str(pt.get("time") or ""))

    # Calculate total distance along breadcrumbs
    total_dist_meters = 0.0
    speeds = []
    for i in range(len(trail_points) - 1):
        p1 = trail_points[i]
        p2 = trail_points[i + 1]
        dist = calculate_geodesic_distance_meters(p1["lat"], p1["lng"], p2["lat"], p2["lng"])
        if dist and dist < 200000: # filter out teleportation glitches (> 200km single step)
            total_dist_meters += dist
        if p2.get("speed_kmh") and p2["speed_kmh"] > 0:
            speeds.append(p2["speed_kmh"])

    total_distance_km = round(total_dist_meters / 1000.0, 2)
    max_speed_kmh = round(max(speeds), 1) if speeds else 0.0
    avg_speed_kmh = round(sum(speeds) / len(speeds), 1) if speeds else 0.0

    summary = {
        "total_distance_km": total_distance_km,
        "total_points": len(trail_points),
        "total_milestones": len(milestones),
        "active_jobs_count": len(jobs_handled),
        "max_speed_kmh": max_speed_kmh,
        "avg_speed_kmh": avg_speed_kmh,
        "first_ping_time": trail_points[0]["time_short"] if trail_points else "--:--",
        "last_ping_time": trail_points[-1]["time_short"] if trail_points else "--:--"
    }

    return jsonify({
        "success": True,
        "date": target_date_str,
        "employee": emp_record,
        "technicians_list": technicians_list,
        "attendance": attendance_record,
        "milestones": milestones,
        "trail": trail_points,
        "jobs_handled": jobs_handled,
        "summary": summary
    })


@technician_bp.route("/api/admin/technician-gps-history/simulate-route", methods=["POST"])
def simulate_technician_route():
    """
    Populates or refreshes realistic test route data for a technician on a given date.
    Enables instant demonstration of Check-in, Job Location, On-the-way, Reached,
    Completion, and continuous Location History breadcrumb trail.
    """
    data = request.get_json() or {}
    emp_id = data.get("employee_id")
    target_date_str = (data.get("date") or str(date.today())).strip()

    g.cursor.execute("SELECT id, full_name, employee_code, user_id FROM employees WHERE id = %s", (emp_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Technician not found"}), 404

    target_user_id = emp.get("user_id") or getattr(g, "user_id", None) or 1

    # Office coordinates (Varanasi / Sigra area)
    base_lat = 25.3176
    base_lng = 82.9739

    # 1. Update or create attendance
    g.cursor.execute(
        """
        INSERT INTO employee_attendance (employee_id, user_id, attendance_date, check_in_time, check_in_lat, check_in_lng,
                                         check_in_address, check_out_time, check_out_lat, check_out_lng,
                                         check_out_address, status, total_working_minutes)
        VALUES (%s, %s, %s, '09:15:00', %s, %s, 'Pari Billing Workshop, Sigra, Varanasi', '18:45:00', %s, %s,
                'Pari Billing Workshop, Sigra, Varanasi', 'Present', 570)
        ON DUPLICATE KEY UPDATE 
            user_id = VALUES(user_id),
            check_in_time = VALUES(check_in_time),
            check_in_lat = VALUES(check_in_lat),
            check_in_lng = VALUES(check_in_lng),
            check_in_address = VALUES(check_in_address),
            check_out_time = VALUES(check_out_time),
            check_out_lat = VALUES(check_out_lat),
            check_out_lng = VALUES(check_out_lng),
            check_out_address = VALUES(check_out_address),
            status = 'Present',
            total_working_minutes = 570
        """,
        (emp["id"], target_user_id, target_date_str, base_lat, base_lng, base_lat + 0.0002, base_lng + 0.0003)
    )

    # 2. Check for or create demo service job
    g.cursor.execute(
        """
        SELECT id, service_number FROM service_jobs 
        WHERE assigned_technician_id = %s AND (appointment_date = %s OR DATE(created_at) = %s)
        LIMIT 1
        """,
        (emp["id"], target_date_str, target_date_str)
    )
    job = g.cursor.fetchone()
    
    # Destination coordinates (Lanka / BHU area)
    dest_lat = 25.2815
    dest_lng = 82.9984
    otw_lat = 25.3020
    otw_lng = 82.9840
    reach_lat = 25.2818
    reach_lng = 82.9980
    comp_lat = 25.2817
    comp_lng = 82.9982

    if not job:
        # Create a field complaint job
        srv_num = f"FLD-{target_date_str.replace('-','')}-{emp['id']:02d}"
        g.cursor.execute(
            """
            INSERT INTO service_jobs (service_number, service_type, customer_name, customer_mobile, customer_address,
                                     complaint_type, complaint, priority, assigned_technician_id, technician_name,
                                     service_status, appointment_date, appointment_start_time, appointment_end_time,
                                     job_latitude, job_longitude,
                                     on_the_way_at, on_the_way_lat, on_the_way_lng, on_the_way_address,
                                     reached_at, reached_lat, reached_lng, reached_address,
                                     work_started_at, completed_at, completion_lat, completion_lng, completion_address,
                                     customer_rating, customer_feedback)
            VALUES (%s, 'Field', 'Sharma Electronics (Manoj Sharma)', '9876543210', 'Plot 45, Near Lanka Gate, Varanasi',
                    'Hardware Repair', 'Laser printer roller jammed and toner drum replacement', 'High', %s, %s,
                    'Completed', %s, '10:30:00', '12:00:00',
                    %s, %s,
                    %s, %s, %s, 'Sigra Chauraha, Varanasi',
                    %s, %s, %s, 'Lanka Main Road, Varanasi',
                    %s, %s, %s, %s, 'Plot 45, Near Lanka Gate, Varanasi',
                    5, 'Excellent and fast service! Problem resolved on spot.')
            """,
            (
                srv_num, emp["id"], emp["full_name"], target_date_str,
                dest_lat, dest_lng,
                f"{target_date_str} 10:05:00", otw_lat, otw_lng,
                f"{target_date_str} 10:28:00", reach_lat, reach_lng,
                f"{target_date_str} 10:32:00",
                f"{target_date_str} 11:45:00", comp_lat, comp_lng
            )
        )
        job_id = g.cursor.lastrowid
    else:
        job_id = job["id"]
        g.cursor.execute(
            """
            UPDATE service_jobs
            SET job_latitude = %s, job_longitude = %s,
                on_the_way_at = %s, on_the_way_lat = %s, on_the_way_lng = %s, on_the_way_address = 'Sigra Chauraha, Varanasi',
                reached_at = %s, reached_lat = %s, reached_lng = %s, reached_address = 'Lanka Main Road, Varanasi',
                work_started_at = %s,
                completed_at = %s, completion_lat = %s, completion_lng = %s, completion_address = 'Plot 45, Near Lanka Gate, Varanasi',
                customer_rating = 5, customer_feedback = 'Excellent and fast service! Problem resolved on spot.'
            WHERE id = %s
            """,
            (
                dest_lat, dest_lng,
                f"{target_date_str} 10:05:00", otw_lat, otw_lng,
                f"{target_date_str} 10:28:00", reach_lat, reach_lng,
                f"{target_date_str} 10:32:00",
                f"{target_date_str} 11:45:00", comp_lat, comp_lng,
                job_id
            )
        )

    # 3. Insert realistic breadcrumb trajectory into employee_gps_locations
    # Clear existing pings for that date to avoid clutter
    g.cursor.execute("DELETE FROM employee_gps_locations WHERE employee_id = %s AND DATE(recorded_at) = %s", (emp["id"], target_date_str))

    sample_waypoints = [
        # (lat, lng, time_str, speed, battery, job_id)
        (25.3176, 82.9739, "09:15:00", 0.0, 98, None),     # Punch in at office
        (25.3174, 82.9742, "09:30:00", 1.2, 97, None),     # Workshop staging
        (25.3160, 82.9755, "10:00:00", 15.4, 96, job_id),  # Travel starts
        (25.3020, 82.9840, "10:05:00", 28.5, 95, job_id),  # On the way milestone
        (25.2950, 82.9890, "10:12:00", 32.0, 94, job_id),  # En route
        (25.2890, 82.9930, "10:20:00", 24.5, 93, job_id),  # Approaching Lanka
        (25.2818, 82.9980, "10:28:00", 3.0, 92, job_id),   # Reached site
        (25.2816, 82.9983, "10:45:00", 0.0, 90, job_id),   # In progress work
        (25.2817, 82.9982, "11:15:00", 0.0, 88, job_id),   # In progress work
        (25.2817, 82.9982, "11:45:00", 0.0, 86, job_id),   # Job Completed
        (25.2850, 82.9950, "12:15:00", 22.0, 84, None),    # Moving to next spot
        (25.2980, 82.9860, "13:00:00", 0.0, 80, None),     # Lunch stop
        (25.3100, 82.9780, "15:30:00", 26.5, 75, None),    # Return trip
        (25.3175, 82.9740, "18:30:00", 0.5, 68, None),     # Reached office
        (25.3178, 82.9742, "18:45:00", 0.0, 67, None),     # Punch out
    ]

    for wpt in sample_waypoints:
        ts = f"{target_date_str} {wpt[2]}"
        g.cursor.execute(
            """
            INSERT INTO employee_gps_locations (employee_id, service_job_id, latitude, longitude, accuracy_meters, speed_kmh, battery_level, recorded_at)
            VALUES (%s, %s, %s, %s, 8.0, %s, %s, %s)
            """,
            (emp["id"], wpt[5], wpt[0], wpt[1], wpt[3], wpt[4], ts)
        )

    g.db.commit()

    return jsonify({
        "success": True,
        "message": f"Sample GPS route and milestones simulated successfully for {emp['full_name']} on {target_date_str}."
    })


# ==============================================================================
# TECHNICIAN MOBILE APP - DASHBOARD, JOBS & WORK PROOF
# ==============================================================================

@technician_bp.route("/api/tech/dashboard-summary", methods=["GET"])
def get_technician_dashboard_summary():
    user_id = g.user_id
    g.cursor.execute("SELECT id, employee_code, full_name, phone, designation FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee profile not found."}), 404
    emp_id = emp["id"]
    today = str(date.today())

    # Today's jobs
    g.cursor.execute(
        """
        SELECT sj.id, sj.service_number, sj.customer_name, sj.customer_mobile, sj.complaint,
               sj.service_status, sj.priority, sj.complaint_type, sj.appointment_date,
               sj.appointment_start_time, sj.appointment_end_time, sj.estimated_duration_minutes,
               c.address AS customer_address
        FROM service_jobs sj
        LEFT JOIN customers c ON c.id = sj.customer_id
        WHERE sj.assigned_technician_id = %s
          AND (sj.appointment_date = %s OR (sj.appointment_date IS NULL AND DATE(sj.created_at) = %s))
        ORDER BY sj.appointment_start_time ASC, sj.id DESC
        """,
        (emp_id, today, today)
    )
    today_jobs = serialize_rows(g.cursor.fetchall())
    today_count = len(today_jobs)

    # Completed jobs count today
    g.cursor.execute(
        """
        SELECT COUNT(*) AS cnt FROM service_jobs
        WHERE assigned_technician_id = %s AND service_status IN ('Completed', 'Delivered')
          AND (appointment_date = %s OR (appointment_date IS NULL AND DATE(created_at) = %s))
        """,
        (emp_id, today, today)
    )
    completed_row = g.cursor.fetchone()
    completed_count = completed_row["cnt"] if completed_row else 0

    # Pending jobs count (total active assigned)
    g.cursor.execute(
        """
        SELECT COUNT(*) AS cnt FROM service_jobs
        WHERE assigned_technician_id = %s AND service_status NOT IN ('Completed', 'Delivered', 'Cancelled')
        """,
        (emp_id,)
    )
    pending_row = g.cursor.fetchone()
    pending_count = pending_row["cnt"] if pending_row else 0

    # Upcoming jobs count (appointment_date > today)
    g.cursor.execute(
        """
        SELECT COUNT(*) AS cnt FROM service_jobs
        WHERE assigned_technician_id = %s AND appointment_date > %s AND service_status NOT IN ('Completed', 'Delivered', 'Cancelled')
        """,
        (emp_id, today)
    )
    upcoming_row = g.cursor.fetchone()
    upcoming_count = upcoming_row["cnt"] if upcoming_row else 0

    # Active job (In Progress, Reached Site, or On the Way)
    g.cursor.execute(
        """
        SELECT sj.id, sj.service_number, sj.customer_name, sj.customer_mobile, sj.service_status, sj.complaint,
               c.address AS customer_address
        FROM service_jobs sj
        LEFT JOIN customers c ON c.id = sj.customer_id
        WHERE sj.assigned_technician_id = %s AND sj.service_status IN ('In Progress', 'Reached Site', 'On the Way')
        ORDER BY FIELD(sj.service_status, 'In Progress', 'Reached Site', 'On the Way')
        LIMIT 1
        """,
        (emp_id,)
    )
    active_job = serialize_row(g.cursor.fetchone())

    return jsonify({
        "success": True,
        "employee": serialize_row(emp),
        "stats": {
            "today_count": today_count,
            "completed_count": completed_count,
            "pending_count": pending_count,
            "upcoming_count": upcoming_count
        },
        "today_jobs": today_jobs,
        "active_job": active_job,
        "notifications_count": 3
    })


@technician_bp.route("/api/tech/jobs", methods=["GET"])
def get_technician_jobs():
    user_id = g.user_id
    filter_type = request.args.get("filter", "all")

    g.cursor.execute("SELECT id FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee profile not found."}), 404
    emp_id = emp["id"]

    sql = """
        SELECT sj.id, sj.service_number, sj.customer_name, sj.customer_mobile, sj.complaint,
               sj.service_status, sj.priority, sj.complaint_type, sj.appointment_date,
               sj.appointment_start_time, sj.appointment_end_time, sj.estimated_duration_minutes,
               sj.actual_duration_minutes, sj.accepted_at, sj.on_the_way_at, sj.reached_at,
               sj.work_started_at, sj.completed_at, sj.product_source, sj.external_product_name,
               sj.external_brand, sj.external_model, sj.hold_reason, sj.held_at, c.address AS customer_address, NULL AS customer_city,
               (SELECT COUNT(*) FROM service_job_work_proof wp WHERE wp.service_job_id = sj.id) AS has_work_proof
        FROM service_jobs sj
        LEFT JOIN customers c ON c.id = sj.customer_id
        WHERE sj.assigned_technician_id = %s
    """
    params = [emp_id]

    today = str(date.today())
    if filter_type == "today":
        sql += " AND (sj.appointment_date = %s OR (sj.appointment_date IS NULL AND DATE(sj.created_at) = %s))"
        params.extend([today, today])
    elif filter_type == "pending":
        sql += " AND sj.service_status NOT IN ('Delivered', 'Completed', 'Cancelled')"
    elif filter_type == "hold":
        sql += " AND sj.service_status = 'On Hold'"
    elif filter_type == "completed":
        sql += " AND sj.service_status IN ('Completed', 'Delivered')"

    sql += " ORDER BY sj.appointment_date ASC, sj.appointment_start_time ASC, sj.id DESC"
    g.cursor.execute(sql, params)
    jobs = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "jobs": jobs})


@technician_bp.route("/api/tech/jobs/<int:job_id>", methods=["GET"])
def get_technician_job_detail(job_id):
    user_id = g.user_id
    g.cursor.execute("SELECT id FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    emp_id = emp["id"] if emp else 0

    g.cursor.execute(
        """
        SELECT sj.*, c.address AS customer_address, NULL AS customer_city, c.email AS customer_email,
               wp.before_photo_path, wp.after_photo_path, wp.customer_signature_path, wp.technician_notes,
               wp.customer_feedback, wp.submitted_at AS proof_submitted_at
        FROM service_jobs sj
        LEFT JOIN customers c ON c.id = sj.customer_id
        LEFT JOIN service_job_work_proof wp ON wp.service_job_id = sj.id
        WHERE sj.id = %s
        LIMIT 1
        """,
        (job_id,)
    )
    job = serialize_row(g.cursor.fetchone())
    if not job:
        return jsonify({"success": False, "message": "Service job not found."}), 404

    user_role = str(getattr(g, "current_user", {}).get("role") or "").lower()
    if user_role == "technician" and job.get("assigned_technician_id") != emp_id:
        return jsonify({"success": False, "message": "You are not authorized to view this job sheet."}), 403

    g.cursor.execute(
        "SELECT id, part_name, serial_number, quantity, unit_price, line_total FROM service_job_parts WHERE service_job_id = %s",
        (job_id,)
    )
    parts = serialize_rows(g.cursor.fetchall())

    return jsonify({"success": True, "job": job, "parts": parts})


@technician_bp.route("/api/tech/jobs/<int:job_id>/status", methods=["POST"])
def update_technician_job_status(job_id):
    user_id = g.user_id
    data = request.get_json() or {}
    new_status = data.get("status")
    lat = data.get("latitude")
    lng = data.get("longitude")
    hold_reason = (data.get("hold_reason") or data.get("remark") or "").strip()

    allowed_statuses = {"Accepted", "On the Way", "Reached Site", "In Progress", "Completed", "Cancelled", "On Hold"}
    if new_status not in allowed_statuses:
        return jsonify({"success": False, "message": f"Invalid status: {new_status}"}), 400

    g.cursor.execute("SELECT id FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    emp_id = emp["id"] if emp else 0

    g.cursor.execute("SELECT id, service_number, service_status, assigned_technician_id, work_started_at, created_at FROM service_jobs WHERE id = %s", (job_id,))
    job = g.cursor.fetchone()
    if not job:
        return jsonify({"success": False, "message": "Job not found."}), 404

    current_status = (job.get("service_status") or "Pending").strip()

    # Rule 1: Single Active Complaint Constraint
    # Only one complaint can be in ('On the Way', 'Reached Site', 'In Progress') at a time per technician.
    active_statuses = {"On the Way", "Reached Site", "In Progress"}
    if new_status in active_statuses and emp_id:
        g.cursor.execute(
            """
            SELECT id, service_number, service_status, customer_name
            FROM service_jobs
            WHERE assigned_technician_id = %s
              AND service_status IN ('On the Way', 'Reached Site', 'In Progress')
              AND id != %s
            LIMIT 1
            """,
            (emp_id, job_id)
        )
        active_conflict = g.cursor.fetchone()
        if active_conflict:
            return jsonify({
                "success": False,
                "message": f"Complaint #{active_conflict['service_number']} is currently active ({active_conflict['service_status']}). You can only work on one complaint at a time. Please put it on Hold or Complete it first."
            }), 400

    # Rule 2: Strict Sequential State Machine Transitions
    if new_status == "On the Way":
        if current_status == "On the Way":
            return jsonify({"success": False, "message": "You are already On the Way to this job."}), 400
        if current_status in ("Reached Site", "In Progress"):
            return jsonify({"success": False, "message": f"Cannot set to 'On the Way' because job is already '{current_status}'."}), 400
        if current_status in ("Completed", "Cancelled", "Delivered", "Closed"):
            return jsonify({"success": False, "message": f"This job is already {current_status}."}), 400

    elif new_status == "Reached Site":
        # Next step after 'On the Way' MUST be 'Reached Site'
        if current_status != "On the Way":
            if current_status == "Reached Site":
                return jsonify({"success": False, "message": "You have already marked arrival at this site."}), 400
            if current_status == "In Progress":
                return jsonify({"success": False, "message": "Work has already started on this job. Cannot mark Reached again."}), 400
            return jsonify({"success": False, "message": "You must click 'On the Way' first before marking arrival ('Reached Site')."}), 400

    elif new_status == "In Progress":
        # Can ONLY start work if current status is 'Reached Site'
        if current_status != "Reached Site":
            if current_status == "In Progress":
                return jsonify({"success": False, "message": "Work is already in progress on this job."}), 400
            if current_status == "On the Way":
                return jsonify({"success": False, "message": "You must mark 'Reached Site' first before starting work."}), 400
            return jsonify({"success": False, "message": "You must travel and reach the site before starting work."}), 400

    elif new_status == "Completed":
        # Can ONLY complete if current status is 'In Progress'
        if current_status != "In Progress":
            return jsonify({"success": False, "message": "Work must be started ('In Progress') before completing this job."}), 400

    elif new_status == "On Hold":
        if current_status in ("Completed", "Cancelled", "Delivered", "Closed"):
            return jsonify({"success": False, "message": f"Cannot put a {current_status} job on hold."}), 400
        if current_status == "On Hold":
            return jsonify({"success": False, "message": "This job is already on hold."}), 400
        if not hold_reason:
            return jsonify({"success": False, "message": "Hold remark/reason is required to put a job on hold."}), 400

    updates = ["service_status = %s"]
    params = [new_status]

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    address = (data.get("address") or data.get("location_address") or "").strip() or None

    if new_status == "Accepted":
        updates.append("accepted_at = %s")
        params.append(now_str)
    elif new_status == "On the Way":
        updates.append("on_the_way_at = %s")
        params.append(now_str)
        if lat and lng:
            updates.append("on_the_way_lat = %s")
            params.append(lat)
            updates.append("on_the_way_lng = %s")
            params.append(lng)
            if address:
                updates.append("on_the_way_address = %s")
                params.append(address)
            if emp_id:
                g.cursor.execute(
                    """
                    INSERT INTO employee_gps_locations (employee_id, service_job_id, latitude, longitude, accuracy_meters)
                    VALUES (%s, %s, %s, %s, 10.0)
                    """,
                    (emp_id, job_id, lat, lng)
                )
    elif new_status == "Reached Site":
        updates.append("reached_at = %s")
        params.append(now_str)
        if lat and lng:
            updates.append("reached_lat = %s")
            params.append(lat)
            updates.append("reached_lng = %s")
            params.append(lng)
            if address:
                updates.append("reached_address = %s")
                params.append(address)
            if emp_id:
                g.cursor.execute(
                    """
                    INSERT INTO employee_gps_locations (employee_id, service_job_id, latitude, longitude, accuracy_meters)
                    VALUES (%s, %s, %s, %s, 10.0)
                    """,
                    (emp_id, job_id, lat, lng)
                )
    elif new_status == "In Progress":
        updates.append("work_started_at = %s")
        params.append(now_str)
    elif new_status == "On Hold":
        updates.append("held_at = %s")
        params.append(now_str)
        if hold_reason:
            updates.append("hold_reason = %s")
            params.append(hold_reason)
    elif new_status == "Completed":
        updates.append("completed_at = %s")
        params.append(now_str)
        if lat and lng:
            updates.append("completion_lat = %s")
            params.append(lat)
            updates.append("completion_lng = %s")
            params.append(lng)
            if address:
                updates.append("completion_address = %s")
                params.append(address)
            if emp_id:
                g.cursor.execute(
                    """
                    INSERT INTO employee_gps_locations (employee_id, service_job_id, latitude, longitude, accuracy_meters)
                    VALUES (%s, %s, %s, %s, 10.0)
                    """,
                    (emp_id, job_id, lat, lng)
                )
        start_time = job.get("work_started_at") or job.get("created_at")
        if start_time:
            actual_dur = max(1, int((datetime.now() - start_time).total_seconds() / 60))
            updates.append("actual_duration_minutes = %s")
            params.append(actual_dur)
    elif new_status == "Cancelled":
        updates.append("cancelled_at = %s")
        params.append(now_str)

    params.append(job_id)
    sql = f"UPDATE service_jobs SET {', '.join(updates)} WHERE id = %s"
    g.cursor.execute(sql, params)
    g.db.commit()

    # Trigger cascade schedule shift if completed (delays shift forward, early finish shifts back)
    if new_status == "Completed":
        try:
            cascade_res = cascade_technician_schedule_shift(job_id)
            print("Cascade reschedule result for job", job_id, ":", cascade_res)
        except Exception as cs_err:
            print("Cascade reschedule error:", cs_err)

    emp_name = emp.get("full_name") if emp else "Technician"
    log_technician_activity(
        employee_id=emp_id,
        user_id=user_id,
        activity_type="JOB_STATUS",
        action=f"Status: {new_status}",
        description=f"{emp_name} updated Job #{job.get('service_number', job_id)} to '{new_status}'" + (f" (Reason: {hold_reason})" if hold_reason else ""),
        service_job_id=job_id,
        latitude=lat,
        longitude=lng
    )

    return jsonify({"success": True, "message": f"Job status updated to {new_status}."})


@technician_bp.route("/api/tech/jobs/<int:job_id>/work-proof", methods=["POST"])
def submit_work_proof(job_id):
    user_id = g.user_id
    data = request.get_json() or {}
    before_img_data = data.get("before_photo")
    after_img_data = data.get("after_photo")
    sig_img_data = data.get("customer_signature")
    tech_notes = (data.get("technician_notes") or "").strip()
    cust_feedback = (data.get("customer_feedback") or "").strip()

    g.cursor.execute("SELECT id, full_name FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    emp_id = emp["id"] if emp else 0

    before_path = save_base64_image(before_img_data, WORK_PROOF_DIR, prefix=f"before_job_{job_id}")
    after_path = save_base64_image(after_img_data, WORK_PROOF_DIR, prefix=f"after_job_{job_id}")
    sig_path = save_base64_image(sig_img_data, SIGNATURE_DIR, prefix=f"sig_job_{job_id}")

    cust_rating = data.get("customer_rating")
    try:
        cust_rating = max(1, min(5, int(cust_rating))) if cust_rating is not None else 5
    except Exception:
        cust_rating = 5

    g.cursor.execute(
        """
        INSERT INTO service_job_work_proof (service_job_id, technician_id, before_photo_path, after_photo_path,
                                            customer_signature_path, technician_notes, customer_feedback, customer_rating)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE before_photo_path = COALESCE(VALUES(before_photo_path), before_photo_path),
                                after_photo_path = COALESCE(VALUES(after_photo_path), after_photo_path),
                                customer_signature_path = COALESCE(VALUES(customer_signature_path), customer_signature_path),
                                technician_notes = VALUES(technician_notes),
                                customer_feedback = VALUES(customer_feedback),
                                customer_rating = VALUES(customer_rating)
        """,
        (job_id, emp_id, before_path, after_path, sig_path, tech_notes, cust_feedback, cust_rating)
    )

    # Sync rating & feedback & completion coordinates to service_jobs
    proof_lat = data.get("latitude")
    proof_lng = data.get("longitude")
    proof_addr = (data.get("address") or data.get("location_address") or "").strip() or None

    sj_updates = []
    sj_params = []
    if cust_feedback:
        sj_updates.append("customer_feedback = %s")
        sj_params.append(cust_feedback)
    if cust_rating:
        sj_updates.append("customer_rating = %s")
        sj_params.append(cust_rating)
    if proof_lat and proof_lng:
        sj_updates.append("completion_lat = COALESCE(completion_lat, %s)")
        sj_params.append(proof_lat)
        sj_updates.append("completion_lng = COALESCE(completion_lng, %s)")
        sj_params.append(proof_lng)
        if proof_addr:
            sj_updates.append("completion_address = COALESCE(completion_address, %s)")
            sj_params.append(proof_addr)
        if emp_id:
            g.cursor.execute(
                """
                INSERT INTO employee_gps_locations (employee_id, service_job_id, latitude, longitude, accuracy_meters)
                VALUES (%s, %s, %s, %s, 10.0)
                """,
                (emp_id, job_id, proof_lat, proof_lng)
            )

    if sj_updates:
        sj_params.append(job_id)
        g.cursor.execute(f"UPDATE service_jobs SET {', '.join(sj_updates)} WHERE id = %s", sj_params)
    g.db.commit()

    emp_name = emp.get("full_name") if emp else "Technician"
    log_technician_activity(
        employee_id=emp_id,
        user_id=user_id,
        activity_type="WORK_PROOF",
        action="Proof Uploaded",
        description=f"{emp_name} submitted work proof & customer signature for Job #{job_id}",
        service_job_id=job_id,
        latitude=proof_lat,
        longitude=proof_lng,
        location_address=proof_addr
    )

    return jsonify({
        "success": True,
        "message": "Work proof and customer signature saved successfully.",
        "before_photo": before_path,
        "after_photo": after_path,
        "signature": sig_path
    })


@technician_bp.route("/api/tech/my-tools", methods=["GET"])
def get_my_tools():
    user_id = g.user_id
    g.cursor.execute("SELECT id FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee not found."}), 404

    g.cursor.execute(
        """
        SELECT id, tool_code, tool_name, category, serial_number, condition_status, assigned_date, remarks
        FROM technician_tools
        WHERE assigned_employee_id = %s
        ORDER BY tool_name ASC
        """,
        (emp["id"],)
    )
    tools = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "tools": tools})


@technician_bp.route("/api/tech/my-inventory", methods=["GET"])
def get_my_inventory():
    user_id = g.user_id
    g.cursor.execute("SELECT id FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    emp = g.cursor.fetchone()
    if not emp:
        return jsonify({"success": False, "message": "Employee not found."}), 404

    g.cursor.execute(
        """
        SELECT ti.id, ti.product_id, ti.quantity_held, ti.updated_at,
               p.product_name, p.unit, p.sale_price, p.track_serial
        FROM technician_inventory ti
        JOIN products p ON p.id = ti.product_id
        WHERE ti.employee_id = %s AND ti.quantity_held > 0
        ORDER BY p.product_name ASC
        """,
        (emp["id"],)
    )
    inventory = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "inventory": inventory})


# ==============================================================================
# TECHNICIAN TOOLS ASSET REGISTER (ADMIN)
# ==============================================================================

@technician_bp.route("/api/tools", methods=["GET"])
def list_tools():
    emp_id = request.args.get("employee_id")
    condition = request.args.get("condition")

    sql = """
        SELECT tt.*, e.full_name AS assigned_to_name, e.employee_code
        FROM technician_tools tt
        LEFT JOIN employees e ON e.id = tt.assigned_employee_id
        WHERE 1=1
    """
    params = []
    if emp_id:
        sql += " AND tt.assigned_employee_id = %s"
        params.append(emp_id)
    if condition:
        sql += " AND tt.condition_status = %s"
        params.append(condition)

    sql += " ORDER BY tt.id DESC"
    g.cursor.execute(sql, params)
    tools = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "tools": tools})


@technician_bp.route("/api/tools", methods=["POST"])
def add_tool():
    data = request.get_json() or {}
    tool_name = (data.get("tool_name") or "").strip()
    tool_code = (data.get("tool_code") or "").strip()
    category = (data.get("category") or "Hand Tool").strip()
    serial_number = (data.get("serial_number") or "").strip() or None
    purchase_date = data.get("purchase_date") or None
    purchase_cost = float(data.get("purchase_cost") or 0.0)
    condition_status = data.get("condition_status") or "Good"
    remarks = (data.get("remarks") or "").strip() or None

    if not tool_name:
        return jsonify({"success": False, "message": "Tool name is required."}), 400

    if not tool_code:
        g.cursor.execute("SELECT MAX(id) AS max_id FROM technician_tools")
        max_id = (g.cursor.fetchone() or {}).get("max_id") or 0
        tool_code = f"TOOL-{(max_id + 1):04d}"

    g.cursor.execute(
        """
        INSERT INTO technician_tools (tool_code, tool_name, category, serial_number, purchase_date,
                                      purchase_cost, condition_status, remarks)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (tool_code, tool_name, category, serial_number, purchase_date, purchase_cost, condition_status, remarks)
    )
    g.db.commit()
    return jsonify({"success": True, "message": f"Tool '{tool_name}' added successfully."}), 201


@technician_bp.route("/api/tools/<int:tool_id>", methods=["PUT"])
def update_tool(tool_id):
    data = request.get_json() or {}
    tool_name = (data.get("tool_name") or "").strip()
    category = (data.get("category") or "Hand Tool").strip()
    serial_number = (data.get("serial_number") or "").strip() or None
    purchase_date = data.get("purchase_date") or None
    purchase_cost = float(data.get("purchase_cost") or 0.0)
    condition_status = data.get("condition_status") or "Good"
    remarks = (data.get("remarks") or "").strip() or None

    if not tool_name:
        return jsonify({"success": False, "message": "Tool name is required."}), 400

    g.cursor.execute(
        """
        UPDATE technician_tools
        SET tool_name = %s, category = %s, serial_number = %s, purchase_date = %s,
            purchase_cost = %s, condition_status = %s, remarks = %s
        WHERE id = %s
        """,
        (tool_name, category, serial_number, purchase_date, purchase_cost, condition_status, remarks, tool_id)
    )
    g.db.commit()
    return jsonify({"success": True, "message": "Tool updated successfully."})


@technician_bp.route("/api/tools/<int:tool_id>/assign", methods=["POST"])
def assign_tool(tool_id):
    data = request.get_json() or {}
    employee_id = data.get("employee_id")
    assigned_date = data.get("assigned_date") or str(date.today())
    condition = data.get("condition_status") or "Good"

    if not employee_id:
        return jsonify({"success": False, "message": "Employee is required."}), 400

    g.cursor.execute(
        """
        UPDATE technician_tools
        SET assigned_employee_id = %s, assigned_date = %s, condition_status = %s, return_date = NULL
        WHERE id = %s
        """,
        (employee_id, assigned_date, condition, tool_id)
    )
    g.db.commit()
    return jsonify({"success": True, "message": "Tool assigned successfully."})


@technician_bp.route("/api/tools/<int:tool_id>/return", methods=["POST"])
def return_tool(tool_id):
    data = request.get_json() or {}
    condition = data.get("condition_status") or "Good"
    remarks = (data.get("remarks") or "").strip() or None
    return_date = data.get("return_date") or str(date.today())

    g.cursor.execute(
        """
        UPDATE technician_tools
        SET assigned_employee_id = NULL, return_date = %s, condition_status = %s,
            remarks = COALESCE(%s, remarks)
        WHERE id = %s
        """,
        (return_date, condition, remarks, tool_id)
    )
    g.db.commit()
    return jsonify({"success": True, "message": "Tool marked as returned."})


@technician_bp.route("/api/tools/<int:tool_id>", methods=["DELETE"])
def delete_tool(tool_id):
    g.cursor.execute("DELETE FROM technician_tools WHERE id = %s", (tool_id,))
    g.db.commit()
    return jsonify({"success": True, "message": "Tool deleted successfully."})


# ==============================================================================
# TECHNICIAN MATERIAL INVENTORY (ADMIN CONTROLLED)
# ==============================================================================

@technician_bp.route("/api/technician-inventory", methods=["GET"])
def list_technician_inventory():
    emp_id = request.args.get("employee_id")

    sql = """
        SELECT ti.*, e.full_name AS employee_name, e.employee_code,
               p.product_name, p.unit, p.sale_price, p.purchase_price
        FROM technician_inventory ti
        JOIN employees e ON e.id = ti.employee_id
        JOIN products p ON p.id = ti.product_id
        WHERE ti.quantity_held > 0
    """
    params = []
    if emp_id:
        sql += " AND ti.employee_id = %s"
        params.append(emp_id)

    sql += " ORDER BY e.full_name ASC, p.product_name ASC"
    g.cursor.execute(sql, params)
    inventory = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "inventory": inventory})


@technician_bp.route("/api/technician-inventory/issue", methods=["POST"])
def issue_inventory_to_technician():
    data = request.get_json() or {}
    employee_id = data.get("employee_id")
    product_id = data.get("product_id")
    quantity = int(data.get("quantity") or 0)
    remarks = (data.get("remarks") or "").strip() or None

    if not employee_id or not product_id or quantity <= 0:
        return jsonify({"success": False, "message": "Employee, Product, and positive Quantity are required."}), 400

    g.cursor.execute(
        """
        INSERT INTO technician_inventory (employee_id, product_id, quantity_held)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE quantity_held = quantity_held + VALUES(quantity_held)
        """,
        (employee_id, product_id, quantity)
    )

    g.cursor.execute(
        """
        INSERT INTO technician_inventory_logs (employee_id, product_id, transaction_type, quantity, remarks, issued_by_user_id)
        VALUES (%s, %s, 'Issued_To_Technician', %s, %s, %s)
        """,
        (employee_id, product_id, quantity, remarks, g.user_id)
    )
    g.db.commit()

    return jsonify({"success": True, "message": f"Successfully issued {quantity} units to technician."})


@technician_bp.route("/api/technician-inventory/return", methods=["POST"])
def return_inventory_from_technician():
    data = request.get_json() or {}
    employee_id = data.get("employee_id")
    product_id = data.get("product_id")
    quantity = int(data.get("quantity") or 0)
    remarks = (data.get("remarks") or "").strip() or None

    if not employee_id or not product_id or quantity <= 0:
        return jsonify({"success": False, "message": "Employee, Product, and positive Quantity are required."}), 400

    g.cursor.execute(
        "SELECT quantity_held FROM technician_inventory WHERE employee_id = %s AND product_id = %s",
        (employee_id, product_id)
    )
    row = g.cursor.fetchone()
    current_qty = row["quantity_held"] if row else 0

    if quantity > current_qty:
        return jsonify({"success": False, "message": f"Cannot return {quantity} units. Technician only holds {current_qty}."}), 400

    g.cursor.execute(
        "UPDATE technician_inventory SET quantity_held = quantity_held - %s WHERE employee_id = %s AND product_id = %s",
        (quantity, employee_id, product_id)
    )

    g.cursor.execute(
        """
        INSERT INTO technician_inventory_logs (employee_id, product_id, transaction_type, quantity, remarks, issued_by_user_id)
        VALUES (%s, %s, 'Returned_To_Store', %s, %s, %s)
        """,
        (employee_id, product_id, quantity, remarks, g.user_id)
    )
    g.db.commit()

    return jsonify({"success": True, "message": f"Successfully received {quantity} units back into store."})


@technician_bp.route("/api/technician-inventory/logs", methods=["GET"])
def inventory_logs():
    emp_id = request.args.get("employee_id")
    limit = min(int(request.args.get("limit", 100)), 200)

    sql = """
        SELECT til.*, e.full_name AS employee_name, e.employee_code, p.product_name, u.username AS issued_by_username
        FROM technician_inventory_logs til
        JOIN employees e ON e.id = til.employee_id
        JOIN products p ON p.id = til.product_id
        JOIN users u ON u.id = til.issued_by_user_id
        WHERE 1=1
    """
    params = []
    if emp_id:
        sql += " AND til.employee_id = %s"
        params.append(emp_id)

    sql += " ORDER BY til.created_at DESC LIMIT %s"
    params.append(limit)

    g.cursor.execute(sql, params)
    logs = serialize_rows(g.cursor.fetchall())
    return jsonify({"success": True, "logs": logs})


# ==============================================================================
# STATIC WORK PROOFS & SIGNATURES SERVING
# ==============================================================================

@technician_bp.route("/uploads/<folder>/<filename>", methods=["GET"])
def serve_uploaded_file(folder, filename):
    allowed_folders = {"work_proofs": WORK_PROOF_DIR, "signatures": SIGNATURE_DIR, "employee_photos": EMPLOYEE_PHOTO_DIR}
    target_dir = allowed_folders.get(folder)
    if not target_dir:
        return jsonify({"success": False, "message": "Invalid folder."}), 404
    return send_from_directory(target_dir, filename)

