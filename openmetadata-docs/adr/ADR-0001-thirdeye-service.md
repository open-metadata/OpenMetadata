# ADR-0001: ThirdEye Analytics Service as Internal Microservice

**Date**: 2025-01-16  
**Status**: Proposed  
**Authors**: OpenMetadata Team  
**Related Issues**: N/A

---

## Context

OpenMetadata is expanding to provide advanced analytics and cost optimization capabilities for data infrastructure. These new capabilities, collectively called "ThirdEye," include:

- **ZI Score**: A health score for data infrastructure based on storage, compute, and query efficiency
- **Action Items**: Recommendations for cost savings and optimizations
- **Opportunity Campaigns**: Grouped optimization opportunities across data assets
- **Cost Tracking**: Historical tracking of costs and realized savings
- **Detection Rules**: Automated detection of optimization opportunities
- **Insights & Reports**: Analytics on storage, compute, query patterns, and other metrics

These capabilities require:
1. Separate database schema and domain models (different from core metadata entities)
2. Distinct business logic for analytics, scoring algorithms, and optimization recommendations
3. Independent scalability requirements (analytics workloads vs. metadata CRUD)
4. Potential for compute-intensive operations (cost calculations, ML-based scoring)

### Current Architecture

OpenMetadata currently runs as a monolithic service (`openmetadata-service`) on port 8585 with:
- Dropwizard/Jetty for REST APIs
- PostgreSQL for metadata storage
- Elasticsearch for search indexing
- Single API surface (`/api/v1/*`)

### Problem Statement

We need to decide how to integrate ThirdEye capabilities into the OpenMetadata ecosystem while maintaining:
- **Architectural clarity**: Clear separation between core metadata and analytics domains
- **API consistency**: Single entry point for all OpenMetadata APIs
- **Security**: Unified authentication and authorization
- **Operational simplicity**: Easy deployment and management
- **Future flexibility**: Ability to scale analytics independently if needed

---

## Decision

We will implement ThirdEye as an **internal microservice** (`thirdeye-service`) that:

1. **Runs as a separate Java/Dropwizard service** on port 8586 (not externally exposed)
2. **Is accessed exclusively through `openmetadata-service`** via internal HTTP proxying
3. **Uses its own MySQL database** (`thirdeye_db`) for analytics-specific data
4. **Shares authentication/authorization** with OpenMetadata (JWT tokens validated by OM service)
5. **Communicates back to OpenMetadata** via REST API calls to fetch metadata entities

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         External Clients                              │
│                  (UI, API Consumers, Integrations)                   │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │
                           HTTPS/8585 (single entry point)
                                    │
