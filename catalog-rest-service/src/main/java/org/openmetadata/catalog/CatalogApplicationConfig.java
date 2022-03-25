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
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.slack.SlackPublisherConfiguration;

public class CatalogApplicationConfig extends Configuration {
  @JsonProperty("database")
  @NotNull
  @Valid
  @Getter
  @Setter
  private DataSourceFactory dataSourceFactory;

  @JsonProperty("swagger")
  @Getter
  @Setter
  private SwaggerBundleConfiguration swaggerBundleConfig;

  @JsonProperty("authorizerConfiguration")
  @Getter
  @Setter
  private AuthorizerConfiguration authorizerConfiguration;

  @JsonProperty("authenticationConfiguration")
  @Getter
  @Setter
  private AuthenticationConfiguration authenticationConfiguration;

  @JsonProperty("elasticsearch")
  @Getter
  @Setter
  private ElasticSearchConfiguration elasticSearchConfiguration;

  @JsonProperty("eventHandlerConfiguration")
  @Getter
  @Setter
  private EventHandlerConfiguration eventHandlerConfiguration;

  @JsonProperty("airflowConfiguration")
  @Getter
  @Setter
  private AirflowConfiguration airflowConfiguration;

  @JsonProperty("slackEventPublishers")
  @Getter
  @Setter
  private List<SlackPublisherConfiguration> slackEventPublishers;

  @JsonProperty("migrationConfiguration")
  @NotNull
  @Getter
  @Setter
  private MigrationConfiguration migrationConfiguration;

  @JsonProperty("fernetConfiguration")
  @Getter
  @Setter
  private FernetConfiguration fernetConfiguration;

  @JsonProperty("health")
  @NotNull
  @Valid
  @Getter
  @Setter
  private HealthConfiguration healthConfiguration = new HealthConfiguration();

  @JsonProperty("sandboxModeEnabled")
  @Getter
  @Setter
  private boolean sandboxModeEnabled;

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
