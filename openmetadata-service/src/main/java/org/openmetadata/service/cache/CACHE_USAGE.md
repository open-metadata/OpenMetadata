# OpenMetadata Cache Implementation

## Overview
Write-through cache implementation using Redis to optimize database performance during high load scenarios.

## Architecture
- **Write-through pattern**: All writes go to both database and cache
- **Strong consistency**: Cache is always consistent with database
- **Automatic population**: Cache populates naturally from usage patterns
- **Optional warmup**: Can pre-load cache for load testing

## Configuration

### Basic Setup (Production)
```yaml
cache:
  provider: redis
  redis:
    url: redis://localhost:6379
    keyspace: om:prod
  warmup:
    enabled: false  # Let cache populate naturally
```

### Load Testing Setup
```yaml
cache:
  provider: redis
  redis:
    url: redis://redis-cluster:6379
    cluster: true
    poolSize: 128
  warmup:
    enabled: false  # Keep false, trigger manually
    topNByUsage: 100000  # Load 100k entities
    maxQps: 500
    maxConcurrent: 32
```

## Load Testing Workflow

### 1. Start OpenMetadata with Redis
```bash
docker-compose up -d redis
./docker/run_local_docker.sh
```

### 2. Trigger Cache Warmup
```bash
# Manually trigger cache warmup to load all entities
curl -X POST http://localhost:8585/api/v1/system/cache/warmup \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Monitor Warmup Progress
```bash
# Check warmup statistics
curl http://localhost:8585/api/v1/system/cache/stats \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Run Load Tests
Once warmup completes, run your load tests. The cache will serve requests without hitting the database.

## Cache Keys Structure
- Entities: `om:env:e:entityType:uuid`
- Relationships: `om:env:rel:entityType:uuid:relType:direction`
- Tags: `om:env:tags:entityType:uuid`
- Column tags: `om:env:ctags:entityType:uuid:columnFqn`

## Performance Characteristics

### Without Cache (Database Only)
- Entity fetch: ~50-100ms
- Relationship queries: ~100-200ms
- High concurrency: Database connection pool exhaustion

### With Cold Cache
- First request: ~50-100ms (fetches from DB, populates cache)
- Subsequent requests: ~1-5ms (served from cache)

### With Warm Cache (Load Testing)
- All requests: ~1-5ms
- No database load
- Can handle 10,000+ QPS per Redis node

## Monitoring

### Redis Metrics
```bash
# Monitor Redis performance
redis-cli --stat

# Check memory usage
redis-cli INFO memory

# Monitor slow queries
redis-cli SLOWLOG get 10
```

### Application Metrics
- Cache hit rate: `/metrics` endpoint
- Warmup progress: `/api/v1/system/cache/stats`
- Health check: `/healthcheck` (includes cache status)

## Troubleshooting

### Cache Not Populating
1. Check Redis connectivity: `redis-cli ping`
2. Verify configuration: `cache.provider: redis`
3. Check logs for connection errors

### High Memory Usage
1. Reduce TTL values
2. Limit warmup size (`topNByUsage`)
3. Enable Redis eviction policy

### Slow Warmup
1. Increase `maxQps` and `maxConcurrent`
2. Use Redis cluster for parallel loading
3. Warm up only frequently accessed entities

## Best Practices

1. **Production**: Keep warmup disabled, let cache populate naturally
2. **Load Testing**: Use manual warmup endpoint before tests
3. **Monitoring**: Watch Redis memory and CPU usage
4. **TTL**: Set appropriate TTL based on data change frequency
5. **Cluster**: Use Redis cluster for high-traffic deployments