┌───────────────────────────────────▼──────────────────────────────────┐
│                      openmetadata-service                             │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  API Routes                                                  │   │
│  │  • /api/v1/databases                                        │   │
│  │  • /api/v1/tables                                           │   │
│  │  • /api/v1/users                                            │   │
│  │  • /api/v1/thirdeye/*  ──┐                                 │   │
│  └───────────────────────────┼──────────────────────────────────┘   │
│                              │ Proxy to                             │
│                              │ http://localhost:8586                │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               │ Internal HTTP (not exposed)
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                       thirdeye-service                                │
│                         (port 8586)                                  │
│                                                                       │
│  • ZI Score calculation                                             │
│  • Action Items management                                          │
│  • Campaigns & Cost Tracking                                        │
│  • Detection Rules engine                                           │
│  • Analytics Reports                                                │
│                                                                       │
│  ◄───────────────────────────────────────────────────────────       │
│  Calls OM API for metadata (tables, users, databases)               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                   ┌───────┴────────┐
                   │                │
         ┌─────────▼──────┐  ┌──────▼──────────┐
         │ PostgreSQL     │  │ MySQL           │
         │ (metadata)     │  │ (thirdeye_db)   │
         │ Port 5432      │  │ Port 3306       │
         └────────────────┘  └─────────────────┘
```

### Technology Stack Decision

**thirdeye-py-service (Python/FastAPI):**
- **Framework**: FastAPI 0.109+ (modern async, automatic OpenAPI docs)
- **Language**: Python 3.11+
- **ASGI Server**: Uvicorn with standard extras
- **Database**: MySQL 8.0+ with asyncmy driver
- **ORM**: SQLAlchemy 2.0 (async support)
- **Migrations**: Alembic (SQLAlchemy-native)
- **Authentication**: PyJWT / python-jose for JWT validation
- **Logging**: Loguru (structured logging)
- **Metrics**: Prometheus client
- **Testing**: pytest + httpx (async testing)
- **Type Checking**: mypy, pydantic

**Rationale for Python/FastAPI over Java/Dropwizard:**
- ✅ Faster development for analytics/data-heavy workloads
- ✅ Better ecosystem for data processing (pandas, numpy if needed)
- ✅ Native async/await for concurrent database queries
- ✅ Automatic OpenAPI/Swagger documentation
- ✅ Smaller memory footprint (~50MB vs ~500MB for JVM)
- ✅ Easier onboarding for data engineers
- ✅ Better suited for compute-intensive analytics
- ✅ Simpler deployment (single Python process)

### API Routing Example

**Client Request:**
```
GET /api/v1/thirdeye/dashboard/zi-score
Host: openmetadata.example.com:8585
Authorization: Bearer <JWT_TOKEN>
```

**OpenMetadata Service (Proxy):**
```java
// In openmetadata-service
@Path("/api/v1/thirdeye")
public class ThirdEyeProxyResource {
    
    @GET
    @Path("/{resource:.*}")
    @Authenticated
    public Response proxyToThirdEye(@PathParam("resource") String resource,
                                     @Context HttpServletRequest request) {
        // Validate JWT token (already done by @Authenticated)
        // Forward request to thirdeye-service
        return httpClient.forward("http://localhost:8586/api/v1/thirdeye/" + resource, request);
    }
}
```

**ThirdEye Service (Handler):**
```python
# In thirdeye-py-service
from fastapi import APIRouter, Depends
from thirdeye.auth import get_current_user
from thirdeye.services.zi_score import ZIScoreService

router = APIRouter(prefix="/api/v1/thirdeye/dashboard")

@router.get("/zi-score")
async def get_zi_score(
    user: dict = Depends(get_current_user),
    zi_service: ZIScoreService = Depends()
):
    """Calculate and return ZI Score for data infrastructure health"""
    # User already authenticated by OM service via JWT
    # Calculate ZI score from thirdeye_db
    score = await zi_service.calculate()
    return score
```

---

## Consequences

### Positive

✅ **Clear Domain Separation**
- Core metadata concerns (entities, lineage, governance) remain in `openmetadata-service`
- Analytics and optimization logic isolated in `thirdeye-service`
- Each service can evolve independently

✅ **Single API Entry Point**
- Clients only connect to one endpoint (port 8585)
- Consistent authentication, rate limiting, and API versioning
- No need to expose multiple ports externally

✅ **Independent Scalability**
- ThirdEye analytics workloads can be scaled separately if needed
- Resource-intensive calculations don't impact core metadata operations
- Can deploy multiple ThirdEye instances behind load balancer in future

✅ **Security & Authentication**
- Authentication/authorization handled once at OM service level
- No need to duplicate auth logic in ThirdEye service
- JWT tokens issued and validated by OpenMetadata

✅ **Database Flexibility**
- ThirdEye uses MySQL (optimized for analytics workloads, complex queries)
- Core metadata remains in PostgreSQL (optimized for transactional workloads)
- Independent backup, scaling, and tuning strategies

✅ **Deployment Simplicity**
- Both services can be packaged in same Docker container (if desired)
- Or deployed as separate containers with internal networking
- No external routing/API gateway complexity needed

✅ **Development Clarity**
- Clear module boundaries for development teams
- Easier to onboard contributors to specific domains
- Independent testing and CI/CD pipelines possible

### Negative

⚠️ **Additional Service Complexity**
- Must manage two services instead of one
- Additional configuration (ports, database connections)
- More complex local development setup

⚠️ **Network Hop Overhead**
- Proxying adds latency (typically <5ms on localhost)
- Additional failure point in request path
- Need to handle service-to-service communication failures

⚠️ **Distributed Logging & Debugging**
- Logs split across two services
- Request tracing needs correlation IDs
- Debugging requires context switching between services

⚠️ **Operational Overhead**
- Two services to monitor, upgrade, and maintain
- Database migrations for two databases
- Coordinated deployment strategy needed

### Mitigations

🔧 **For Complexity:**
- Provide Docker Compose setup for easy local development
- Document startup scripts and service dependencies
- Consider single container option for simple deployments

🔧 **For Network Overhead:**
- Keep services on same host/pod for minimal latency
- Implement caching where appropriate
- Use connection pooling for service-to-service calls

🔧 **For Debugging:**
- Implement correlation IDs across service boundaries
- Centralized logging (ELK stack or similar)
- Health check endpoints for both services

🔧 **For Operations:**
- Unified monitoring dashboard
- Automated deployment scripts
- Database migration coordination in CI/CD

---

## Alternatives Considered

### Alternative 1: Embed ThirdEye in openmetadata-service

**Approach**: Add ThirdEye resources directly to `openmetadata-service` as additional REST endpoints.

**Pros:**
- Single service to deploy and manage
- No network overhead
- Simpler operational model

**Cons:**
- Mixes distinct domain concerns in one codebase
- Harder to scale analytics workloads independently
- Risk of tight coupling between metadata and analytics
- Large codebase becomes harder to maintain

**Why Rejected**: Violates single responsibility principle and makes future scaling difficult.

---

### Alternative 2: True External Microservice

**Approach**: Deploy `thirdeye-service` as a standalone external service with its own public API.

**Pros:**
- Maximum independence and scalability
- Can be developed/deployed completely separately
- Clear service boundaries

**Cons:**
- Clients must manage connections to multiple services
- Duplicate authentication/authorization logic
- Complex API versioning and routing
- Security surface area increases (two exposed ports)
- Harder for external API consumers

**Why Rejected**: Adds unnecessary complexity for clients and security concerns.

---

### Alternative 3: Shared Database with Schema Separation

**Approach**: Use same PostgreSQL database but different schemas (e.g., `public` for metadata, `thirdeye` for analytics).

**Pros:**
- Single database to manage
- Easier transactions across boundaries
- Simpler backup/restore

**Cons:**
- Tight coupling at data layer
- Database scaling affects both domains equally
- PostgreSQL may not be optimal for analytics queries
- Schema migration conflicts

**Why Rejected**: Creates tight coupling and limits database optimization strategies.

---

## Implementation Plan

### Phase 1: Service Scaffolding (Week 1)
- [ ] Create `thirdeye-service` Maven module
- [ ] Set up Dropwizard application structure
- [ ] Configure MySQL connection and Flyway migrations
- [ ] Implement basic health check endpoint
- [ ] Add service to root `pom.xml`

### Phase 2: Proxy Implementation (Week 1)
- [ ] Create `ThirdEyeProxyResource` in `openmetadata-service`
- [ ] Implement request forwarding logic
- [ ] Handle authentication context propagation
- [ ] Add integration tests for proxy

### Phase 3: Database Setup (Week 2)
- [ ] Create `thirdeye_db` database schema
- [ ] Convert Prisma schema to Flyway migrations
- [ ] Set up JDBI repositories
- [ ] Seed initial data (techniques catalog)

### Phase 4: Core API Implementation (Weeks 3-4)
- [ ] Implement Dashboard APIs (ZI Score, Budget Forecast)
- [ ] Implement Action Items CRUD
- [ ] Implement Campaigns APIs
- [ ] Add comprehensive tests

### Phase 5: Frontend Integration (Week 5)
- [ ] Update `thirdeye-ui` to call OM service endpoints
- [ ] Update `next.config.ts` rewrites (no changes needed - already proxies `/api/v1/*`)
- [ ] Implement UI components (ZI Score Gauge, etc.)

### Phase 6: Production Readiness (Week 6)
- [ ] Docker Compose configuration
- [ ] Kubernetes manifests (if applicable)
- [ ] Monitoring and alerting setup
- [ ] Documentation and runbooks

---

## References

- [OpenMetadata Architecture Overview](/developers/architecture)
- [Microservices Pattern: Backend for Frontend](https://microservices.io/patterns/apigateway.html)
- [ThirdEye Planning Document](../thirdeye-ui/cursor/MIGRATION-DESIGN.md)

---

## Notes

- This ADR establishes the architectural pattern for ThirdEye integration
- The service remains internal and not exposed to external clients
- Future enhancements (e.g., gRPC, message queues) can be considered as needs evolve
- This pattern can be reused for other specialized services (e.g., data quality, profiling)

---

## Approval

**Decision Makers:**
- [ ] Architecture Team
- [ ] Engineering Lead
- [ ] Product Owner

**Approved**: TBD  
**Review Date**: 2025-01-20

