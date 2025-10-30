# ThirdEye CI/CD Pipeline Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [GitHub Actions Workflows](#github-actions-workflows)
3. [Deployment Strategies](#deployment-strategies)
4. [Environment Configuration](#environment-configuration)
5. [Automated Testing](#automated-testing)
6. [Build Process](#build-process)
7. [Deployment Process](#deployment-process)
8. [Rollback Procedures](#rollback-procedures)
9. [Monitoring & Alerts](#monitoring--alerts)

---

## 🎯 Overview

### CI/CD Architecture

```
Developer → GitHub → GitHub Actions → Build & Test → Deploy to Server
                          ↓
                   Run Tests
                   Build Artifacts
                   Security Scan
                          ↓
                   SSH to Production
                   Update Services
                   Verify Health
```

### Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| Development | `feat/*` | Local | Feature development |
| Staging | `develop` | `staging.coming.live` | Pre-production testing |
| Production | `feat/thirdeye-py-graphql` | `coming.live` | Live production |

---

## 🔄 GitHub Actions Workflows

### Main Workflow

Create `.github/workflows/ci-cd.yml`:

```yaml
name: ThirdEye CI/CD Pipeline

on:
  push:
    branches:
      - feat/thirdeye-py-graphql
      - main
      - develop
  pull_request:
    branches:
      - feat/thirdeye-py-graphql
      - main

env:
  PYTHON_VERSION: '3.11'
  NODE_VERSION: '18'

jobs:
  # ============================================
  # PYTHON SERVICE - TEST & LINT
  # ============================================
  test-python:
    name: Test Python Service
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: thirdeye_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          cd thirdeye-py-service
          pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov black flake8
      
      - name: Run Black (code formatter check)
        run: |
          cd thirdeye-py-service
          black --check src/
      
      - name: Run Flake8 (linter)
        run: |
          cd thirdeye-py-service
          flake8 src/ --max-line-length=120 --exclude=__pycache__
      
      - name: Run tests
        env:
          MYSQL_HOST: 127.0.0.1
          MYSQL_PORT: 3306
          MYSQL_USER: root
          MYSQL_PASSWORD: password
          MYSQL_DATABASE: thirdeye_test
        run: |
          cd thirdeye-py-service
          export PYTHONPATH=src
          pytest tests/ -v --cov=thirdeye --cov-report=xml --cov-report=term
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./thirdeye-py-service/coverage.xml
          flags: python
          name: python-coverage

  # ============================================
  # NEXT.JS UI - TEST & BUILD
  # ============================================
  test-ui:
    name: Test Next.js UI
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: thirdeye-ui/package-lock.json
      
      - name: Install dependencies
        run: |
          cd thirdeye-ui
          npm ci
      
      - name: Run ESLint
        run: |
          cd thirdeye-ui
          npm run lint
      
      - name: Run type check
        run: |
          cd thirdeye-ui
          npm run type-check || npx tsc --noEmit
      
      - name: Run tests
        run: |
          cd thirdeye-ui
          npm test -- --coverage --watchAll=false
      
      - name: Build application
        env:
          NODE_ENV: production
          NEXTAUTH_URL: http://localhost:3000
        run: |
          cd thirdeye-ui
          npm run build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ui-build
          path: thirdeye-ui/.next/
          retention-days: 7

  # ============================================
  # SECURITY SCANNING
  # ============================================
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
      
      - name: Check Python dependencies
        run: |
          cd thirdeye-py-service
          pip install --upgrade pip
          pip install safety
          safety check --json || true
      
      - name: Check Node dependencies
        run: |
          cd thirdeye-ui
          npm audit --audit-level=high || true

  # ============================================
  # DEPLOY TO PRODUCTION
  # ============================================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [test-python, test-ui, security-scan]
    if: github.ref == 'refs/heads/feat/thirdeye-py-graphql' && github.event_name == 'push'
    environment:
      name: production
      url: https://coming.live
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.SERVER_SSH_KEY }}
      
      - name: Add server to known hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -H ${{ secrets.SERVER_HOST }} >> ~/.ssh/known_hosts
      
      - name: Deploy to production server
        env:
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
        run: |
          ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
            set -e
            
            echo "======================================"
            echo "Starting deployment..."
            echo "======================================"
            
            # Navigate to project
            cd /opt/thirdeye-deployment/OpenMetadata
            
            # Backup current version
            BACKUP_DIR="/opt/thirdeye-deployment/backups/$(date +%Y%m%d_%H%M%S)"
            mkdir -p $BACKUP_DIR
            echo "Creating backup in $BACKUP_DIR..."
            
            # Pull latest code
            echo "Pulling latest code..."
            git stash
            git fetch origin
            git checkout feat/thirdeye-py-graphql
            git pull origin feat/thirdeye-py-graphql
            
            # Update Python service
            echo "Updating Python service..."
            cd thirdeye-py-service
            source venv/bin/activate
            pip install -r requirements.txt --quiet
            
            # Restart Python service
            echo "Restarting Python service..."
            pkill -f "uvicorn.*8587" || echo "No Python service running"
            sleep 2
            export PYTHONPATH=src
            nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &
            
            # Update UI
            echo "Updating UI..."
            cd ../thirdeye-ui
            npm install --quiet
            npm run build
            
            # Restart UI
            echo "Restarting UI..."
            pm2 restart thirdeye-ui
            pm2 save
            
            # Verify deployment
            echo "Verifying deployment..."
            sleep 5
            
            # Check Python service
            if curl -sf http://localhost:8587/api/v1/thirdeye/health > /dev/null; then
                echo "✓ Python service is healthy"
            else
                echo "✗ Python service health check failed"
                exit 1
            fi
            
            # Check UI
            if pm2 list | grep -q "thirdeye-ui.*online"; then
                echo "✓ UI is running"
            else
                echo "✗ UI is not running"
                exit 1
            fi
            
            echo "======================================"
            echo "Deployment completed successfully!"
            echo "======================================"
          ENDSSH
      
      - name: Notify deployment success
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: success
          text: '🚀 ThirdEye deployed successfully to production!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
      
      - name: Notify deployment failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: '❌ ThirdEye deployment to production failed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  # ============================================
  # POST-DEPLOYMENT HEALTH CHECKS
  # ============================================
  health-check:
    name: Post-Deployment Health Check
    runs-on: ubuntu-latest
    needs: deploy-production
    if: success()
    
    steps:
      - name: Wait for services to stabilize
        run: sleep 30
      
      - name: Check Python service health
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" http://108.181.162.31:8587/api/v1/thirdeye/health)
          if [ "$response" != "200" ]; then
            echo "Health check failed with status code: $response"
            exit 1
          fi
          echo "✓ Python service health check passed"
      
      - name: Check UI accessibility
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" https://coming.live)
          if [ "$response" != "200" ]; then
            echo "UI check failed with status code: $response"
            exit 1
          fi
          echo "✓ UI accessibility check passed"
      
      - name: Run smoke tests
        run: |
          # Test dashboard endpoint
          curl -sf https://coming.live/api/thirdeye/dashboard/data || exit 1
          
          # Test insights endpoint
          curl -sf https://coming.live/api/thirdeye/insights/report || exit 1
          
          echo "✓ Smoke tests passed"
```

---

## 🚀 Deployment Strategies

### Rolling Deployment

```bash
#!/bin/bash
# deployment/rolling-deploy.sh

set -e

SERVICES=("thirdeye-py-service" "thirdeye-ui")
BACKUP_DIR="/opt/thirdeye-deployment/backups/$(date +%Y%m%d_%H%M%S)"

echo "Creating backup: $BACKUP_DIR"
mkdir -p $BACKUP_DIR

for service in "${SERVICES[@]}"; do
  echo "Deploying $service..."
  
  # Backup current version
  cp -r "/opt/thirdeye-deployment/OpenMetadata/$service" "$BACKUP_DIR/"
  
  # Update service
  cd "/opt/thirdeye-deployment/OpenMetadata/$service"
  git pull origin feat/thirdeye-py-graphql
  
  # Restart service
  if [ "$service" == "thirdeye-py-service" ]; then
    pkill -f "uvicorn.*8587"
    source venv/bin/activate
    export PYTHONPATH=src
    nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 > logs/thirdeye-service.log 2>&1 &
  else
    npm install
    npm run build
    pm2 restart thirdeye-ui
  fi
  
  # Health check
  sleep 5
  if ! curl -sf http://localhost:8587/api/v1/thirdeye/health > /dev/null; then
    echo "Health check failed for $service! Rolling back..."
    cp -r "$BACKUP_DIR/$service"/* "/opt/thirdeye-deployment/OpenMetadata/$service/"
    exit 1
  fi
  
  echo "✓ $service deployed successfully"
done

echo "Deployment completed!"
```

### Blue-Green Deployment

```bash
#!/bin/bash
# deployment/blue-green-deploy.sh

set -e

CURRENT_ENV=$(cat /opt/thirdeye-deployment/current-env.txt)
if [ "$CURRENT_ENV" == "blue" ]; then
  NEW_ENV="green"
  NEW_PORT=8588
else
  NEW_ENV="blue"
  NEW_PORT=8587
fi

echo "Current environment: $CURRENT_ENV"
echo "Deploying to: $NEW_ENV (port $NEW_PORT)"

# Deploy to new environment
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port $NEW_PORT > logs/thirdeye-service-$NEW_ENV.log 2>&1 &

# Health check
sleep 5
if curl -sf http://localhost:$NEW_PORT/api/v1/thirdeye/health > /dev/null; then
  echo "✓ New environment healthy"
  
  # Switch traffic (update nginx/load balancer config)
  sudo sed -i "s/proxy_pass http:\/\/localhost:[0-9]*;/proxy_pass http:\/\/localhost:$NEW_PORT;/" /etc/nginx/conf.d/thirdeye.conf
  sudo nginx -t && sudo systemctl reload nginx
  
  # Update current environment marker
  echo "$NEW_ENV" > /opt/thirdeye-deployment/current-env.txt
  
  # Stop old environment
  OLD_PORT=$((NEW_PORT == 8587 ? 8588 : 8587))
  pkill -f "uvicorn.*$OLD_PORT"
  
  echo "✓ Traffic switched to $NEW_ENV"
else
  echo "✗ Health check failed! Not switching traffic."
  pkill -f "uvicorn.*$NEW_PORT"
  exit 1
fi
```

---

## ⚙️ Environment Configuration

### GitHub Secrets

Configure these secrets in GitHub repository settings:

```
SERVER_HOST=108.181.162.31
SERVER_USER=root
SERVER_SSH_KEY=[Your private SSH key content]
SLACK_WEBHOOK=[Your Slack webhook URL for notifications]
MYSQL_ROOT_PASSWORD=[Production MySQL root password]
JWT_SECRET=[Production JWT secret]
```

### Environment Files

#### Production (.env.production)

```bash
# thirdeye-py-service/.env.production
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=openmetadata_user
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_DATABASE=thirdeye

ENVIRONMENT=production
LOG_LEVEL=INFO
API_V1_PREFIX=/api/v1/thirdeye

# Feature flags
ENABLE_GRAPHQL=true
ENABLE_CACHE=true
CACHE_TTL_SECONDS=300
```

```bash
# thirdeye-ui/.env.production
OPENMETADATA_BASE_URL=http://coming.live:8585
THIRDEYE_BACKEND_URL=http://127.0.0.1:8587
NEXTAUTH_URL=https://coming.live
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
```

#### Staging (.env.staging)

```bash
# thirdeye-py-service/.env.staging
MYSQL_HOST=staging-db.example.com
MYSQL_PORT=3306
MYSQL_USER=thirdeye_staging
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_DATABASE=thirdeye_staging

ENVIRONMENT=staging
LOG_LEVEL=DEBUG
API_V1_PREFIX=/api/v1/thirdeye
```

---

## 🧪 Automated Testing

### Python Test Configuration

```python
# thirdeye-py-service/tests/conftest.py

import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from thirdeye.db import Base

TEST_DATABASE_URL = "mysql+aiomysql://root:password@localhost:3306/thirdeye_test"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture
async def test_session(test_engine):
    """Create test database session."""
    async_session = sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()
```

### UI Test Configuration

```typescript
// thirdeye-ui/jest.config.js

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/__tests__/**',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

---

## 🔨 Build Process

### Python Build

```bash
#!/bin/bash
# deployment/build-python.sh

set -e

cd thirdeye-py-service

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run tests
export PYTHONPATH=src
pytest tests/ -v

# Check code quality
black --check src/
flake8 src/ --max-line-length=120

echo "✓ Python build completed"
```

### UI Build

```bash
#!/bin/bash
# deployment/build-ui.sh

set -e

cd thirdeye-ui

# Install dependencies
npm ci

# Run tests
npm test -- --coverage --watchAll=false

# Run linter
npm run lint

# Build application
npm run build

echo "✓ UI build completed"
```

---

## 📦 Deployment Process

### Automated Deployment Script

```bash
#!/bin/bash
# deployment/deploy.sh

set -e

PROJECT_DIR="/opt/thirdeye-deployment/OpenMetadata"
BACKUP_DIR="/opt/thirdeye-deployment/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "======================================"
echo "ThirdEye Deployment Script"
echo "Timestamp: $TIMESTAMP"
echo "======================================"

# Create backup
echo "Step 1: Creating backup..."
mkdir -p "$BACKUP_DIR/$TIMESTAMP"
cp -r "$PROJECT_DIR/thirdeye-py-service" "$BACKUP_DIR/$TIMESTAMP/"
cp -r "$PROJECT_DIR/thirdeye-ui" "$BACKUP_DIR/$TIMESTAMP/"
echo "✓ Backup created: $BACKUP_DIR/$TIMESTAMP"

# Pull latest code
echo "Step 2: Pulling latest code..."
cd "$PROJECT_DIR"
git stash
git fetch origin
git checkout feat/thirdeye-py-graphql
git pull origin feat/thirdeye-py-graphql
echo "✓ Code updated"

# Update Python service
echo "Step 3: Updating Python service..."
cd thirdeye-py-service
source venv/bin/activate
pip install -r requirements.txt --quiet

# Run database migrations (if any)
if [ -f "migrations/migrate.py" ]; then
  echo "Running database migrations..."
  python migrations/migrate.py
fi

# Restart Python service
pkill -f "uvicorn.*8587" || echo "No Python service running"
sleep 2
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &
echo "✓ Python service restarted"

# Update UI
echo "Step 4: Updating UI..."
cd ../thirdeye-ui
npm install --quiet
npm run build

# Restart UI
pm2 restart thirdeye-ui
pm2 save
echo "✓ UI restarted"

# Health checks
echo "Step 5: Running health checks..."
sleep 10

# Check Python service
if curl -sf http://localhost:8587/api/v1/thirdeye/health > /dev/null; then
  echo "✓ Python service is healthy"
else
  echo "✗ Python service health check failed!"
  echo "Rolling back..."
  
  # Rollback
  pkill -f "uvicorn.*8587"
  cp -r "$BACKUP_DIR/$TIMESTAMP/thirdeye-py-service"/* "$PROJECT_DIR/thirdeye-py-service/"
  cd "$PROJECT_DIR/thirdeye-py-service"
  source venv/bin/activate
  export PYTHONPATH=src
  nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 > logs/thirdeye-service.log 2>&1 &
  
  exit 1
fi

# Check UI
if pm2 list | grep -q "thirdeye-ui.*online"; then
  echo "✓ UI is running"
else
  echo "✗ UI is not running!"
  echo "Rolling back..."
  
  # Rollback
  cp -r "$BACKUP_DIR/$TIMESTAMP/thirdeye-ui"/* "$PROJECT_DIR/thirdeye-ui/"
  cd "$PROJECT_DIR/thirdeye-ui"
  pm2 restart thirdeye-ui
  
  exit 1
fi

# Smoke tests
echo "Step 6: Running smoke tests..."
curl -sf https://coming.live/api/thirdeye/dashboard/data > /dev/null || exit 1
curl -sf https://coming.live/api/thirdeye/insights/report > /dev/null || exit 1
echo "✓ Smoke tests passed"

echo "======================================"
echo "Deployment completed successfully!"
echo "======================================"
echo "Backup: $BACKUP_DIR/$TIMESTAMP"
echo "Logs:"
echo "  Python: tail -f $PROJECT_DIR/thirdeye-py-service/logs/thirdeye-service.log"
echo "  UI:     pm2 logs thirdeye-ui"
```

---

## ↩️ Rollback Procedures

### Automatic Rollback

```bash
#!/bin/bash
# deployment/rollback.sh

set -e

BACKUP_DIR="/opt/thirdeye-deployment/backups"
PROJECT_DIR="/opt/thirdeye-deployment/OpenMetadata"

# Find latest backup
LATEST_BACKUP=$(ls -td $BACKUP_DIR/*/ | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "No backup found!"
  exit 1
fi

echo "Rolling back to: $LATEST_BACKUP"

# Stop current services
echo "Stopping current services..."
pkill -f "uvicorn.*8587" || true
pm2 stop thirdeye-ui || true

# Restore from backup
echo "Restoring from backup..."
cp -r "$LATEST_BACKUP/thirdeye-py-service"/* "$PROJECT_DIR/thirdeye-py-service/"
cp -r "$LATEST_BACKUP/thirdeye-ui"/* "$PROJECT_DIR/thirdeye-ui/"

# Restart services
echo "Restarting services..."
cd "$PROJECT_DIR/thirdeye-py-service"
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 > logs/thirdeye-service.log 2>&1 &

cd "$PROJECT_DIR/thirdeye-ui"
pm2 restart thirdeye-ui

# Verify
sleep 5
if curl -sf http://localhost:8587/api/v1/thirdeye/health > /dev/null; then
  echo "✓ Rollback successful"
else
  echo "✗ Rollback failed"
  exit 1
fi
```

### Manual Rollback

```bash
# 1. Identify the version/backup to rollback to
ls -lhtr /opt/thirdeye-deployment/backups/

# 2. Stop current services
pkill -f "uvicorn.*8587"
pm2 stop thirdeye-ui

# 3. Restore specific backup
BACKUP_VERSION="20251028_120000"
cp -r /opt/thirdeye-deployment/backups/$BACKUP_VERSION/* /opt/thirdeye-deployment/OpenMetadata/

# 4. Restart services
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 > logs/thirdeye-service.log 2>&1 &

cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
pm2 restart thirdeye-ui

# 5. Verify
curl http://localhost:8587/api/v1/thirdeye/health
pm2 status
```

---

## 📊 Monitoring & Alerts

### Health Check Endpoints

```python
# thirdeye-py-service/src/thirdeye/routers/health.py

@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/detailed")
async def detailed_health_check(
    om_session: AsyncSession = Depends(get_om_session),
    te_session: AsyncSession = Depends(get_te_session)
):
    """Detailed health check with dependency status."""
    health = {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": {}
    }
    
    # Check OpenMetadata DB
    try:
        await om_session.execute(text("SELECT 1"))
        health["dependencies"]["openmetadata_db"] = "ok"
    except Exception as e:
        health["dependencies"]["openmetadata_db"] = f"error: {str(e)}"
        health["status"] = "degraded"
    
    # Check ThirdEye DB
    try:
        await te_session.execute(text("SELECT 1"))
        health["dependencies"]["thirdeye_db"] = "ok"
    except Exception as e:
        health["dependencies"]["thirdeye_db"] = f"error: {str(e)}"
        health["status"] = "degraded"
    
    return health
```

### Monitoring Script

```bash
#!/bin/bash
# deployment/monitor.sh

while true; do
  # Check Python service
  if ! curl -sf http://localhost:8587/api/v1/thirdeye/health > /dev/null; then
    echo "[$(date)] Python service is down! Alerting..."
    # Send alert (email, Slack, PagerDuty, etc.)
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
      -H 'Content-Type: application/json' \
      -d '{"text":"🚨 ThirdEye Python service is down!"}'
  fi
  
  # Check UI
  if ! pm2 list | grep -q "thirdeye-ui.*online"; then
    echo "[$(date)] UI is down! Alerting..."
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
      -H 'Content-Type: application/json' \
      -d '{"text":"🚨 ThirdEye UI is down!"}'
  fi
  
  sleep 60
done
```

### Prometheus Metrics

```python
# thirdeye-py-service/src/thirdeye/metrics.py

from prometheus_client import Counter, Histogram, Gauge

# Request metrics
request_count = Counter(
    'thirdeye_requests_total',
    'Total number of requests',
    ['method', 'endpoint', 'status']
)

request_duration = Histogram(
    'thirdeye_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint']
)

# Database metrics
db_query_duration = Histogram(
    'thirdeye_db_query_duration_seconds',
    'Database query duration in seconds',
    ['query_type']
)

# Business metrics
purge_candidates_count = Gauge(
    'thirdeye_purge_candidates_total',
    'Total number of purge candidates'
)

zi_score_value = Gauge(
    'thirdeye_zi_score',
    'Current ZI Score value'
)
```

---

**Last Updated**: October 28, 2025  
**Version**: 1.0.0  
**Maintained by**: ThirdEye Team

