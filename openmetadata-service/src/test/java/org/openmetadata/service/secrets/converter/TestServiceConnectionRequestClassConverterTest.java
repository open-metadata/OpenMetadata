package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.services.connections.database.AthenaConnection;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.slf4j.LoggerFactory;

class TestServiceConnectionRequestClassConverterTest {

  private static final String SECRET = "never-echo-this-secret";
  private static final String STAGING_DIR_WITH_SPACE = "s3://bucket/athena results/";

  private final ClassConverter converter =
      ClassConverterFactory.getConverter(TestServiceConnectionRequest.class);

  @Test
  void invalidUriNamesTheFieldAndConstraintWithoutEchoingTheValue() {
    Map<String, Object> request =
        testConnectionRequest("Athena", athenaConfig(STAGING_DIR_WITH_SPACE));

    InvalidServiceConnectionException failure =
        assertThrows(InvalidServiceConnectionException.class, () -> converter.convert(request));

    assertEquals(
        "Invalid Athena connection: 's3StagingDir' must be a valid URI "
            + "(Illegal character in path at index 18)",
        failure.getMessage());
    assertFalse(failure.getMessage().contains("athena results"));
    assertFalse(failure.getMessage().contains(SECRET));
  }

  @Test
  void invalidNestedUriNamesTheFullFieldPath() {
    Map<String, Object> config = athenaConfig("s3://bucket/results/");
    awsConfigOf(config).put("endPointURL", "http://local host:4566");

    InvalidServiceConnectionException failure =
        assertThrows(
            InvalidServiceConnectionException.class,
            () -> converter.convert(testConnectionRequest("Athena", config)));

    assertEquals(
        "Invalid Athena connection: 'awsConfig.endPointURL' must be a valid URI "
            + "(Illegal character in authority at index 12)",
        failure.getMessage());
  }

  /** A URI can embed credentials, so the log line must not quote the rejected value either. */
  @Test
  void rejectionIsLoggedOnceWithoutTheRejectedValue() {
    Map<String, Object> request =
        testConnectionRequest(
            "Athena", athenaConfig("s3://AKIAEXAMPLE:" + SECRET + "@bucket/athena results/"));
    Logger logger =
        (Logger) LoggerFactory.getLogger(TestServiceConnectionRequestClassConverter.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      assertThrows(InvalidServiceConnectionException.class, () -> converter.convert(request));

      assertEquals(1, appender.list.size());
      ILoggingEvent warning = appender.list.get(0);
      assertEquals(Level.WARN, warning.getLevel());
      assertEquals(
          "Rejected test connection for service [athena_service]: Invalid Athena connection: "
              + "'s3StagingDir' must be a valid URI (Illegal character in path at index 53); "
              + "cause: java.net.URISyntaxException",
          warning.getFormattedMessage());
      assertNull(
          warning.getThrowableProxy(),
          "a logged cause would print the rejected URI and its secret");
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  @Test
  void invalidUriKeepsTheOriginalCause() {
    Map<String, Object> request =
        testConnectionRequest("Athena", athenaConfig(STAGING_DIR_WITH_SPACE));

    InvalidServiceConnectionException failure =
        assertThrows(InvalidServiceConnectionException.class, () -> converter.convert(request));

    assertInstanceOf(IllegalArgumentException.class, failure.getCause());
    assertInstanceOf(URISyntaxException.class, ExceptionUtils.getRootCause(failure));
  }

  @Test
  void unknownConnectionTypeKeepsTheOriginalCause() {
    Map<String, Object> request = testConnectionRequest("NotAConnector", athenaConfig("s3://b/"));

    InvalidServiceConnectionException failure =
        assertThrows(InvalidServiceConnectionException.class, () -> converter.convert(request));

    assertInstanceOf(ClassNotFoundException.class, failure.getCause());
    assertFalse(failure.getMessage().contains(SECRET));
  }

  @Test
  void validConnectionConvertsUnchanged() {
    Map<String, Object> request =
        testConnectionRequest("Athena", athenaConfig("s3://bucket/results/"));

    TestServiceConnectionRequest converted =
        (TestServiceConnectionRequest) converter.convert(request);

    DatabaseConnection connection =
        assertInstanceOf(DatabaseConnection.class, converted.getConnection());
    AthenaConnection athena = assertInstanceOf(AthenaConnection.class, connection.getConfig());
    assertEquals(URI.create("s3://bucket/results/"), athena.getS3StagingDir());
    assertEquals(SECRET, athena.getAwsConfig().getAwsSecretAccessKey());
  }

  static Map<String, Object> athenaConfig(String s3StagingDir) {
    Map<String, Object> awsConfig = new HashMap<>();
    awsConfig.put("awsRegion", "us-east-1");
    awsConfig.put("awsAccessKeyId", "AKIAEXAMPLE");
    awsConfig.put("awsSecretAccessKey", SECRET);
    Map<String, Object> config = new HashMap<>();
    config.put("type", "Athena");
    config.put("s3StagingDir", s3StagingDir);
    config.put("workgroup", "primary");
    config.put("awsConfig", awsConfig);
    return config;
  }

  static Map<String, Object> testConnectionRequest(
      String connectionType, Map<String, Object> config) {
    return Map.of(
        "connection",
        Map.of("config", config),
        "serviceType",
        "Database",
        "connectionType",
        connectionType,
        "serviceName",
        "athena_service");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> awsConfigOf(Map<String, Object> config) {
    return (Map<String, Object>) config.get("awsConfig");
  }
}
