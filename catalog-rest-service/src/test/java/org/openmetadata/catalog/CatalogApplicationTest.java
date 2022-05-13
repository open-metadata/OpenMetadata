/*
 *  Copyright 2021 Collate
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

package org.openmetadata.catalog;

import static java.lang.String.format;

import io.dropwizard.testing.ConfigOverride;
import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.client.HttpUrlConnectorProvider;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.openmetadata.catalog.fernet.Fernet;
import org.openmetadata.catalog.resources.CollectionRegistry;
import org.openmetadata.catalog.resources.events.WebhookCallbackResource;
import org.testcontainers.containers.JdbcDatabaseContainer;

@Slf4j
public abstract class CatalogApplicationTest {
  protected static final String CONFIG_PATH = ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");
  private static JdbcDatabaseContainer<?> SQL_CONTAINER;
  public static DropwizardAppExtension<CatalogApplicationConfig> APP;
  protected static final WebhookCallbackResource webhookCallbackResource = new WebhookCallbackResource();
  public static final String FERNET_KEY_1 = "ihZpp5gmmDvVsgoOG6OVivKWwC9vd5JQ";

  static {
    CollectionRegistry.addTestResource(webhookCallbackResource);
    Fernet.getInstance().setFernetKey(FERNET_KEY_1);
  }

  @BeforeAll
  public static void createApplication() throws Exception {
    // The system properties are provided by maven-surefire for testing with mysql and postgres
    final String jdbcContainerClassName = System.getProperty("jdbcContainerClassName");
    final String jdbcContainerImage = System.getProperty("jdbcContainerImage");
    LOG.info("Using test container class {} and image {}", jdbcContainerClassName, jdbcContainerImage);

    SQL_CONTAINER =
        (JdbcDatabaseContainer<?>)
            Class.forName(jdbcContainerClassName).getConstructor(String.class).newInstance(jdbcContainerImage);
    SQL_CONTAINER.withReuse(true);
    SQL_CONTAINER.withStartupTimeoutSeconds(240);
    SQL_CONTAINER.withConnectTimeoutSeconds(240);
    SQL_CONTAINER.start();

    final String migrationScripsLocation =
        ResourceHelpers.resourceFilePath("db/sql/" + SQL_CONTAINER.getDriverClassName());
    Flyway flyway =
        Flyway.configure()
            .dataSource(SQL_CONTAINER.getJdbcUrl().replace("172.17.0.1", "host.docker.internal"), SQL_CONTAINER.getUsername(), SQL_CONTAINER.getPassword())
            .table("DATABASE_CHANGE_LOG")
            .locations("filesystem:" + migrationScripsLocation)
            .sqlMigrationPrefix("v")
            .load();
    flyway.clean();
    flyway.migrate();

    APP =
        new DropwizardAppExtension<>(
            CatalogApplication.class,
            CONFIG_PATH,
            // Database overrides
            ConfigOverride.config("database.driverClass", SQL_CONTAINER.getDriverClassName()),
            ConfigOverride.config("database.url", SQL_CONTAINER.getJdbcUrl().replace("172.17.0.1", "host.docker.internal")),
            ConfigOverride.config("database.user", SQL_CONTAINER.getUsername()),
            ConfigOverride.config("database.password", SQL_CONTAINER.getPassword()),
            // Migration overrides
            ConfigOverride.config("migrationConfiguration.path", migrationScripsLocation));
    APP.before();
  }

  @AfterAll
  public static void stopApplication() {
    // If BeforeAll causes and exception AfterAll still gets called before that exception is thrown.
    // If a NullPointerException is thrown during the cleanup of above it will eat the initial error
    if (APP != null) {
      APP.after();
    }
  }

  public static Client getClient() {
    return APP.client()
        .property(ClientProperties.CONNECT_TIMEOUT, 0)
        .property(ClientProperties.READ_TIMEOUT, 0)
        .property(HttpUrlConnectorProvider.SET_METHOD_WORKAROUND, true);
  }

  public static WebTarget getResource(String collection) {
    return getClient().target(format("http://localhost:%s/api/v1/%s", APP.getLocalPort(), collection));
  }

  public static WebTarget getConfigResource(String resource) {
    return getClient().target(format("http://localhost:%s/api/v1/config/%s", APP.getLocalPort(), resource));
  }
}
