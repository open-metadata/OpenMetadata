package org.openmetadata.service.util.jdbi;

import com.codahale.metrics.NoopMetricRegistry;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.jdbi3.JdbiFactory;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.util.RestUtil;

public class JdbiUtils {

  public static Jdbi createAndSetupJDBI(Environment environment, DataSourceFactory dbFactory) {
    DatabaseAuthenticationProviderFactory.get(dbFactory.getUrl())
        .ifPresent(
            databaseAuthenticationProvider -> {
              String token =
                  databaseAuthenticationProvider.authenticate(
                      dbFactory.getUrl(), dbFactory.getUser(), dbFactory.getPassword());
              dbFactory.setPassword(token);
            });

    Jdbi jdbiInstance = new JdbiFactory().build(environment, dbFactory, "database");
    jdbiInstance.setSqlLogger(new OMSqlLogger());
    // Set the Database type for choosing correct queries from annotations
    jdbiInstance
        .getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(dbFactory.getDriverClass()));
    jdbiInstance.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);

    return jdbiInstance;
  }

  public static Jdbi createAndSetupJDBI(DataSourceFactory dbFactory) {
    DatabaseAuthenticationProviderFactory.get(dbFactory.getUrl())
        .ifPresent(
            databaseAuthenticationProvider -> {
              String token =
                  databaseAuthenticationProvider.authenticate(
                      dbFactory.getUrl(), dbFactory.getUser(), dbFactory.getPassword());
              dbFactory.setPassword(token);
            });

    Jdbi jdbiInstance = Jdbi.create(dbFactory.build(new NoopMetricRegistry(), "open-metadata-ops"));
    jdbiInstance.installPlugin(new SqlObjectPlugin());
    jdbiInstance
        .getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(dbFactory.getDriverClass()));
    jdbiInstance.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);

    return jdbiInstance;
  }

  public static int getOffset(String offset) {
    return offset != null ? Integer.parseInt(RestUtil.decodeCursor(offset)) : 0;
  }

  public static String getAfterOffset(int offsetInt, int limit, int total) {
    int afterOffset = offsetInt + limit;
    // If afterOffset is greater than total, then set it to null to indicate end of list
    return afterOffset >= total ? null : String.valueOf(afterOffset);
  }

  public static String getBeforeOffset(int offsetInt, int limit) {
    int beforeOffsetInt = offsetInt - limit;
    // If offset is negative, then set it to 0 if you pass offset 4 and limit 10, then the previous
    // page will be at offset 0
    if (beforeOffsetInt < 0) beforeOffsetInt = 0;
    // if offsetInt is 0 (i.e. either no offset or offset is 0), then set it to null as there is no
    // previous page
    return (offsetInt == 0) ? null : String.valueOf(beforeOffsetInt);
  }
}
