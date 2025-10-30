# ThirdEye Project Overview

Complete project documentation and reference guide for the ThirdEye Analytics Platform integrated with OpenMetadata.

---

## 📚 Documentation Index

| Document | Purpose | Audience |
|----------|---------|----------|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | ⭐ High-level project summary | Everyone |
| [SERVER_DOCUMENTATION.md](SERVER_DOCUMENTATION.md) | Complete server setup & operations | DevOps, Ops |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | Code style & best practices | Developers |
| [CICD_PIPELINE.md](CICD_PIPELINE.md) | CI/CD workflows & deployment | DevOps |
| [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) | Quick reference for ops tasks | On-Call, Ops |

---

## 🎯 Project Summary

### What is ThirdEye?

ThirdEye is an intelligent data infrastructure analytics platform that helps organizations:

- **Identify zombie tables** (unused data assets)
- **Detect wasteful storage** (unnecessary data retention)
- **Calculate cost savings** (optimization opportunities)
- **Recommend actions** (purge, archive, optimize)
- **Monitor health** (infrastructure wellness score)

### Key Metrics

- **ZI Score (Zero Intelligence Score)**: 0-100 health score (lower is better)
- **Purge Score**: 0-10 rating for table cleanup priority
- **Cost Savings**: Monthly and annual savings opportunities
- **Storage Waste**: Percentage of unnecessary storage

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Production                            │
│                    coming.live (VPS)                         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐         ┌──────▼──────┐      ┌──────▼──────┐
   │Next.js  │         │  Python     │      │ OpenMetadata│
   │   UI    │────────▶│  FastAPI    │─────▶│   Server    │
   │  :3000  │         │   :8587     │      │   :8585     │
   └─────────┘         └─────────────┘      └──────┬──────┘
                              │                     │
                              │                     │
                        ┌─────▼─────────────────────▼──┐
                        │    MySQL (Docker)            │
                        │  - openmetadata_db           │
                        │  - thirdeye (schema)         │
                        │     :3306                    │
                        └──────────────────────────────┘
```

### Technology Stack

#### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Library**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts
- **State**: React Hooks

#### Backend (Python)
- **Framework**: FastAPI 0.109
- **Language**: Python 3.11
- **API Styles**: REST + GraphQL (Strawberry)
- **ORM**: SQLAlchemy (async)
- **Server**: Uvicorn

#### Backend (Java - OpenMetadata Integration)
- **Framework**: Dropwizard
- **Language**: Java 21 LTS
- **Build**: Maven 3.9.11
- **Server**: Jetty (embedded)

#### Database
- **Database**: MySQL 8.0
- **Container**: Docker
- **Schemas**: `openmetadata_db`, `thirdeye`

#### Infrastructure
- **Server**: CentOS Stream 8
- **Process Manager**: PM2 (UI), systemd/nohup (Python)
- **Reverse Proxy**: Nginx (planned)
- **SSL**: Let's Encrypt (planned)

---

## 📁 Repository Structure

```
OpenMetadata/
├── openmetadata-service/              # Java backend
│   └── src/main/java/org/openmetadata/service/
│       ├── clients/
│       │   ├── ThirdEyeClient.java
│       │   └── ThirdEyeService.java
│       ├── config/
│       │   └── ThirdEyeConfiguration.java
│       ├── resources/
│       │   └── ThirdEyeResource.java
│       └── exception/
│           └── ThirdEyeServiceException.java
│
├── thirdeye-py-service/               # Python FastAPI backend
│   ├── src/thirdeye/
│   │   ├── app.py                     # Main application
│   │   ├── config.py                  # Configuration
│   │   ├── db.py                      # Database connections
│   │   ├── routers/                   # API endpoints
│   │   │   ├── health.py
│   │   │   ├── dashboard.py
│   │   │   ├── zi_score.py
│   │   │   ├── techniques.py
│   │   │   ├── insights.py
│   │   │   └── action_items.py
│   │   ├── graphql/                   # GraphQL schema
│   │   ├── repo/                      # Data repositories
│   │   ├── services/                  # Business logic
│   │   └── models/                    # Data models
│   ├── requirements.txt
│   ├── .env
│   └── logs/
│
├── thirdeye-ui/                       # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/thirdeye/    # ThirdEye pages
│   │   │   └── api/thirdeye/          # API proxy
│   │   ├── components/                # React components
│   │   ├── lib/                       # Utilities
│   │   └── middleware.ts              # Auth middleware
│   ├── package.json
│   └── .env.local
│
├── deployment/                        # Deployment scripts
│   ├── deploy.sh
│   ├── rollback.sh
│   └── health-check.sh
│
└── Documentation/                     # Project docs
    ├── PROJECT_OVERVIEW.md
    ├── SERVER_DOCUMENTATION.md
    ├── CODING_STANDARDS.md
    ├── CICD_PIPELINE.md
    └── OPERATIONS_RUNBOOK.md
```

---

## 🚀 Quick Start

### For Developers (Local Development)

```bash
# 1. Clone repository
git clone https://github.com/shashionline/OpenMetadata.git
cd OpenMetadata
git checkout feat/thirdeye-py-graphql

