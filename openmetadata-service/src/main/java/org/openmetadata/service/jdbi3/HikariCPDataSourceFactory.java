/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.jdbi3;

import com.codahale.metrics.MetricRegistry;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.db.ManagedDataSource;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Map;
import java.util.Properties;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.auth.DatabaseAuthStrategy;

@Slf4j
@Getter
@Setter
public class HikariCPDataSourceFactory extends DataSourceFactory {

  @JsonProperty
  @Min(1)
  private int minimumIdle = 10;

  @JsonProperty
  @Max(500)
  private int maximumPoolSize = 100;

  @JsonProperty private Long connectionTimeout;

  @JsonProperty private Long idleTimeout;

  @JsonProperty private Long maxLifetime;

  @JsonProperty private Long keepaliveTime;

  @JsonProperty private Long validationTimeout;

  @JsonProperty private Long leakDetectionThreshold;

  @JsonProperty private boolean autoCommit = true;

  @JsonProperty private boolean cachePrepStmts = true;

  @JsonProperty private int prepStmtCacheSize = 250;

  @JsonProperty private int prepStmtCacheSqlLimit = 2048;

  @JsonProperty private boolean useServerPrepStmts = true;

  @JsonProperty private boolean allowPoolSuspension = false;

  @JsonProperty private boolean readOnly = false;

  @JsonProperty private boolean registerMbeans = false;

  @JsonProperty private String poolName = "openmetadata-hikari-pool";

  // Path to a file holding the DB password. When set, the password is read from this file and
  // re-read per connection, so an externally-rotated credential is picked up without a restart.
  @JsonProperty private String dbPasswordFile;

  @JsonIgnore private HikariDataSource hikariDataSource;

  @Override
  public ManagedDataSource build(MetricRegistry metricRegistry, String name) {
    HikariConfig config = buildHikariConfig(name);

    if (metricRegistry != null) {
      config.setMetricRegistry(metricRegistry);
    }

    try {
      config.setMetricsTrackerFactory(
          new com.zaxxer.hikari.metrics.micrometer.MicrometerMetricsTrackerFactory(
              io.micrometer.core.instrument.Metrics.globalRegistry));
    } catch (Exception e) {
      LOG.debug("Could not set Micrometer metrics tracker: {}", e.getMessage());
    }

    LOG.debug(
        "Creating standard ManagedHikariDataSource (custom DataSource handling done in config)");
    ManagedHikariDataSource managedDataSource = new ManagedHikariDataSource(config, name);
    this.hikariDataSource = managedDataSource;
    return managedDataSource;
  }

  private HikariConfig buildHikariConfig() {
    return buildHikariConfig(poolName);
  }

