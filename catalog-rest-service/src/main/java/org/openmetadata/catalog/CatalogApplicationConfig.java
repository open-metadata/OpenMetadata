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
import java.util.ArrayList;
import java.util.List;
import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.StatementException;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.catalog.events.EventHandlerConfiguration;
import org.openmetadata.catalog.fernet.FernetConfiguration;
import org.openmetadata.catalog.filter.Filter;
import org.openmetadata.catalog.filter.FilterRegistry;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.SettingsRepository;
import org.openmetadata.catalog.migration.MigrationConfiguration;
import org.openmetadata.catalog.secrets.SecretsManagerConfiguration;
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.security.jwt.JWTTokenConfiguration;
import org.openmetadata.catalog.settings.Settings;
import org.openmetadata.catalog.settings.SettingsType;
import org.openmetadata.catalog.slackChat.SlackChatConfiguration;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.validators.AirflowConfigValidation;

@Getter
@Setter
public class CatalogApplicationConfig extends Configuration {
  @JsonProperty("database")
  @NotNull
  @Valid
  private DataSourceFactory dataSourceFactory;

  @JsonProperty("swagger")
  private SwaggerBundleConfiguration swaggerBundleConfig;

  @JsonProperty("authorizerConfiguration")
  private AuthorizerConfiguration authorizerConfiguration;

  @JsonProperty("authenticationConfiguration")
  private AuthenticationConfiguration authenticationConfiguration;

  @JsonProperty("jwtTokenConfiguration")
  private JWTTokenConfiguration jwtTokenConfiguration;

  @JsonProperty("elasticsearch")
  private ElasticSearchConfiguration elasticSearchConfiguration;

  @JsonProperty("eventHandlerConfiguration")
  private EventHandlerConfiguration eventHandlerConfiguration;

  @AirflowConfigValidation
  @NotNull
  @Valid
  @JsonProperty("airflowConfiguration")
  private AirflowConfiguration airflowConfiguration;

  @JsonProperty("migrationConfiguration")
  @NotNull
  private MigrationConfiguration migrationConfiguration;

  @JsonProperty("fernetConfiguration")
  private FernetConfiguration fernetConfiguration;

  @JsonProperty("health")
  @NotNull
  @Valid
  private HealthConfiguration healthConfiguration = new HealthConfiguration();

  @JsonProperty("sandboxModeEnabled")
  private boolean sandboxModeEnabled;

  @JsonProperty("slackChat")
  private SlackChatConfiguration slackChatConfiguration = new SlackChatConfiguration();

  @JsonProperty("secretsManagerConfiguration")
  private SecretsManagerConfiguration secretsManagerConfiguration;

  public List<Settings> fetchConfigurationFromDB(Jdbi jdbi) {
    List<Settings> settingsList = new ArrayList<>();
    try {
      CollectionDAO dao = jdbi.onDemand(CollectionDAO.class);
      SettingsRepository repository = new SettingsRepository(dao);
      ResultList<Settings> settings = repository.listAllConfigs();
      if (settings.getData() != null) {
        settingsList = settings.getData();
        settings
            .getData()
            .forEach(
                (setting) -> {
                  if (setting.getConfigType().equals(SettingsType.ACTIVITY_FEED_FILTER_SETTING)) {
                    List<Filter> filters = (List<Filter>) setting.getConfigValue();
                    // if we have the filters on server startup , populate the config to Filter Registry
                    FilterRegistry.add(filters);
                  }
                });
        return settingsList;
      }
    } catch (StatementException e) {
      throw new IllegalArgumentException("Exception encountered when trying to obtain configuration from Database.", e);
    }
    return settingsList;
  }

  public void setConfigFromDB(List<Settings> dbConfig) {
    dbConfig.forEach(
        (config) -> {
          switch (config.getConfigType()) {
            case AIRFLOW_CONFIGURATION:
              airflowConfiguration = JsonUtils.convertValue(config.getConfigValue(), AirflowConfiguration.class);
          }
        });
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
