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
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Logger;
import javax.sql.DataSource;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.util.jdbi.AwsRdsDatabaseAuthenticationProvider;

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
  @JsonIgnore private boolean isAwsRdsIamAuth = false;
  @JsonIgnore private AwsRdsDatabaseAuthenticationProvider awsRdsAuthProvider;

  @Override
  public ManagedDataSource build(MetricRegistry metricRegistry, String name) {
    // Initialize AWS RDS IAM authentication if configured
    initializeAwsRdsIamAuth();

    HikariConfig config = buildHikariConfig(name);

    if (metricRegistry != null) {
      config.setMetricRegistry(metricRegistry);
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

    // Configure authentication
    if (isAwsRdsIamAuth) {
      // For AWS RDS IAM, use custom DataSource that generates fresh tokens per connection
      LOG.debug("Setting custom AwsRdsIamAwareDataSource for dynamic token generation");
      config.setDataSource(
          new AwsRdsIamAwareDataSource(
              getUrl(), getUser(), awsRdsAuthProvider, dataSourceProperties));
    } else {
      // For standard authentication, set username/password directly
      if (getUser() != null) {
        config.setUsername(getUser());
      }
      String password = getPassword();
      if (password != null) {
        config.setPassword(password);
      }
      if (!dataSourceProperties.isEmpty()) {
        config.setDataSourceProperties(dataSourceProperties);
      }
    }

    return config;
  }

  private void initializeAwsRdsIamAuth() {
    // AWS RDS IAM is detected when URL contains both required parameters:
    // - awsRegion: required for IAM token generation
    // - allowPublicKeyRetrieval: required for MySQL IAM auth
    // Note: A dummy password may still be configured per documentation
    String url = getUrl();
    boolean hasAwsRegion = url != null && url.contains("awsRegion");
    boolean hasAllowPublicKeyRetrieval = url != null && url.contains("allowPublicKeyRetrieval");

    this.isAwsRdsIamAuth = hasAwsRegion && hasAllowPublicKeyRetrieval;

    if (LOG.isDebugEnabled()) {
      LOG.debug(
          "IAM detection: hasAwsRegion={}, hasAllowPublicKeyRetrieval={}, isAwsRdsIamAuth={}",
          hasAwsRegion,
          hasAllowPublicKeyRetrieval,
          isAwsRdsIamAuth);
    }

    if (isAwsRdsIamAuth) {
      this.awsRdsAuthProvider = new AwsRdsDatabaseAuthenticationProvider();
      LOG.info("AWS RDS IAM authentication enabled - tokens will be generated per connection");
    }
  }

  private void configurePostgreSQLProperties(Properties props) {
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

  private static class AwsRdsIamAwareDataSource implements DataSource {
    private final String jdbcUrl;
    private final String username;
    private final AwsRdsDatabaseAuthenticationProvider authProvider;
    private final Properties connectionProperties;

    public AwsRdsIamAwareDataSource(
        String jdbcUrl,
        String username,
        AwsRdsDatabaseAuthenticationProvider authProvider,
        Properties connectionProperties) {
      this.jdbcUrl = jdbcUrl;
      this.username = username;
      this.authProvider = authProvider;
      this.connectionProperties =
          connectionProperties != null ? connectionProperties : new Properties();
    }

    @Override
    public Connection getConnection() throws SQLException {
      try {
        String freshToken = authProvider.authenticate(jdbcUrl, username, null);
        LOG.debug("Generated fresh AWS RDS IAM token for new connection");

        // Build connection properties with fresh token
        Properties props = new Properties();
        props.putAll(connectionProperties);
        props.setProperty("user", username);
        props.setProperty("password", freshToken);

        return DriverManager.getConnection(jdbcUrl, props);
      } catch (Exception e) {
        LOG.error("Failed to generate AWS RDS IAM token: {}", e.getMessage(), e);
        throw new SQLException("Failed to authenticate with AWS RDS IAM", e);
      }
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
      // Ignore provided credentials and use IAM token
      return getConnection();
    }

    // Required DataSource interface methods (minimal implementation)
    @Override
    public PrintWriter getLogWriter() throws SQLException {
      return null;
    }

    @Override
    public void setLogWriter(PrintWriter out) throws SQLException {}

    @Override
    public int getLoginTimeout() throws SQLException {
      return 0;
    }

    @Override
    public void setLoginTimeout(int seconds) throws SQLException {}

    @Override
    public Logger getParentLogger() throws SQLFeatureNotSupportedException {
      throw new SQLFeatureNotSupportedException();
    }

    @Override
    public <T> T unwrap(Class<T> iface) throws SQLException {
      throw new SQLException("Cannot unwrap to " + iface.getName());
    }

    @Override
    public boolean isWrapperFor(Class<?> iface) throws SQLException {
      return false;
    }
  }
}
