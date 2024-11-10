package org.openmetadata.service.util.jdbi;

import com.codahale.metrics.NoopMetricRegistry;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.jdbi3.JdbiFactory;
import io.dropwizard.setup.Environment;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;

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
}
