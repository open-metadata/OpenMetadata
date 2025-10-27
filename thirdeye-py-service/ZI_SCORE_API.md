# ZI Score API Documentation

## Overview

The ZI Score (Zero Intelligence Score) is a health metric for data infrastructure that measures the efficiency and optimization of your data lake. It's calculated based on three key components:

- **Utilization Rate** (40% weight): Active tables vs total tables
- **Storage Efficiency** (35% weight): Active storage vs total storage  
- **Access Freshness** (25% weight): Recently accessed tables

The score ranges from 0-100, where higher scores indicate better health.

## Score Interpretation

| Score Range | Status | Meaning |
|------------|--------|---------|
| 80-100 | EXCELLENT | Highly optimized infrastructure |
| 60-79 | GOOD | Well maintained with minor optimization opportunities |
| 40-59 | FAIR | Needs attention and optimization |
| 20-39 | POOR | Significant issues requiring immediate action |
| 0-19 | CRITICAL | Critical state requiring urgent intervention |

## API Endpoints

### GraphQL API

**Endpoint:** `POST /api/v1/thirdeye/graphql`

**GraphQL IDE:** Available in development at `/api/v1/thirdeye/graphql` (Apollo Sandbox)

#### Full Query

```graphql
query GetZIScore {
  ziScore {
    overall
    storageScore
    queryScore
    computeScore
    trend
    status
    breakdown {
      storage
      compute
      query
      others
    }
    metadata {
      totalTables
      activeTables
      inactiveTables
      totalStorageTb
      wasteStorageTb
      wastePercentage
      monthlyCostUsd
      monthlySavingsOpportunityUsd
      annualSavingsOpportunityUsd
      zombieTables
      zombiePercentage
      staleTables
      stalePercentage
      calculatedAt
    }
  }
}
```

#### Summary Query (for UI Gauge)

```graphql
query GetZIScoreSummary {
  ziScore {
    overall
    status
    trend
    breakdown {
      storage
      compute
      query
      others
    }
  }
}
```

### REST API Endpoints

#### 1. Get ZI Score (Full)

**GET** `/api/v1/thirdeye/zi-score`

Returns complete ZI Score with all metadata.

**Authentication:** Required (JWT from OpenMetadata)

**Response:**
```json
{
  "overall": 74.5,
  "status": "GOOD",
  "trend": "improving",
  "breakdown": {
    "storage": 26.1,
    "compute": 29.8,
    "query": 18.6,
    "others": 0.0
  },
  "storageScore": 74.5,
  "computeScore": 74.5,
  "queryScore": 74.5,
  "metadata": {
    "totalTables": 1500,
    "activeTables": 1200,
    "inactiveTables": 300,
    "totalStorageTB": 50.5,
    "wasteStorageTB": 12.3,
    "wastePercentage": 24.4,
    "monthlyCostUSD": 909.00,
    "monthlySavingsOpportunityUSD": 221.40,
    "annualSavingsOpportunityUSD": 2656.80,
    "zombieTables": 150,
    "zombiePercentage": 10.0,
    "staleTables": 200,
    "stalePercentage": 13.3,
    "calculatedAt": "2025-01-16 10:30:45"
  }
}
```

#### 2. Get ZI Score Summary

**GET** `/api/v1/thirdeye/zi-score/summary`

Returns condensed ZI Score optimized for dashboard display.

**Authentication:** Required (JWT from OpenMetadata)

**Response:**
```json
{
  "score": 74.5,
  "status": "GOOD",
  "breakdown": {
    "storage": 26.1,
    "compute": 29.8,
    "query": 18.6,
    "others": 0.0
  },
  "trend": "improving",
  "savings": {
    "monthly": 221.40,
    "annual": 2656.80
  },
  "alerts": {
    "zombie_tables": 150,
    "zombie_percentage": 10.0,
    "waste_storage_tb": 12.3,
    "waste_percentage": 24.4
  }
}
```

#### 3. Get Health Metrics (Raw)

**GET** `/api/v1/thirdeye/zi-score/health-metrics`

Returns raw health metrics from `v_datalake_health_metrics` view.

**Authentication:** Required (JWT from OpenMetadata)

**Response:** Complete raw metrics dictionary with all calculated fields.

#### 4. Get Purge Candidates

**GET** `/api/v1/thirdeye/zi-score/purge-candidates`

Returns tables ranked by purge score for deletion/archival recommendations.

**Authentication:** Required (JWT from OpenMetadata)

**Query Parameters:**
- `limit` (int, 1-1000, default: 100): Maximum results
- `offset` (int, default: 0): Pagination offset
- `min_score` (float, 0-10, optional): Minimum purge score filter
- `recommendation` (string, optional): Filter by recommendation type
  - `EXCELLENT_CANDIDATE`
  - `GOOD_CANDIDATE`
  - `REVIEW_REQUIRED`
  - `KEEP`

