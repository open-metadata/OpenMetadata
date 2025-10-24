# ThirdEye Python GraphQL Service

Internal microservice for ThirdEye analytics, accessed via OpenMetadata proxy at `/api/v1/thirdeye/**`.

## Architecture

- **Framework**: FastAPI + Strawberry GraphQL
- **Language**: Python 3.11+
- **Database**: MySQL (dual connection - read-only OM, read-write thirdeye schema)
- **Authentication**: JWT validation (shared secret with OpenMetadata)
- **Port**: 8586 (internal only, not exposed externally)

## Quick Start

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn thirdeye.app:app --host 0.0.0.0 --port 8586 --reload

# Health check
curl http://localhost:8586/api/v1/thirdeye/health

# Prometheus metrics
curl http://localhost:8586/metrics
```

### Environment Variables

```bash
# Database connections
export OM_MYSQL_HOST=localhost
export OM_MYSQL_PORT=3306
export OM_MYSQL_USER=openmetadata_user
export OM_MYSQL_PASSWORD=openmetadata_password
export OM_MYSQL_DB=openmetadata_db

export TE_MYSQL_HOST=localhost
export TE_MYSQL_PORT=3306
export TE_MYSQL_USER=openmetadata_user
export TE_MYSQL_PASSWORD=openmetadata_password
export TE_MYSQL_DB=openmetadata_db
export TE_MYSQL_SCHEMA=thirdeye

# Authentication
export JWT_SECRET=your-jwt-secret-shared-with-openmetadata
export JWT_ALGORITHM=HS256

# Service
export LOG_LEVEL=INFO
export ENVIRONMENT=development
```

## GraphQL API

### Endpoint

- **Development**: `http://localhost:8586/graphql`
- **Production**: `https://openmetadata.example.com:8585/api/v1/thirdeye/graphql` (proxied)

### Example Query

```graphql
query DashboardData {
  ziScore {
    overall
    storageScore
    computeScore
    queryScore
  }
  
  actionItems(status: OPEN, limit: 10) {
    id
    title
    category
    potentialSavings
  }
}
```

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=thirdeye --cov-report=html

# Type checking
mypy src/thirdeye
```

## Docker

```bash
# Build image
docker build -t thirdeye-py-service:latest .

# Run container
docker run -p 8586:8586 \
  -e OM_MYSQL_HOST=host.docker.internal \
  -e JWT_SECRET=your-secret \
  thirdeye-py-service:latest
```

## Project Structure

```
thirdeye-py-service/
├── src/thirdeye/
│   ├── app.py              # FastAPI application entry point
│   ├── config.py           # Configuration management
│   ├── auth.py             # JWT validation middleware
│   ├── db.py               # Database connections
│   ├── repo/               # Data access layer
│   │   ├── om_read.py      # OpenMetadata DB (read-only)
│   │   └── te_write.py     # ThirdEye schema (read-write)
│   ├── services/           # Business logic
│   │   └── zi_score.py     # ZI Score calculation
│   ├── routers/            # REST endpoints
│   │   ├── health.py       # Health check
│   │   └── dashboard.py    # Dashboard data (if needed)
│   ├── graphql/            # GraphQL layer
│   │   ├── schema.py       # Strawberry schema
│   │   ├── loaders.py      # DataLoaders (batching)
│   │   └── operations/     # Persisted queries
│   └── migrations/         # SQL migrations
└── tests/                  # Test suite
```

## References

- [ADR-0002: ThirdEye Python GraphQL Service](../openmetadata-docs/adr/ADR-0002-thirdeye-py-graphql.md)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Strawberry GraphQL](https://strawberry.rocks/)