  private HikariConfig buildHikariConfig(String poolNameToUse) {
    HikariConfig config = new HikariConfig();

    config.setJdbcUrl(getUrl());
    config.setDriverClassName(getDriverClass());

    config.setPoolName(poolNameToUse);
    config.setMinimumIdle(minimumIdle);
    config.setMaximumPoolSize(getMaxSize());

    // Read timeout configurations from either direct fields or properties
    Map<String, String> properties = getProperties();

    // Connection timeout - default 30 seconds
    Long connTimeout = connectionTimeout;
    if (connTimeout == null && properties != null && properties.containsKey("connectionTimeout")) {
      connTimeout = Long.parseLong(properties.get("connectionTimeout"));
    }
    config.setConnectionTimeout(connTimeout != null ? connTimeout : 30000L);

    // Idle timeout - default 10 minutes
    Long idleTime = idleTimeout;
    if (idleTime == null && properties != null && properties.containsKey("idleTimeout")) {
      idleTime = Long.parseLong(properties.get("idleTimeout"));
    }
    config.setIdleTimeout(idleTime != null ? idleTime : 600000L);

    // Max lifetime - default 30 minutes
    Long maxLife = maxLifetime;
    if (maxLife == null && properties != null && properties.containsKey("maxLifetime")) {
      maxLife = Long.parseLong(properties.get("maxLifetime"));
    }
    config.setMaxLifetime(maxLife != null ? maxLife : 1800000L);

    // Keepalive time - default 0 (disabled)
    Long keepAlive = keepaliveTime;
    if (keepAlive == null && properties != null && properties.containsKey("keepaliveTime")) {
      keepAlive = Long.parseLong(properties.get("keepaliveTime"));
    }
    config.setKeepaliveTime(keepAlive != null ? keepAlive : 0L);

    // Validation timeout - default 5 seconds
    Long validTimeout = validationTimeout;
    if (validTimeout == null && properties != null && properties.containsKey("validationTimeout")) {
      validTimeout = Long.parseLong(properties.get("validationTimeout"));
    }
    config.setValidationTimeout(validTimeout != null ? validTimeout : 5000L);

    Long leakThreshold = leakDetectionThreshold;
    if (leakThreshold == null
        && properties != null
        && properties.containsKey("leakDetectionThreshold")) {
      leakThreshold = Long.parseLong(properties.get("leakDetectionThreshold"));
    }
    // Default leakDetectionThreshold to 60s (HikariCP's own default is 0 = disabled).
    // On a busy server a leaked connection silently drains the pool until requests
    // start queuing and k8s liveness probes fail; with this on, HikariCP logs a stack
    // trace for any borrow that exceeds the threshold so the offending caller is
    // identifiable. Operators that need a different threshold can override via
    // `leakDetectionThreshold` in openmetadata.yaml.
    config.setLeakDetectionThreshold(leakThreshold != null ? leakThreshold : 60000L);

    config.setAutoCommit(autoCommit);
    config.setReadOnly(readOnly);
    config.setRegisterMbeans(registerMbeans);
    config.setAllowPoolSuspension(allowPoolSuspension);

    getValidationQuery()
        .ifPresent(
            query -> {
              if (!query.isEmpty()) {
                config.setConnectionTestQuery(query);
              }
            });

    // Build data source properties first (needed for both standard and IAM auth)
    Properties dataSourceProperties = new Properties();
    if (getProperties() != null) {
      dataSourceProperties.putAll(getProperties());
    }

    if (cachePrepStmts) {
      dataSourceProperties.putIfAbsent("cachePrepStmts", "true");
      dataSourceProperties.putIfAbsent("prepStmtCacheSize", String.valueOf(prepStmtCacheSize));
      dataSourceProperties.putIfAbsent(
          "prepStmtCacheSqlLimit", String.valueOf(prepStmtCacheSqlLimit));
    }

    // Apply database-specific configurations
    String driverClassName = getDriverClass();
    if (driverClassName != null) {
      if (driverClassName.contains("postgresql")) {
        configurePostgreSQLProperties(dataSourceProperties);
      } else if (driverClassName.contains("mysql") || driverClassName.contains("mariadb")) {
        configureMySQLProperties(dataSourceProperties);
      }
    }

    DatabaseAuthStrategy.Context authContext =
        new DatabaseAuthStrategy.Context(getUrl(), getUser(), getPassword(), dbPasswordFile);
    DatabaseAuthStrategy.select(authContext).apply(config, dataSourceProperties, authContext);

    return config;
  }

