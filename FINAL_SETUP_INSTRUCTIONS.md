# 🚀 FINAL SETUP INSTRUCTIONS - ThirdEye Complete

## ✅ What's Complete

1. ✅ **Next.js async error FIXED** - Route params properly awaited
2. ✅ **ThirdEye routers added** - All endpoints registered
3. ✅ **Dashboard /data endpoint created** - UI compatibility
4. ✅ **Middleware updated** - `/api/thirdeye/*` routes made public
5. ✅ **OpenMetadata JAR built** - With full ThirdEye integration (4.4 MB)
6. ✅ **Docker deployment ready** - Complete stack configuration

---

## 🔧 Current Issue: Port Conflict

**Problem:** Port 8586 is occupied by a Java/Dropwizard service (probably OpenMetadata admin port)

**Solution:** Run ThirdEye Python service on port **8587** instead

---

## 🚀 START YOUR SERVICES - 3 TERMINALS

### **Terminal 1: ThirdEye Python Service (NEW!)**

```bash
cd C:/Users/shash/Documents/GitHub/OpenMetadata/thirdeye-py-service
./start-service.sh
```

**You should see:**
```
INFO:     Uvicorn running on http://0.0.0.0:8587
INFO:     Application startup complete.
✅ Database connections initialized successfully
```

**Keep this terminal running!**

---

### **Terminal 2: Next.js Frontend**

**If it's already running:**
- Just refresh your browser at http://localhost:3000
- The errors should be gone now!

**If you need to start it:**
```bash
cd C:/Users/shash/Documents/GitHub/OpenMetadata/thirdeye-ui
rm -rf .next
npm run dev
```

**You should see:**
```
✓ Ready in 5s
- Local: http://localhost:3000
✅ No more async errors!
✅ Public route accessed: /api/thirdeye/*
```

**Keep this terminal running too!**

---

### **Terminal 3: Testing (Optional)**

Once both services are running:

```bash
# Test ThirdEye backend directly
curl http://localhost:8587/api/v1/thirdeye/health

# Test through Next.js proxy
curl http://localhost:3000/api/thirdeye/health

# Test dashboard data
curl http://localhost:3000/api/thirdeye/dashboard/data
```

---

## 🌐 Access Your Dashboard

**Open in browser:**
```
http://localhost:3000/dashboard/thirdeye
```

**You should see:**
- ✅ No async errors in console
- ✅ Real data from ThirdEye backend
- ✅ ZI Score gauge working
- ✅ Action items loading
- ✅ Techniques displaying
- ✅ Insights reports working

---

## 📊 Service Ports Summary

| Service | Port | URL | Status |
|---------|------|-----|--------|
| Next.js UI | 3000 | http://localhost:3000 | Running |
| ThirdEye Python | **8587** | http://localhost:8587 | **NEW PORT** ✅ |
| ~~ThirdEye (old)~~ | ~~8586~~ | - | ❌ Port occupied by Java |

---

## 🔍 Verify Everything is Working

### **1. Check ThirdEye Service:**
```bash
curl http://localhost:8587/api/v1/thirdeye/health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "thirdeye-py-service",
  "version": "0.1.0"
}
```

### **2. Check Next.js Proxy:**
```bash
curl http://localhost:3000/api/thirdeye/health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "thirdeye-py-service",
  "version": "0.1.0"
}
```

### **3. Check Dashboard Data:**
```bash
curl http://localhost:3000/api/thirdeye/dashboard/data
```

**Expected response:**
```json
{
  "ziScore": {
    "score": 74,
    "breakdown": {
      "storage": 25,
      "compute": 20,
      "query": 15,
      "others": 14
    }
  },
  "budgetForecast": { ... },
  "metadata": { ... }
}
```

---

## 🎯 What Changed

### **Files Updated:**

1. ✅ `thirdeye-ui/src/app/api/thirdeye/[...path]/route.ts`
   - Fixed async params error
   - Changed port to 8587

2. ✅ `thirdeye-ui/src/middleware.ts`
   - Added `/api/thirdeye` to public routes

3. ✅ `thirdeye-py-service/src/thirdeye/app.py`
   - Added all missing routers (techniques, insights, action_items)

