package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.sql.SQLException;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory.RotatingFileCredentialDataSource;
import org.openmetadata.service.util.jdbi.FileCredentialProvider;

class RotatingFileCredentialDataSourceTest {

  private static final String URL = "jdbc:stub:db";
  private StubDriver driver;

  @BeforeEach
  void registerDriver() throws SQLException {
    driver = new StubDriver();
    DriverManager.registerDriver(driver);
  }

  @AfterEach
  void deregisterDriver() throws SQLException {
    DriverManager.deregisterDriver(driver);
  }

  @Test
  void connectsWithTheFileTokenAndConfiguredUser(@TempDir Path dir) throws Exception {
    Path file = dir.resolve("token");
    writeQuietly(file, "token-1");

    assertNotNull(newDataSource(file).getConnection());
    assertEquals("token-1", driver.lastPassword.get());
    assertEquals("principal", driver.lastUser.get());
  }

  @Test
  void rereadsAndRetriesOnceWhenTheTokenWasStale(@TempDir Path dir) throws Exception {
    Path file = dir.resolve("token");
    writeQuietly(file, "stale-token");
    driver.reject.add("stale-token");
    // The external rotator writes the fresh token around the time the stale one is rejected.
    driver.onConnect = () -> writeQuietly(file, "fresh-token");

    assertNotNull(newDataSource(file).getConnection());
    assertEquals("fresh-token", driver.lastPassword.get());
  }

  @Test
  void propagatesFailureWhenTheRetryAlsoFails(@TempDir Path dir) throws Exception {
    Path file = dir.resolve("token");
    writeQuietly(file, "bad-token");
    driver.reject.add("bad-token");

    assertThrows(SQLException.class, () -> newDataSource(file).getConnection());
  }

  private RotatingFileCredentialDataSource newDataSource(Path file) {
    FileCredentialProvider provider = new FileCredentialProvider(file.toString());
    return new RotatingFileCredentialDataSource(URL, "principal", provider, new Properties());
  }

  private static void writeQuietly(Path file, String content) {
    try {
      Files.writeString(file, content);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  /** Minimal JDBC driver that records the credentials it receives and can reject given passwords. */
  private static final class StubDriver implements Driver {
    private final AtomicReference<String> lastPassword = new AtomicReference<>();
    private final AtomicReference<String> lastUser = new AtomicReference<>();
    private final Set<String> reject = ConcurrentHashMap.newKeySet();
    private volatile Runnable onConnect;

    @Override
    public Connection connect(String url, Properties info) throws SQLException {
      if (!acceptsURL(url)) {
        return null;
      }
      if (onConnect != null) {
        onConnect.run();
      }
      lastUser.set(info.getProperty("user"));
      String password = info.getProperty("password");
      lastPassword.set(password);
      if (reject.contains(password)) {
        throw new SQLException("FATAL: The access token has expired");
      }
      return mock(Connection.class);
    }

    @Override
    public boolean acceptsURL(String url) {
      return url != null && url.startsWith("jdbc:stub:");
    }

    @Override
    public DriverPropertyInfo[] getPropertyInfo(String url, Properties info) {
      return new DriverPropertyInfo[0];
    }

    @Override
    public int getMajorVersion() {
      return 1;
    }

    @Override
    public int getMinorVersion() {
      return 0;
    }

    @Override
    public boolean jdbcCompliant() {
      return false;
    }

    @Override
    public Logger getParentLogger() {
      return Logger.getLogger("stub");
    }
  }
}
