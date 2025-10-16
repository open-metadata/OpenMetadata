# ThirdEye Analytics Service 📊

Internal microservice for OpenMetadata providing advanced analytics and cost optimization.

## Overview

ThirdEye is a Python/FastAPI-based analytics service that calculates **ZI Score** (Zero Inefficiency Score) and provides cost optimization recommendations for data infrastructure.

**Key Features:**
- 📈 **ZI Score Calculation**: Data infrastructure health scoring
- 💰 **Cost Optimization**: Action items and savings recommendations
- 📋 **Campaigns**: Grouped optimization opportunities
- 📊 **Analytics**: Historical trends and forecasts
- 🔐 **Secure**: JWT authentication shared with OpenMetadata

## Architecture

```
Client → OpenMetadata Service (8585) → ThirdEye Service (8586)
         [Proxy/Gateway]                 [Internal/Not Exposed]
```

ThirdEye runs internally and is **only accessible** through openmetadata-service proxy.

## Quick Start

### Prerequisites

- Python 3.11+
- MySQL 8.0+ (for thirdeye_db)
- OpenMetadata running on port 8585

### Installation

```bash
cd thirdeye-py-service

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Database Setup

```bash
# Run database migrations
mysql -u root -p < src/thirdeye/migrations/001_init.sql
```

### Configuration

Create `.env` file:

```bash
cp .env.example .env
# Edit .env with your configuration
```

Key settings:
- `DB_HOST`, `DB_PORT`, `DB_NAME`: ThirdEye MySQL database
- `OM_DB_HOST`, `OM_DB_PORT`: OpenMetadata MySQL (read-only)
- `JWT_SECRET`: Shared secret with OpenMetadata
- `OM_BASE_URL`: OpenMetadata API URL

### Running the Service

#### Development

```bash
# Option 1: Using uvicorn directly
uvicorn thirdeye.app:app --host 0.0.0.0 --port 8586 --reload

# Option 2: Using Python module
python -m thirdeye.app

# Option 3: Using setup.py entry point
pip install -e .
thirdeye
```

#### Production

```bash
uvicorn thirdeye.app:app --host 0.0.0.0 --port 8586 --workers 4
```

### Verification

```bash
# Health check (no auth required)
curl http://localhost:8586/health
# Expected: {"status":"ok","service":"thirdeye-analytics","timestamp":"..."}

# API version health check
curl http://localhost:8586/api/v1/thirdeye/health
# Expected: {"status":"ok","service":"thirdeye-analytics","timestamp":"..."}

# Detailed health (with database check)
curl http://localhost:8586/api/v1/thirdeye/health/detail
```

## API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8586/api/v1/thirdeye/docs
- **ReDoc**: http://localhost:8586/api/v1/thirdeye/redoc
- **OpenAPI JSON**: http://localhost:8586/api/v1/thirdeye/openapi.json

## API Endpoints

### Health & Monitoring

```bash
GET /health                           # Basic health check
GET /api/v1/thirdeye/health          # Health with API prefix
GET /api/v1/thirdeye/health/ready    # Readiness probe (K8s)
GET /api/v1/thirdeye/health/live     # Liveness probe (K8s)
GET /api/v1/thirdeye/health/detail   # Detailed health + metrics
```

### Dashboard (Requires Authentication)

```bash
GET /api/v1/thirdeye/dashboard/zi-score        # Current ZI Score
GET /api/v1/thirdeye/dashboard/health-history  # Historical scores
GET /api/v1/thirdeye/dashboard/budget-forecast # Cost forecast
GET /api/v1/thirdeye/dashboard/summary         # Complete dashboard
```

### Action Items (Requires Authentication)

```bash
GET    /api/v1/thirdeye/action-items              # List action items
POST   /api/v1/thirdeye/action-items              # Create action item
GET    /api/v1/thirdeye/action-items/{id}         # Get specific item
PATCH  /api/v1/thirdeye/action-items/{id}         # Update item
DELETE /api/v1/thirdeye/action-items/{id}         # Delete item
GET    /api/v1/thirdeye/action-items/stats/summary # Statistics
```

## Authentication

All protected endpoints require JWT bearer token issued by OpenMetadata:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8586/api/v1/thirdeye/dashboard/zi-score
```

## Docker

### Build

```bash
docker build -t thirdeye-service:latest .
```

### Run

```bash
docker run -d \
  --name thirdeye \
  -p 8586:8586 \
  -e DB_HOST=mysql-host \
  -e DB_PASSWORD=password \
  -e JWT_SECRET=your-secret \
  thirdeye-service:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  thirdeye:
    build: .
    ports:
      - "8586:8586"
    environment:
      - DB_HOST=mysql
      - DB_PASSWORD=thirdeye123
      - JWT_SECRET=shared-secret
    depends_on:
      - mysql
```

