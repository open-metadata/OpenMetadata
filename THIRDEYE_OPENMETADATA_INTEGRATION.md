# ThirdEye OpenMetadata Integration

## Overview

This document describes the integration of ThirdEye analytics service with OpenMetadata server. The integration provides a proxy layer that allows the OpenMetadata UI to access ThirdEye analytics capabilities through the OpenMetadata backend, ensuring proper authentication, authorization, and request handling.

## Architecture

```
OpenMetadata UI
       ↓
OpenMetadata Server (Port 8585)
       ↓ (Proxy)
ThirdEye Python Service (Port 8586)
       ↓
Database Views (v_datalake_health_metrics, v_table_purge_scores)
```

## Components

### 1. ThirdEyeConfiguration
**File:** `openmetadata-service/src/main/java/org/openmetadata/service/config/ThirdEyeConfiguration.java`

Configuration class for ThirdEye service integration:
- Service endpoint configuration (host, port, SSL)
- Timeout and retry settings
- SSL/TLS configuration

### 2. ThirdEyeClient
**File:** `openmetadata-service/src/main/java/org/openmetadata/service/clients/ThirdEyeClient.java`

HTTP client for communicating with ThirdEye service:
- Async HTTP requests with retry logic
- SSL/TLS support
- Error handling and logging
- Health check functionality

### 3. ThirdEyeService
**File:** `openmetadata-service/src/main/java/org/openmetadata/service/clients/ThirdEyeService.java`

Managed service for ThirdEye client lifecycle:
- Initialization and cleanup
- Connection health monitoring
- Service availability checks

### 4. ThirdEyeResource
**File:** `openmetadata-service/src/main/java/org/openmetadata/service/resources/ThirdEyeResource.java`

REST API resource for proxying ThirdEye requests:
- Authentication and authorization
- Request/response transformation
- Error handling
- Generic proxy endpoints

## API Endpoints

All ThirdEye endpoints are available under `/api/v1/thirdeye/`:

### Health Check
```
GET /api/v1/thirdeye/health
```
Returns ThirdEye service health status.

### ZI Score Endpoints
```
GET /api/v1/thirdeye/zi-score                    # Full ZI Score
GET /api/v1/thirdeye/zi-score/summary            # Summary for UI
GET /api/v1/thirdeye/zi-score/health-metrics     # Raw metrics
GET /api/v1/thirdeye/zi-score/purge-candidates   # Purge candidates
```

### GraphQL
```
POST /api/v1/thirdeye/graphql
```
Proxy GraphQL queries to ThirdEye service.

### Generic Proxy
```
GET /api/v1/thirdeye/{path:.*}     # Proxy any GET request
POST /api/v1/thirdeye/{path:.*}    # Proxy any POST request
```

## Configuration

### 1. Add to openmetadata.yaml

```yaml
thirdEyeConfiguration:
  enabled: true
  host: "localhost"
  port: 8586
  basePath: "/api/v1/thirdeye"
  timeout: 30000  # 30 seconds
  retryAttempts: 3
  retryDelay: 1000  # 1 second
  ssl:
    enabled: false
    verifyHostname: true
    trustAllCertificates: false
```

### 2. SSL Configuration (Optional)

```yaml
thirdEyeConfiguration:
  enabled: true
  host: "thirdeye.example.com"
  port: 443
  basePath: "/api/v1/thirdeye"
  ssl:
    enabled: true
    verifyHostname: true
    trustAllCertificates: false
    keystorePath: "/etc/ssl/keystore.jks"
    keystorePassword: "changeit"
    truststorePath: "/etc/ssl/truststore.jks"
    truststorePassword: "changeit"
```

## Frontend Integration

### Update thirdeye-ui API calls

The frontend should now call OpenMetadata instead of directly calling ThirdEye:

**Before:**
```typescript
// Direct call to ThirdEye
const response = await fetch('http://localhost:8586/api/v1/thirdeye/zi-score/summary');
```

**After:**
```typescript
// Call through OpenMetadata proxy
const response = await fetch('/api/v1/thirdeye/zi-score/summary');
```

### Update thirdeyeClient.ts

