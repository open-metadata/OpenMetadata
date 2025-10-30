# ThirdEye Analytics Platform - Complete Documentation

> **Enterprise Data Infrastructure Analytics & Cost Optimization Platform**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/shashionline/OpenMetadata)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/next.js-15-black.svg)](https://nextjs.org/)

---

## 📖 Complete Documentation Library

### 🌟 Start Here

| Document | Description | Who Should Read |
|----------|-------------|-----------------|
| **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** | 🎯 High-level project summary, architecture, features | Everyone (start here!) |
| **[QUICK_START.md](#quick-start-guide)** | ⚡ Get up and running in 5 minutes | New developers |

### 👨‍💻 For Developers

| Document | Description | Use When |
|----------|-------------|----------|
| **[CODING_STANDARDS.md](CODING_STANDARDS.md)** | Code style, best practices, patterns | Writing code, reviewing PRs |
| **API_DOCUMENTATION.md** | REST & GraphQL API reference | Building integrations |

### 🚀 For DevOps & SRE

| Document | Description | Use When |
|----------|-------------|----------|
| **[SERVER_DOCUMENTATION.md](SERVER_DOCUMENTATION.md)** | Complete server setup & configuration | Initial setup, troubleshooting |
| **[CICD_PIPELINE.md](CICD_PIPELINE.md)** | CI/CD workflows, deployment automation | Setting up pipelines |
| **[OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md)** | Quick reference for daily operations | On-call, incident response |

### 📊 System Information

```
Production:  https://coming.live
Server:      108.181.162.31 (CentOS 8)
Location:    /opt/thirdeye-deployment/OpenMetadata
Branch:      feat/thirdeye-py-graphql
```

---

## 🎯 What is ThirdEye?

ThirdEye is an intelligent analytics platform that helps organizations optimize their data infrastructure by:

- 🗂️ **Identifying zombie tables** - Unused data assets consuming resources
- 💰 **Calculating cost savings** - Millions in potential savings
- 📊 **Health monitoring** - Real-time infrastructure wellness
- 🎯 **Actionable insights** - Prioritized recommendations
- 🤖 **Automated optimization** - Smart data lifecycle management

### Key Metrics

```
┌─────────────────────────────────────────────────┐
│  ZI Score: 32.9 (FAIR)                         │
│  Potential Savings: $413,528/year              │
│  Tables Analyzed: 144,515                      │
│  Zombie Tables: 15.2%                          │
└─────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Stack                         │
│                   coming.live (VPS)                          │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼─────┐        ┌──────▼──────┐      ┌──────▼──────┐
   │ Next.js  │        │   Python    │      │OpenMetadata │
   │   UI     │───────▶│   FastAPI   │─────▶│   Server    │
   │  :3000   │ Proxy  │   :8587     │ REST │   :8585     │
   └──────────┘        └─────────────┘      └─────────────┘
                              │
                              │
                        ┌─────▼──────┐
                        │   MySQL    │
                        │   :3306    │
                        │  (Docker)  │
                        └────────────┘
```

**Tech Stack:**
- Frontend: Next.js 15 + TypeScript + Tailwind CSS
- Backend: Python 3.11 + FastAPI + GraphQL
- Integration: Java 21 + OpenMetadata
- Database: MySQL 8.0
- Infrastructure: CentOS 8 + Docker + PM2

---

## ⚡ Quick Start Guide

### For Developers (Local Setup)

```bash
# 1. Clone & Navigate
git clone https://github.com/shashionline/OpenMetadata.git
cd OpenMetadata
git checkout feat/thirdeye-py-graphql

# 2. Start Python Service
cd thirdeye-py-service
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export PYTHONPATH=src
uvicorn thirdeye.app:app --reload --port 8587

# 3. Start UI (new terminal)
cd thirdeye-ui
npm install
npm run dev

# 4. Access
# UI:      http://localhost:3000
# API:     http://localhost:8587/api/v1/thirdeye/health
# GraphQL: http://localhost:8587/api/v1/thirdeye/graphql
```

### For DevOps (Production Deployment)

```bash
# SSH to server
ssh root@108.181.162.31

# Run deployment
cd /opt/thirdeye-deployment/OpenMetadata
./deployment/deploy.sh

# Verify
./deployment/health-check.sh
```

### For Operations (Service Management)

```bash
# Check status
pm2 status
ps aux | grep uvicorn | grep 8587

# View logs
tail -f /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log
pm2 logs thirdeye-ui

# Restart
./deployment/restart-services.sh
```

---

## 📊 Key Features

### 1. 📈 Real-Time Dashboard

Interactive dashboard showing:
- ZI Score gauge (infrastructure health)
- Cost breakdown analysis
- Table statistics
- Trend charts

**URL**: `/dashboard/thirdeye`

### 2. 🔍 Insights Report

Detailed analysis including:
- Zombie tables (0% utilization)
- Stale tables (<10% utilization)
- Top cost tables
- Storage waste

**API**: `GET /api/thirdeye/insights/report`

### 3. ✅ Action Items

Prioritized recommendations:
- Safe to purge (score 9-10)
- Convert to transient (score 7-8)
- Archive candidates (score 5-6)
- Cost savings opportunities

**API**: `GET /api/thirdeye/action-items`

### 4. 🛠️ Optimization Techniques

Implementation guides for:
- Automated lifecycle policies
- Data archival strategies
- Cost optimization
- Governance best practices

**URL**: `/dashboard/thirdeye/techniques`

### 5. 🔌 GraphQL API

Flexible query interface:

```graphql
query GetDashboard {
  ziScore {
    overallScore
    status
    savingsOpportunity {
      monthlyUsd
      annualUsd
    }
  }
  purgeCandidates(minScore: 8.0, limit: 10) {
    tableName
    purgeScore
    monthlyCostUsd
  }
}
```

**Endpoint**: `/api/v1/thirdeye/graphql`

---

## 🗂️ Project Structure

```
OpenMetadata/
│
├── 📄 Documentation/
│   ├── PROJECT_OVERVIEW.md          ⭐ Start here
│   ├── SERVER_DOCUMENTATION.md      🖥️ Server setup
│   ├── CODING_STANDARDS.md          📝 Code guidelines
│   ├── CICD_PIPELINE.md             🚀 Deployment
│   └── OPERATIONS_RUNBOOK.md        🔧 Quick ops reference
│
├── 🐍 thirdeye-py-service/          Python Backend
│   ├── src/thirdeye/
│   │   ├── app.py                   FastAPI application
│   │   ├── routers/                 API endpoints
│   │   ├── graphql/                 GraphQL schema
│   │   ├── repo/                    Data access
│   │   └── services/                Business logic
│   └── requirements.txt
│
├── ⚛️ thirdeye-ui/                   Next.js Frontend
│   ├── src/
│   │   ├── app/dashboard/thirdeye/  Dashboard pages
│   │   ├── app/api/thirdeye/        API proxy
│   │   ├── components/              React components
│   │   └── lib/                     Utilities
│   └── package.json
│
├── ☕ openmetadata-service/          Java Integration
│   └── src/main/java/org/openmetadata/service/
│       ├── clients/                 ThirdEye client
│       ├── config/                  Configuration
│       └── resources/               REST endpoints
│
└── 🚀 deployment/                    Deployment Scripts
    ├── deploy.sh                    Full deployment
    ├── rollback.sh                  Emergency rollback
    ├── health-check.sh              System health
    └── restart-services.sh          Service restart
```

---

## 🌐 Production Environment

### Server Access

```bash
# SSH Access
ssh root@108.181.162.31

# Project Location
cd /opt/thirdeye-deployment/OpenMetadata

# Active Branch
git branch  # feat/thirdeye-py-graphql
```

### Service Endpoints

| Service | Internal | External | Status |
|---------|----------|----------|--------|
| **ThirdEye UI** | localhost:3000 | https://coming.live | ✅ Running |
| **Python API** | localhost:8587 | Internal only | ✅ Running |
| **OpenMetadata** | localhost:8585 | https://coming.live:8585 | ✅ Running |
| **MySQL** | localhost:3306 | Internal only | ✅ Running |

### Database Access

```bash
# Via Docker
docker exec -it openmetadata_mysql mysql -u root -ppassword

# Direct connection
mysql -h localhost -P 3306 -u openmetadata_user -popenmetadata_password thirdeye

# Check data
docker exec -i openmetadata_mysql mysql -u root -ppassword -e "
  USE thirdeye;
  SELECT COUNT(*) FROM v_table_purge_scores;
  SELECT COUNT(*) FROM v_datalake_health_metrics;
"
```

---

## 🔄 Development Workflow

### Git Branching Strategy

```
main                          Production releases
  │
  ├── develop                 Development/staging
  │    │
  │    └── feat/*            Feature branches
  │         │
  │         └── feat/thirdeye-py-graphql  ← Current active
  │
  └── hotfix/*               Emergency fixes
```

### Making Changes

```bash
# 1. Create feature branch
git checkout -b feat/your-feature-name

# 2. Make changes
# ... edit code ...

# 3. Test locally
cd thirdeye-py-service && pytest tests/
cd thirdeye-ui && npm test

# 4. Commit
git add .
git commit -m "feat: add your feature description"

# 5. Push
git push origin feat/your-feature-name

# 6. Create PR on GitHub
```

### Code Review Checklist

Before submitting PR:
- [ ] Code follows [CODING_STANDARDS.md](CODING_STANDARDS.md)
- [ ] Tests pass locally
- [ ] No console.log() or print() statements
- [ ] Documentation updated
- [ ] CHANGELOG updated

---

## 🧪 Testing

### Python Tests

```bash
cd thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src

# Run all tests
pytest tests/ -v

# With coverage
pytest tests/ -v --cov=thirdeye --cov-report=term

# Specific test
pytest tests/test_zi_score.py -v
```

### UI Tests

```bash
cd thirdeye-ui

# Run tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Integration Tests

```bash
# Full integration test
./scripts/run-integration-tests.sh

# Manual API testing
curl http://localhost:8587/api/v1/thirdeye/health
curl http://localhost:8587/api/v1/thirdeye/dashboard/data
```

---

## 📝 API Documentation

### REST API Examples

```bash
# Health Check
curl http://localhost:8587/api/v1/thirdeye/health

# Dashboard Data
curl http://localhost:8587/api/v1/thirdeye/dashboard/data

# Insights Report
curl http://localhost:8587/api/v1/thirdeye/insights/report

# Action Items
curl http://localhost:8587/api/v1/thirdeye/action-items

# Optimization Techniques
curl http://localhost:8587/api/v1/thirdeye/techniques
```

### GraphQL Examples

```graphql
# Get ZI Score
query {
  ziScore {
    overallScore
    status
    breakdown {
      zombieWeight
      staleWeight
      wasteWeight
    }
  }
}

# Get Purge Candidates
query {
  purgeCandidates(minScore: 8.0, limit: 20) {
    tableName
    purgeScore
    monthlyCostUsd
    lastAccessed
    reasonForPurge
  }
}

# Get Health Metrics
query {
  healthMetrics {
    totalTables
    activeTables
    zombieTables
    staleTables
    totalStorageTb
    wasteStorageTb
  }
}
```

**GraphQL Playground**: http://localhost:8587/api/v1/thirdeye/graphql

---

## 🔧 Common Operations

### Restart Services

```bash
# Python Service
pkill -f "uvicorn.*8587"
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

# UI
pm2 restart thirdeye-ui

# Both (using script)
cd /opt/thirdeye-deployment/OpenMetadata
./deployment/restart-services.sh
```

### View Logs

```bash
# Python Service
tail -f /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log

# UI
pm2 logs thirdeye-ui

# MySQL
docker logs -f openmetadata_mysql

# Search for errors
grep -i error /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log | tail -20
```

### Deploy Updates

```bash
# Quick deployment
cd /opt/thirdeye-deployment/OpenMetadata
git pull origin feat/thirdeye-py-graphql
./deployment/deploy.sh

# Or manual
cd thirdeye-py-service && pip install -r requirements.txt && pkill -f uvicorn && ./start-service.sh
cd thirdeye-ui && npm install && npm run build && pm2 restart thirdeye-ui
```

---

## 🐛 Troubleshooting

### Quick Diagnostics

```bash
# Run health check script
/opt/thirdeye-deployment/health-check.sh

# Check all services
docker ps | grep -E "mysql|openmetadata"
pm2 status
ps aux | grep uvicorn | grep 8587
ss -tlnp | grep -E "8587|3000|3306"

# Test connectivity
curl http://localhost:8587/api/v1/thirdeye/health
curl http://localhost:3000
```

### Common Issues & Solutions

#### Python Service Won't Start
```bash
# Check port availability
ss -tlnp | grep 8587
pkill -f "uvicorn.*8587"

# Check Python environment
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
python -c "import thirdeye; print('OK')"

# Check logs
tail -50 logs/thirdeye-service.log
```

#### UI Connection Errors
```bash
# Check environment
cat /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui/.env.local | grep THIRDEYE

# Should be: THIRDEYE_BACKEND_URL=http://127.0.0.1:8587
# NOT: THIRDEYE_BACKEND_URL=http://localhost:8587

# Rebuild after env change
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
npm run build
pm2 restart thirdeye-ui
```

#### Database Issues
```bash
# Check MySQL
docker ps | grep mysql
docker exec openmetadata_mysql mysqladmin ping

# Verify data
docker exec -i openmetadata_mysql mysql -u root -ppassword thirdeye -e "
  SHOW TABLES;
  SELECT COUNT(*) FROM v_table_purge_scores;
"

# Restart if needed
docker restart openmetadata_mysql
```

**For more troubleshooting**: See [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md)

---

## 📞 Support & Contact

### Get Help

1. **Documentation**: Check relevant docs above
2. **Runbook**: [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) for quick fixes
3. **Slack**: #thirdeye-ops for operational issues
4. **GitHub**: Create issue for bugs/features
5. **On-Call**: Contact on-call engineer for emergencies

### Team Contacts

| Role | Responsibility | Contact |
|------|---------------|---------|
| Project Lead | Overall direction | [Name] - [Email/Slack] |
| Backend Lead | Python/Java | [Name] - [Email/Slack] |
| Frontend Lead | Next.js UI | [Name] - [Email/Slack] |
| DevOps Lead | Infrastructure | [Name] - [Email/Slack] |
| On-Call | 24/7 support | [PagerDuty/Phone] |

---

## 🎓 Learning Resources

### New to the Project?

1. **Read**: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)
2. **Setup**: Follow Quick Start above
3. **Explore**: Browse code in VS Code
4. **Build**: Make a small change
5. **Deploy**: Test locally

### Technology Documentation

- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Strawberry GraphQL](https://strawberry.rocks/)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/14/orm/extensions/asyncio.html)
- [OpenMetadata Docs](https://docs.open-metadata.org/)

---

## 📈 Metrics & KPIs

### Current Performance

```
Response Times:
  Health Check:    < 50ms
  Dashboard Data:  < 500ms
  Insights Report: < 1s
  GraphQL Queries: < 300ms

Availability:
  Uptime: 99.9%
  Error Rate: < 0.1%

Data:
  Tables Analyzed: 144,515
  Purge Candidates: 22,089
  Annual Savings: $413,528
```

---

## 🗺️ Roadmap

### Version 1.0.0 (Current) ✅

- Core REST & GraphQL APIs
- Dashboard with ZI Score
- Insights and action items
- OpenMetadata integration
- Production deployment

### Version 1.1.0 (Q1 2026)

- Automated testing (90%+ coverage)
- CI/CD pipeline (GitHub Actions)
- Prometheus metrics
- Grafana dashboards
- SSL/HTTPS

### Version 2.0.0 (Q2 2026)

- Real-time updates (WebSockets)
- ML-based predictions
- Multi-tenant support
- Advanced reporting
- Mobile app

---

## 📜 License

Copyright © 2025 Your Company Name  
Licensed under the [MIT License](LICENSE)

---

## 🙏 Acknowledgments

- **OpenMetadata** - Data catalog platform
- **FastAPI** - Modern Python web framework
- **Next.js** - React framework
- **All Contributors** - Thank you!

---

## 📚 Full Documentation Index

### Essential Reading
- ⭐ **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** - Start here!
- 🖥️ **[SERVER_DOCUMENTATION.md](SERVER_DOCUMENTATION.md)** - Complete server guide
- 📝 **[CODING_STANDARDS.md](CODING_STANDARDS.md)** - Code guidelines
- 🚀 **[CICD_PIPELINE.md](CICD_PIPELINE.md)** - CI/CD workflows
- 🔧 **[OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md)** - Quick ops reference

### Additional Resources
- **CHANGELOG.md** - Version history
- **CONTRIBUTING.md** - Contribution guidelines
- **SECURITY.md** - Security policies
- **LICENSE** - License information

---

<div align="center">

**ThirdEye Analytics Platform**  
*Intelligent Data Infrastructure Optimization*

[Documentation](PROJECT_OVERVIEW.md) • [GitHub](https://github.com/shashionline/OpenMetadata) • [Support](#support--contact)

**Version 1.0.0** | **Last Updated: October 28, 2025**

</div>

