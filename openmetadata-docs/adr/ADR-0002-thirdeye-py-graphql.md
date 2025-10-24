# ADR-0002: ThirdEye Python Service with GraphQL API

**Date**: 2025-10-24  
**Status**: Proposed  
**Authors**: OpenMetadata Team  
**Related Issues**: N/A  
**Supersedes**: ADR-0001 (ThirdEye Analytics Service as Internal Microservice)

---

## Context

Following ADR-0001, we established that ThirdEye would be an internal microservice accessed through OpenMetadata's proxy at `/api/v1/thirdeye/**`. ADR-0001 initially proposed a Java/Dropwizard implementation but later outlined a Python/FastAPI stack for better analytics capabilities.

This ADR refines the technical approach by introducing **GraphQL** as the API layer for ThirdEye, replacing traditional REST endpoints.

### Requirements

The ThirdEye service must:
1. **Provide analytics data** efficiently with flexible querying (ZI Score, Action Items, Campaigns, Insights, etc.)
2. **Integrate seamlessly** with OpenMetadata's authentication and authorization
3. **Read from OpenMetadata's MySQL database** (read-only) for metadata entities
4. **Write to its own `thirdeye` schema** in the same MySQL instance for analytics data
5. **Scale independently** for compute-intensive analytics workloads
6. **Support complex, nested queries** common in dashboard and reporting use cases
7. **Provide type safety** and auto-generated documentation

### Challenges with REST

Traditional REST APIs for analytics workloads face challenges:
- **Over-fetching**: Clients receive more data than needed (e.g., fetching full action items when only titles are needed)
- **Under-fetching**: Multiple roundtrips required for related data (e.g., action items + their campaigns + related insights)
- **API proliferation**: Each new dashboard requirement creates new endpoints
- **Versioning complexity**: Changes to response structures require careful versioning
- **Lack of type safety**: OpenAPI schemas don't provide compile-time guarantees

---

## Decision

We will implement the **thirdeye-py-service** using:

### Technology Stack

1. **Language**: Python 3.11+
2. **Framework**: FastAPI 0.109+
3. **GraphQL Library**: Strawberry GraphQL 0.235+
4. **Database**: MySQL 8.0+ with aiomysql/asyncmy
5. **ORM**: SQLAlchemy 2.0 (async mode)
6. **Migrations**: Alembic
7. **Authentication**: PyJWT for JWT validation (delegated from OpenMetadata)
8. **ASGI Server**: Uvicorn

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     External Clients                             │
│              (thirdeye-ui, API Consumers)                        │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                   HTTPS/8585 (single entry point)
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                 openmetadata-service                             │
│                                                                   │
│  /api/v1/thirdeye/graphql ──► Proxy to localhost:8586/graphql   │
│  (validates JWT, forwards request)                               │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                   Internal HTTP (not exposed)
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│              thirdeye-py-service (port 8586)                     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            GraphQL Endpoint: /graphql                      │ │
│  │                                                             │ │
│  │  • Single endpoint for all queries/mutations               │ │
│  │  • JWT validation (shared secret with OM)                  │ │
│  │  • Query complexity limits (max depth: 10, cost: 10000)    │ │
│  │  • Persisted queries support (for production security)     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            Strawberry Schema Resolvers                     │ │
│  │                                                             │ │
│  │  Query:                                                     │ │
│  │    - ziScore: ZIScore                                      │ │
│  │    - actionItems: [ActionItem!]!                           │ │
│  │    - campaigns: [Campaign!]!                               │ │
│  │    - insights: [Insight!]!                                 │ │
│  │    - budgetForecast: BudgetForecast                        │ │
│  │                                                             │ │
│  │  Mutation:                                                  │ │
│  │    - createActionItem(input: ActionItemInput!): ActionItem │ │
│  │    - updateActionItem(id: ID!, input: ...): ActionItem     │ │
│  │    - createCampaign(input: CampaignInput!): Campaign       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────┬───────────────────────────────────┬──┘
                            │                                   │
                 ┌──────────▼────────┐               ┌──────────▼────────┐
                 │   MySQL (OM)      │               │  MySQL (thirdeye) │
                 │   READ-ONLY       │               │   READ-WRITE      │
                 │   (metadata)      │               │   (analytics)     │
                 └───────────────────┘               └───────────────────┘