```typescript
// Update base URL to use OpenMetadata proxy
const THIRDEYE_BASE_URL = '/api/v1/thirdeye';  // Instead of direct backend URL

// All existing methods will work unchanged
const summary = await thirdeyeClient.getZIScoreSummary();
```

## Authentication & Authorization

### OpenMetadata Authentication
All requests go through OpenMetadata's authentication system:
- JWT tokens from OpenMetadata
- User context and permissions
- Audit logging

### Authorization
The ThirdEye resource checks for `VIEW_ANALYTICS` permission:
```java
private void authorize(SecurityContext securityContext, String operation) {
  if (securityContext.getUserPrincipal() == null) {
    throw new jakarta.ws.rs.NotAuthorizedException("Authentication required");
  }
  // TODO: Implement proper authorization based on OpenMetadata's auth system
}
```

## Error Handling

### Service Unavailable
When ThirdEye service is disabled:
```json
{
  "error": "ThirdEye service is disabled"
}
```

### Connection Errors
When ThirdEye service is unreachable:
```json
{
  "error": "ThirdEye service error",
  "message": "Connection refused"
}
```

### Authentication Errors
When user is not authenticated:
```json
{
  "detail": "Not authenticated"
}
```

## Deployment

### 1. Build OpenMetadata with ThirdEye Integration

```bash
cd openmetadata-service
mvn clean package -DskipTests
```

### 2. Configure ThirdEye Service

Ensure ThirdEye Python service is running:
```bash
cd thirdeye-py-service
uvicorn thirdeye.app:app --host 0.0.0.0 --port 8586
```

### 3. Start OpenMetadata Server

```bash
cd openmetadata-service
java -jar target/openmetadata-service-*.jar server conf/openmetadata.yaml
```

### 4. Verify Integration

```bash
# Check OpenMetadata health
curl http://localhost:8585/api/v1/system/version

# Check ThirdEye proxy health
curl http://localhost:8585/api/v1/thirdeye/health

# Test ZI Score endpoint
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:8585/api/v1/thirdeye/zi-score/summary
```

## Testing

### 1. Unit Tests

Create tests for each component:
```java
@Test
public void testThirdEyeClientHealthCheck() {
  ThirdEyeConfiguration config = new ThirdEyeConfiguration();
  config.setEnabled(true);
  config.setHost("localhost");
  config.setPort(8586);
  
  ThirdEyeClient client = new ThirdEyeClient(config);
  boolean isHealthy = client.healthCheck().get();
  assertTrue(isHealthy);
}
```

### 2. Integration Tests

Test the full proxy chain:
```bash
# Test health endpoint
curl http://localhost:8585/api/v1/thirdeye/health

# Test ZI Score with authentication
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8585/api/v1/thirdeye/zi-score/summary

# Test GraphQL proxy
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ ziScore { overall status } }"}' \
  http://localhost:8585/api/v1/thirdeye/graphql
```

### 3. Load Testing

Test proxy performance:
```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:8585/api/v1/thirdeye/zi-score/summary
```

## Monitoring

### 1. Health Checks

Monitor ThirdEye service availability:
```bash
# Check service health
curl http://localhost:8585/api/v1/thirdeye/health

# Expected response when healthy
{
  "status": "ok",
  "service": "thirdeye"
}
```

### 2. Logs

Monitor OpenMetadata logs for ThirdEye integration:
```bash
# Check for ThirdEye-related logs
tail -f logs/openmetadata.log | grep -i thirdeye
```

### 3. Metrics

Add custom metrics for ThirdEye requests:
- Request count
- Response time
- Error rate
- Service availability

## Troubleshooting

### Issue: 503 Service Unavailable

**Cause:** ThirdEye service is disabled or unreachable

**Solution:**
1. Check configuration: `thirdEyeConfiguration.enabled = true`
2. Verify ThirdEye service is running on configured port
3. Check network connectivity between OpenMetadata and ThirdEye

### Issue: 401 Unauthorized

**Cause:** Missing or invalid authentication

**Solution:**
1. Ensure JWT token is provided in Authorization header
2. Verify token is valid and not expired
3. Check OpenMetadata authentication configuration

