# 🚀 ThirdEye - Complete Setup Guide

**For Dynamic Data with MySQL Integration**

---

## 📋 **Prerequisites**

- ✅ MySQL 8.0+ installed and running
- ✅ Python 3.11+ installed
- ✅ Node.js 18+ installed
- ✅ Git (for cloning and committing)

---

## 🗄️ **Step 1: Database Setup**

### **Option A: Use Existing OpenMetadata MySQL**

```bash
# Connect to your MySQL instance
mysql -u root -p

# Create thirdeye user (if not exists)
CREATE USER IF NOT EXISTS 'thirdeye'@'localhost' IDENTIFIED BY 'thirdeye123';

# Grant permissions on thirdeye schema
GRANT ALL PRIVILEGES ON thirdeye.* TO 'thirdeye'@'localhost';

# Grant SELECT on openmetadata_db schema (read-only)
GRANT SELECT ON openmetadata_db.* TO 'thirdeye'@'localhost';

FLUSH PRIVILEGES;
```

### **Option B: Create Standalone MySQL**

```bash
# Start MySQL with Docker
docker run -d \
  --name thirdeye-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=openmetadata_db \
  -e MYSQL_USER=thirdeye \
  -e MYSQL_PASSWORD=thirdeye123 \
  -p 3306:3306 \
  mysql:8.0

# Wait for MySQL to start
sleep 10
```

---

## 🐍 **Step 2: Start Python Backend**

### **2.1 Configure Environment:**

```bash
cd thirdeye-py-service

# Create .env file
cat > .env << 'EOF'
# Service Configuration
ENVIRONMENT=development
DEBUG=true
HOST=0.0.0.0
PORT=8586

# MySQL Configuration
OM_MYSQL_HOST=localhost
OM_MYSQL_PORT=3306
OM_MYSQL_DB=openmetadata_db
OM_MYSQL_USER_RO=root
OM_MYSQL_PW_RO=yourpassword

THIRDEYE_MYSQL_SCHEMA=thirdeye
THIRDEYE_MYSQL_USER=thirdeye
THIRDEYE_MYSQL_PW=thirdeye123

# JWT (disabled for development)
JWT_ENABLED=false

# Logging
LOG_LEVEL=INFO
EOF
```

### **2.2 Install Dependencies:**

```bash
# Install in development mode
pip install -e .

# Or install specific packages
pip install fastapi uvicorn sqlalchemy asyncmy loguru pydantic-settings
```

### **2.3 Start the Service:**

```bash
# Start with uvicorn
uvicorn thirdeye.app:app --host 0.0.0.0 --port 8586 --reload

# Service will:
# ✓ Create thirdeye schema automatically
# ✓ Run all migrations (001-006)
# ✓ Create tables and views
# ✓ Start serving on port 8586
```

### **2.4 Verify Backend:**

```bash
# Health check
curl http://localhost:8586/health

# Dashboard data (may be empty without data loaded)
curl http://localhost:8586/api/v1/thirdeye/dashboard/data

# Action items (works without data - shows 0 costs)
curl http://localhost:8586/api/v1/thirdeye/action-items

# API Documentation
open http://localhost:8586/api/v1/thirdeye/docs
```

---

## 🎨 **Step 3: Start Frontend UI**

### **3.1 Configure Environment:**

```bash
cd thirdeye-ui

# Create .env.local file (optional - defaults work)
cat > .env.local << 'EOF'
# ThirdEye Backend URL
THIRDEYE_BACKEND_URL=http://localhost:8586

# Public backend URL for direct health checks
NEXT_PUBLIC_THIRDEYE_BACKEND_URL=http://localhost:8586
EOF
```

### **3.2 Install Dependencies:**

```bash
npm install
# or
yarn install
```

### **3.3 Start Development Server:**

```bash
npm run dev
# or
yarn dev
```

### **3.4 Access Dashboard:**

```
Main Dashboard: http://localhost:3000/dashboard/thirdeye
Help Center:    http://localhost:3000/dashboard/thirdeye/help
Analytics:      http://localhost:3000/dashboard/thirdeye/insights
Techniques:     http://localhost:3000/dashboard/thirdeye/techniques
```

---

## 📊 **Step 4: Load Sample Data (Optional)**

If you want to see real data instead of zeros:

### **4.1 Load Fact Table Data:**

```bash
cd thirdeye-py-service

# Prepare your CSV file with columns:
# FQN, DATABASE_NAME, DB_SCHEMA, TABLE_NAME, SIZE_GB, ROLL_30D_TBL_QC, ROLL_30D_TBL_UC, LAST_ACCESSED_DATE, LAST_REFRESHED_DATE

python -m thirdeye.seeds.data_loader path/to/your/table_usage.csv
```

### **4.2 Insert Sample Health Score:**

```bash
mysql -u thirdeye -pthirdeye123 thirdeye << 'EOF'
INSERT INTO health_score_history (score, captured_at) VALUES 
  (74, NOW()),
  (72, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (73, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (71, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (75, DATE_SUB(NOW(), INTERVAL 4 DAY));
EOF
```

### **4.3 Insert Sample Action Items:**

The action items are calculated from `v_table_purge_scores` view, so once you have data in `fact_datalake_table_usage_inventory`, they will automatically appear!

---

## 🔍 **Step 5: Test the Integration**

### **5.1 Open Browser Console:**

```
1. Go to http://localhost:3000/dashboard/thirdeye
2. Open Developer Tools (F12)
3. Check Console for logs:
   - "Real data loaded successfully" ✅
   - or "Backend not available, using mock data" ⚠️
```

