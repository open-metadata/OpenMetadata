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

@Slf4j
@Getter
@Setter
public class HikariCPDataSourceFactory extends DataSourceFactory {

  @JsonProperty
  @Min(1)
  private int minimumIdle = 10;

  @JsonProperty
  @Max(100)
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

  @JsonIgnore private HikariDataSource hikariDataSource;

  @Override
  public ManagedDataSource build(MetricRegistry metricRegistry, String name) {
    HikariConfig config = buildHikariConfig(name);

    if (metricRegistry != null) {
      config.setMetricRegistry(metricRegistry);
    }

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

    if (getUser() != null) {
      config.setUsername(getUser());
    }

    if (getPassword() != null) {
      config.setPassword(getPassword());
    }

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

    // Leak detection threshold - default 0 (disabled)
    Long leakThreshold = leakDetectionThreshold;
    if (leakThreshold == null
        && properties != null
        && properties.containsKey("leakDetectionThreshold")) {
      leakThreshold = Long.parseLong(properties.get("leakDetectionThreshold"));
    }
    config.setLeakDetectionThreshold(leakThreshold != null ? leakThreshold : 0L);

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

    String driverClassName = getDriverClass();
    if (driverClassName != null) {
      if (driverClassName.contains("postgresql")) {
        configurePostgreSQL(config);
      } else if (driverClassName.contains("mysql") || driverClassName.contains("mariadb")) {
        configureMySQL(config);
      }
    }

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

    if (!dataSourceProperties.isEmpty()) {
      config.setDataSourceProperties(dataSourceProperties);
    }

    return config;
  }

  private void configurePostgreSQL(HikariConfig config) {
    Properties props = config.getDataSourceProperties();

    props.putIfAbsent("reWriteBatchedInserts", "true");
    props.putIfAbsent("prepareThreshold", "0");
    props.putIfAbsent("preparedStatementCacheQueries", "256");
    props.putIfAbsent("preparedStatementCacheSizeMiB", "5");
    props.putIfAbsent("defaultRowFetchSize", "100");
    props.putIfAbsent("loginTimeout", "30");
    props.putIfAbsent("connectTimeout", "30");
    props.putIfAbsent("socketTimeout", "0");
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
    }
  }

  private void configureMySQL(HikariConfig config) {
    Properties props = config.getDataSourceProperties();

    props.putIfAbsent("cachePrepStmts", "true");
    props.putIfAbsent("prepStmtCacheSize", "250");
    props.putIfAbsent("prepStmtCacheSqlLimit", "2048");
    props.putIfAbsent("useServerPrepStmts", String.valueOf(useServerPrepStmts));
    props.putIfAbsent("rewriteBatchedStatements", "true");
    props.putIfAbsent("useSSL", "false");
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
    props.putIfAbsent("socketTimeout", "0");

    Map<String, String> properties = getProperties();
    if (properties != null && properties.containsKey("rewriteBatchedStatements")) {
      props.put("rewriteBatchedStatements", properties.get("rewriteBatchedStatements"));
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
    public void start() throws Exception {
      LOG.info("Starting HikariCP connection pool: {}", name);
    }

    @Override
    public void stop() throws Exception {
      LOG.info("Shutting down HikariCP connection pool: {}", name);
      if (!this.isClosed()) {
        this.close();
      }
    }
  }
}
