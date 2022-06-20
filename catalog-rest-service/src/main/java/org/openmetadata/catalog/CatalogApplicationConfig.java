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

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.Configuration;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.health.conf.HealthConfiguration;
import io.federecio.dropwizard.swagger.SwaggerBundleConfiguration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.StatementException;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.config.ConfigDAO.CatalogConfigDAO;
import org.openmetadata.catalog.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.catalog.events.EventHandlerConfiguration;
import org.openmetadata.catalog.fernet.FernetConfiguration;
import org.openmetadata.catalog.migration.MigrationConfiguration;
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.security.jwt.JWTTokenConfiguration;
import org.openmetadata.catalog.slack.SlackPublisherConfiguration;

public class CatalogApplicationConfig extends Configuration {
  private static final String DATABASE_CONFIG = "database";
  private static final String SWAGGER_CONFIG = "swagger";
  private static final String AUTHORIZER_CONFIG = "authorizerConfiguration";
  private static final String AUTHENTICATION_CONFIG = "authenticationConfiguration";
  private static final String JWT_CONFIG = "jwtTokenConfiguration";
  private static final String ELASTIC_CONFIG = "elasticsearch";
  private static final String EVENTHANDLER_CONFIG = "eventHandlerConfiguration";
  private static final String AIRFLOW_CONFIG = "airflowConfiguration";
  private static final String SLACK_CONFIG = "slackEventPublishers";
  private static final String FERNET_CONFIG = "fernetConfiguration";
  private static final String HEALTH_CONFIG = "health";
  private static final String MIGRATION_CONFIG = "migrationConfiguration";
  private static final String SANDBOXMODE_CONFIG = "sandboxModeEnabled";

  @JsonProperty(DATABASE_CONFIG)
  @NotNull
  @Valid
  @Getter
  @Setter
  private DataSourceFactory dataSourceFactory;

  @JsonProperty(SWAGGER_CONFIG)
  @Getter
  @Setter
  private SwaggerBundleConfiguration swaggerBundleConfig;

  @JsonProperty(AUTHORIZER_CONFIG)
  @Getter
  @Setter
  private AuthorizerConfiguration authorizerConfiguration;

  @JsonProperty(AUTHENTICATION_CONFIG)
  @Getter
  @Setter
  private AuthenticationConfiguration authenticationConfiguration;

  @JsonProperty(JWT_CONFIG)
  @Getter
  @Setter
  private JWTTokenConfiguration jwtTokenConfiguration;

  @JsonProperty(ELASTIC_CONFIG)
  @Getter
  @Setter
  private ElasticSearchConfiguration elasticSearchConfiguration;

  @JsonProperty(EVENTHANDLER_CONFIG)
  @Getter
  @Setter
  private EventHandlerConfiguration eventHandlerConfiguration;

  @JsonProperty(AIRFLOW_CONFIG)
  @Getter
  @Setter
  private AirflowConfiguration airflowConfiguration;

  @JsonProperty(SLACK_CONFIG)
  @Getter
  @Setter
  private List<SlackPublisherConfiguration> slackEventPublishers;

  @JsonProperty(MIGRATION_CONFIG)
  @NotNull
  @Getter
  @Setter
  private MigrationConfiguration migrationConfiguration;

  @JsonProperty(FERNET_CONFIG)
  @Getter
  @Setter
  private FernetConfiguration fernetConfiguration;

  @JsonProperty(HEALTH_CONFIG)
  @NotNull
  @Valid
  @Getter
  @Setter
  private HealthConfiguration healthConfiguration = new HealthConfiguration();

  @JsonProperty(SANDBOXMODE_CONFIG)
  @Getter
  @Setter
  private boolean sandboxModeEnabled;

  public Map<String, String> fetchConfigurationFromDB(Jdbi jdbi) {
    try {
      CatalogConfigDAO dao = jdbi.onDemand(CatalogConfigDAO.class);
      Map<String, String> result = dao.getAllConfig();
      setConfigFromDB(result);
      return result;
    } catch (StatementException e) {
      throw new IllegalArgumentException("Exception encountered when trying to obtain configuration from Database.", e);
    }
  }

  public void setConfigFromDB(Map<String, String> dbConfig) {
    ObjectMapper mapper = new ObjectMapper();
    try {
      authenticationConfiguration =
          mapper.readValue(dbConfig.get(AUTHENTICATION_CONFIG), AuthenticationConfiguration.class);
      authorizerConfiguration = mapper.readValue(dbConfig.get(AUTHORIZER_CONFIG), AuthorizerConfiguration.class);
      jwtTokenConfiguration = mapper.readValue(dbConfig.get(JWT_CONFIG), JWTTokenConfiguration.class);
      // Slack Event Configuration is a list of config
      slackEventPublishers =
          Arrays.asList(mapper.readValue(dbConfig.get(SLACK_CONFIG), SlackPublisherConfiguration[].class));
      eventHandlerConfiguration = mapper.readValue(dbConfig.get(EVENTHANDLER_CONFIG), EventHandlerConfiguration.class);
      fernetConfiguration = mapper.readValue(dbConfig.get(FERNET_CONFIG), FernetConfiguration.class);
      airflowConfiguration = mapper.readValue(dbConfig.get(AIRFLOW_CONFIG), AirflowConfiguration.class);
      elasticSearchConfiguration = mapper.readValue(dbConfig.get(ELASTIC_CONFIG), ElasticSearchConfiguration.class);

    } catch (JsonProcessingException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public String toString() {
    return "catalogConfig{"
        + ", dataSourceFactory="
        + dataSourceFactory
        + ", swaggerBundleConfig="
        + swaggerBundleConfig
        + ", authorizerConfiguration="
        + authorizerConfiguration
        + '}';
  }
}
