# MCP Configuration Guide

## Overview

MCP (Model Context Protocol) server in OpenMetadata can be configured to handle different load scenarios. This guide explains how to configure connection limits, rate limiting, and resource protection.

## Configuration Levels

MCP configuration can be set at three levels (in order of precedence):

1. **Environment Variables** (highest priority)
2. **Application Configuration** (via UI or API)
3. **Default Values** (built-in)

## Application Configuration

Edit the MCP application configuration in the OpenMetadata UI under **Apps > MCP Server**:

```json
{
  "originValidationEnabled": false,
  "originHeaderUri": "http://localhost",
  "connectionLimits": {
    "maxConnections": 100,
    "maxUserConnections": 10,
    "maxOrgConnections": 30,
    "connectionsPerSecond": 10.0,
    "enableCircuitBreaker": true
  },
  "threadPoolConfig": {
    "sseThreadPoolSize": 10,
    "streamableThreadPoolSize": 10,
    "useVirtualThreads": true
  }
}
```

## Environment Variable Overrides

Environment variables always take precedence over application configuration:

```bash
# Connection limits
export MCP_MAX_CONNECTIONS=250
export MCP_MAX_USER_CONNECTIONS=20
export MCP_MAX_ORG_CONNECTIONS=75
export MCP_CONNECTIONS_PER_SECOND=25.0
export MCP_ENABLE_CIRCUIT_BREAKER=true

# Thread pool settings (if supported)
export MCP_SSE_THREAD_POOL_SIZE=20
export MCP_STREAMABLE_THREAD_POOL_SIZE=20
export MCP_USE_VIRTUAL_THREADS=true
```

## Configuration Profiles

### 1. Default Profile (Most Deployments)

Suitable for standard deployments with moderate MCP usage:

```json
{
  "connectionLimits": {
    "maxConnections": 100,
    "maxUserConnections": 10,
    "maxOrgConnections": 30,
    "connectionsPerSecond": 10.0,
    "enableCircuitBreaker": true
  }
}
```

### 2. High Capacity Profile (Heavy MCP Usage)

For deployments like Scout24 with extensive MCP usage:

```json
{
  "connectionLimits": {
    "maxConnections": 250,
    "maxUserConnections": 20,
    "maxOrgConnections": 75,
    "connectionsPerSecond": 25.0,
    "enableCircuitBreaker": true
  },
  "threadPoolConfig": {
    "sseThreadPoolSize": 20,
    "streamableThreadPoolSize": 20,
    "useVirtualThreads": true
  }
}
```

Also increase JVM thread pool settings:
```bash
export SERVER_MAX_THREADS=200
export SERVER_MIN_THREADS=50
```

### 3. Conservative Profile (Resource Constrained)

For environments with limited resources:

```json
{
  "connectionLimits": {
    "maxConnections": 50,
    "maxUserConnections": 5,
    "maxOrgConnections": 15,
    "connectionsPerSecond": 5.0,
    "enableCircuitBreaker": true
  },
  "threadPoolConfig": {
    "sseThreadPoolSize": 5,
    "streamableThreadPoolSize": 5,
    "useVirtualThreads": false
  }
}
```

### 4. Development Profile

For local development with relaxed limits:

```json
{
  "connectionLimits": {
    "maxConnections": 20,
    "maxUserConnections": 10,
    "maxOrgConnections": 20,
    "connectionsPerSecond": 100.0,
    "enableCircuitBreaker": false
  }
}
```

## Protection Mechanisms

### 1. Connection Limits
- **Global limit**: Total concurrent MCP connections
- **Per-user limit**: Maximum connections per individual user
- **Per-org limit**: Maximum connections per organization

### 2. Rate Limiting
- **Global rate**: New connections per second
- **Per-user rate**: 10 connections per minute per user (fixed)

### 3. Circuit Breaker
When enabled, automatically blocks new connections after 10 consecutive failures for 30 seconds.

### 4. Thread Pool Protection
- Separate thread pools for SSE and streamable endpoints
- Virtual threads (Java 21+) for better scalability

## Monitoring

Monitor these metrics to tune configuration:

- `mcp.connections.active` - Current active connections
- `mcp.connections.per.user.max` - Maximum per-user connections
- `mcp.connections.failed` - Failed connection attempts
- `mcp.thread.pool.exhausted` - Thread pool exhaustion events

## Troubleshooting

### Symptoms of Under-Configuration

1. **Connection Rejected Errors**
   - Increase `maxConnections`
   - Check per-user/org limits

2. **Thread Pool Exhaustion**
   - Increase thread pool sizes
   - Enable virtual threads

3. **Slow Response Times**
   - Check rate limiting settings
   - Monitor thread pool saturation

### Recommended Actions for High Load

1. Switch from SSE to streamable endpoint for heavy users
2. Enable virtual threads (Java 21+)
3. Increase JVM thread pool settings
4. Consider horizontal scaling with multiple instances

## Example: Scout24 Configuration

For a deployment with heavy MCP usage like Scout24:

```bash
# Application config (via UI)
# Set to High Capacity Profile values

# Additional JVM settings
export SERVER_MAX_THREADS=250
export SERVER_MIN_THREADS=75
export SERVER_REQUEST_QUEUE=2048

# Monitor and adjust based on metrics
```

## Best Practices

1. **Start Conservative**: Begin with default settings and increase based on monitoring
2. **Monitor Actively**: Watch connection metrics and thread pool utilization
3. **Use Circuit Breaker**: Keep it enabled for production
4. **Virtual Threads**: Enable for Java 21+ for better scalability
5. **User Education**: Guide heavy users to streamable endpoint vs SSE