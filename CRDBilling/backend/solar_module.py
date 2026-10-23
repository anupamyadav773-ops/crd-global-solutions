import json
from flask import Blueprint, request, jsonify, g
solar_bp = Blueprint("solar", __name__)

def ensure_solar_projects_schema(get_db_connection):
    db=cur=None
    try:
        db=get_db_connection(); cur=db.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS solar_projects (id INT AUTO_INCREMENT PRIMARY KEY, project_code VARCHAR(40) NULL UNIQUE, customer_name VARCHAR(180) NOT NULL, phone VARCHAR(40), address TEXT, system_capacity_kw DECIMAL(8,2), payment_type VARCHAR(20) NOT NULL DEFAULT 'direct', finance_provider VARCHAR(180), finance_status VARCHAR(40) NOT NULL DEFAULT 'not_applicable', checklist_json LONGTEXT, installation_status VARCHAR(40) NOT NULL DEFAULT 'pending', installation_date DATE, discom_status VARCHAR(40) NOT NULL DEFAULT 'pending', discom_submission_date DATE, discom_reference VARCHAR(180), net_meter_status VARCHAR(40) NOT NULL DEFAULT 'pending', net_meter_date DATE, subsidy_status VARCHAR(40) NOT NULL DEFAULT 'pending', subsidy_applied_date DATE, subsidy_received_date DATE, subsidy_amount DECIMAL(12,2), notes TEXT, created_by INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_solar_customer(customer_name))"""); db.commit()
    except Exception as e: print('Solar schema error:',e)
    finally:
        if cur:
            try: cur.close()
            except Exception: pass
        if db:
            try:
                if db.is_connected(): db.close()
            except Exception: pass

def clean_date(v): return str(v or '').strip()[:10] or None
def payload(r):
    if not r: return None
    d=dict(r); raw=d.pop('checklist_json',None)
    try: d['checklist']=json.loads(raw) if raw else {}
    except Exception: d['checklist']={}
    for k in ('installation_date','discom_submission_date','net_meter_date','subsidy_applied_date','subsidy_received_date','created_at','updated_at'):
        if d.get(k) is not None: d[k]=d[k].isoformat() if hasattr(d[k],'isoformat') else str(d[k])
    for k in ('system_capacity_kw','subsidy_amount'):
        if d.get(k) is not None: d[k]=float(d[k])
    return d

@solar_bp.route('/solar-projects',methods=['GET','POST','OPTIONS'])
def projects():
    if request.method=='OPTIONS': return '',200
    if request.method=='GET':
        try: g.cursor.execute('SELECT * FROM solar_projects ORDER BY updated_at DESC,id DESC'); return jsonify(success=True,projects=[payload(r) for r in g.cursor.fetchall()])
        except Exception as e: print('Solar list error:',e); return jsonify(success=False,message='Solar projects load nahi ho paye.'),500
    d=request.get_json(silent=True) or {}; name=str(d.get('customer_name') or '').strip(); payment=str(d.get('payment_type') or 'direct').lower()
    if not name: return jsonify(success=False,message='Customer name required hai.'),400
    if payment not in ('direct','finance'): return jsonify(success=False,message='Payment type invalid hai.'),400
    fields=['customer_name','phone','address','system_capacity_kw','payment_type','finance_provider','finance_status','checklist_json','installation_status','installation_date','discom_status','discom_submission_date','discom_reference','net_meter_status','net_meter_date','subsidy_status','subsidy_applied_date','subsidy_received_date','subsidy_amount','notes','created_by']
    vals=[name,d.get('phone') or None,d.get('address') or None,d.get('system_capacity_kw') or None,payment,(d.get('finance_provider') or None) if payment=='finance' else None,(d.get('finance_status') or 'pending') if payment=='finance' else 'not_applicable',json.dumps(d.get('checklist') or {},ensure_ascii=False),d.get('installation_status') or 'pending',clean_date(d.get('installation_date')),d.get('discom_status') or 'pending',clean_date(d.get('discom_submission_date')),d.get('discom_reference') or None,d.get('net_meter_status') or 'pending',clean_date(d.get('net_meter_date')),d.get('subsidy_status') or 'pending',clean_date(d.get('subsidy_applied_date')),clean_date(d.get('subsidy_received_date')),d.get('subsidy_amount') or None,d.get('notes') or None,getattr(g,'user_id',None)]
    try:
        g.cursor.execute('INSERT INTO solar_projects ('+','.join(fields)+') VALUES ('+','.join(['%s']*len(fields))+')',tuple(vals)); pid=g.cursor.lastrowid; g.cursor.execute('UPDATE solar_projects SET project_code=%s WHERE id=%s',('SOL-'+str(pid).zfill(5),pid)); g.db.commit(); g.cursor.execute('SELECT * FROM solar_projects WHERE id=%s',(pid,)); return jsonify(success=True,project=payload(g.cursor.fetchone())),201
    except Exception as e:
        try:g.db.rollback()
        except Exception:pass
        print('Solar create error:',e); return jsonify(success=False,message='Solar project save nahi ho paya.'),500

@solar_bp.route('/solar-projects/<int:pid>',methods=['GET','PUT','DELETE','OPTIONS'])
def project(pid):
    if request.method=='OPTIONS': return '',200
    g.cursor.execute('SELECT * FROM solar_projects WHERE id=%s',(pid,)); row=g.cursor.fetchone()
    if not row:return jsonify(success=False,message='Solar project nahi mila.'),404
    if request.method=='GET':return jsonify(success=True,project=payload(row))
    if request.method=='DELETE':
        if str(getattr(g,'current_user',{}).get('role','')).lower()!='admin':return jsonify(success=False,message='Delete ke liye Admin permission chahiye.'),403
        g.cursor.execute('DELETE FROM solar_projects WHERE id=%s',(pid,));g.db.commit();return jsonify(success=True)
    d=payload(row); d.update(request.get_json(silent=True) or {}); name=str(d.get('customer_name') or '').strip(); payment=str(d.get('payment_type') or 'direct').lower()
    if not name:return jsonify(success=False,message='Customer name required hai.'),400
    if payment not in ('direct','finance'):return jsonify(success=False,message='Payment type invalid hai.'),400
    vals=[name,d.get('phone') or None,d.get('address') or None,d.get('system_capacity_kw') or None,payment,(d.get('finance_provider') or None) if payment=='finance' else None,(d.get('finance_status') or 'pending') if payment=='finance' else 'not_applicable',json.dumps(d.get('checklist') or {},ensure_ascii=False),d.get('installation_status') or 'pending',clean_date(d.get('installation_date')),d.get('discom_status') or 'pending',clean_date(d.get('discom_submission_date')),d.get('discom_reference') or None,d.get('net_meter_status') or 'pending',clean_date(d.get('net_meter_date')),d.get('subsidy_status') or 'pending',clean_date(d.get('subsidy_applied_date')),clean_date(d.get('subsidy_received_date')),d.get('subsidy_amount') or None,d.get('notes') or None,pid]
    try:
        cols='customer_name=%s,phone=%s,address=%s,system_capacity_kw=%s,payment_type=%s,finance_provider=%s,finance_status=%s,checklist_json=%s,installation_status=%s,installation_date=%s,discom_status=%s,discom_submission_date=%s,discom_reference=%s,net_meter_status=%s,net_meter_date=%s,subsidy_status=%s,subsidy_applied_date=%s,subsidy_received_date=%s,subsidy_amount=%s,notes=%s'
        g.cursor.execute('UPDATE solar_projects SET '+cols+' WHERE id=%s',tuple(vals));g.db.commit();g.cursor.execute('SELECT * FROM solar_projects WHERE id=%s',(pid,));return jsonify(success=True,project=payload(g.cursor.fetchone()))
    except Exception as e:
        try:g.db.rollback()
        except Exception:pass
        print('Solar update error:',e);return jsonify(success=False,message='Solar project update nahi ho paya.'),500

@solar_bp.route('/solar-dashboard',methods=['GET'])
def solar_dashboard():
    try:
        g.cursor.execute('SELECT * FROM solar_projects'); ps=[payload(r) for r in g.cursor.fetchall()]
        stats={'total':len(ps),'checklist_pending':sum(1 for p in ps if not p.get('checklist') or any(v not in (True,'done','received','complete') for v in p['checklist'].values())),'finance_pending':sum(1 for p in ps if p['payment_type']=='finance' and p['finance_status'] not in ('approved','disbursed','complete')),'installation_pending':sum(1 for p in ps if p['installation_status']!='completed'),'discom_pending':sum(1 for p in ps if p['installation_status']=='completed' and p['discom_status']!='submitted'),'net_meter_pending':sum(1 for p in ps if p['discom_status']=='submitted' and p['net_meter_status']!='installed'),'subsidy_pending':sum(1 for p in ps if p['net_meter_status']=='installed' and p['subsidy_status']!='received'),'subsidy_received':sum(1 for p in ps if p['subsidy_status']=='received')}
        return jsonify(success=True,stats=stats)
    except Exception as e:print('Solar dashboard error:',e);return jsonify(success=False,message='Dashboard load nahi hua.'),500