# 2. Start Python service
cd thirdeye-py-service
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export PYTHONPATH=src
uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload

# 3. Start UI (new terminal)
cd thirdeye-ui
npm install
npm run dev

# 4. Access
# UI: http://localhost:3000
# API: http://localhost:8587/api/v1/thirdeye/health
# GraphQL: http://localhost:8587/api/v1/thirdeye/graphql
```

### For DevOps (Production Deployment)

```bash
# 1. SSH to server
ssh root@108.181.162.31

# 2. Run deployment script
cd /opt/thirdeye-deployment/OpenMetadata
./deployment/deploy.sh

# 3. Verify deployment
./deployment/health-check.sh
```

### For Operations (Service Management)

```bash
# Check status
pm2 status
ps aux | grep uvicorn

# View logs
tail -f /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log
pm2 logs thirdeye-ui

# Restart services
./deployment/restart-services.sh
```

---

## 🌐 Production Environment

### Server Details

| Property | Value |
|----------|-------|
| **IP Address** | 108.181.162.31 |
| **Hostname** | vps-ujre |
| **OS** | CentOS Stream 8 |
| **Domain** | coming.live |
| **Location** | /opt/thirdeye-deployment/OpenMetadata |

### Service Endpoints

| Service | Internal | External | Purpose |
|---------|----------|----------|---------|
| ThirdEye UI | http://localhost:3000 | https://coming.live | Web interface |
| Python API | http://localhost:8587 | (internal only) | Backend API |
| OpenMetadata | http://localhost:8585 | https://coming.live:8585 | Data catalog |
| MySQL | localhost:3306 | (internal only) | Database |

### Access Credentials

**SSH Access:**
```bash
ssh root@108.181.162.31
```

**MySQL:**
```bash
Host: localhost
Port: 3306
User: openmetadata_user
Password: openmetadata_password
Database: thirdeye
```

**Container Access:**
```bash
docker exec -it openmetadata_mysql mysql -u root -ppassword
```

---

## 📊 Key Features

### 1. Dashboard

Real-time analytics dashboard showing:
- ZI Score gauge
- Health metrics
- Cost breakdown
- Table statistics

**Endpoint**: `/dashboard/thirdeye`

### 2. Insights Report

Detailed insights including:
- Zombie tables (completely unused)
- Stale tables (rarely accessed)
- Top cost tables
- Storage waste analysis

**API**: `/api/thirdeye/insights/report`

### 3. Action Items

Prioritized recommendations:
- Tables to purge
- Tables to archive
- Tables to optimize
- Cost savings opportunities

**API**: `/api/thirdeye/action-items`

### 4. Techniques

Implementation guides for:
- Automated purging
- Lifecycle policies
- Cost optimization
- Data governance

**Endpoint**: `/dashboard/thirdeye/techniques`

### 5. GraphQL API

Flexible query interface:
- ZI Score calculation
- Purge candidates
- Health metrics
- Custom queries

**Endpoint**: `/api/v1/thirdeye/graphql`

---

## 🔄 Development Workflow

### Git Workflow

```bash
# Main branches
main                          # Production-ready code
develop                       # Development/staging
feat/thirdeye-py-graphql     # Current feature (active)

# Create feature branch
git checkout -b feat/your-feature
git push origin feat/your-feature