```

### API Design

**Single GraphQL Endpoint**: `/graphql`

All queries and mutations go through a single endpoint, with introspection enabled in development and disabled in production.

**Example Query**:
```graphql
query DashboardData {
  ziScore {
    overall
    storageScore
    computeScore
    queryScore
    trend
  }
  
  actionItems(status: OPEN, limit: 10) {
    id
    title
    category
    potentialSavings
    campaign {
      id
      name
    }
  }
  
  budgetForecast {
    currentMonthSpend
    forecastedNextMonth
    targetBudget
    variance
  }
}
```

**Example Mutation**:
```graphql
mutation CreateActionItem($input: ActionItemInput!) {
  createActionItem(input: $input) {
    id
    title
    status
    createdAt
  }
}
```

### Database Architecture

**Two Database Connections**:
1. **OpenMetadata MySQL (Read-Only)**
   - Tables: `table_entity`, `database_entity`, `user_entity`, etc.
   - Used for: Fetching metadata to enrich analytics queries
   
2. **ThirdEye Schema (Read-Write)**
   - Tables: `action_items`, `campaigns`, `zi_scores`, `insights`, etc.
   - Used for: Analytics data, optimization tracking, cost history

### Authentication Flow

1. Client sends request to `https://openmetadata.example.com:8585/api/v1/thirdeye/graphql`
2. OpenMetadata service validates JWT token
3. OM forwards request to `http://localhost:8586/graphql` with JWT in `Authorization` header
4. ThirdEye service extracts and validates JWT (using shared secret)
5. GraphQL resolvers access `context.user` for authorization

**Implementation**:
```python
from fastapi import FastAPI, Depends, Request
from strawberry.fastapi import GraphQLRouter
import strawberry
from jose import jwt, JWTError

async def get_current_user(request: Request) -> dict:
    """Extract and validate JWT from OpenMetadata"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(401, "Missing authorization token")
    
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid token")

async def get_context(user: dict = Depends(get_current_user)):
    return {"user": user}

schema = strawberry.Schema(query=Query, mutation=Mutation)
graphql_app = GraphQLRouter(schema, context_getter=get_context)

app.include_router(graphql_app, prefix="/graphql")
```

### Security & Performance Safeguards

1. **Query Complexity Limits**
   - Maximum query depth: 10 levels
   - Maximum query cost: 10,000 points
   - Prevents denial-of-service via deeply nested queries

2. **Persisted Queries** (Production)
   - Only pre-approved queries allowed in production
   - Prevents arbitrary query execution
   - Queries registered during build/deployment

3. **Rate Limiting**
   - Inherited from OpenMetadata proxy layer
   - Per-user query limits

4. **DataLoader Pattern**
   - Batch database queries to prevent N+1 problems
   - Cache within single request context

---

## Consequences

### Positive

✅ **Efficient Data Fetching**
- Clients request exactly the data they need
- Single request for complex nested data (action items → campaigns → insights)
- Reduces bandwidth and improves performance

✅ **Type Safety**
- Strawberry generates TypeScript types for frontend
- End-to-end type safety from database to UI
- Reduces runtime errors

✅ **Self-Documenting API**
- GraphQL introspection provides auto-generated docs
- GraphQL Playground for interactive exploration
- No need to maintain separate OpenAPI specs

✅ **Flexible Queries**
- Frontend can evolve independently without backend changes
- No need for new endpoints when dashboard requirements change
- Supports complex filtering, sorting, pagination out of the box

✅ **Clear Isolation**
- ThirdEye analytics logic completely separate from OpenMetadata core
- Read-only access to OM database prevents accidental modifications
- Independent schema evolution for analytics domain

✅ **Independent Scalability**
- Python service can scale horizontally for analytics workloads
- Stateless design allows easy containerization
- Can add caching layer (Redis) without affecting OM service

### Negative

⚠️ **Learning Curve**
- Team must learn GraphQL concepts (resolvers, dataloaders, schema design)
- Debugging can be harder than REST (complex query execution paths)
- Strawberry-specific patterns and decorators

⚠️ **Caching Complexity**
- HTTP caching less straightforward than REST (all requests are POST to /graphql)
- Requires application-level caching strategies
- Persisted queries help but add deployment complexity

⚠️ **Tooling Differences**
- Standard REST tools (Postman, curl) less effective
- Requires GraphQL-specific clients (Apollo, urql, etc.)
- Monitoring and logging need special handling for GraphQL queries

⚠️ **Query Performance Unpredictability**
- Clients can construct expensive queries
- Complexity analysis required to prevent abuse
- N+1 query problems if not using dataloaders

### Mitigations

🔧 **For Learning Curve:**
- Provide comprehensive documentation and examples
- Set up GraphQL Playground for interactive learning
- Code generation for TypeScript types reduces boilerplate

🔧 **For Caching:**
- Implement persisted queries in production
- Use DataLoader for per-request caching
- Add Redis for shared cache when needed

🔧 **For Tooling:**
- GraphQL Playground in development mode
- Logging middleware to capture full query + variables
- Structured logging for query execution time