### **5.2 Verify Data Flow:**

```bash
# Check backend logs
tail -f thirdeye-py-service/logs/thirdeye.log

# Or watch uvicorn console for requests:
# INFO: 127.0.0.1 - "GET /api/v1/thirdeye/dashboard/data HTTP/1.1" 200 OK
```

### **5.3 Test Refresh Button:**

1. Click "Refresh" button in dashboard header
2. Watch loading spinner
3. Data should reload
4. Check console for any errors

---

## 🎯 **Data Flow Diagram**

```
Frontend (Next.js)
    ↓ fetch('/api/thirdeye/dashboard/data')
Next.js API Proxy (/api/thirdeye/[...path])
    ↓ fetch('http://localhost:8586/api/v1/thirdeye/dashboard/data')
Python Backend (FastAPI)
    ↓ SQLAlchemy async query
MySQL Database
    ↓ v_datalake_health_metrics view
    ↓ v_table_purge_scores view
Response JSON
    ↓
Frontend Updates UI
```

---

## ✅ **Expected Behavior**

### **With Backend Running:**
- Dashboard loads with real data from MySQL
- Action items show actual costs and counts
- Techniques show real statistics
- No "Using Mock Data" badge
- Refresh button works
- Loading states show during data fetch

### **Without Backend Running:**
- Dashboard automatically falls back to mock data
- Yellow "Using Mock Data" badge appears
- All UI still works perfectly
- Refresh button retries backend connection
- No errors - graceful degradation

---

## 🐛 **Troubleshooting**

### **Issue: "Using Mock Data" appears**

**Check:**
1. Is Python backend running? `curl http://localhost:8586/health`
2. Is MySQL running? `mysql -u thirdeye -pthirdeye123`
3. Check backend logs for errors
4. Verify .env configuration

**Solution:**
```bash
# Restart backend
cd thirdeye-py-service
uvicorn thirdeye.app:app --port 8586 --reload
```

### **Issue: "Failed to connect to ThirdEye backend"**

**Check:**
1. Backend URL in .env.local
2. Port 8586 is not blocked
3. CORS settings (should work with proxy)

**Solution:**
```bash
# Check if backend is accessible
curl http://localhost:8586/health

# Verify environment variable
echo $THIRDEYE_BACKEND_URL
```

### **Issue: Database connection errors in backend**

**Check:**
1. MySQL is running
2. thirdeye user exists with correct password
3. thirdeye schema was created

**Solution:**
```bash
# Test MySQL connection
mysql -u thirdeye -pthirdeye123 -e "SHOW DATABASES;"

# Should show:
# +--------------------+
# | Database           |
# +--------------------+
# | thirdeye           |
# | openmetadata_db    |
# +--------------------+
```

---

## 🎨 **Features When Connected to MySQL**

### **Real-Time Data:**
- ✅ ZI Score calculated from `v_datalake_health_metrics`
- ✅ Action items with actual costs from `v_table_purge_scores`
- ✅ Historical health scores from `health_score_history`
- ✅ Budget forecast with real savings opportunities
- ✅ Insights showing actual table data

### **Fallback Behavior:**
- ✅ Automatic fallback to mock data if backend unavailable
- ✅ Graceful error handling with user-friendly messages
- ✅ Retry button to reconnect
- ✅ Visual indicator when using mock data
- ✅ All UI remains functional

---

## 🚀 **Quick Start (All Steps)**

### **Terminal 1 - Backend:**
```bash
cd thirdeye-py-service
export OM_MYSQL_HOST=localhost
export THIRDEYE_MYSQL_USER=root
export THIRDEYE_MYSQL_PW=yourpassword
uvicorn thirdeye.app:app --port 8586 --reload
```

### **Terminal 2 - Frontend:**
```bash
cd thirdeye-ui
npm run dev
```

### **Browser:**
```
http://localhost:3000/dashboard/thirdeye
```

### **Watch the Console:**
```
[ThirdEye Proxy] GET http://localhost:8586/api/v1/thirdeye/dashboard/data
✓ Real data loaded successfully
```

---

## 📊 **Monitoring**

### **Backend Logs:**
```bash
cd thirdeye-py-service
tail -f logs/thirdeye.log
```

### **Frontend Console:**
```javascript
// Browser console should show:
"Real data loaded successfully"

// If backend is down:
"Backend not available, using mock data"
```

### **Network Tab:**
```
GET /api/thirdeye/dashboard/data → 200 OK (real data)
GET /api/thirdeye/action-items → 200 OK (real data)
GET /api/thirdeye/techniques → 200 OK (always works)
```

---

## ✨ **Next Steps**

Once you have data flowing:

1. **Load More Data:**
   - Use data loaders to import CSV files
   - Health scores will auto-calculate
   - Action items will show real costs

2. **Customize:**
   - Adjust refresh intervals in config
   - Modify action item thresholds
   - Add custom techniques

3. **Deploy:**
   - Both services ready for production
   - Use Docker Compose (guide in repo)
   - Configure reverse proxy

---

## 🎯 **Summary**

**With This Setup:**
- ✅ Python backend connects to MySQL
- ✅ Next.js frontend connects to Python backend
- ✅ API proxy handles CORS automatically
- ✅ Automatic fallback to mock data
- ✅ Loading states and error handling
- ✅ Refresh button to retry connection
- ✅ Visual indicators for data source
- ✅ All features work with or without backend

**Total Setup Time:** ~10 minutes  
**Complexity:** Low (mostly env vars)  
**Result:** Fully functional dynamic dashboard!  

---

**Ready to see real data from your MySQL database!** 🎉

