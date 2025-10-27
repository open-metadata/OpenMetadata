# 📋 Where to Find ThirdEye Service Logs

## 🎯 **Quick Answer:**

**Your logs appear in the TERMINAL where you started the ThirdEye service!**

Look for the terminal window where you ran:
```bash
python -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload
```

---

## 📊 **What You'll See in the Logs:**

### **1. Startup Logs:**
```
INFO:     Uvicorn running on http://0.0.0.0:8587 (Press CTRL+C to quit)
INFO:     Started reloader process [13676] using WatchFiles
INFO:     Started server process [27572]
INFO:     Waiting for application startup.
2025-10-27 10:19:30 | INFO     | thirdeye.app:lifespan:39 - Starting thirdeye-py-service in development mode
2025-10-27 10:19:30 | INFO     | thirdeye.app:lifespan:40 - Log level: INFO
2025-10-27 10:19:30 | INFO     | thirdeye.db:init_db:28 - Initializing database connections...
2025-10-27 10:19:30 | INFO     | thirdeye.db:init_db:31 - Connecting to OpenMetadata DB: localhost:3307/openmetadata_db
2025-10-27 10:19:30 | INFO     | thirdeye.db:init_db:48 - Connecting to ThirdEye DB: localhost:3307/openmetadata_db (schema: thirdeye)
2025-10-27 10:19:30 | INFO     | thirdeye.db:init_db:64 - Database connections initialized successfully
2025-10-27 10:19:30 | INFO     | thirdeye.app:lifespan:47 - ThirdEye service startup complete
INFO:     Application startup complete.
```

### **2. HTTP Request Logs:**
```
INFO:     127.0.0.1:46369 - "GET /api/v1/thirdeye/health HTTP/1.1" 200 OK
INFO:     127.0.0.1:46370 - "GET /api/v1/thirdeye/dashboard/data HTTP/1.1" 200 OK
INFO:     127.0.0.1:46371 - "GET /api/v1/thirdeye/action-items HTTP/1.1" 200 OK
```

### **3. SQL Query Logs (NOW ENABLED!):**

With `echo=True` set, you'll see:

```sql
INFO:  BEGIN (implicit)
INFO:  SELECT 
    health_score,
    health_status,
    utilization_rate,
    storage_efficiency,
    access_freshness,
    breakdown_storage,
    breakdown_compute,
    breakdown_query,
    breakdown_others,
    total_tables,
    active_tables,
    inactive_tables,
    total_storage_tb,
    waste_storage_tb,
    waste_percentage,
    total_monthly_cost_usd,
    monthly_savings_opportunity_usd,
    annual_savings_opportunity_usd,
    zombie_tables,
    zombie_percentage,
    stale_tables,
    stale_percentage,
    calculated_at
FROM thirdeye.v_datalake_health_metrics
LIMIT %(param_1)s
INFO:  [generated in 0.00231s] {'param_1': 1}
INFO:  ROLLBACK
```

### **4. Application Logs:**
```
2025-10-27 14:05:53 | INFO     | thirdeye.services.zi_score:calculate:47 - Calculating ZI Score from health metrics view
2025-10-27 14:05:53 | WARNING  | thirdeye.services.zi_score:calculate:53 - No health metrics available, returning fallback values
2025-10-27 14:05:53 | ERROR    | thirdeye.routers.action_items:get_action_items:69 - Error executing query for safe_to_purge
```

### **5. Error Logs:**
```
2025-10-27 14:01:33 | ERROR    | thirdeye.routers.action_items:get_action_items:69 - Error executing query for automated_queries: (pymysql.err.OperationalError) (1045, "Access denied for user 'root'@'172.16.240.1' (using password: YES)")
```

---

## 🔍 **How to Find Your Terminal:**

### **If you can't find the terminal:**

1. **Look for a terminal with this header:**
   ```
   shash@LAPTOP-CJQ3FBU6 MINGW64 ~/Documents/GitHub/OpenMetadata (feat/thirdeye-py-graphql)
   ```

2. **Look for recent output containing:**
   - `INFO:     Uvicorn running on http://0.0.0.0:8587`
   - `thirdeye-py-service`
   - SQL queries (if any requests were made)

3. **Check all open terminal windows** - one should have the service running

---

## 🛠️ **If You Lost the Terminal:**

### **Option A: Check Process and Restart**

```bash
# See what Python processes are running
tasklist | grep python

# Kill them
taskkill //F //IM python.exe

# Restart with visible logs
cd thirdeye-py-service
export PYTHONPATH=src
python -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload
```

### **Option B: Start Fresh with Log File**

```bash
cd thirdeye-py-service
export PYTHONPATH=src

# Start and save logs to file
python -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload 2>&1 | tee thirdeye-live.log
```

**This will:**
- Display logs in terminal
- Save to `thirdeye-live.log` file

**Then you can:**
```bash
# View in real-time
tail -f thirdeye-live.log

# Search logs
grep ERROR thirdeye-live.log
grep SQL thirdeye-live.log
grep "SELECT" thirdeye-live.log
```

---

## 📊 **Trigger Logs to See SQL Queries:**

Make a request to see the SQL logs appear:

```bash
# Trigger dashboard data query
curl http://localhost:8587/api/v1/thirdeye/dashboard/data

# Trigger action items query
curl http://localhost:8587/api/v1/thirdeye/action-items

# Trigger insights query
curl "http://localhost:8587/api/v1/thirdeye/insights/report?report_type=storage&limit=5&offset=0"
```

**Watch your ThirdEye terminal** - you'll see SQL queries execute in real-time!

---

## 🎯 **Log Levels:**

Current log level is `INFO`. You'll see:
- ✅ INFO messages (regular operations)
- ✅ WARNING messages (non-critical issues)
- ✅ ERROR messages (problems)
- ✅ SUCCESS messages (completed operations)
- ✅ SQL queries (with echo=True)

---

## 💡 **Pro Tip:**

**Keep the ThirdEye terminal visible while testing!**

Split your screen:
- Left: ThirdEye terminal (shows logs + SQL queries)
- Right: Browser with dashboard
- Bottom: Terminal for cURL tests

This way you can see logs in real-time as you use the dashboard!

---

## 📝 **Summary:**

**Logs Location:** Terminal where you ran `python -m uvicorn ...`

**SQL Queries:** ✅ Now enabled with `echo=True`

**To See Logs:** Make API requests and watch the terminal

**To Save Logs:** Use `2>&1 | tee logfile.log`

---

**Your ThirdEye terminal is showing all the logs - just look for the terminal with "Uvicorn running on http://0.0.0.0:8587"** 📊
