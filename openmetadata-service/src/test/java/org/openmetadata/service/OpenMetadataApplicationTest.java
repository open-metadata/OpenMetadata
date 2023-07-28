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

package org.openmetadata.service;

import static java.lang.String.format;
import static org.openmetadata.service.util.TablesInitializer.validateAndRunSystemDataMigrations;

import io.dropwizard.jersey.jackson.JacksonFeature;
import io.dropwizard.testing.ConfigOverride;
import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import java.util.HashSet;
import java.util.Set;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.HttpHost;
import org.elasticsearch.client.RestClient;
import org.flywaydb.core.Flyway;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.client.HttpUrlConnectorProvider;
import org.glassfish.jersey.client.JerseyClientBuilder;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.events.WebhookCallbackResource;
import org.openmetadata.service.resources.tags.TagLabelCache;
import org.openmetadata.service.security.policyevaluator.PolicyCache;
import org.openmetadata.service.security.policyevaluator.RoleCache;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.testcontainers.containers.JdbcDatabaseContainer;
import org.testcontainers.elasticsearch.ElasticsearchContainer;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class OpenMetadataApplicationTest {
  protected static final String CONFIG_PATH = ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");
  public static DropwizardAppExtension<OpenMetadataApplicationConfig> APP;
  protected static final WebhookCallbackResource webhookCallbackResource = new WebhookCallbackResource();
  public static final String FERNET_KEY_1 = "ihZpp5gmmDvVsgoOG6OVivKWwC9vd5JQ";
  private static ElasticsearchContainer ELASTIC_SEARCH_CONTAINER;

  public static final boolean RUN_ELASTIC_SEARCH_TESTCASES = false;

  private static final Set<ConfigOverride> configOverrides = new HashSet<>();

  private static final String JDBC_CONTAINER_CLASS_NAME = "org.testcontainers.containers.MySQLContainer";
  private static final String JDBC_CONTAINER_IMAGE = "mysql:8";
  private static final String ELASTIC_SEARCH_CONTAINER_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:7.16.3";

  private static String HOST;
  private static String PORT;

  static {
    CollectionRegistry.addTestResource(webhookCallbackResource);
    Fernet.getInstance().setFernetKey(FERNET_KEY_1);
  }

  @BeforeAll
  public static void createApplication() throws Exception {
    String jdbcContainerClassName = System.getProperty("jdbcContainerClassName");
    String jdbcContainerImage = System.getProperty("jdbcContainerImage");
    String elasticSearchContainerImage = System.getProperty("elasticSearchContainerClassName");
    if (CommonUtil.nullOrEmpty(jdbcContainerClassName)) {
      jdbcContainerClassName = JDBC_CONTAINER_CLASS_NAME;
    }
    if (CommonUtil.nullOrEmpty(jdbcContainerImage)) {
      jdbcContainerImage = JDBC_CONTAINER_IMAGE;
    }
    if (CommonUtil.nullOrEmpty(elasticSearchContainerImage)) {
      elasticSearchContainerImage = ELASTIC_SEARCH_CONTAINER_IMAGE;
    }
    // The system properties are provided by maven-surefire for testing with mysql and postgres
    LOG.info("Using test container class {} and image {}", jdbcContainerClassName, jdbcContainerImage);

    JdbcDatabaseContainer<?> sqlContainer =
        (JdbcDatabaseContainer<?>)
            Class.forName(jdbcContainerClassName).getConstructor(String.class).newInstance(jdbcContainerImage);
    sqlContainer.withReuse(false);
    sqlContainer.withStartupTimeoutSeconds(240);
    sqlContainer.withConnectTimeoutSeconds(240);
    sqlContainer.start();

    final String migrationScripsLocation =
        ResourceHelpers.resourceFilePath("db/sql/" + sqlContainer.getDriverClassName());
    Flyway flyway =
        Flyway.configure()
            .dataSource(sqlContainer.getJdbcUrl(), sqlContainer.getUsername(), sqlContainer.getPassword())
            .table("DATABASE_CHANGE_LOG")
            .locations("filesystem:" + migrationScripsLocation)
            .sqlMigrationPrefix("v")
            .cleanDisabled(false)
            .load();
    flyway.clean();
    flyway.migrate();

    ELASTIC_SEARCH_CONTAINER = new ElasticsearchContainer(elasticSearchContainerImage);
    if (RUN_ELASTIC_SEARCH_TESTCASES) {
      ELASTIC_SEARCH_CONTAINER.start();
      ELASTIC_SEARCH_CONTAINER.withReuse(true);
      String[] parts = ELASTIC_SEARCH_CONTAINER.getHttpHostAddress().split(":");
      HOST = parts[0];
      PORT = parts[1];
      // elastic search overrides
      configOverrides.add(ConfigOverride.config("elasticsearch.host", HOST));
      configOverrides.add(ConfigOverride.config("elasticsearch.port", PORT));
      configOverrides.add(ConfigOverride.config("elasticsearch.scheme", "http"));
      configOverrides.add(ConfigOverride.config("elasticsearch.username", ""));
      configOverrides.add(ConfigOverride.config("elasticsearch.password", ""));
      configOverrides.add(ConfigOverride.config("elasticsearch.truststorePath", ""));
      configOverrides.add(ConfigOverride.config("elasticsearch.truststorePassword", ""));
      configOverrides.add(ConfigOverride.config("elasticsearch.connectionTimeoutSecs", "5"));
      configOverrides.add(ConfigOverride.config("elasticsearch.socketTimeoutSecs", "60"));
      configOverrides.add(ConfigOverride.config("elasticsearch.keepAliveTimeoutSecs", "600"));
      configOverrides.add(ConfigOverride.config("elasticsearch.batchSize", "10"));
      configOverrides.add(ConfigOverride.config("elasticsearch.searchIndexMappingLanguage", "EN"));
      configOverrides.add(ConfigOverride.config("elasticsearch.searchType", "elasticsearch"));
    }
    // Database overrides
    configOverrides.add(ConfigOverride.config("database.driverClass", sqlContainer.getDriverClassName()));
    configOverrides.add(ConfigOverride.config("database.url", sqlContainer.getJdbcUrl()));
    configOverrides.add(ConfigOverride.config("database.user", sqlContainer.getUsername()));
    configOverrides.add(ConfigOverride.config("database.password", sqlContainer.getPassword()));
    // Migration overrides
    configOverrides.add(ConfigOverride.config("migrationConfiguration.path", migrationScripsLocation));
    ConfigOverride[] configOverridesArray = configOverrides.toArray(new ConfigOverride[0]);
    APP = new DropwizardAppExtension<>(OpenMetadataApplication.class, CONFIG_PATH, configOverridesArray);

    // Run System Migrations
    final Jdbi jdbi = Jdbi.create(sqlContainer.getJdbcUrl(), sqlContainer.getUsername(), sqlContainer.getPassword());
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(sqlContainer.getDriverClassName()));
    validateAndRunSystemDataMigrations(jdbi, ConnectionType.from(sqlContainer.getDriverClassName()), false);

    APP.before();
  }

  @AfterAll
  public static void stopApplication() throws Exception {
    // If BeforeAll causes and exception AfterAll still gets called before that exception is thrown.
    // If a NullPointerException is thrown during the cleanup of above it will eat the initial error
    if (APP != null) {
      APP.after();
      APP.getEnvironment().getApplicationContext().getServer().stop();
    }
    SubjectCache.cleanUp();
    PolicyCache.cleanUp();
    RoleCache.cleanUp();
    TagLabelCache.cleanUp();
    ELASTIC_SEARCH_CONTAINER.stop();
  }

  public static Client getClient() {
    return new JerseyClientBuilder()
        .register(new JacksonFeature(APP.getObjectMapper()))
        .property(ClientProperties.CONNECT_TIMEOUT, 0)
        .property(ClientProperties.READ_TIMEOUT, 0)
        .property(HttpUrlConnectorProvider.SET_METHOD_WORKAROUND, true)
        .build();
  }

  public static RestClient getSearchClient() {
    return RestClient.builder(HttpHost.create(ELASTIC_SEARCH_CONTAINER.getHttpHostAddress())).build();
  }

  public static WebTarget getResource(String collection) {
    return getClient().target(format("http://localhost:%s/api/v1/%s", APP.getLocalPort(), collection));
  }

  public static WebTarget getConfigResource(String resource) {
    return getClient().target(format("http://localhost:%s/api/v1/system/config/%s", APP.getLocalPort(), resource));
  }
}