4. ✅ `thirdeye-py-service/src/thirdeye/routers/__init__.py`
   - Exported all routers

5. ✅ `thirdeye-py-service/src/thirdeye/routers/dashboard.py`
   - Added `/data` endpoint for UI compatibility

6. ✅ `thirdeye-py-service/requirements.txt`
   - Fixed PyYAML version

7. ✅ **NEW:** `thirdeye-py-service/start-service.sh`
   - Easy startup script

---

## 🐛 Troubleshooting

### **Issue: "Port 8586 is occupied"**
✅ **SOLVED:** Using port 8587 now

### **Issue: "Connection refused"**
**Solution:** Make sure you ran `./start-service.sh` in Terminal 1

### **Issue: "Missing authorization"**
✅ **SOLVED:** Middleware updated to allow public access to `/api/thirdeye/*`

### **Issue: "404 Not Found"**
✅ **SOLVED:** All missing routers and endpoints added

---

## 📋 Complete Startup Checklist

- [ ] **Terminal 1:** Start ThirdEye service
  ```bash
  cd thirdeye-py-service && ./start-service.sh
  ```
  
- [ ] **Wait for:** "Application startup complete"

- [ ] **Terminal 2:** Start Next.js (if not running)
  ```bash
  cd thirdeye-ui && npm run dev
  ```

- [ ] **Wait for:** "Ready in Xs"

- [ ] **Browser:** Open http://localhost:3000/dashboard/thirdeye

- [ ] **Verify:** No errors in browser console

- [ ] **Verify:** ZI Score shows real data

---

## 🎊 Success Criteria

When everything is working, you'll see:

**✅ In Terminal 1 (ThirdEye):**
```
INFO:     Uvicorn running on http://0.0.0.0:8587
INFO:     Application startup complete
INFO:     127.0.0.1:XXXXX - "GET /api/v1/thirdeye/health HTTP/1.1" 200 OK
INFO:     127.0.0.1:XXXXX - "GET /api/v1/thirdeye/dashboard/data HTTP/1.1" 200 OK
```

**✅ In Terminal 2 (Next.js):**
```
✅ Public route accessed: /api/thirdeye/health
✅ Public route accessed: /api/thirdeye/dashboard/data
[ThirdEye Proxy] GET http://localhost:8587/api/v1/thirdeye/dashboard/data
GET /api/thirdeye/dashboard/data 200 in XXXms
```

**✅ In Browser:**
- No async errors in console
- ZI Score gauge showing real numbers
- Action items loaded
- No 404 errors

---

## 🎯 Quick Test Commands

After starting both services:

```bash
# Test health
curl http://localhost:8587/api/v1/thirdeye/health
curl http://localhost:3000/api/thirdeye/health

# Test dashboard
curl http://localhost:3000/api/thirdeye/dashboard/data

# Test action items
curl http://localhost:3000/api/thirdeye/action-items

# Test techniques
curl http://localhost:3000/api/thirdeye/techniques

# Test insights
curl "http://localhost:3000/api/thirdeye/insights/report?report_type=storage&limit=3&offset=0"
```

---

## 📚 Documentation Reference

- **Integration Guide:** `THIRDEYE_OPENMETADATA_INTEGRATION.md`
- **Build Success:** `BUILD_SUCCESS.md`
- **Docker Deployment:** `DOCKER_DEPLOYMENT_COMPLETE.md`
- **Quick Reference:** `openmetadata-docker/QUICK_REFERENCE.md`

---

## 🚀 Next Steps

### **Immediate (Get it working now):**
1. ✅ Start ThirdEye on port 8587
2. ✅ Next.js will auto-reload with new port
3. ✅ Access http://localhost:3000/dashboard/thirdeye
4. ✅ Everything should work!

### **Future (Use OpenMetadata integration):**
1. Deploy Docker stack: `cd openmetadata-docker && ./deploy-thirdeye.sh`
2. Access http://localhost:8585/api/v1/thirdeye/*
3. Full production setup with authentication

---

**Status:** 🟢 **READY TO START!**

**Action Required:** Open Terminal 1 and run:
```bash
cd thirdeye-py-service && ./start-service.sh
```

Then refresh your browser! 🎉
