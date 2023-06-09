package org.openmetadata.service.util;

import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.jdbi3.JdbiFactory;
import io.dropwizard.setup.Environment;
import java.net.URI;
import java.time.temporal.ChronoUnit;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;

@Slf4j
public final class JdbiUtils {

  private JdbiUtils() {}

  public static Jdbi createJdbi(OpenMetadataApplicationConfig config, Environment environment) {

    // Prepare
    DataSourceFactory dataSourceFactory = config.getDataSourceFactory();

    // Check auth provider
    checkAuthenticationProvider(config, dataSourceFactory);

    // Build
    Jdbi jdbi = new JdbiFactory().build(environment, dataSourceFactory, "database");

    // Set logging
    setLogging(dataSourceFactory, jdbi);

    // Return
    return jdbi;
  }

  private static void checkAuthenticationProvider(
      OpenMetadataApplicationConfig config, DataSourceFactory dataSourceFactory) {
    // Check auth provider
    if (config.getAwsConfiguration() != null && config.getAwsConfiguration().getEnableIamDatabaseAuthentication()) {
      // Parse jdbc url
      URI uri = URI.create(dataSourceFactory.getUrl().substring(5));
      String region = config.getAwsConfiguration().getRegion();

      // Set password
      dataSourceFactory.setPassword(
          AWSUtils.generateDBAuthToken(region, uri.getHost(), uri.getPort(), dataSourceFactory.getUser()));
    }
  }

  private static void setLogging(DataSourceFactory dataSourceFactory, Jdbi jdbi) {
    SqlLogger sqlLogger =
        new SqlLogger() {
          @Override
          public void logBeforeExecution(StatementContext context) {
            LOG.debug("sql {}, parameters {}", context.getRenderedSql(), context.getBinding());
          }

          @Override
          public void logAfterExecution(StatementContext context) {
            LOG.debug(
                "sql {}, parameters {}, timeTaken {} ms",
                context.getRenderedSql(),
                context.getBinding(),
                context.getElapsedTime(ChronoUnit.MILLIS));
          }
        };

    // Log it
    if (LOG.isDebugEnabled()) {
      jdbi.setSqlLogger(sqlLogger);
    }

    // Set the Database type for choosing correct queries from annotations
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(dataSourceFactory.getDriverClass()));
  }
}