## Development

### Code Quality

```bash
# Format code
black src/ tests/

# Sort imports
isort src/ tests/

# Linting
flake8 src/ tests/

# Type checking
mypy src/
```

### Testing

```bash
# Run all tests
pytest

# With coverage
pytest --cov=thirdeye --cov-report=html

# Specific test file
pytest tests/test_health.py

# Verbose output
pytest -v -s
```

### Project Structure

```
thirdeye-py-service/
├── src/thirdeye/
│   ├── __init__.py
│   ├── app.py                  # FastAPI application
│   ├── config.py               # Configuration management
│   ├── auth.py                 # JWT authentication
│   ├── db.py                   # Database sessions
│   ├── routers/
│   │   ├── health.py           # Health endpoints
│   │   ├── dashboard.py        # Dashboard APIs
│   │   └── action_items.py     # Action items CRUD
│   ├── services/
│   │   └── zi_score.py         # ZI Score calculation
│   ├── repo/
│   │   ├── om_read.py          # OpenMetadata DB (read-only)
│   │   └── te_write.py         # ThirdEye DB (read-write)
│   └── migrations/
│       └── 001_init.sql        # Database schema
├── tests/
├── requirements.txt
├── pyproject.toml
├── Dockerfile
└── README.md
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | ThirdEye Analytics Service | Application name |
| `ENVIRONMENT` | development | Environment: development, staging, production |
| `DEBUG` | false | Debug mode |
| `HOST` | 0.0.0.0 | Bind host |
| `PORT` | 8586 | Bind port |
| `DB_HOST` | localhost | ThirdEye MySQL host |
| `DB_PORT` | 3306 | ThirdEye MySQL port |
| `DB_NAME` | thirdeye_db | ThirdEye database name |
| `DB_USER` | thirdeye | Database user |
| `DB_PASSWORD` | - | Database password (required) |
| `OM_DB_HOST` | localhost | OpenMetadata MySQL host |
| `OM_DB_NAME` | openmetadata_db | OpenMetadata database name |
| `OM_BASE_URL` | http://localhost:8585 | OpenMetadata API URL |
| `JWT_SECRET` | - | JWT secret key (required) |
| `LOG_LEVEL` | INFO | Logging level |

## Deployment

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: thirdeye-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: thirdeye
  template:
    metadata:
      labels:
        app: thirdeye
    spec:
      containers:
      - name: thirdeye
        image: thirdeye-service:latest
        ports:
        - containerPort: 8586
        env:
        - name: DB_HOST
          value: "mysql-service"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: thirdeye-secrets
              key: jwt-secret
        livenessProbe:
          httpGet:
            path: /api/v1/thirdeye/health/live
            port: 8586
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/thirdeye/health/ready
            port: 8586
          initialDelaySeconds: 20
          periodSeconds: 5
```

## Monitoring

### Metrics

Prometheus metrics available at `/metrics` (if enabled).

### Logging

Structured JSON logs to stdout (production) or pretty-printed logs (development).

Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

## Troubleshooting

### Service won't start

1. Check database connectivity:
   ```bash
   mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "SELECT 1"
   ```

2. Verify migrations ran:
   ```bash
   mysql -u thirdeye -p thirdeye_db -e "SHOW TABLES"
   ```

3. Check logs:
   ```bash
   tail -f logs/thirdeye.log
   ```

### 401 Unauthorized errors

- Verify `JWT_SECRET` matches OpenMetadata configuration
- Check JWT token expiration
- Ensure `JWT_AUDIENCE` and `JWT_ISSUER` match OpenMetadata

### Database connection errors

- Verify MySQL is running and accessible
- Check firewall rules
- Confirm database credentials
- Test connection: `telnet $DB_HOST $DB_PORT`

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Format code: `black .` and `isort .`
5. Run tests: `pytest`
6. Commit: `git commit -m "Add my feature"`
7. Push: `git push origin feature/my-feature`
8. Create Pull Request

## License

Apache License 2.0 - see LICENSE file

## Support

- **Issues**: [GitHub Issues](https://github.com/open-metadata/OpenMetadata/issues)
- **Docs**: [OpenMetadata Documentation](https://docs.open-metadata.org)
- **Slack**: [OpenMetadata Slack](https://slack.open-metadata.org)

---

**Part of OpenMetadata** | [Website](https://open-metadata.org) | [GitHub](https://github.com/open-metadata/OpenMetadata)

