import hashlib
import json
import secrets
from datetime import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, g

ai_bp = Blueprint("ai_assistant", __name__)

def ensure_api_keys_schema(get_db_connection):
    db = cur = None
    try:
        db = get_db_connection()
        cur = db.cursor(dictionary=True)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(120) NOT NULL,
                api_key_hash VARCHAR(255) NOT NULL UNIQUE,
                api_key_prefix VARCHAR(40) NOT NULL,
                raw_key_display VARCHAR(120) NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                last_used_at TIMESTAMP NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_api_key_hash(api_key_hash)
            )
        """)
        db.commit()
    except Exception as e:
        print("API Keys schema error:", e)
    finally:
        if cur:
            try: cur.close()
            except Exception: pass
        if db:
            try:
                if db.is_connected(): db.close()
            except Exception: pass

def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()

def get_provided_key():
    # 1. Header X-API-Key
    key = request.headers.get("X-API-Key", "").strip()
    if key:
        return key
    # 2. Authorization: Bearer crd_ai_...
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.startswith("Bearer "):
        bearer_val = auth_header[7:].strip()
        if bearer_val.startswith("crd_ai_"):
            return bearer_val
    # 3. Query param ?api_key=...
    q_key = request.args.get("api_key", "").strip()
    if q_key:
        return q_key
    return None

def require_ai_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == "OPTIONS":
            return "", 200

        raw_key = get_provided_key()
        if not raw_key:
            return jsonify({
                "success": False,
                "error": "Unauthorized",
                "message": "Valid API Key required. Pass via 'X-API-Key' header, 'Authorization: Bearer <key>', or '?api_key=<key>' parameter."
            }), 401

        k_hash = hash_key(raw_key)
        try:
            g.cursor.execute(
                "SELECT * FROM api_keys WHERE api_key_hash = %s AND is_active = 1 LIMIT 1",
                (k_hash,)
            )
            key_record = g.cursor.fetchone()
            if not key_record:
                return jsonify({
                    "success": False,
                    "error": "Forbidden",
                    "message": "Invalid or revoked API Key."
                }), 403

            # Update last used timestamp
            g.cursor.execute(
                "UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = %s",
                (key_record["id"],)
            )
            g.db.commit()
            g.ai_key = key_record

        except Exception as e:
            print("AI Auth error:", e)
            return jsonify({"success": False, "message": "Database auth error: " + str(e)}), 500

        return f(*args, **kwargs)
    return decorated_function


# =====================================================================
# 1. OPENAPI SPECIFICATION (FOR CHATGPT ACTIONS / AI ASSISTANT IMPORT)
# =====================================================================
@ai_bp.route("/api/ai/openapi.json", methods=["GET"])
def openapi_spec():
    host_url = request.host_url.rstrip("/")
    spec = {
        "openapi": "3.0.3",
        "info": {
            "title": "CRD Global Solutions AI Assistant API",
            "version": "1.0.0",
            "description": "Real-time AI Assistant integration API for CRD Global Solutions Billing & Solar ERP. Enables external AI models (ChatGPT Custom GPT, WhatsApp AI, Claude) to query inventory, customer ledgers, daily sales, and solar file stages."
        },
        "servers": [
            { "url": host_url, "description": "Live CRD Billing Server" }
        ],
        "components": {
            "securitySchemes": {
                "ApiKeyAuth": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-API-Key",
                    "description": "CRD AI Assistant API Key generated from Billing Settings."
                }
            }
        },
        "security": [
            { "ApiKeyAuth": [] }
        ],
        "paths": {
            "/api/ai/summary": {
                "get": {
                    "summary": "Business Overview & Daily Stats",
                    "description": "Returns today's sales, revenue, low stock count, customer count, and solar file summary.",
                    "operationId": "getBusinessSummary",
                    "responses": {
                        "200": { "description": "Real-time business summary" }
                    }
                }
            },
            "/api/ai/products": {
                "get": {
                    "summary": "Search Products & Inventory Stock",
                    "description": "Check if items (CCTV, Solar Panels, Inverters, Laptops, Printers) are in stock, pricing, and warranty.",
                    "operationId": "searchProducts",
                    "parameters": [
                        { "name": "q", "in": "query", "schema": { "type": "string" }, "description": "Search product name, brand, or model" },
                        { "name": "category", "in": "query", "schema": { "type": "string" }, "description": "Filter by category (e.g. CCTV, Solar, Laptop, Printer)" },
                        { "name": "low_stock", "in": "query", "schema": { "type": "boolean" }, "description": "Set true to show only low stock items" }
                    ],
                    "responses": {
                        "200": { "description": "List of matching products" }
                    }
                }
            },
            "/api/ai/customers": {
                "get": {
                    "summary": "Customer Ledger & Outstanding Balance",
                    "description": "Find customer contact info and current outstanding balance due.",
                    "operationId": "searchCustomers",
                    "parameters": [
                        { "name": "q", "in": "query", "schema": { "type": "string" }, "description": "Search customer name, mobile number, or address" }
                    ],
                    "responses": {
                        "200": { "description": "List of matching customers with balance" }
                    }
                }
            },
            "/api/ai/solar": {
                "get": {
                    "summary": "Solar Project Pipeline & File Status",
                    "description": "Track 10-step solar file progress (docs, portal, bank, installation, final bill, DCR, DISCOM, subsidy).",
                    "operationId": "getSolarProjects",
                    "parameters": [
                        { "name": "q", "in": "query", "schema": { "type": "string" }, "description": "Customer name, phone, or project ID (e.g. SOL-00001)" },
                        { "name": "stage", "in": "query", "schema": { "type": "string" }, "description": "Filter by stage key (create_customer, collect_docs, pm_suryaghar, finance_online, bank_submission, installation, final_bill, dcr_certificate, discom_submission, track_subsidy)" }
                    ],
                    "responses": {
                        "200": { "description": "List of solar project files" }
                    }
                }
            },
            "/api/ai/sales": {
                "get": {
                    "summary": "Sales & Invoices History",
                    "description": "Get recent sales invoices, today's sales list, payment mode, and total amounts.",
                    "operationId": "getSalesInvoices",
                    "parameters": [
                        { "name": "date", "in": "query", "schema": { "type": "string" }, "description": "Invoice date YYYY-MM-DD (defaults to today)" },
                        { "name": "customer_name", "in": "query", "schema": { "type": "string" }, "description": "Filter by customer name" }
                    ],
                    "responses": {
                        "200": { "description": "List of sales invoices" }
                    }
                }
            }
        }
    }
    return jsonify(spec)


# =====================================================================
# 2. AI ASSISTANT QUERY ENDPOINTS
# =====================================================================

# Business Overview Summary
@ai_bp.route("/api/ai/summary", methods=["GET"])
@require_ai_api_key
def ai_summary():
    try:
        today_str = datetime.now().strftime("%Y-%m-%d")
        month_str = datetime.now().strftime("%Y-%m-") + "%"

        # Today's Sales
        g.cursor.execute(
            """SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total, COALESCE(SUM(paid_amount), 0) as paid
               FROM sales_invoices
               WHERE invoice_date = %s AND (document_type != 'Quotation' OR document_type IS NULL)""",
            (today_str,)
        )
        today_sales = g.cursor.fetchone() or {"count": 0, "total": 0, "paid": 0}

        # Monthly Sales
        g.cursor.execute(
            """SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total
               FROM sales_invoices
               WHERE invoice_date LIKE %s AND (document_type != 'Quotation' OR document_type IS NULL)""",
            (month_str,)
        )
        month_sales = g.cursor.fetchone() or {"count": 0, "total": 0}

        # Low Stock Count
        g.cursor.execute(
            "SELECT COUNT(*) as count FROM products WHERE status = 'Active' AND stock <= 5 AND item_type != 'Service'"
        )
        low_stock = g.cursor.fetchone() or {"count": 0}

        # Total Active Customers & Total Balance Due
        g.cursor.execute(
            "SELECT COUNT(*) as count, COALESCE(SUM(balance), 0) as total_due FROM customers WHERE status = 'Active'"
        )
        cust_stats = g.cursor.fetchone() or {"count": 0, "total_due": 0}

        # Solar Projects Breakdown
        g.cursor.execute(
            "SELECT current_stage, COUNT(*) as count FROM solar_projects GROUP BY current_stage"
        )
        solar_stages = {row["current_stage"]: row["count"] for row in g.cursor.fetchall()}
        total_solar = sum(solar_stages.values())

        return jsonify({
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "business_name": "CRD Global Solutions",
            "today_stats": {
                "date": today_str,
                "invoices_count": int(today_sales["count"]),
                "sales_amount": float(today_sales["total"]),
                "amount_collected": float(today_sales["paid"])
            },
            "monthly_stats": {
                "invoices_count": int(month_sales["count"]),
                "sales_amount": float(month_sales["total"])
            },
            "inventory": {
                "low_stock_items_count": int(low_stock["count"])
            },
            "customers": {
                "total_active_customers": int(cust_stats["count"]),
                "total_outstanding_due": float(cust_stats["total_due"])
            },
            "solar_pipeline": {
                "total_projects": total_solar,
                "stage_breakdown": solar_stages
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# Products & Inventory Stock Search
@ai_bp.route("/api/ai/products", methods=["GET"])
@require_ai_api_key
def ai_products():
    try:
        q = (request.args.get("q") or request.args.get("query") or "").strip()
        cat = (request.args.get("category") or "").strip()
        low_stock = request.args.get("low_stock", "").lower() in ("true", "1", "yes")

        sql = "SELECT id, product_name, category, brand, model_no, sale_price, stock, unit, status FROM products WHERE status = 'Active'"
        params = []

        if q:
            sql += " AND (product_name LIKE %s OR brand LIKE %s OR model_no LIKE %s OR barcode LIKE %s)"
            like_val = f"%{q}%"
            params.extend([like_val, like_val, like_val, like_val])

        if cat:
            sql += " AND category LIKE %s"
            params.append(f"%{cat}%")

        if low_stock:
            sql += " AND stock <= 5"

        sql += " ORDER BY stock ASC, id DESC LIMIT 50"

        g.cursor.execute(sql, tuple(params))
        rows = g.cursor.fetchall()

        results = []
        for r in rows:
            results.append({
                "id": r["id"],
                "name": r["product_name"],
                "category": r.get("category") or "General",
                "brand": r.get("brand") or "",
                "model_no": r.get("model_no") or "",
                "price": float(r["sale_price"]) if r.get("sale_price") is not None else 0.0,
                "stock_quantity": float(r["stock"]) if r.get("stock") is not None else 0.0,
                "unit": r.get("unit") or "Pcs",
                "is_in_stock": float(r.get("stock") or 0) > 0
            })

        return jsonify({
            "success": True,
            "total_found": len(results),
            "products": results
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# Customers Search & Outstanding Balance
@ai_bp.route("/api/ai/customers", methods=["GET"])
@require_ai_api_key
def ai_customers():
    try:
        q = (request.args.get("q") or request.args.get("query") or request.args.get("phone") or request.args.get("name") or "").strip()

        sql = "SELECT id, customer_name, mobile, email, address, balance, status FROM customers WHERE 1=1"
        params = []

        if q:
            sql += " AND (customer_name LIKE %s OR mobile LIKE %s OR address LIKE %s)"
            like_val = f"%{q}%"
            params.extend([like_val, like_val, like_val])

        sql += " ORDER BY balance DESC, id DESC LIMIT 30"

        g.cursor.execute(sql, tuple(params))
        rows = g.cursor.fetchall()

        results = []
        for r in rows:
            results.append({
                "id": r["id"],
                "name": r["customer_name"],
                "mobile": r.get("mobile") or "",
                "email": r.get("email") or "",
                "address": r.get("address") or "",
                "balance_due": float(r["balance"]) if r.get("balance") is not None else 0.0,
                "status": r.get("status") or "Active"
            })

        return jsonify({
            "success": True,
            "total_found": len(results),
            "customers": results
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# Solar Pipeline Status
@ai_bp.route("/api/ai/solar", methods=["GET"])
@require_ai_api_key
def ai_solar():
    try:
        q = (request.args.get("q") or request.args.get("query") or "").strip()
        stage = (request.args.get("stage") or "").strip()

        sql = "SELECT * FROM solar_projects WHERE 1=1"
        params = []

        if q:
            sql += " AND (customer_name LIKE %s OR phone LIKE %s OR project_code LIKE %s OR consumer_number LIKE %s)"
            like_val = f"%{q}%"
            params.extend([like_val, like_val, like_val, like_val])

        if stage:
            sql += " AND current_stage = %s"
            params.append(stage)

        sql += " ORDER BY id DESC LIMIT 30"

        g.cursor.execute(sql, tuple(params))
        rows = g.cursor.fetchall()

        stage_titles = {
            "create_customer": "1. ग्राहक विवरण (Create Customer)",
            "collect_docs": "2. दस्तावेज़ संग्रह (Collect Documents)",
            "pm_suryaghar": "3. PM सूर्यघर ऑनलाइन (Online Portal)",
            "finance_online": "4. ऑनलाइन फाइनेंस (Finance Online)",
            "bank_submission": "5. बैंक डॉक जमा (Submit Docs to Bank)",
            "installation": "6. प्लांट इंस्टॉलेशन (Installation Project)",
            "final_bill": "7. फ़ाइनल बिल जनरेट (Generate Final Bill)",
            "dcr_certificate": "8. DCR सर्टिफिकेट (Generate DCR Certificate)",
            "discom_submission": "9. डिस्कॉम में जमा (Submit Document to DISCOM)",
            "track_subsidy": "10. सब्सिडी ट्रैकिंग (Track Subsidy)"
        }

        results = []
        for r in rows:
            st = r.get("current_stage") or "create_customer"
            results.append({
                "id": r["id"],
                "project_code": r.get("project_code") or f"SOL-{r['id']}",
                "customer_name": r.get("customer_name") or "",
                "phone": r.get("phone") or "",
                "address": r.get("address") or "",
                "capacity_kw": float(r["system_capacity_kw"]) if r.get("system_capacity_kw") is not None else 0.0,
                "current_stage_key": st,
                "current_stage_name": stage_titles.get(st, st),
                "deal_amount": float(r["deal_amount"]) if r.get("deal_amount") is not None else 0.0,
                "advance_amount": float(r["advance_amount"]) if r.get("advance_amount") is not None else 0.0,
                "consumer_number": r.get("consumer_number") or "",
                "net_meter_status": r.get("net_meter_status") or "pending",
                "subsidy_status": r.get("subsidy_status") or "pending",
                "subsidy_amount": float(r["subsidy_amount"]) if r.get("subsidy_amount") is not None else 0.0
            })

        return jsonify({
            "success": True,
            "total_found": len(results),
            "solar_projects": results
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# Sales Invoices
@ai_bp.route("/api/ai/sales", methods=["GET"])
@require_ai_api_key
def ai_sales():
    try:
        dt = (request.args.get("date") or datetime.now().strftime("%Y-%m-%d")).strip()
        cust = (request.args.get("customer_name") or "").strip()

        sql = """SELECT id, invoice_number, invoice_date, customer_name, customer_mobile,
                        grand_total, paid_amount, balance_amount, payment_mode, payment_status
                 FROM sales_invoices
                 WHERE (document_type != 'Quotation' OR document_type IS NULL)"""
        params = []

        if dt:
            sql += " AND invoice_date = %s"
            params.append(dt)

        if cust:
            sql += " AND customer_name LIKE %s"
            params.append(f"%{cust}%")

        sql += " ORDER BY id DESC LIMIT 50"

        g.cursor.execute(sql, tuple(params))
        rows = g.cursor.fetchall()

        results = []
        for r in rows:
            results.append({
                "invoice_number": r["invoice_number"],
                "date": str(r["invoice_date"]),
                "customer_name": r.get("customer_name") or "",
                "mobile": r.get("customer_mobile") or "",
                "total_amount": float(r["grand_total"]) if r.get("grand_total") is not None else 0.0,
                "paid_amount": float(r["paid_amount"]) if r.get("paid_amount") is not None else 0.0,
                "balance_due": float(r["balance_amount"]) if r.get("balance_amount") is not None else 0.0,
                "payment_mode": r.get("payment_mode") or "Cash",
                "payment_status": r.get("payment_status") or "Paid"
            })

        return jsonify({
            "success": True,
            "date": dt,
            "total_invoices": len(results),
            "sales": results
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# =====================================================================
# 3. ADMIN API KEY MANAGEMENT (GUI IN SETTINGS)
# =====================================================================

# List all keys
@ai_bp.route("/api/admin/api-keys", methods=["GET"])
def list_api_keys():
    try:
        g.cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(120) NOT NULL,
                api_key_hash VARCHAR(255) NOT NULL UNIQUE,
                api_key_prefix VARCHAR(40) NOT NULL,
                raw_key_display VARCHAR(120) NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                last_used_at TIMESTAMP NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_api_key_hash(api_key_hash)
            )
        """)
        g.db.commit()
    except Exception as e:
        print("Schema verify error:", e)

    try:
        g.cursor.execute("SELECT id, key_name, api_key_prefix, raw_key_display, is_active, last_used_at, created_at FROM api_keys ORDER BY id DESC")
        rows = g.cursor.fetchall() or []
        for r in rows:
            if r.get("last_used_at"):
                r["last_used_at"] = r["last_used_at"].isoformat()
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
        return jsonify(
            success=True,
            keys=rows,
            api_keys=rows,
            data=rows
        )
    except Exception as e:
        return jsonify(success=False, message=str(e), keys=[], api_keys=[]), 500