# Merge workflow
feat/* → develop → main
```

### Code Review Process

1. Create pull request
2. Automated tests run (GitHub Actions)
3. Code review by team
4. Merge to branch
5. Auto-deploy (if configured)

### Testing

```bash
# Python tests
cd thirdeye-py-service
export PYTHONPATH=src
pytest tests/ -v --cov=thirdeye

# UI tests
cd thirdeye-ui
npm test

# Integration tests
./scripts/run-integration-tests.sh
```

---

## 📈 Monitoring & Observability

### Health Checks

```bash
# Python service
curl http://localhost:8587/api/v1/thirdeye/health

# UI
pm2 status | grep thirdeye-ui

# Database
docker exec openmetadata_mysql mysqladmin ping
```

### Logs

```bash
# Python service
tail -f /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log

# UI
pm2 logs thirdeye-ui

# MySQL
docker logs openmetadata_mysql
```

### Metrics (Planned)

- Request rate
- Response time
- Error rate
- Database query performance
- Resource utilization

---

## 🔐 Security

### Authentication

- JWT-based authentication
- Session management via NextAuth
- Secure cookie handling

### Authorization

- Role-based access control (RBAC)
- Public vs. protected routes
- API endpoint protection

### Data Security

- Parameterized SQL queries (SQL injection prevention)
- Input validation
- CORS configuration
- HTTPS (production)

### Secrets Management

- Environment variables
- No hardcoded credentials
- Secure .env files (chmod 600)

---

## 📝 API Documentation

### REST API

#### Health Check
```bash
GET /api/v1/thirdeye/health
Response: {"status": "ok", "timestamp": "..."}
```

#### Dashboard Data
```bash
GET /api/v1/thirdeye/dashboard/data
Response: {
  "zi_score": {...},
  "health_metrics": {...},
  "purge_candidates": [...]
}
```

#### Insights Report
```bash
GET /api/v1/thirdeye/insights/report
Response: {
  "zombie_tables": [...],
  "stale_tables": [...],
  "cost_analysis": {...}
}
```

#### Action Items
```bash
GET /api/v1/thirdeye/action-items
Response: {
  "high_priority": [...],
  "medium_priority": [...],
  "low_priority": [...]
}
```

### GraphQL API

```graphql
query GetZIScore {
  ziScore {
    overallScore
    status
    healthMetrics {
      zombiePercentage
      stalePercentage
      wastePercentage
      utilizationRate
    }
    savingsOpportunity {
      monthlyUsd
      annualUsd
    }
  }
}
```

**Endpoint**: `/api/v1/thirdeye/graphql`  
**IDE**: Apollo Sandbox (development mode)

---

## 🎓 Learning Resources

### For New Team Members

1. **Read**: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) (this document)
2. **Setup**: Follow Quick Start guide above
3. **Explore**: Navigate codebase using VS Code
4. **Build**: Make a small change and deploy to local
5. **Review**: Read [CODING_STANDARDS.md](CODING_STANDARDS.md)

### For Developers

- Python: [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- TypeScript: [Next.js Docs](https://nextjs.org/docs)
- GraphQL: [Strawberry Docs](https://strawberry.rocks/)
- Database: [SQLAlchemy Async](https://docs.sqlalchemy.org/en/14/orm/extensions/asyncio.html)

### For Operations

- [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) - Daily operations
- [SERVER_DOCUMENTATION.md](SERVER_DOCUMENTATION.md) - Server setup
- [CICD_PIPELINE.md](CICD_PIPELINE.md) - Deployment process

---

## 🐛 Troubleshooting

### Common Issues

#### Issue: Python service won't start
**Solution**: See [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md#python-service-wont-start)

#### Issue: UI shows connection error
**Check**:
1. Python service is running: `curl http://localhost:8587/api/v1/thirdeye/health`
2. THIRDEYE_BACKEND_URL in `.env.local` is correct
3. Use `127.0.0.1` not `localhost` (IPv4 vs IPv6)

#### Issue: Database connection fails
**Check**:
1. MySQL container is running: `docker ps | grep mysql`
2. Credentials in `config.py` are correct
3. Database `thirdeye` exists
4. Views are created: `SHOW TABLES;`

#### Issue: 404 Not Found errors
**Check**:
1. Endpoint URL is correct
2. Router is imported in `app.py`
3. Python service logs for errors

---

## 📞 Support & Contact

### Team

| Role | Responsibility | Contact |
|------|---------------|---------|
| Project Lead | Overall project direction | [Email/Slack] |
| Backend Lead | Python/Java backend | [Email/Slack] |
| Frontend Lead | Next.js UI | [Email/Slack] |
| DevOps Lead | Deployment & infrastructure | [Email/Slack] |
| On-Call | 24/7 support | [Phone/PagerDuty] |

### Communication Channels

- **Slack**: #thirdeye-dev (development), #thirdeye-ops (operations)
- **GitHub**: Issues and pull requests
- **Email**: thirdeye-team@yourcompany.com
- **Wiki**: Internal documentation

### Escalation

1. **Level 1**: Check [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md)
2. **Level 2**: Ask in #thirdeye-ops Slack
3. **Level 3**: Contact on-call engineer
4. **Level 4**: Escalate to project lead

---

## 🎯 Roadmap

### Current Version: 1.0.0

- ✅ Core API endpoints (REST + GraphQL)
- ✅ Dashboard UI with ZI Score
- ✅ Database views and queries
- ✅ OpenMetadata integration
- ✅ Production deployment

### Next Version: 1.1.0 (Planned)

- [ ] Automated testing suite
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Prometheus metrics
- [ ] Alerting system
- [ ] SSL/HTTPS configuration

### Future Versions

- [ ] Real-time data updates (WebSockets)
- [ ] Machine learning predictions
- [ ] Multi-tenant support
- [ ] Advanced reporting
- [ ] Mobile app

---

## 📜 License & Copyright

**Copyright**: © 2025 Your Company Name  
**License**: [Your License Here]  
**Version**: 1.0.0  
**Last Updated**: October 28, 2025

---

## 🙏 Acknowledgments

- OpenMetadata team for the data catalog platform
- FastAPI for the excellent Python web framework
- Next.js team for the React framework
- All contributors to this project

---

## 📚 Related Documentation

- [SERVER_DOCUMENTATION.md](SERVER_DOCUMENTATION.md) - Complete server guide
- [CODING_STANDARDS.md](CODING_STANDARDS.md) - Code style guide
- [CICD_PIPELINE.md](CICD_PIPELINE.md) - CI/CD workflows
- [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) - Quick operations reference

---

**For questions or issues, please contact the ThirdEye team.**