🔧 **For Performance:**
- Query complexity analysis enabled
- Automatic query validation and cost calculation
- Database query optimization with proper indexes

---

## Alternatives Considered

### Alternative 1: Traditional REST with FastAPI

**Approach**: Implement REST endpoints like `/api/v1/thirdeye/action-items`, `/api/v1/thirdeye/zi-score`, etc.

**Pros:**
- Familiar HTTP semantics (GET, POST, PUT, DELETE)
- Easy caching with standard HTTP headers
- Simple to test with curl/Postman
- Less learning curve

**Cons:**
- Over-fetching/under-fetching problems
- API proliferation as features grow
- Versioning complexity for breaking changes
- Less type safety for frontend

**Why Rejected**: REST doesn't provide the flexibility needed for complex analytics dashboards with varying data requirements.

---

### Alternative 2: gRPC with Protocol Buffers

**Approach**: Use gRPC for service-to-service communication with strict schema definitions.

**Pros:**
- Strong typing with protobuf
- Excellent performance (binary protocol)
- Built-in code generation for clients

**Cons:**
- Poor browser support (requires gRPC-Web proxy)
- Not as flexible as GraphQL for frontend queries
- Harder to debug (binary protocol)
- Overkill for internal service communication

**Why Rejected**: Browser compatibility issues and lack of query flexibility make gRPC unsuitable for web-facing analytics APIs.

---

### Alternative 3: GraphQL Federation (Apollo)

**Approach**: Use Apollo Federation to combine OpenMetadata and ThirdEye GraphQL schemas into a unified graph.

**Pros:**
- Single GraphQL endpoint for all of OpenMetadata + ThirdEye
- Can query across service boundaries in single request
- Mature ecosystem with Apollo tooling

**Cons:**
- Requires Apollo Gateway deployment
- OpenMetadata core would need GraphQL migration
- Added complexity for minimal benefit
- Tight coupling between services

**Why Rejected**: OpenMetadata core uses REST, and migrating it to GraphQL is out of scope. Simple proxying is sufficient.

---

## Implementation Plan

### Phase 1: Service Scaffolding (Week 1)
- [x] Create `thirdeye-py-service` directory structure
- [x] Set up FastAPI application with Strawberry GraphQL
- [x] Configure MySQL connection (dual connection pools)
- [x] Implement JWT authentication middleware
- [x] Add health check endpoint (`/health`)

### Phase 2: Database Setup (Week 1)
- [ ] Create Alembic migrations for `thirdeye` schema
- [ ] Set up SQLAlchemy models (Action Items, Campaigns, ZI Scores, etc.)
- [ ] Configure read-only connection to OpenMetadata database
- [ ] Seed initial data (techniques catalog)

### Phase 3: GraphQL Schema (Week 2)
- [ ] Define Strawberry types (Query, Mutation, Object types)
- [ ] Implement core resolvers (ziScore, actionItems, campaigns)
- [ ] Add DataLoader for efficient batch loading
- [ ] Configure query complexity analysis

### Phase 4: OpenMetadata Proxy (Week 2)
- [ ] Create `ThirdEyeProxyResource` in `openmetadata-service`
- [ ] Forward `/api/v1/thirdeye/graphql` to Python service
- [ ] Ensure JWT propagation
- [ ] Add integration tests

### Phase 5: Frontend Integration (Week 3)
- [ ] Generate TypeScript types from GraphQL schema
- [ ] Set up GraphQL client (urql or Apollo)
- [ ] Implement dashboard queries
- [ ] Add mutation hooks for action item CRUD

### Phase 6: Security & Performance (Week 4)
- [ ] Enable query complexity limits
- [ ] Implement persisted queries
- [ ] Add structured logging for all GraphQL operations
- [ ] Set up Prometheus metrics

### Phase 7: Testing & Documentation (Week 5)
- [ ] Write unit tests for resolvers
- [ ] Integration tests for full query execution
- [ ] Performance benchmarks
- [ ] Developer documentation and examples

---

## References

- [Strawberry GraphQL Documentation](https://strawberry.rocks/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [ADR-0001: ThirdEye Service Architecture](./ADR-0001-thirdeye-service.md)

---

## Notes

- This ADR focuses specifically on the API layer (GraphQL); ADR-0001 covers the overall service architecture
- The Python/FastAPI choice aligns with data analytics best practices and team expertise
- GraphQL provides the flexibility needed for evolving dashboard requirements without backend changes
- Persisted queries ensure production security while maintaining development flexibility
- The dual-database approach (read-only OM + read-write thirdeye) ensures clear separation of concerns

---

## Approval

**Decision Makers:**
- [ ] Architecture Team
- [ ] Engineering Lead
- [ ] Frontend Team Lead

**Approved**: TBD  
**Review Date**: 2025-10-31