**Response:**
```json
{
  "data": [
    {
      "fqn": "warehouse.analytics.temp_report_2023",
      "database_name": "warehouse",
      "db_schema": "analytics",
      "table_name": "temp_report_2023",
      "table_type": "Regular",
      "size_gb": 150.5,
      "days_since_access": 120,
      "query_count_30d": 0,
      "user_count_30d": 0,
      "monthly_cost_usd": 2.71,
      "purge_score": 8.7,
      "recommendation": "EXCELLENT_CANDIDATE",
      "annual_savings_usd": 32.49,
      "size_score": 6.0,
      "access_staleness_score": 10.0,
      "usage_frequency_score": 10.0,
      "refresh_waste_score": 5.0,
      "user_engagement_score": 10.0
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 1
  },
  "filters": {
    "min_score": null,
    "recommendation": null
  }
}
```

#### 5. Dashboard ZI Score (Legacy)

**GET** `/api/v1/thirdeye/dashboard/zi-score`

Legacy endpoint, returns same data as `/api/v1/thirdeye/zi-score`.

## Usage Examples

### cURL Examples

#### Get ZI Score
```bash
curl -X GET "http://localhost:8586/api/v1/thirdeye/zi-score" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Purge Candidates (Top 10, Score >= 8)
```bash
curl -X GET "http://localhost:8586/api/v1/thirdeye/zi-score/purge-candidates?limit=10&min_score=8" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### GraphQL Query
```bash
curl -X POST "http://localhost:8586/api/v1/thirdeye/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "{ ziScore { overall status breakdown { storage compute query } } }"
  }'
```

### Python Examples

```python
import requests

# Your JWT token from OpenMetadata
token = "YOUR_JWT_TOKEN"
headers = {"Authorization": f"Bearer {token}"}
base_url = "http://localhost:8586/api/v1/thirdeye"

# Get ZI Score
response = requests.get(f"{base_url}/zi-score", headers=headers)
zi_score = response.json()
print(f"ZI Score: {zi_score['overall']} ({zi_score['status']})")

# Get purge candidates
response = requests.get(
    f"{base_url}/zi-score/purge-candidates",
    headers=headers,
    params={"limit": 10, "recommendation": "EXCELLENT_CANDIDATE"}
)
candidates = response.json()
print(f"Found {candidates['pagination']['count']} purge candidates")

# GraphQL query
query = """
query {
  ziScore {
    overall
    status
    breakdown { storage compute query }
  }
}
"""
response = requests.post(
    f"{base_url}/graphql",
    headers=headers,
    json={"query": query}
)
data = response.json()
print(f"ZI Score from GraphQL: {data['data']['ziScore']['overall']}")
```

### TypeScript/JavaScript Example (Frontend)

```typescript
// Using fetch API
async function getZIScore(token: string) {
  const response = await fetch('/api/thirdeye/zi-score/summary', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data;
}

// Using GraphQL
async function getZIScoreGraphQL(token: string) {
  const query = `
    query {
      ziScore {
        overall
        status
        trend
        breakdown { storage compute query others }
      }
    }
  `;
  
  const response = await fetch('/api/thirdeye/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query })
  });
  
  const { data } = await response.json();
  return data.ziScore;
}
```

## Database Views

The ZI Score API queries two main database views:

### v_datalake_health_metrics

Calculates overall health score and aggregated metrics.

**Key Columns:**
- `health_score`: Overall ZI Score (0-100)
- `health_status`: Classification (EXCELLENT, GOOD, FAIR, POOR, CRITICAL)
- `utilization_rate`: % of active tables
- `storage_efficiency`: % of actively used storage
- `access_freshness`: % of recently accessed tables
- `breakdown_*`: Component contributions to score
- Various metrics on tables, storage, costs, zombies, etc.

### v_table_purge_scores

Calculates purge scores for individual tables.

**Key Columns:**
- `purge_score`: Score 0-10 indicating deletion/archival priority
- `recommendation`: Category (EXCELLENT_CANDIDATE, GOOD_CANDIDATE, etc.)
- Component scores: size, staleness, usage, refresh waste, user engagement
- Cost and savings metrics

## Error Handling

### No Data Available

If `fact_datalake_table_usage_inventory` has no data:

```json
{
  "overall": 0.0,
  "status": "NO_DATA",
  "metadata": {
    "message": "No data available. Please ensure fact_datalake_table_usage_inventory has data."
  }
}
```

### Authentication Required

All endpoints require JWT authentication. Missing or invalid tokens return:

```json
{
  "detail": "Not authenticated"
}
```

## Integration with UI

### ZIScoreGauge Component

The React component expects data in this format:

```typescript
interface ZIScoreGaugeProps {
  score?: number;  // overall score 0-100
  breakdown?: {
    compute?: number;   // percentage
    storage?: number;   // percentage
    query?: number;     // percentage
    others?: number;    // percentage
  };
}
```

Map the API response:

```typescript
const gaugeData = {
  score: ziScore.overall,
  breakdown: {
    compute: ziScore.breakdown.compute,
    storage: ziScore.breakdown.storage,
    query: ziScore.breakdown.query,
    others: ziScore.breakdown.others
  }
};
```

## Performance Considerations

- Views are materialized on each query
- For high-traffic scenarios, consider caching the results
- Typical query time: 100-500ms depending on data volume
- Pagination recommended for purge candidates (use limit/offset)

## Future Enhancements

- Historical trending (compare with `fact_health_score_history`)
- Real-time score updates via WebSocket
- Custom weight configuration for components
- ML-based anomaly detection
- Automated action item generation

