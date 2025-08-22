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

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.core.Configuration;
import io.dropwizard.db.DataSourceFactory;
import io.federecio.dropwizard.swagger.SwaggerBundleConfiguration;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.DefaultOperationalConfigProvider;
import org.openmetadata.schema.api.configuration.dataQuality.DataQualityConfiguration;
import org.openmetadata.schema.api.configuration.events.EventHandlerConfiguration;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.fernet.FernetConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.OpsConfig;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.configuration.AiPlatformConfiguration;
import org.openmetadata.schema.configuration.LimitsConfiguration;
import org.openmetadata.schema.security.scim.ScimConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.config.ObjectStorageConfiguration;
import org.openmetadata.service.migration.MigrationConfiguration;
import org.openmetadata.service.monitoring.EventMonitorConfiguration;

@Getter
@Setter
public class OpenMetadataApplicationConfig extends Configuration {

  @Getter @JsonProperty private String basePath;

  @Getter
  @JsonProperty("assets")
  private Map<String, String> assets;

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

  @JsonProperty("pipelineServiceClientConfiguration")
  private PipelineServiceClientConfiguration pipelineServiceClientConfiguration;

  @JsonProperty("operationalConfig")
  private OpsConfig opsConfig;

  private DefaultOperationalConfigProvider operationalApplicationConfigProvider;

  private static final String CERTIFICATE_PATH = "certificatePath";

  public PipelineServiceClientConfiguration getPipelineServiceClientConfiguration() {
    if (pipelineServiceClientConfiguration != null) {
      Map<String, String> temporarySSLConfig =
          JsonUtils.readOrConvertValue(
              pipelineServiceClientConfiguration.getSslConfig(), Map.class);
      if (temporarySSLConfig != null && temporarySSLConfig.containsKey(CERTIFICATE_PATH)) {
        temporarySSLConfig.put("caCertificate", temporarySSLConfig.get(CERTIFICATE_PATH));
        temporarySSLConfig.remove(CERTIFICATE_PATH);
      }
      pipelineServiceClientConfiguration.setSslConfig(temporarySSLConfig);
    }
    return pipelineServiceClientConfiguration;
  }

  public DefaultOperationalConfigProvider getOperationalApplicationConfigProvider() {
    if (operationalApplicationConfigProvider == null) {
      operationalApplicationConfigProvider = new DefaultOperationalConfigProvider(getOpsConfig());
    }
    return operationalApplicationConfigProvider;
  }

  public OpsConfig getOpsConfig() {
    if (opsConfig == null) {
      opsConfig = new OpsConfig().withEnable(false);
    }
    return opsConfig;
  }

  @JsonProperty("migrationConfiguration")
  @NotNull
  private MigrationConfiguration migrationConfiguration;

  @JsonProperty("fernetConfiguration")
  private FernetConfiguration fernetConfiguration;

  @JsonProperty("secretsManagerConfiguration")
  private SecretsManagerConfiguration secretsManagerConfiguration;

  @JsonProperty("eventMonitoringConfiguration")
  private EventMonitorConfiguration eventMonitorConfiguration;

  @JsonProperty("clusterName")
  private String clusterName;

  @Valid
  @NotNull
  @JsonProperty("web")
  private OMWebConfiguration webConfiguration = new OMWebConfiguration();

  @JsonProperty("dataQualityConfiguration")
  private DataQualityConfiguration dataQualityConfiguration;

  @JsonProperty("limits")
  private LimitsConfiguration limitsConfiguration;

  @JsonProperty("objectStorage")
  @Valid
  private ObjectStorageConfiguration objectStorage;

  @JsonProperty("scimConfiguration")
  private ScimConfiguration scimConfiguration;

  @JsonProperty("aiPlatformConfiguration")
  private AiPlatformConfiguration aiPlatformConfiguration;

  @JsonProperty("rdf")
  private RdfConfiguration rdfConfiguration = new RdfConfiguration();

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
