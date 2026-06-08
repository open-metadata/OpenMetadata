package org.openmetadata.service.jdbi3.auth;

import com.zaxxer.hikari.HikariConfig;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.util.Properties;
import java.util.logging.Logger;
import javax.sql.DataSource;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.util.jdbi.AwsRdsDatabaseAuthenticationProvider;

/** AWS RDS IAM authentication: a fresh IAM token is generated for each new connection. */
@Slf4j
final class AwsRdsIamAuthStrategy implements DatabaseAuthStrategy {

  @Override
  public String name() {
    return "AWS RDS IAM";
  }

  @Override
  public boolean appliesTo(Context context) {
    // Detected when the URL carries both required parameters: awsRegion (token generation) and
    // allowPublicKeyRetrieval (MySQL IAM auth).
    String url = context.jdbcUrl();
    return url != null
        && url.contains(AwsRdsDatabaseAuthenticationProvider.AWS_REGION)
        && url.contains(AwsRdsDatabaseAuthenticationProvider.ALLOW_PUBLIC_KEY_RETRIEVAL);
  }

  @Override
  public void apply(HikariConfig config, Properties dataSourceProperties, Context context) {
    LOG.info("AWS RDS IAM authentication enabled - tokens will be generated per connection");
    config.setDataSource(
        new AwsRdsIamAwareDataSource(
            context.jdbcUrl(),
            context.username(),
            new AwsRdsDatabaseAuthenticationProvider(),
            dataSourceProperties));
  }

  private static class AwsRdsIamAwareDataSource implements DataSource {
    private final String jdbcUrl;
    private final String username;
    private final AwsRdsDatabaseAuthenticationProvider authProvider;
    private final Properties connectionProperties;

    AwsRdsIamAwareDataSource(
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
      return getConnection();
    }

    @Override
    public PrintWriter getLogWriter() {
      return null;
    }

    @Override
    public void setLogWriter(PrintWriter out) {}

    @Override
    public int getLoginTimeout() {
      return 0;
    }

    @Override
    public void setLoginTimeout(int seconds) {}

    @Override
    public Logger getParentLogger() throws SQLFeatureNotSupportedException {
      throw new SQLFeatureNotSupportedException();
    }

    @Override
    public <T> T unwrap(Class<T> iface) throws SQLException {
      throw new SQLException("Cannot unwrap to " + iface.getName());
    }

    @Override
    public boolean isWrapperFor(Class<?> iface) {
      return false;
    }
  }
}
