package org.openmetadata.service.jdbi3.auth;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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

/**
 * Reads the DB password from a file and re-reads it per connection, so an externally-rotated
 * credential is picked up without restarting the service.
 */
@Slf4j
final class FileCredentialAuthStrategy implements DatabaseAuthStrategy {

  @Override
  public String name() {
    return "file-based credential (dbPasswordFile)";
  }

  @Override
  public boolean appliesTo(Context context) {
    return !nullOrEmpty(context.dbPasswordFile());
  }

  @Override
  public void apply(HikariConfig config, Properties dataSourceProperties, Context context) {
    FileCredentialProvider provider = new FileCredentialProvider(context.dbPasswordFile());
    // Read once up front so a misconfigured path fails fast at startup.
    provider.authenticate(context.jdbcUrl(), context.username(), null);
    LOG.info(
        "File-based rotating DB credential enabled - password re-read per connection from {}",
        context.dbPasswordFile());
    config.setDataSource(
        new RotatingFileCredentialDataSource(
            context.jdbcUrl(), context.username(), provider, dataSourceProperties));
  }

  // Package-private so RotatingFileCredentialDataSourceTest can exercise the per-connection re-read
  // and the auth-failure retry directly via a stub JDBC driver.
  static class RotatingFileCredentialDataSource implements DataSource {
    private final String jdbcUrl;
    private final String username;
    private final FileCredentialProvider provider;
    private final Properties connectionProperties;

    RotatingFileCredentialDataSource(
        String jdbcUrl,
        String username,
        FileCredentialProvider provider,
        Properties connectionProperties) {
      this.jdbcUrl = jdbcUrl;
      this.username = username;
      this.provider = provider;
      this.connectionProperties =
          connectionProperties != null ? connectionProperties : new Properties();
    }

    @Override
    public Connection getConnection() throws SQLException {
      Connection connection;
      try {
        connection = connect();
      } catch (SQLException first) {
        if (!isAuthFailure(first)) {
          throw first; // non-auth failure: don't re-read the credential or retry
        }
        // An auth failure may mean the credential just rotated; re-read and retry once.
        provider.invalidate();
        connection = retryConnect(first);
      }
      return connection;
    }

    private Connection connect() throws SQLException {
      String password = provider.authenticate(jdbcUrl, username, null);
      Properties props = new Properties();
      props.putAll(connectionProperties);
      props.setProperty("user", username);
      props.setProperty("password", password);
      return DriverManager.getConnection(jdbcUrl, props);
    }

    private Connection retryConnect(SQLException first) throws SQLException {
      Connection connection;
      try {
        connection = connect();
      } catch (SQLException retryFailure) {
        LOG.error(
            "File-based credential DB connection failed after re-read: {}",
            retryFailure.getMessage());
        throw new SQLException(
            "Failed to authenticate with file-based DB credential after token re-read", first);
      }
      return connection;
    }

    // Postgres returns SQLState class 28 (invalid authorization) for an expired/invalid token.
    private static boolean isAuthFailure(SQLException e) {
      String sqlState = e.getSQLState();
      return sqlState != null && sqlState.startsWith("28");
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