  private void configurePostgreSQLProperties(Properties props) {
    props.putIfAbsent("reWriteBatchedInserts", "true");
    props.putIfAbsent("prepareThreshold", "0");
    props.putIfAbsent("preparedStatementCacheQueries", "256");
    props.putIfAbsent("preparedStatementCacheSizeMiB", "5");
    props.putIfAbsent("defaultRowFetchSize", "100");
    props.putIfAbsent("loginTimeout", "30");
    props.putIfAbsent("connectTimeout", "30");
    // Default socketTimeout from "0" (infinite — a stuck DB read held the
    // connection forever, exhausted the pool, and stalled k8s liveness probes)
    // to 5 minutes. Real OpenMetadata queries should never run that long; jobs
    // that legitimately need a longer cap (bulk imports, reindex) should run
    // with their own pool config.
    props.putIfAbsent("socketTimeout", "300");
    props.putIfAbsent("tcpKeepAlive", "true");
    props.putIfAbsent("ApplicationName", "OpenMetadata");

    // Aurora-specific optimizations
    props.putIfAbsent("loadBalanceHosts", "false");
    props.putIfAbsent("hostRecheckSeconds", "10");
    props.putIfAbsent("targetServerType", "primary");

    Map<String, String> properties = getProperties();
    if (properties != null) {
      // Override with any custom properties from configuration
      if (properties.containsKey("reWriteBatchedInserts")) {
        props.put("reWriteBatchedInserts", properties.get("reWriteBatchedInserts"));
      }
      if (properties.containsKey("loginTimeout")) {
        props.put("loginTimeout", properties.get("loginTimeout"));
      }
      if (properties.containsKey("loadBalanceHosts")) {
        props.put("loadBalanceHosts", properties.get("loadBalanceHosts"));
      }
      if (properties.containsKey("hostRecheckSeconds")) {
        props.put("hostRecheckSeconds", properties.get("hostRecheckSeconds"));
      }
      if (properties.containsKey("targetServerType")) {
        props.put("targetServerType", properties.get("targetServerType"));
      }
      if (properties.containsKey("postgresqlConnectTimeout")) {
        props.put("connectTimeout", properties.get("postgresqlConnectTimeout"));
        props.remove("postgresqlConnectTimeout");
      }
      if (properties.containsKey("postgresqlSocketTimeout")) {
        props.put("socketTimeout", properties.get("postgresqlSocketTimeout"));
        props.remove("postgresqlSocketTimeout");
      }
    }
  }

  private void configureMySQLProperties(Properties props) {
    props.putIfAbsent("cachePrepStmts", "true");
    props.putIfAbsent("prepStmtCacheSize", "250");
    props.putIfAbsent("prepStmtCacheSqlLimit", "2048");
    props.putIfAbsent("useServerPrepStmts", String.valueOf(useServerPrepStmts));
    props.putIfAbsent("rewriteBatchedStatements", "true");
    props.putIfAbsent("useLocalSessionState", "true");
    props.putIfAbsent("useLocalTransactionState", "true");
    props.putIfAbsent("maintainTimeStats", "false");
    props.putIfAbsent("elideSetAutoCommits", "true");
    props.putIfAbsent("cacheResultSetMetadata", "true");
    props.putIfAbsent("cacheServerConfiguration", "true");
    props.putIfAbsent("zeroDateTimeBehavior", "CONVERT_TO_NULL");
    props.putIfAbsent("characterEncoding", "UTF-8");
    props.putIfAbsent("useUnicode", "true");
    props.putIfAbsent("connectionCollation", "utf8mb4_unicode_ci");
    // MySQL connectTimeout is in milliseconds
    props.putIfAbsent("connectTimeout", "30000");
    // Default socketTimeout from "0" (infinite — see PostgreSQL note above) to
    // 5 minutes (in milliseconds for MySQL).
    props.putIfAbsent("socketTimeout", "300000");

    Map<String, String> properties = getProperties();
    if (properties != null) {
      if (properties.containsKey("rewriteBatchedStatements")) {
        props.put("rewriteBatchedStatements", properties.get("rewriteBatchedStatements"));
      }
      if (properties.containsKey("mysqlConnectTimeout")) {
        props.put("connectTimeout", properties.get("mysqlConnectTimeout"));
        props.remove("mysqlConnectTimeout");
      }
      if (properties.containsKey("mysqlSocketTimeout")) {
        props.put("socketTimeout", properties.get("mysqlSocketTimeout"));
        props.remove("mysqlSocketTimeout");
      }
    }
  }

  private static class ManagedHikariDataSource extends HikariDataSource
      implements ManagedDataSource {
    private final String name;

    public ManagedHikariDataSource(HikariConfig config, String name) {
      super(config);
      this.name = name;
    }

    @Override
    public void start() {
      LOG.info("Starting HikariCP connection pool: {}", name);
    }

    @Override
    public void stop() {
      LOG.info("Shutting down HikariCP connection pool: {}", name);
      if (!this.isClosed()) {
        this.close();
      }
    }
  }
}
