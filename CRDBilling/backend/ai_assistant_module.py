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
            },
            "/api/ai/financial": {
                "get": {
                    "summary": "Financial Overview, Profit/Loss & Cash Flow",
                    "description": "Fetch complete business financial metrics: daily/monthly sales revenue, purchases, operating expenses, estimated net profit/loss, customer receivables (dues), vendor payables, and payment method collections.",
                    "operationId": "getFinancialData",
                    "responses": {
                        "200": { "description": "Real-time financial and profit & loss report" }
                    }
                }
            },
            "/api/ai/inventory": {
                "get": {
                    "summary": "Inventory Stock Valuation & Items",
                    "description": "Fetch real-time inventory statistics, total stock units, asset valuation in INR, low-stock warnings, out-of-stock items, and search products.",
                    "operationId": "getInventoryData",
                    "parameters": [
                        { "name": "q", "in": "query", "schema": { "type": "string" }, "description": "Search product name, brand, model, or barcode" },
                        { "name": "category", "in": "query", "schema": { "type": "string" }, "description": "Filter by category" },
                        { "name": "status", "in": "query", "schema": { "type": "string" }, "description": "Filter status: low_stock, out_of_stock, in_stock" }
                    ],
                    "responses": {
                        "200": { "description": "Real-time inventory valuation and stock levels" }
                    }
                }
            },
            "/api/ai/portal": {
                "get": {
                    "summary": "PM Surya Ghar & Service Portal Data",
                    "description": "Fetch PM Surya Ghar national portal applications, consumer numbers, bank loan/finance status, net-metering DISCOM status, subsidy tracking, and field service complaints.",
                    "operationId": "getPortalData",
                    "parameters": [
                        { "name": "q", "in": "query", "schema": { "type": "string" }, "description": "Search customer name, mobile, portal application number, consumer number" },
                        { "name": "stage", "in": "query", "schema": { "type": "string" }, "description": "Filter by solar stage key" }
                    ],
                    "responses": {
                        "200": { "description": "Solar and Service Portal pipeline status" }
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


# Products & Inventory Stock Search (handles /api/ai/products, /api/ai/inventory, /api/ai/stock)
@ai_bp.route("/api/ai/products", methods=["GET"])
@ai_bp.route("/api/ai/inventory", methods=["GET"])
@ai_bp.route("/api/ai/stock", methods=["GET"])
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

        # High-level inventory valuation & stats
        g.cursor.execute(
            """SELECT
                COUNT(*) AS total_skus,
                COALESCE(SUM(stock), 0) AS total_units,
                COALESCE(SUM(stock * purchase_price), 0) AS total_stock_valuation,
                COALESCE(SUM(CASE WHEN stock <= min_stock AND stock > 0 THEN 1 ELSE 0 END), 0) AS low_stock_count,
                COALESCE(SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_count
               FROM products
               WHERE status = 'Active' AND item_type != 'Service'"""
        )
        inv_stats = g.cursor.fetchone() or {}

        return jsonify({
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "inventory_summary": {
                "total_skus": int(inv_stats.get("total_skus") or 0),
                "total_stock_units": float(inv_stats.get("total_units") or 0),
                "total_inventory_valuation_inr": float(inv_stats.get("total_stock_valuation") or 0),
                "low_stock_items_count": int(inv_stats.get("low_stock_count") or 0),
                "out_of_stock_items_count": int(inv_stats.get("out_of_stock_count") or 0)
            },
            "total_found": len(results),
            "inventory": results,
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
# FINANCIAL & PROFIT/LOSS ENDPOINT
# =====================================================================
@ai_bp.route("/api/ai/financial", methods=["GET"])
@ai_bp.route("/api/ai/finance", methods=["GET"])
@ai_bp.route("/api/ai/financials", methods=["GET"])
@require_ai_api_key
def ai_financial():
    try:
        today_str = datetime.now().strftime("%Y-%m-%d")
        month_prefix = datetime.now().strftime("%Y-%m-") + "%"

        # 1. Sales Revenue (Today, Month, All Time)
        g.cursor.execute(
            """SELECT
                COALESCE(SUM(CASE WHEN invoice_date = %s THEN grand_total ELSE 0 END), 0) AS today_sales,
                COALESCE(SUM(CASE WHEN invoice_date = %s THEN paid_amount ELSE 0 END), 0) AS today_collected,
                COALESCE(SUM(CASE WHEN invoice_date LIKE %s THEN grand_total ELSE 0 END), 0) AS month_sales,
                COALESCE(SUM(CASE WHEN invoice_date LIKE %s THEN paid_amount ELSE 0 END), 0) AS month_collected,
                COALESCE(SUM(grand_total), 0) AS total_sales,
                COALESCE(SUM(paid_amount), 0) AS total_collected
               FROM sales_invoices
               WHERE (document_type != 'Quotation' OR document_type IS NULL)""",
            (today_str, today_str, month_prefix, month_prefix)
        )
        sales_row = g.cursor.fetchone() or {}

        # 2. Purchases (Today, Month, All Time)
        g.cursor.execute(
            """SELECT
                COALESCE(SUM(CASE WHEN purchase_date = %s THEN grand_total ELSE 0 END), 0) AS today_purchases,
                COALESCE(SUM(CASE WHEN purchase_date LIKE %s THEN grand_total ELSE 0 END), 0) AS month_purchases,
                COALESCE(SUM(grand_total), 0) AS total_purchases
               FROM purchases""",
            (today_str, month_prefix)
        )
        purch_row = g.cursor.fetchone() or {}

        # 3. Expenses (Today, Month, All Time)
        g.cursor.execute(
            """SELECT
                COALESCE(SUM(CASE WHEN expense_date = %s THEN amount ELSE 0 END), 0) AS today_expenses,
                COALESCE(SUM(CASE WHEN expense_date LIKE %s THEN amount ELSE 0 END), 0) AS month_expenses,
                COALESCE(SUM(amount), 0) AS total_expenses
               FROM expenses""",
            (today_str, month_prefix)
        )
        exp_row = g.cursor.fetchone() or {}

        # 4. Receivables (Customer Outstanding Balance)
        g.cursor.execute(
            """SELECT COALESCE(SUM(balance), 0) AS total_receivables, COUNT(*) as customers_with_due
               FROM customers WHERE balance > 0 AND status = 'Active'"""
        )
        rec_row = g.cursor.fetchone() or {}

        # 5. Payables (Supplier dues if suppliers table exists)
        supplier_payables = 0.0
        try:
            g.cursor.execute("""SELECT COALESCE(SUM(balance), 0) AS total_payables FROM suppliers WHERE status = 'Active'""")
            sup_row = g.cursor.fetchone()
            if sup_row:
                supplier_payables = float(sup_row.get("total_payables") or 0)
        except Exception:
            pass

        # 6. Payment Modes Distribution (This month)
        payment_modes = {}
        try:
            g.cursor.execute(
                """SELECT COALESCE(payment_method, 'Cash') AS mode, COALESCE(SUM(paid_amount), 0) AS total
                   FROM sales_invoices
                   WHERE invoice_date LIKE %s AND (document_type != 'Quotation' OR document_type IS NULL)
                   GROUP BY payment_method""",
                (month_prefix,)
            )
            for pm in (g.cursor.fetchall() or []):
                payment_modes[pm["mode"]] = float(pm["total"])
        except Exception:
            pass

        # 7. Net Profit estimation (Month Sales - (Month Purchases + Month Expenses))
        m_sales = float(sales_row.get("month_sales") or 0)
        m_purch = float(purch_row.get("month_purchases") or 0)
        m_exp = float(exp_row.get("month_expenses") or 0)
        est_net_profit = round(m_sales - (m_purch + m_exp), 2)

        # 8. Solar Deal & Financials
        solar_fin = {"total_deals_amount": 0.0, "total_advance_collected": 0.0, "pending_deal_amount": 0.0}
        try:
            g.cursor.execute(
                """SELECT
                    COALESCE(SUM(deal_amount), 0) AS total_deals,
                    COALESCE(SUM(advance_amount), 0) AS total_advance
                   FROM solar_projects"""
            )
            s_row = g.cursor.fetchone()
            if s_row:
                tot_deals = float(s_row.get("total_deals") or 0)
                tot_adv = float(s_row.get("total_advance") or 0)
                solar_fin = {
                    "total_deals_amount": tot_deals,
                    "total_advance_collected": tot_adv,
                    "pending_deal_amount": max(0.0, tot_deals - tot_adv)
                }
        except Exception:
            pass

        return jsonify({
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "business_name": "CRD Global Solutions",
            "today_financials": {
                "sales_revenue": float(sales_row.get("today_sales") or 0),
                "cash_collected": float(sales_row.get("today_collected") or 0),
                "purchases": float(purch_row.get("today_purchases") or 0),
                "expenses": float(exp_row.get("today_expenses") or 0),
                "today_net": round(float(sales_row.get("today_sales") or 0) - (float(purch_row.get("today_purchases") or 0) + float(exp_row.get("today_expenses") or 0)), 2)
            },
            "monthly_financials": {
                "month": datetime.now().strftime("%B %Y"),
                "sales_revenue": m_sales,
                "amount_collected": float(sales_row.get("month_collected") or 0),
                "purchases_cost": m_purch,
                "operational_expenses": m_exp,
                "estimated_net_profit": est_net_profit,
                "payment_modes_breakdown": payment_modes
            },
            "balance_sheet_summary": {
                "accounts_receivable_customer_dues": float(rec_row.get("total_receivables") or 0),
                "customers_owing_count": int(rec_row.get("customers_with_due") or 0),
                "accounts_payable_vendor_dues": supplier_payables
            },
            "solar_project_finances": solar_fin
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# =====================================================================
# PORTAL ENDPOINT (PM SURYA GHAR & SERVICE PORTAL DATA)
# =====================================================================
@ai_bp.route("/api/ai/portal", methods=["GET"])
@ai_bp.route("/api/ai/portal-data", methods=["GET"])
@ai_bp.route("/api/ai/solar-portal", methods=["GET"])
@require_ai_api_key
def ai_portal():
    try:
        q = (request.args.get("q") or request.args.get("query") or "").strip()
        stage_filter = (request.args.get("stage") or "").strip().lower()
        limit = min(int(request.args.get("limit") or 30), 100)

        stage_names = {
            "create_customer": "1. Customer Onboarding",
            "collect_docs": "2. Document Collection",
            "pm_suryaghar": "3. PM Surya Ghar Portal Application",
            "finance_online": "4. Finance Online (Loan)",
            "bank_submission": "5. Bank Document Submission",
            "installation": "6. Plant Installation",
            "final_bill": "7. Final Invoice Generation",
            "dcr_certificate": "8. DCR Certificate",
            "discom_submission": "9. DISCOM Net-Metering Submission",
            "track_subsidy": "10. Subsidy Disbursement Tracking"
        }

        # 1. Portal Pipeline Summary
        g.cursor.execute(
            """SELECT
                COUNT(*) AS total_files,
                COALESCE(SUM(CASE WHEN portal_app_number IS NOT NULL AND portal_app_number != '' THEN 1 ELSE 0 END), 0) AS online_portal_applied,
                COALESCE(SUM(CASE WHEN payment_type = 'finance' THEN 1 ELSE 0 END), 0) AS finance_loan_files,
                COALESCE(SUM(CASE WHEN current_stage = 'track_subsidy' THEN 1 ELSE 0 END), 0) AS subsidy_pending_files,
                COALESCE(SUM(deal_amount), 0) AS total_deal_value
               FROM solar_projects"""
        )
        p_stats = g.cursor.fetchone() or {}

        # 2. Stage Counts Breakdown
        g.cursor.execute("""SELECT current_stage, COUNT(*) as count FROM solar_projects GROUP BY current_stage""")
        stage_counts = {r["current_stage"]: int(r["count"]) for r in (g.cursor.fetchall() or [])}

        # 3. Technician Field Service Portal Summary
        tech_portal = {"active_complaints": 0, "in_progress_jobs": 0, "completed_today": 0}
        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            g.cursor.execute(
                """SELECT
                    COALESCE(SUM(CASE WHEN status NOT IN ('Completed', 'Delivered', 'Cancelled') THEN 1 ELSE 0 END), 0) AS active_complaints,
                    COALESCE(SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END), 0) AS in_progress,
                    COALESCE(SUM(CASE WHEN status IN ('Completed', 'Delivered') AND DATE(updated_at) = %s THEN 1 ELSE 0 END), 0) AS completed_today
                   FROM service_entries""",
                (today_str,)
            )
            t_row = g.cursor.fetchone()
            if t_row:
                tech_portal = {
                    "active_complaints": int(t_row.get("active_complaints") or 0),
                    "in_progress_jobs": int(t_row.get("in_progress") or 0),
                    "completed_today": int(t_row.get("completed_today") or 0)
                }
        except Exception:
            pass

        # 4. Filtered Projects List
        sql = """SELECT id, project_number, customer_name, customer_mobile, consumer_number,
                        portal_app_number, portal_date, system_capacity_kw, deal_amount, advance_amount,
                        payment_type, finance_provider, finance_status, bank_submission_date,
                        installation_status, final_bill_number, dcr_cert_status, discom_status,
                        subsidy_status, current_stage, updated_at
                 FROM solar_projects WHERE 1=1"""
        params = []

        if q:
            sql += """ AND (customer_name LIKE %s OR customer_mobile LIKE %s OR project_number LIKE %s OR portal_app_number LIKE %s OR consumer_number LIKE %s)"""
            like_val = f"%{q}%"
            params.extend([like_val, like_val, like_val, like_val, like_val])

        if stage_filter:
            sql += """ AND current_stage = %s"""
            params.append(stage_filter)

        sql += """ ORDER BY updated_at DESC LIMIT %s"""
        params.append(limit)

        g.cursor.execute(sql, tuple(params))
        proj_rows = g.cursor.fetchall() or []

        projects = []
        for pr in proj_rows:
            st_key = pr.get("current_stage")
            projects.append({
                "project_id": pr["id"],
                "project_number": pr.get("project_number"),
                "customer_name": pr.get("customer_name"),
                "mobile": pr.get("customer_mobile"),
                "consumer_number": pr.get("consumer_number"),
                "portal_app_number": pr.get("portal_app_number") or "Not Applied",
                "portal_date": str(pr["portal_date"]) if pr.get("portal_date") else None,
                "system_capacity_kw": float(pr.get("system_capacity_kw") or 0),
                "deal_amount": float(pr.get("deal_amount") or 0),
                "advance_collected": float(pr.get("advance_amount") or 0),
                "payment_type": pr.get("payment_type"),
                "finance_provider": pr.get("finance_provider"),
                "finance_status": pr.get("finance_status"),
                "current_stage_key": st_key,
                "current_stage_name": stage_names.get(st_key, st_key),
                "subsidy_status": pr.get("subsidy_status")
            })

        return jsonify({
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "solar_portal_summary": {
                "total_files": int(p_stats.get("total_files") or 0),
                "online_portal_applications": int(p_stats.get("online_portal_applied") or 0),
                "finance_loan_cases": int(p_stats.get("finance_loan_files") or 0),
                "subsidy_pipeline_cases": int(p_stats.get("subsidy_pending_files") or 0),
                "total_project_deal_value_inr": float(p_stats.get("total_deal_value") or 0),
                "stages_breakdown": stage_counts
            },
            "technician_portal_summary": tech_portal,
            "count": len(projects),
            "projects": projects
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
