# ThirdEye GraphQL Queries Reference

## 🎯 GraphQL Endpoint

**URL:** http://localhost:8587/graphql  
**GraphQL Playground:** http://localhost:8587/graphql (interactive UI)

---

## 📋 Available Queries

### 1. **Get ZI Score (Full)**

Get complete ZI Score with all metadata:

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

**Example cURL:**
```bash
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { ziScore { overall status breakdown { storage compute query others } } }"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "ziScore": {
      "overall": 74.0,
      "status": "good",
      "breakdown": {
        "storage": 25.0,
        "compute": 20.0,
        "query": 15.0,
        "others": 14.0
      }
    }
  }
}
```

---

### 2. **Get ZI Score Summary (Optimized for UI)**

Lightweight query for dashboard gauge:

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

**Example cURL:**
```bash
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetZIScoreSummary { ziScore { overall status trend breakdown { storage compute query others } } }"
  }'
```

---

### 3. **Health Check**

Simple health check via GraphQL:

```graphql
query HealthCheck {
  health
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ health }"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "health": "ok"
  }
}
```

---

### 4. **Get Specific Score Components**

Query only what you need:

```graphql
query GetOverallScore {
  ziScore {
    overall
  }
}
```

```graphql
query GetBreakdown {
  ziScore {
    breakdown {
      storage
      compute
      query
      others
    }
  }
}
```

```graphql
query GetMetadata {
  ziScore {
    metadata {
      totalTables
      activeTables
      wasteStorageTb
      monthlySavingsOpportunityUsd
    }
  }
}
```

---

## 🎨 GraphQL Schema

### **Types:**

```graphql
type Query {
  ziScore: ZIScore!
  health: String!
}

type ZIScore {
  overall: Float!
  storageScore: Float!
  queryScore: Float!
  computeScore: Float!
  trend: String!
  status: String!
  breakdown: ZIScoreBreakdown!
  metadata: ZIScoreMetadata!
}

type ZIScoreBreakdown {
  storage: Float!
  compute: Float!
  query: Float!
  others: Float!
}

type ZIScoreMetadata {
  totalTables: Int!
  activeTables: Int!
  inactiveTables: Int!
  totalStorageTb: Float!
  wasteStorageTb: Float!
  wastePercentage: Float!
  monthlyCostUsd: Float!
  monthlySavingsOpportunityUsd: Float!
  annualSavingsOpportunityUsd: Float!
  zombieTables: Int!
  zombiePercentage: Float!
  staleTables: Int!
  stalePercentage: Float!
  calculatedAt: String
}
```

---

## 🧪 Testing GraphQL Queries

### **Method 1: GraphQL Playground (Interactive)**

1. Open: http://localhost:8587/graphql
2. You'll see Apollo Sandbox
3. Paste any query and click "Run"
4. Explore schema with autocomplete

### **Method 2: cURL (Command Line)**

```bash
# Basic query
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health }"}'

# Full ZI Score
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { ziScore { overall storageScore queryScore computeScore status trend breakdown { storage compute query others } metadata { totalTables activeTables monthlyCostUsd monthlySavingsOpportunityUsd } } }"
  }'

# Pretty print with jq
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ ziScore { overall status breakdown { storage compute query others } } }"}' \
  | python -m json.tool
```

### **Method 3: JavaScript/TypeScript (Frontend)**

```typescript
// Using fetch
const response = await fetch('http://localhost:8587/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `
      query {
        ziScore {
          overall
          status
          breakdown {
            storage
            compute
            query
            others
          }
        }
      }
    `
  })
});

const data = await response.json();
console.log(data.data.ziScore);
```

### **Method 4: Python (Backend)**

```python
import httpx
import asyncio

async def get_zi_score():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'http://localhost:8587/graphql',
            json={
                'query': '''
                    query {
                        ziScore {
                            overall
                            status
                            breakdown {
                                storage
                                compute
                                query
                                others
                            }
                        }
                    }
                '''
            }
        )
        return response.json()

# Run it
result = asyncio.run(get_zi_score())
print(result)
```

---

## 📊 Example Responses

### **Full ZI Score Response:**

