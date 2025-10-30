# ThirdEye Coding Standards

## 📋 Table of Contents

1. [Python Code Standards](#python-code-standards)
2. [TypeScript/React Standards](#typescriptreact-standards)
3. [Java Code Standards](#java-code-standards)
4. [API Design Guidelines](#api-design-guidelines)
5. [Database Standards](#database-standards)
6. [Testing Guidelines](#testing-guidelines)
7. [Documentation Standards](#documentation-standards)
8. [Git Commit Messages](#git-commit-messages)
9. [Code Review Checklist](#code-review-checklist)

---

## 🐍 Python Code Standards

### General Principles

- Follow [PEP 8](https://pep8.org/) style guide
- Use Python 3.11+ features
- Type hints for all function signatures
- Docstrings for all public functions/classes

### Code Style

```python
# Good: Type hints, clear names, docstrings
from typing import List, Optional
from pydantic import BaseModel

class TablePurgeScore(BaseModel):
    """Represents a table's purge score and metadata.
    
    Attributes:
        table_name: Fully qualified table name
        purge_score: Score from 0-10 indicating purge priority
        monthly_cost_usd: Estimated monthly cost in USD
        last_accessed: Last access timestamp
    """
    table_name: str
    purge_score: float
    monthly_cost_usd: Optional[float] = None
    last_accessed: Optional[str] = None


async def get_purge_candidates(
    session: AsyncSession,
    min_score: float = 7.0,
    limit: int = 100
) -> List[TablePurgeScore]:
    """Fetch tables with high purge scores.
    
    Args:
        session: Database session
        min_score: Minimum purge score threshold (default: 7.0)
        limit: Maximum number of results (default: 100)
    
    Returns:
        List of TablePurgeScore objects sorted by score descending
    
    Raises:
        DatabaseError: If database query fails
    """
    query = text("""
        SELECT 
            table_name,
            purge_score,
            monthly_cost_usd,
            last_accessed
        FROM thirdeye.v_table_purge_scores
        WHERE purge_score >= :min_score
        ORDER BY purge_score DESC
        LIMIT :limit
    """)
    
    result = await session.execute(
        query,
        {"min_score": min_score, "limit": limit}
    )
    
    return [TablePurgeScore(**row) for row in result.mappings()]
```

### FastAPI Route Structure

```python
# thirdeye-py-service/src/thirdeye/routers/example.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from loguru import logger

from thirdeye.db import get_om_session
from thirdeye.models import ResponseModel, ErrorResponse
from thirdeye.repo import example_repo

router = APIRouter(
    prefix="/example",
    tags=["example"],
)


@router.get(
    "/items",
    response_model=List[ResponseModel],
    responses={
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get all items",
    description="Retrieves a list of all items from the database."
)
async def get_items(
    limit: int = 100,
    session: AsyncSession = Depends(get_om_session)
) -> List[ResponseModel]:
    """Get all items endpoint."""
    try:
        logger.info(f"Fetching items with limit: {limit}")
        items = await example_repo.fetch_items(session, limit)
        logger.info(f"Successfully fetched {len(items)} items")
        return items
        
    except Exception as e:
        logger.error(f"Failed to fetch items: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch items: {str(e)}"
        )
```

### Error Handling

```python
# Good: Specific exceptions, logging, user-friendly messages

from loguru import logger
from fastapi import HTTPException, status

try:
    result = await database_operation()
    
except DatabaseConnectionError as e:
    logger.error(f"Database connection failed: {e}")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database service temporarily unavailable"
    )
    
except ValidationError as e:
    logger.warning(f"Validation error: {e}")
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid input: {e}"
    )
    
except Exception as e:
    logger.exception("Unexpected error occurred")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An unexpected error occurred"
    )
```

### Logging

```python
from loguru import logger

# Good: Structured logging with context
logger.info(f"Processing request for user_id={user_id}, table={table_name}")
logger.debug(f"Query parameters: {query_params}")
logger.warning(f"Slow query detected: {query_time}ms for table={table_name}")
logger.error(f"Failed to process request: {error_message}", exc_info=True)

# Bad: Generic messages
logger.info("Processing")  # Too vague
logger.error("Error")  # No context
```

### Configuration

```python
# thirdeye-py-service/src/thirdeye/config.py

from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "openmetadata_user"
    mysql_password: str = "openmetadata_password"
    mysql_database: str = "thirdeye"
    
    # API
    api_v1_prefix: str = "/api/v1/thirdeye"
    environment: str = "production"
    log_level: str = "INFO"
    
    # Feature flags
    enable_graphql: bool = True
    enable_cache: bool = True
    cache_ttl_seconds: int = 300
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
```

---

## ⚛️ TypeScript/React Standards

### General Principles

- Use TypeScript strict mode
- Functional components with hooks
- Props interfaces for all components
- Meaningful component names

### Component Structure

```typescript
// thirdeye-ui/src/components/features/TableList.tsx

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Props for TableList component
 */
interface TableListProps {
  tables: PurgeCandidate[];
  onTableSelect?: (tableId: string) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * PurgeCandidate data structure
 */
interface PurgeCandidate {
  id: string;
  tableName: string;
  purgeScore: number;
  monthlyCost: number;
  lastAccessed: string;
}

/**
 * Displays a list of tables with their purge scores
 * 
 * @param tables - Array of table data to display
 * @param onTableSelect - Callback when a table is selected
 * @param isLoading - Whether data is currently loading
 * @param className - Additional CSS classes
 */
export const TableList: React.FC<TableListProps> = ({
  tables,
  onTableSelect,
  isLoading = false,
  className = '',
}) => {
  const handleTableClick = (tableId: string) => {
    onTableSelect?.(tableId);
  };

  if (isLoading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  if (tables.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">
            No tables found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {tables.map((table) => (
        <Card
          key={table.id}
          onClick={() => handleTableClick(table.id)}
          className="cursor-pointer hover:shadow-lg transition-shadow"
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{table.tableName}</span>
              <Badge variant={table.purgeScore >= 8 ? 'destructive' : 'warning'}>
                Score: {table.purgeScore.toFixed(1)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Cost</p>
                <p className="text-lg font-semibold">
                  ${table.monthlyCost.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Accessed</p>
                <p className="text-lg font-semibold">
                  {new Date(table.lastAccessed).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

TableList.displayName = 'TableList';
```

### API Client

```typescript
// thirdeye-ui/src/lib/thirdeyeClient.ts

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

class ThirdEyeClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/thirdeye') {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch purge candidates from the API
   * 
   * @param minScore - Minimum purge score filter
   * @param limit - Maximum number of results
   * @returns Promise with array of candidates or error
   */
  async getPurgeCandidates(
    minScore: number = 7.0,
    limit: number = 100
  ): Promise<ApiResponse<PurgeCandidate[]>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/purge-candidates?min_score=${minScore}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return {
          error: `API error: ${response.statusText}`,
          status: response.status,
        };
      }

      const data = await response.json();
      return {
        data,
        status: response.status,
      };
      
    } catch (error) {
      console.error('Failed to fetch purge candidates:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500,
      };
    }
  }
}

export const thirdeyeClient = new ThirdEyeClient();
```

### Hooks

```typescript
// thirdeye-ui/src/hooks/usePurgeCandidates.ts

import { useState, useEffect } from 'react';
import { thirdeyeClient } from '@/lib/thirdeyeClient';

interface UsePurgeCandidatesOptions {
  minScore?: number;
  limit?: number;
  autoFetch?: boolean;
}

export const usePurgeCandidates = ({
  minScore = 7.0,
  limit = 100,
  autoFetch = true,
}: UsePurgeCandidatesOptions = {}) => {
  const [data, setData] = useState<PurgeCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);

    const response = await thirdeyeClient.getPurgeCandidates(minScore, limit);

    if (response.error) {
      setError(response.error);
      setData([]);
    } else {
      setData(response.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (autoFetch) {
      fetchCandidates();
    }
  }, [minScore, limit, autoFetch]);

  return {
    data,
    loading,
    error,
    refetch: fetchCandidates,
  };
};
```

---

## ☕ Java Code Standards

### OpenMetadata Integration

```java
// openmetadata-service/src/main/java/org/openmetadata/service/clients/ThirdEyeClient.java

package org.openmetadata.service.clients;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.config.ThirdEyeConfiguration;
import org.openmetadata.service.exception.ThirdEyeServiceException;

import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.core.Response;
import java.util.concurrent.TimeUnit;

/**
 * HTTP client for communicating with ThirdEye Python service.
 * 
 * <p>Provides retry logic and error handling for all ThirdEye API calls.
 * 
 * @author ThirdEye Team
 * @version 1.0
 */
@Slf4j
public class ThirdEyeClient {
    private final Client client;
    private final String baseUrl;
    private final ObjectMapper objectMapper;
    private final int maxRetries;

    /**
     * Creates a new ThirdEye client.
     * 
     * @param config Configuration for ThirdEye connection
     */
    public ThirdEyeClient(ThirdEyeConfiguration config) {
        this.baseUrl = String.format(
            "%s://%s:%d",
            config.getSsl() ? "https" : "http",
            config.getHost(),
            config.getPort()
        );
        
        this.maxRetries = config.getMaxRetries();
        this.objectMapper = new ObjectMapper();
        
        this.client = ClientBuilder.newBuilder()
            .connectTimeout(config.getConnectTimeout(), TimeUnit.SECONDS)
            .readTimeout(config.getReadTimeout(), TimeUnit.SECONDS)
            .build();
        
        log.info("ThirdEye client initialized with base URL: {}", baseUrl);
    }

    /**
     * Get health status from ThirdEye service.
     * 
     * @return Health check response
     * @throws ThirdEyeServiceException if service is unavailable
     */
    public Response getHealth() throws ThirdEyeServiceException {
        String endpoint = baseUrl + "/api/v1/thirdeye/health";
        
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                log.debug("Calling ThirdEye health endpoint (attempt {}/{})", 
                    attempt, maxRetries);
                
                Response response = client
                    .target(endpoint)
                    .request()
                    .get();
                
                if (response.getStatus() == 200) {
                    log.debug("ThirdEye health check successful");
                    return response;
                }
                
                log.warn("ThirdEye health check failed with status: {}", 
                    response.getStatus());
                
            } catch (Exception e) {
                log.error("ThirdEye health check attempt {} failed: {}", 
                    attempt, e.getMessage());
                
                if (attempt == maxRetries) {
                    throw new ThirdEyeServiceException(
                        "Failed to connect to ThirdEye service after " 
                        + maxRetries + " attempts", e);
                }
                
                try {
                    Thread.sleep(1000 * attempt); // Exponential backoff
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
            }
        }
        
        throw new ThirdEyeServiceException(
            "ThirdEye service unavailable after " + maxRetries + " attempts");
    }
}
```

---

## 🔌 API Design Guidelines

### RESTful Endpoints

```
Good:
  GET    /api/v1/thirdeye/tables                    # List all tables
  GET    /api/v1/thirdeye/tables/{id}               # Get specific table
  POST   /api/v1/thirdeye/tables                    # Create table
  PUT    /api/v1/thirdeye/tables/{id}               # Update table
  DELETE /api/v1/thirdeye/tables/{id}               # Delete table
  GET    /api/v1/thirdeye/tables/{id}/scores        # Get table scores

Bad:
  GET    /api/v1/thirdeye/getTable?id=123           # Not RESTful
  POST   /api/v1/thirdeye/updateTable               # Wrong verb
  GET    /api/v1/thirdeye/tables/delete/123         # Wrong method
```

### Response Format

```json
// Success Response
{
  "status": "success",
  "data": {
    "items": [...],
    "count": 42,
    "page": 1,
    "total_pages": 5
  },
  "timestamp": "2025-10-28T12:00:00Z"
}

// Error Response
{
  "status": "error",
  "error": {
    "code": "TABLE_NOT_FOUND",
    "message": "Table with ID 'xyz' not found",
    "details": "The requested table does not exist in the database"
  },
  "timestamp": "2025-10-28T12:00:00Z"
}
```

### GraphQL Schema

```graphql
# Good: Clear types, documented fields

"""
Represents a table in the data warehouse
"""
type Table {
  """Unique identifier for the table"""
  id: ID!
  
  """Fully qualified table name (database.schema.table)"""
  fullyQualifiedName: String!
  
  """Purge score from 0-10, higher means more likely to purge"""
  purgeScore: Float!
  
  """Estimated monthly cost in USD"""
  monthlyCostUsd: Float
  
  """Last time the table was accessed"""
  lastAccessed: DateTime
  
  """Columns in this table"""
  columns: [Column!]!
}

"""
Query root type
"""
type Query {
  """
  Get a single table by ID
  
  Arguments:
    id: The unique identifier of the table
  """
  table(id: ID!): Table
  
  """
  List tables with optional filtering
  
  Arguments:
    minScore: Minimum purge score filter (default: 0)
    limit: Maximum number of results (default: 100)
    offset: Number of records to skip (default: 0)
  """
  tables(
    minScore: Float = 0
    limit: Int = 100
    offset: Int = 0
  ): [Table!]!
}
```

---

## 🗄️ Database Standards

### Table Naming

```sql
-- Good: Lowercase, underscores, descriptive
CREATE TABLE table_purge_scores (...);
CREATE TABLE datalake_health_metrics (...);
CREATE VIEW v_table_purge_scores AS ...;

-- Bad: Mixed case, abbreviated
CREATE TABLE TblPrgScr (...);
CREATE TABLE DataLakeHlthMtrcs (...);
```

### Column Naming

```sql
-- Good: Lowercase, underscores, clear meaning
CREATE TABLE tables (
    id BIGINT PRIMARY KEY,
    fully_qualified_name VARCHAR(255) NOT NULL,
    purge_score DECIMAL(3,2),
    monthly_cost_usd DECIMAL(10,2),
    last_accessed TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bad: Abbreviated, unclear
CREATE TABLE tables (
    id BIGINT,
    fqn VARCHAR(255),
    score DECIMAL(3,2),
    cost DECIMAL(10,2),
    access TIMESTAMP
);
```

### Indexes

```sql
-- Create indexes for commonly queried columns
CREATE INDEX idx_purge_score ON table_purge_scores(purge_score DESC);
CREATE INDEX idx_monthly_cost ON table_purge_scores(monthly_cost_usd DESC);
CREATE INDEX idx_last_accessed ON table_purge_scores(last_accessed);

-- Composite indexes for common query patterns
CREATE INDEX idx_score_cost ON table_purge_scores(purge_score DESC, monthly_cost_usd DESC);
```

---

## ✅ Testing Guidelines

### Python Tests

```python
# thirdeye-py-service/tests/test_purge_candidates.py

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from thirdeye.app import app
from thirdeye.models import TablePurgeScore


@pytest.mark.asyncio
async def test_get_purge_candidates_success():
    """Test successful retrieval of purge candidates."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/thirdeye/purge-candidates?min_score=7.0")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert all(item["purge_score"] >= 7.0 for item in data)


@pytest.mark.asyncio
async def test_get_purge_candidates_invalid_score():
    """Test validation of invalid score parameter."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/thirdeye/purge-candidates?min_score=15.0")
        
        assert response.status_code == 422
        assert "validation" in response.json()["error"].lower()
```

### TypeScript Tests

```typescript
// thirdeye-ui/src/components/__tests__/TableList.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { TableList } from '../features/TableList';

describe('TableList', () => {
  const mockTables = [
    {
      id: '1',
      tableName: 'database.schema.table1',
      purgeScore: 8.5,
      monthlyCost: 1200,
      lastAccessed: '2025-01-01',
    },
  ];

  it('renders table list correctly', () => {
    render(<TableList tables={mockTables} />);
    
    expect(screen.getByText('database.schema.table1')).toBeInTheDocument();
    expect(screen.getByText('Score: 8.5')).toBeInTheDocument();
    expect(screen.getByText('$1,200')).toBeInTheDocument();
  });

  it('calls onTableSelect when table is clicked', () => {
    const handleSelect = jest.fn();
    render(<TableList tables={mockTables} onTableSelect={handleSelect} />);
    
    const tableCard = screen.getByText('database.schema.table1').closest('div[role="button"]');
    fireEvent.click(tableCard!);
    
    expect(handleSelect).toHaveBeenCalledWith('1');
  });

  it('shows loading state', () => {
    render(<TableList tables={[]} isLoading={true} />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty state when no tables', () => {
    render(<TableList tables={[]} />);
    
    expect(screen.getByText('No tables found')).toBeInTheDocument();
  });
});
```

---

## 📝 Documentation Standards

### Code Comments

```python
# Good: Explain WHY, not WHAT
# Calculate weighted average because simple average skews results
# when tables have vastly different sizes
weighted_score = sum(score * size for score, size in scores) / total_size

# Bad: Obvious comments
# Add 1 to count
count = count + 1
```

### Function Documentation

```python
def calculate_zi_score(
    zombie_pct: float,
    stale_pct: float,
    waste_pct: float,
    utilization_rate: float
) -> tuple[float, str]:
    """
    Calculate Zero Intelligence (ZI) Score for data infrastructure health.
    
    The ZI Score is a weighted composite score that considers:
    - Percentage of zombie tables (40% weight)
    - Percentage of stale tables (30% weight)
    - Storage waste percentage (20% weight)
    - Utilization rate inverse (10% weight)
    
    Args:
        zombie_pct: Percentage of completely unused tables (0-100)
        stale_pct: Percentage of rarely accessed tables (0-100)
        waste_pct: Percentage of wasted storage (0-100)
        utilization_rate: Active resource utilization rate (0-100)
    
    Returns:
        tuple: (score, status) where:
            - score: Float from 0-100 (higher is worse)
            - status: String descriptor ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL')
    
    Example:
        >>> calculate_zi_score(15.0, 25.0, 30.0, 60.0)
        (32.0, 'FAIR')
    
    Note:
        A score above 70 indicates critical issues requiring immediate attention.
    """
    weights = {
        'zombie': 0.40,
        'stale': 0.30,
        'waste': 0.20,
        'utilization': 0.10
    }
    
    score = (
        zombie_pct * weights['zombie'] +
        stale_pct * weights['stale'] +
        waste_pct * weights['waste'] +
        (100 - utilization_rate) * weights['utilization']
    )
    
    if score >= 70:
        status = 'CRITICAL'
    elif score >= 50:
        status = 'POOR'
    elif score >= 30:
        status = 'FAIR'
    elif score >= 15:
        status = 'GOOD'
    else:
        status = 'EXCELLENT'
    
    return round(score, 1), status
```

---

## 📋 Git Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.
- `ci`: CI/CD changes

### Examples

```
feat(api): add purge candidates endpoint

Implement /api/v1/thirdeye/purge-candidates endpoint that returns
tables with high purge scores. Includes filtering by minimum score
and pagination support.

Closes #123

---

fix(ui): resolve IPv6 connection issue with backend

Update THIRDEYE_BACKEND_URL to use 127.0.0.1 instead of localhost
to avoid IPv6 connection attempts that fail when service only
listens on IPv4.

Fixes #456

---

docs: add comprehensive server documentation

Create SERVER_DOCUMENTATION.md with complete deployment guide,
troubleshooting steps, and operational procedures.

---

refactor(db): optimize purge score query performance

Add composite index on (purge_score, monthly_cost_usd) to speed up
common query patterns. Reduces query time from 2.3s to 0.15s.

---

test(api): add integration tests for ZI score calculation

Implement comprehensive test suite covering:
- Normal calculation scenarios
- Edge cases (zero values, maximum values)
- Error handling
```

---

## ✔️ Code Review Checklist

### General

- [ ] Code follows project style guide
- [ ] No commented-out code
- [ ] No console.log() or print() statements (use proper logging)
- [ ] No hardcoded credentials or secrets
- [ ] Meaningful variable and function names

### Functionality

- [ ] Code does what it's supposed to do
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] No unnecessary complexity

### Testing

- [ ] Unit tests added/updated
- [ ] Tests pass locally
- [ ] Integration tests pass (if applicable)
- [ ] Code coverage is adequate

### Performance

- [ ] No N+1 queries
- [ ] Database queries are optimized
- [ ] Appropriate use of indexes
- [ ] No memory leaks

### Security

- [ ] Input validation implemented
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS vulnerabilities addressed
- [ ] Authentication/authorization checked

### Documentation

- [ ] Code comments where necessary
- [ ] API documentation updated
- [ ] README updated if needed
- [ ] CHANGELOG updated

### Git

- [ ] Meaningful commit message
- [ ] Commits are atomic
- [ ] No merge commits in feature branch
- [ ] Branch is up to date with main

---

**Last Updated**: October 28, 2025  
**Version**: 1.0.0  
**Maintained by**: ThirdEye Team