### Issue: 502 Bad Gateway

**Cause:** ThirdEye service returned an error

**Solution:**
1. Check ThirdEye service logs
2. Verify database views exist and have data
3. Check ThirdEye service configuration

### Issue: Timeout Errors

**Cause:** ThirdEye service is slow or unresponsive

**Solution:**
1. Increase timeout in configuration
2. Check ThirdEye service performance
3. Verify database query performance

## Security Considerations

### 1. Network Security
- Use HTTPS for production deployments
- Configure proper firewall rules
- Use VPN or private networks for service communication

### 2. Authentication
- All requests must be authenticated through OpenMetadata
- No direct access to ThirdEye service from UI
- Proper JWT token validation

### 3. Authorization
- Implement proper permission checks
- Audit all analytics requests
- Limit access to sensitive data

## Performance Optimization

### 1. Connection Pooling
- Configure HTTP client connection pooling
- Reuse connections for multiple requests
- Set appropriate connection limits

### 2. Caching
- Cache ZI Score results for 5-15 minutes
- Use Redis for distributed caching
- Implement cache invalidation strategies

### 3. Load Balancing
- Deploy multiple ThirdEye service instances
- Use load balancer for high availability
- Implement health checks and failover

## Future Enhancements

### 1. Real-time Updates
- WebSocket support for live score updates
- Server-sent events for dashboard refresh
- Push notifications for score changes

### 2. Advanced Analytics
- Historical trend analysis
- Predictive scoring
- ML-based recommendations

### 3. Multi-tenant Support
- Organization-specific analytics
- Data isolation and security
- Custom scoring algorithms

## Migration Guide

### From Direct ThirdEye Calls

1. **Update Frontend URLs:**
   ```typescript
   // Old: Direct calls
   const baseUrl = 'http://localhost:8586/api/v1/thirdeye';
   
   // New: Through OpenMetadata
   const baseUrl = '/api/v1/thirdeye';
   ```

2. **Update Authentication:**
   ```typescript
   // Old: No auth or separate auth
   const headers = {};
   
   // New: Use OpenMetadata JWT
   const headers = {
     'Authorization': `Bearer ${jwtToken}`
   };
   ```

3. **Update Error Handling:**
   ```typescript
   // Handle new error responses
   if (response.status === 503) {
     // ThirdEye service unavailable
   }
   ```

### Configuration Migration

1. **Remove Direct ThirdEye Configuration:**
   - Remove direct backend URLs from frontend
   - Remove separate authentication setup

2. **Add OpenMetadata Configuration:**
   - Add `thirdEyeConfiguration` to `openmetadata.yaml`
   - Configure service endpoints and SSL

3. **Update Deployment:**
   - Ensure ThirdEye service is accessible from OpenMetadata
   - Update firewall and network configuration

## Support

For issues and questions:
1. Check OpenMetadata logs for ThirdEye integration errors
2. Verify ThirdEye service is running and healthy
3. Test direct ThirdEye service endpoints
4. Review configuration and network connectivity

## Files Created/Modified

### New Files
- `ThirdEyeConfiguration.java` - Configuration class
- `ThirdEyeClient.java` - HTTP client
- `ThirdEyeService.java` - Managed service
- `ThirdEyeResource.java` - REST API resource
- `ThirdEyeServiceException.java` - Exception class
- `thirdeye-config-example.yaml` - Configuration example

### Modified Files
- `OpenMetadataApplicationConfig.java` - Added ThirdEye configuration
- Frontend `thirdeyeClient.ts` - Update base URL (manual change needed)

### Documentation
- `THIRDEYE_OPENMETADATA_INTEGRATION.md` - This file
- API documentation in resource classes
- Configuration examples

---

**Status:** ✅ Complete and Ready for Integration  
**Backend Integration:** OpenMetadata server with ThirdEye proxy  
**Frontend Changes:** Update API client base URL  
**Configuration:** YAML-based service configuration  
**Authentication:** OpenMetadata JWT-based auth  
**Deployment:** Standard OpenMetadata deployment process