```json
{
  "data": {
    "ziScore": {
      "overall": 74.0,
      "storageScore": 70.0,
      "queryScore": 65.0,
      "computeScore": 72.0,
      "trend": "improving",
      "status": "good",
      "breakdown": {
        "storage": 25.0,
        "compute": 20.0,
        "query": 15.0,
        "others": 14.0
      },
      "metadata": {
        "totalTables": 1250,
        "activeTables": 890,
        "inactiveTables": 360,
        "totalStorageTb": 125.5,
        "wasteStorageTb": 45.2,
        "wastePercentage": 36.0,
        "monthlyCostUsd": 2259.0,
        "monthlySavingsOpportunityUsd": 813.6,
        "annualSavingsOpportunityUsd": 9763.2,
        "zombieTables": 145,
        "zombiePercentage": 11.6,
        "staleTables": 215,
        "stalePercentage": 17.2,
        "calculatedAt": "2025-10-27T04:30:00Z"
      }
    }
  }
}
```

### **Summary Response (for UI Gauge):**

```json
{
  "data": {
    "ziScore": {
      "overall": 74.0,
      "status": "good",
      "trend": "improving",
      "breakdown": {
        "storage": 25.0,
        "compute": 20.0,
        "query": 15.0,
        "others": 14.0
      }
    }
  }
}
```

### **Health Check Response:**

```json
{
  "data": {
    "health": "ok"
  }
}
```

---

## 🔍 GraphQL Introspection

Get the full schema:

```graphql
query IntrospectionQuery {
  __schema {
    queryType {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
    types {
      name
      kind
      fields {
        name
        type {
          name
        }
      }
    }
  }
}
```

---

## 🚀 Frontend Integration

### **How the UI uses GraphQL:**

```typescript
// From thirdeye-ui/src/lib/thirdeyeClient.ts

async getZIScoreSummary() {
  const query = `
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
  `;

  const response = await this.graphqlQuery(query);
  return response.data.ziScore;
}

async graphqlQuery(query: string, variables?: any) {
  return this.fetch('/graphql', {
    method: 'POST',
    body: JSON.stringify({ query, variables })
  });
}
```

---

## 🎯 Common Use Cases

### **Dashboard Gauge:**

```graphql
{
  ziScore {
    overall
    breakdown {
      storage
      compute
      query
      others
    }
  }
}
```

### **Cost Savings Widget:**

```graphql
{
  ziScore {
    metadata {
      monthlyCostUsd
      monthlySavingsOpportunityUsd
      annualSavingsOpportunityUsd
    }
  }
}
```

### **Table Statistics:**

```graphql
{
  ziScore {
    metadata {
      totalTables
      activeTables
      inactiveTables
      zombieTables
      staleTables
    }
  }
}
```

### **Storage Overview:**

```graphql
{
  ziScore {
    storageScore
    breakdown {
      storage
    }
    metadata {
      totalStorageTb
      wasteStorageTb
      wastePercentage
    }
  }
}
```

---

## 🔐 Authentication (Future)

Currently, GraphQL endpoint is open. For production, you can add authentication:

```bash
# With JWT token
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"query": "{ ziScore { overall } }"}'
```

---

## 📝 Query Best Practices

### **1. Request Only What You Need:**

❌ **Bad** (requesting everything):
```graphql
{ ziScore { overall storageScore queryScore computeScore trend status breakdown { storage compute query others } metadata { totalTables activeTables inactiveTables ... } } }
```

✅ **Good** (specific fields):
```graphql
{ ziScore { overall status breakdown { storage compute query others } } }
```

### **2. Use Named Queries:**

```graphql
query DashboardGaugeData {
  ziScore {
    overall
    breakdown {
      storage
      compute
      query
      others
    }
  }
}
```

### **3. Handle Errors:**

```typescript
try {
  const response = await fetch('/graphql', {
    method: 'POST',
    body: JSON.stringify({ query })
  });
  
  const result = await response.json();
  
  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    return null;
  }
  
  return result.data;
} catch (error) {
  console.error('Network error:', error);
  return null;
}
```

---

## 🧪 Quick Test Commands

