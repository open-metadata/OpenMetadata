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
import java.time.Duration;
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

  @JsonProperty private long connectionTimeout = Duration.ofSeconds(30).toMillis();

  @JsonProperty private long idleTimeout = Duration.ofMinutes(10).toMillis();

  @JsonProperty private long maxLifetime = Duration.ofMinutes(30).toMillis();

  @JsonProperty private long keepaliveTime = Duration.ofMinutes(5).toMillis();

  @JsonProperty private long validationTimeout = Duration.ofSeconds(5).toMillis();

  @JsonProperty private long leakDetectionThreshold = 0;

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
    HikariConfig config = buildHikariConfig();

    if (metricRegistry != null) {
      config.setMetricRegistry(metricRegistry);
    }

    ManagedHikariDataSource managedDataSource = new ManagedHikariDataSource(config, name);
    this.hikariDataSource = managedDataSource;
    return managedDataSource;
  }

  private HikariConfig buildHikariConfig() {
    HikariConfig config = new HikariConfig();

    config.setJdbcUrl(getUrl());
    config.setDriverClassName(getDriverClass());

    if (getUser() != null) {
      config.setUsername(getUser());
    }

    if (getPassword() != null) {
      config.setPassword(getPassword());
    }

    config.setPoolName(poolName);
    config.setMinimumIdle(minimumIdle);
    config.setMaximumPoolSize(getMaxSize());
    config.setConnectionTimeout(connectionTimeout);
    config.setIdleTimeout(idleTimeout);
    config.setMaxLifetime(maxLifetime);
    config.setKeepaliveTime(keepaliveTime);
    config.setValidationTimeout(validationTimeout);
    config.setLeakDetectionThreshold(leakDetectionThreshold);
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

    Map<String, String> properties = getProperties();
    if (properties != null && properties.containsKey("reWriteBatchedInserts")) {
      props.put("reWriteBatchedInserts", properties.get("reWriteBatchedInserts"));
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
