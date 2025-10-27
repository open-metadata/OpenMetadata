# ThirdEye Docker - Quick Reference Card

## 🚀 **ONE-COMMAND DEPLOYMENT**

```bash
cd openmetadata-docker && ./deploy-thirdeye.sh
```

**That's it!** ✅ Everything will start automatically.

---

## 📋 **Quick Commands**

### **Stack Management**

```bash
./thirdeye-stack.sh start      # Start all services
./thirdeye-stack.sh stop       # Stop all services
./thirdeye-stack.sh restart    # Restart services
./thirdeye-stack.sh status     # Show status
./thirdeye-stack.sh logs       # View logs
./thirdeye-stack.sh health     # Health checks
./thirdeye-stack.sh test       # Test integration
```

---

## 🌐 **Service URLs**

| Service | URL |
|---------|-----|
| OpenMetadata UI | http://localhost:8585 |
| OpenMetadata API | http://localhost:8585/api |
| ThirdEye Proxy | http://localhost:8585/api/v1/thirdeye |
| ThirdEye Direct | http://localhost:8587 |
| Elasticsearch | http://localhost:9200 |
| Airflow | http://localhost:8080 |

---

## 🔑 **Default Credentials**

| Service | Username | Password |
|---------|----------|----------|
| OpenMetadata | `admin` | `admin` |
| Airflow | `admin` | `admin` |
| MySQL Root | `root` | `password` |

---

## 🧪 **Quick Tests**

### **1. Health Check (No Auth)**
```bash
curl http://localhost:8585/api/v1/thirdeye/health
```

### **2. Get JWT Token**
1. Open http://localhost:8585
2. Login (admin/admin)
3. DevTools → Application → Local Storage
4. Copy JWT token value

### **3. Test ZI Score (With Auth)**
```bash
export JWT="<your_token>"
curl -H "Authorization: Bearer $JWT" \
  http://localhost:8585/api/v1/thirdeye/zi-score/summary
```

---

## 🔧 **Troubleshooting**

### **Services not starting?**
```bash
# Check logs
docker-compose -f docker-compose.yml -f docker-compose.thirdeye.yml logs

# Check disk space
df -h

# Check ports
netstat -tulpn | grep -E "8585|8586|8587|9200|3307"
```

### **ThirdEye 404 errors?**
```bash
# Check if ThirdEye service is running
docker logs thirdeye_service

# Test direct connection
curl http://localhost:8587/docs
```

### **Can't connect to OpenMetadata?**
```bash
# Check container is running
docker ps | grep openmetadata

# Check health
docker inspect --format='{{.State.Health.Status}}' openmetadata_server

# View logs
docker logs openmetadata_server | tail -50
```

---

## 📊 **File Locations**

| File | Purpose |
|------|---------|
| `custom-jar/openmetadata-service-1.9.9.jar` | Custom JAR with ThirdEye |
| `Dockerfile.custom` | Custom image definition |
| `docker-compose.thirdeye.yml` | ThirdEye extension config |
| `thirdeye.env` | Environment variables |
| `deploy-thirdeye.sh` | Automated deployment |
| `thirdeye-stack.sh` | Stack management |

---

## 🔄 **Update Workflow**

When you make code changes:

```bash
# 1. Rebuild JAR
cd ..
mvn clean install -pl openmetadata-service -am -DskipTests

# 2. Copy to Docker
cp openmetadata-service/target/openmetadata-service-1.9.9.jar \
   openmetadata-docker/custom-jar/

# 3. Redeploy
cd openmetadata-docker
./deploy-thirdeye.sh
```

---

## 💡 **Pro Tips**

1. **Save JWT token for testing:**
   ```bash
   export JWT="your_long_jwt_token_here"
   # Now you can run curl commands with -H "Authorization: Bearer $JWT"
   ```

2. **Watch logs in real-time:**
   ```bash
   docker logs -f openmetadata_server | grep -i thirdeye
   ```

3. **Quick health check:**
   ```bash
   ./thirdeye-stack.sh health
   ```

4. **Backup before updates:**
   ```bash
   tar -czf backup-$(date +%Y%m%d).tar.gz docker-volume/
   ```

---

## ✅ **Success Indicators**

After deployment, verify:

- [ ] OpenMetadata UI loads at http://localhost:8585
- [ ] Can login with admin/admin
- [ ] Health check: `curl http://localhost:8585/api/v1/thirdeye/health`
- [ ] Returns: `{"status": "ok", "service": "thirdeye"}`
- [ ] All containers show "healthy" in `docker ps`

---

## 📞 **Need Help?**

Read the full guide:
```bash
cat THIRDEYE_DOCKER_DEPLOYMENT.md
```

Check integration docs:
```bash
cat ../THIRDEYE_OPENMETADATA_INTEGRATION.md
```

---

**Quick Start:** `./deploy-thirdeye.sh`  
**Manage Stack:** `./thirdeye-stack.sh [start|stop|status|logs|health]`  
**Full Guide:** `THIRDEYE_DOCKER_DEPLOYMENT.md`