```bash
# 1. Health check
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health }"}' \
  | python -m json.tool

# 2. Get ZI Score (summary)
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ ziScore { overall status breakdown { storage compute query others } } }"}' \
  | python -m json.tool

# 3. Get full ZI Score
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d @- << 'EOF' | python -m json.tool
{
  "query": "query { ziScore { overall storageScore queryScore computeScore trend status breakdown { storage compute query others } metadata { totalTables activeTables monthlyCostUsd monthlySavingsOpportunityUsd } } }"
}
EOF

# 4. Get schema introspection
curl -X POST http://localhost:8587/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { queryType { name fields { name } } } }"}' \
  | python -m json.tool
```

---

## 🌐 GraphQL Playground Usage

### **Step 1: Open Playground**
Open http://localhost:8587/graphql in your browser

### **Step 2: Explore Schema**
Click "Schema" tab on the right to see all available types and fields

### **Step 3: Run Queries**
Paste any query in the left panel and click the "Run" button

### **Step 4: Use Autocomplete**
Press `Ctrl+Space` while typing to get autocomplete suggestions

---

## 📊 Response Structure

All GraphQL responses follow this format:

```json
{
  "data": {
    "ziScore": { ... }
  },
  "errors": [  // Only present if there are errors
    {
      "message": "Error description",
      "locations": [...],
      "path": [...]
    }
  ]
}
```

---

## 🔄 Future Queries (Coming Soon)

These will be added as the service expands:

```graphql
# Action Items
query GetActionItems {
  actionItems {
    id
    title
    description
    cost
    priority
  }
}

# Purge Candidates
query GetPurgeCandidates($limit: Int, $minScore: Float) {
  purgeCandidates(limit: $limit, minScore: $minScore) {
    fqn
    purgeScore
    sizeGb
    monthlyCost
    recommendation
  }
}

# Techniques
query GetTechniques {
  techniques {
    id
    title
    description
    category
  }
}

# Create Action Item (Mutation)
mutation CreateActionItem($input: ActionItemInput!) {
  createActionItem(input: $input) {
    id
    title
    status
  }
}
```

---

## 🎯 Use Cases

### **Dashboard Gauge Component:**
```graphql
{ ziScore { overall breakdown { storage compute query others } } }
```

### **Budget Forecast Widget:**
```graphql
{ ziScore { metadata { monthlyCostUsd monthlySavingsOpportunityUsd annualSavingsOpportunityUsd } } }
```

### **Health Status Banner:**
```graphql
{ ziScore { overall status trend } }
```

### **Storage Insights:**
```graphql
{ ziScore { storageScore breakdown { storage } metadata { totalStorageTb wasteStorageTb wastePercentage } } }
```

### **Table Activity:**
```graphql
{ ziScore { metadata { totalTables activeTables inactiveTables zombieTables staleTables } } }
```

---

## 🔧 Troubleshooting

### **Issue: GraphQL endpoint 404**

**Cause:** Service not running or wrong URL

**Solution:**
```bash
# Check if service is running
curl http://localhost:8587/api/v1/thirdeye/health

# Verify GraphQL is mounted
curl http://localhost:8587/graphql
# Should return GraphQL Playground HTML
```

### **Issue: "Field not found" error**

**Cause:** Typo in field name or field doesn't exist

**Solution:**
```bash
# Check schema in playground
# Fields are case-sensitive: 
# ✅ ziScore (correct)
# ❌ ZIScore (wrong)
# ❌ zi_score (wrong)
```

### **Issue: "Cannot return null for non-nullable field"**

**Cause:** Database views don't exist or have no data

**Solution:**
```bash
# Service returns fallback data if views missing
# Check logs for: "No health metrics available, returning fallback values"
```

---

## 📚 Resources

- **GraphQL Playground:** http://localhost:8587/graphql
- **Schema Explorer:** Click "Schema" tab in playground
- **API Docs:** http://localhost:8587/docs
- **Health Check:** http://localhost:8587/api/v1/thirdeye/health

---

## 💡 Pro Tips

1. **Use GraphQL for flexible queries** (choose exactly what fields you need)
2. **Use REST for simple operations** (health checks, single endpoints)
3. **Use named queries** for better debugging
4. **Check playground schema** for available fields
5. **Handle errors gracefully** in production code

---

**GraphQL Endpoint:** http://localhost:8587/graphql  
**Interactive Playground:** Open in browser to explore! 🚀