# Create new API key
@ai_bp.route("/api/admin/api-keys", methods=["POST"])
def create_api_key():
    try:
        g.cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(120) NOT NULL,
                api_key_hash VARCHAR(255) NOT NULL UNIQUE,
                api_key_prefix VARCHAR(40) NOT NULL,
                raw_key_display VARCHAR(120) NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                last_used_at TIMESTAMP NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_api_key_hash(api_key_hash)
            )
        """)
        g.db.commit()
    except Exception as e:
        print("Schema verify error:", e)

    data = request.get_json(silent=True) or {}
    name = (data.get("key_name") or data.get("name") or "AI Assistant Integration").strip()

    # Generate a cryptographically secure random key
    # Format: crd_ai_live_ + 32 hex chars
    raw_key = f"crd_ai_live_{secrets.token_hex(16)}"
    k_hash = hash_key(raw_key)
    prefix = raw_key[:18]

    try:
        g.cursor.execute(
            """INSERT INTO api_keys (key_name, api_key_hash, api_key_prefix, raw_key_display, created_by)
               VALUES (%s, %s, %s, %s, %s)""",
            (name, k_hash, prefix, prefix, getattr(g, "user_id", None))
        )
        g.db.commit()
        key_id = g.cursor.lastrowid

        return jsonify({
            "success": True,
            "message": "AI API Key सफलतापूर्वक जनरेट हो गई। कृपया इसे कॉपी करके सुरक्षित रख लें, यह दोबारा नहीं दिखेगी।",
            "api_key": raw_key,
            "raw_key": raw_key,
            "key": raw_key,
            "key_info": {
                "id": key_id,
                "name": name,
                "key_name": name,
                "prefix": prefix,
                "created_at": datetime.now().isoformat()
            }
        }), 201
    except Exception as e:
        try: g.db.rollback()
        except Exception: pass
        return jsonify(success=False, message=str(e)), 500

# Toggle active status
@ai_bp.route("/api/admin/api-keys/<int:key_id>/toggle", methods=["POST"])
def toggle_api_key(key_id):
    try:
        g.cursor.execute("SELECT id, is_active FROM api_keys WHERE id = %s LIMIT 1", (key_id,))
        row = g.cursor.fetchone()
        if not row:
            return jsonify(success=False, message="API Key नहीं मिली।"), 404

        new_status = 0 if row["is_active"] else 1
        g.cursor.execute("UPDATE api_keys SET is_active = %s WHERE id = %s", (new_status, key_id))
        g.db.commit()
        return jsonify(success=True, is_active=new_status, message="Status updated successfully.")
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

# Delete / Revoke key
@ai_bp.route("/api/admin/api-keys/<int:key_id>", methods=["DELETE"])
def delete_api_key(key_id):
    try:
        g.cursor.execute("DELETE FROM api_keys WHERE id = %s", (key_id,))
        g.db.commit()
        return jsonify(success=True, message="API Key सफलतापूर्वक हटा दी गई।")
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500
