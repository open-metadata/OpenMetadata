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
import io.dropwizard.Configuration;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.health.conf.HealthConfiguration;
import io.federecio.dropwizard.swagger.SwaggerBundleConfiguration;
import java.util.List;
import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.catalog.events.EventHandlerConfiguration;
import org.openmetadata.catalog.fernet.FernetConfiguration;
import org.openmetadata.catalog.migration.MigrationConfiguration;
import org.openmetadata.catalog.resources.teams.OrganizationConfiguration;
import org.openmetadata.catalog.secrets.SecretsManagerConfiguration;
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.security.jwt.JWTTokenConfiguration;
import org.openmetadata.catalog.slack.SlackPublisherConfiguration;
import org.openmetadata.catalog.slackChat.SlackChatConfiguration;

public class CatalogApplicationConfig extends Configuration {
  private static final String ORGANIZATION_CONFIG = "organization";
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
  private static final String SLACK_CHAT_CONFIG = "slackChat";
  private static final String SECRET_MANAGER_CONFIG = "secretsManagerConfiguration";

  @JsonProperty(ORGANIZATION_CONFIG)
  @NotNull
  @Valid
  @Getter
  @Setter
  private OrganizationConfiguration organizationConfiguration;

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

  @JsonProperty(SLACK_CHAT_CONFIG)
  @Getter
  @Setter
  private SlackChatConfiguration slackChatConfiguration = new SlackChatConfiguration();

  @JsonProperty(SECRET_MANAGER_CONFIG)
  @Getter
  @Setter
  private SecretsManagerConfiguration secretsManagerConfiguration;

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
