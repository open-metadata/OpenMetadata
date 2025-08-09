---
title: Database Connection Pooling
description: Optimize your OpenMetadata deployment with database connection pooling. Learn configuration best practices, performance tuning, and setup guides.
slug: /deployment/database-connection-pooling
collate: false
---

# Database Connection Pool

Dropwizard JDBI provides connection pooling by default. Enabling and properly configuring connection pooling ensures that each database query does not open a new connection but instead utilizes a pool of reusable connections. This enhances application performance, reduces latency, and efficiently manages database resources.

Database connection pooling is a technique used to maintain a cache of database connections that can be reused for future requests. This approach minimizes the overhead associated with establishing a new connection for each request, leading to improved performance and resource utilization.

In the context of Dropwizard JDBI, enabling and configuring connection pooling ensures that your application can handle multiple database operations efficiently, especially under high load conditions.

- [Why Use a Database Connection Pool?](#why-use-a-database-connection-pool)
- [Configuration Parameters](#configuration-parameters)
  - [maxSize](#maxsize)
  - [minSize](#minsize)
  - [initialSize](#initialsize)
  - [checkConnectionWhileIdle](#checkconnectionwhileidle)
  - [checkConnectionOnBorrow](#checkconnectiononborrow)
  - [evictionInterval](#evictioninterval)
  - [minIdleTime](#minidletime)
- [Best Practices](#best-practices-for-database-connection-pooling)

## Why Use a Database Connection Pool?

- **Performance Improvement**: Reusing existing connections reduces the time required to establish new connections, leading to faster query execution.
- **Resource Optimization**: Limits the number of open connections to the database, preventing resource exhaustion.
- **Scalability**: Efficiently handles increasing numbers of database requests by managing connections effectively.
- **Stability**: Reduces the risk of connection timeouts and failures by maintaining a pool of healthy connections.

## Configuration Parameters

The following configuration parameters control the behavior of the database connection pool in Dropwizard JDBI:

### maxSize

- **Description**: Specifies the maximum number of connections that can be active in the pool at any given time.
- **Environment Variable**: `DB_CONNECTION_POOL_MAX_SIZE`
- **Default Value**: `50`
- **Usage**:
  - Determines the upper limit of concurrent database connections.
  - Should be set based on the expected workload and database server capabilities.
  - Setting this value too high may overwhelm the database server; too low may lead to connection shortages under high load.

### minSize

- **Description**: Defines the minimum number of idle connections that the pool tries to maintain.
- **Environment Variable**: `DB_CONNECTION_POOL_MIN_SIZE`
- **Default Value**: `10`
- **Usage**:
  - Ensures that a certain number of connections are always ready to serve incoming requests.
  - Helps in reducing latency for initial requests after periods of inactivity.
  - Should be set considering the baseline load and resource availability.

### initialSize

- **Description**: Sets the number of connections created when the pool is initialized.
- **Environment Variable**: `DB_CONNECTION_POOL_INITIAL_SIZE`
- **Default Value**: `10`
- **Usage**:
  - Determines how many connections are available immediately after startup.
  - A higher value can reduce initial request latency but increases startup time and resource usage.
  - Typically aligned with `minSize` for consistency.

### checkConnectionWhileIdle

- **Description**: Indicates whether idle connections should be validated periodically to ensure they are still alive.
- **Environment Variable**: `DB_CONNECTION_CHECK_CONNECTION_WHILE_IDLE`
- **Default Value**: `true`
- **Usage**:
  - Helps in detecting and removing stale or broken connections from the pool.
  - Maintains the health of the connection pool over time.
  - Slightly increases overhead due to periodic checks but improves reliability.

### checkConnectionOnBorrow

- **Description**: Determines whether a connection should be validated before being handed over to a client.
- **Environment Variable**: `DB_CONNECTION_CHECK_CONNECTION_ON_BORROW`
- **Default Value**: `true`
- **Usage**:
  - Ensures that clients receive only valid and live connections.
  - Prevents runtime errors caused by broken connections.
  - May introduce minimal latency due to the validation process.

### evictionInterval

- **Description**: Specifies the interval at which idle connections are checked and evicted if necessary.
- **Environment Variable**: `DB_CONNECTION_EVICTION_INTERVAL`
- **Default Value**: `5 minutes`
- **Usage**:
  - Controls how frequently the pool checks for idle connections to remove.
  - Works in conjunction with `minIdleTime` to maintain optimal pool size.
  - A shorter interval leads to more frequent checks, potentially freeing up resources sooner but increasing overhead.

### minIdleTime

- **Description**: Defines the minimum amount of time a connection can remain idle before it is eligible for eviction.
- **Environment Variable**: `DB_CONNECTION_MIN_IDLE_TIME`
- **Default Value**: `1 minute`
- **Usage**:
  - Determines how long idle connections are retained in the pool.
  - Helps in balancing resource usage by removing unnecessary idle connections.
  - Should be set based on typical usage patterns to ensure connections are available when needed without consuming excessive resources.

```yaml
maxSize: ${DB_CONNECTION_POOL_MAX_SIZE:-50}
minSize: ${DB_CONNECTION_POOL_MIN_SIZE:-10}
initialSize: ${DB_CONNECTION_POOL_INITIAL_SIZE:-10}
checkConnectionWhileIdle: ${DB_CONNECTION_CHECK_CONNECTION_WHILE_IDLE:-true}
checkConnectionOnBorrow: ${DB_CONNECTION_CHECK_CONNECTION_ON_BORROW:-true}
evictionInterval: ${DB_CONNECTION_EVICTION_INTERVAL:-5 minutes}
minIdleTime: ${DB_CONNECTION_MIN_IDLE_TIME:-1 minute}
```

# Best Practices for Database Connection Pooling

To ensure that your database connection pooling is optimized for performance, reliability, and resource management, consider the following best practices:

## 1. Monitor and Adjust

- **Regular Monitoring**: Continuously monitor your application’s performance and database load to understand how your connection pool is performing.
- **Adjust Pool Sizes**: Based on monitoring data, adjust the pool size parameters (`maxSize`, `minSize`, `initialSize`) to match your workload needs. This helps in avoiding resource bottlenecks or wastage.

## 2. Understand Workload Patterns

- **Peak vs. Off-Peak**: Identify peak and off-peak usage times in your application. Configure your pool to handle peak loads effectively while conserving resources during off-peak times.
- **Dynamic Scaling**: Consider implementing dynamic scaling of the connection pool size if your environment supports it. This allows the pool to grow and shrink in response to actual demand.

## 3. Ensure Database Capacity

- **Max Connections**: Verify that your database server can support the maximum number of connections specified by `maxSize`. Exceeding the database’s capacity can lead to connection failures and degraded performance.
- **Avoid Over-Configuration**: Setting `maxSize` too high can overwhelm your database, while setting it too low can result in connection shortages under high load. Balance is key.

## 4. Use Validation Checks

- **Enable `checkConnectionWhileIdle`**: This ensures that idle connections are periodically validated, preventing broken connections from remaining in the pool. It improves the reliability of the connection pool.
- **Enable `checkConnectionOnBorrow`**: Validate connections before handing them over to the application. This reduces the risk of runtime errors due to stale or broken connections.

## 5. Configure Timeouts Appropriately

- **Eviction Interval**: Set `evictionInterval` to an appropriate value that balances the frequency of idle connection checks with the overhead of performing these checks.
- **Idle Time**: Adjust `minIdleTime` based on typical usage patterns. This ensures that connections are retained for as long as they are likely to be needed, without wasting resources on keeping them idle for too long.

## 6. Consider Connection Pool Size Based on Application Behavior

- **Transactional Applications**: For applications with short, frequent transactions, a larger pool size might be necessary to handle the high concurrency.
- **Long-Lived Connections**: If your application tends to hold connections open for extended periods, ensure that your pool is large enough to accommodate other incoming requests without running out of connections.

## 7. Review and Test Configuration Changes

- **Staging Environment Testing**: Before deploying changes to production, test any configuration changes in a staging environment that closely mirrors production. This helps to catch potential issues early.
- **Review Logs and Metrics**: After making changes, review your application logs and database metrics to ensure that the new configuration is performing as expected.

## 8. Use Connection Pooling Libraries Effectively

- **Leverage Built-In Features**: Use features provided by your connection pooling library, such as connection leak detection, to ensure optimal usage of your pool.
- **Stay Updated**: Keep your connection pooling library up to date with the latest versions to benefit from performance improvements and security fixes.

By following these best practices, you can ensure that your database connection pool is configured for optimal performance, reliability, and resource efficiency, resulting in a more stable and responsive application.
