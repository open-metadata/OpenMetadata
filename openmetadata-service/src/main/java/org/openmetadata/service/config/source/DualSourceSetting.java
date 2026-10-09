/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.config.source;

import java.util.Arrays;
import java.util.Optional;
import java.util.function.Function;
import org.openmetadata.schema.api.configuration.AppConfiguration;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.security.scim.ScimConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/**
 * Where each setting that lives both in the deployment and in the database comes from in the
 * deployment configuration, and the class its value has.
 */
public enum DualSourceSetting {
  AUTHENTICATION(
      SettingsType.AUTHENTICATION_CONFIGURATION,
      AuthenticationConfiguration.class,
      ConfigTemplateKind.SERVER,
      "/authenticationConfiguration",
      OpenMetadataApplicationConfig::getAuthenticationConfiguration),
  AUTHORIZER(
      SettingsType.AUTHORIZER_CONFIGURATION,
      AuthorizerConfiguration.class,
      ConfigTemplateKind.SERVER,
      "/authorizerConfiguration",
      OpenMetadataApplicationConfig::getAuthorizerConfiguration),
  EMAIL(
      SettingsType.EMAIL_CONFIGURATION,
      SmtpSettings.class,
      ConfigTemplateKind.OPERATIONS,
      "/email",
      config -> config.getOperationalApplicationConfigProvider().getEmailSettings()),
  SERVER_URL(
      SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION,
      OpenMetadataBaseUrlConfiguration.class,
      ConfigTemplateKind.OPERATIONS,
      "/serverUrl",
      config -> config.getOperationalApplicationConfigProvider().getServerUrl()),
  SCIM(
      SettingsType.SCIM_CONFIGURATION,
      ScimConfiguration.class,
      ConfigTemplateKind.SERVER,
      "/scimConfiguration",
      OpenMetadataApplicationConfig::getScimConfiguration),
  MCP(
      SettingsType.MCP_CONFIGURATION,
      MCPConfiguration.class,
      ConfigTemplateKind.SERVER,
      "/mcpConfiguration",
      OpenMetadataApplicationConfig::getMcpConfiguration),
  APP(
      SettingsType.APP_CONFIGURATION,
      AppConfiguration.class,
      ConfigTemplateKind.SERVER,
      "/appConfiguration",
      OpenMetadataApplicationConfig::getAppConfiguration);

  private final SettingsType settingsType;
  private final Class<?> valueClass;
  private final ConfigTemplateKind templateKind;
  private final String templateSection;
  private final Function<OpenMetadataApplicationConfig, Object> deploymentValue;

  DualSourceSetting(
      SettingsType settingsType,
      Class<?> valueClass,
      ConfigTemplateKind templateKind,
      String templateSection,
      Function<OpenMetadataApplicationConfig, Object> deploymentValue) {
    this.settingsType = settingsType;
    this.valueClass = valueClass;
    this.templateKind = templateKind;
    this.templateSection = templateSection;
    this.deploymentValue = deploymentValue;
  }

  public SettingsType settingsType() {
    return settingsType;
  }

  public Class<?> valueClass() {
    return valueClass;
  }

  public ConfigTemplateKind templateKind() {
    return templateKind;
  }

  public String templateSection() {
    return templateSection;
  }

  public Object deploymentValue(OpenMetadataApplicationConfig config) {
    return deploymentValue.apply(config);
  }

  public static Optional<DualSourceSetting> of(SettingsType settingsType) {
    return Arrays.stream(values())
        .filter(setting -> setting.settingsType == settingsType)
        .findFirst();
  }
}
