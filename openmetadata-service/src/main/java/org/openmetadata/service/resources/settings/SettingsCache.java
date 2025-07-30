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

package org.openmetadata.service.resources.settings;

import static org.openmetadata.schema.settings.SettingsType.ASSET_CERTIFICATION_SETTINGS;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.CUSTOM_UI_THEME_PREFERENCE;
import static org.openmetadata.schema.settings.SettingsType.EMAIL_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.ENTITY_RULES_SETTINGS;
import static org.openmetadata.schema.settings.SettingsType.LINEAGE_SETTINGS;
import static org.openmetadata.schema.settings.SettingsType.LOGIN_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.SCIM_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.SEARCH_SETTINGS;
import static org.openmetadata.schema.settings.SettingsType.WORKFLOW_SETTINGS;

import com.cronutils.utils.StringUtils;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.api.configuration.LogoConfiguration;
import org.openmetadata.api.configuration.ThemeConfiguration;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.lineage.LineageLayer;
import org.openmetadata.schema.api.lineage.LineageSettings;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.configuration.ExecutorConfiguration;
import org.openmetadata.schema.configuration.HistoryCleanUpConfiguration;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.security.scim.ScimConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class SettingsCache {
  private static volatile boolean initialized = false;
  protected static final LoadingCache<String, Settings> CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(1000)
          .expireAfterWrite(3, TimeUnit.MINUTES)
          .build(new SettingsLoader());

  private SettingsCache() {
    // Private constructor for singleton
  }

  // Expected to be called only once from the DefaultAuthorizer
  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!initialized) {
      initialized = true;
      createDefaultConfiguration(config);
    }
  }

  private static void createDefaultConfiguration(OpenMetadataApplicationConfig applicationConfig) {
    // Initialise Email Setting
    Settings storedSettings =
        Entity.getSystemRepository().getConfigWithKey(EMAIL_CONFIGURATION.toString());
    if (storedSettings == null) {
      // Only in case a config doesn't exist in DB we insert it
      SmtpSettings emailConfig =
          applicationConfig.getOperationalApplicationConfigProvider().getEmailSettings();

      Settings setting =
          new Settings().withConfigType(EMAIL_CONFIGURATION).withConfigValue(emailConfig);
      Entity.getSystemRepository().createNewSetting(setting);
    }

    // Initialise OM base url setting
    Settings storedOpenMetadataBaseUrlConfiguration =
        Entity.getSystemRepository()
            .getConfigWithKey(OPEN_METADATA_BASE_URL_CONFIGURATION.toString());
    if (storedOpenMetadataBaseUrlConfiguration == null) {
      Settings setting =
          new Settings()
              .withConfigType(OPEN_METADATA_BASE_URL_CONFIGURATION)
              .withConfigValue(
                  applicationConfig.getOperationalApplicationConfigProvider().getServerUrl());
      Entity.getSystemRepository().createNewSetting(setting);
    }

    // Initialise Theme Setting
    Settings storedCustomUiThemeConf =
        Entity.getSystemRepository().getConfigWithKey(CUSTOM_UI_THEME_PREFERENCE.toString());
    if (storedCustomUiThemeConf == null) {
      // Only in case a config doesn't exist in DB we insert it
      Settings setting =
          new Settings()
              .withConfigType(CUSTOM_UI_THEME_PREFERENCE)
              .withConfigValue(
                  new UiThemePreference()
                      .withCustomLogoConfig(
                          new LogoConfiguration()
                              .withCustomLogoUrlPath("")
                              .withCustomFaviconUrlPath("")
                              .withCustomMonogramUrlPath(""))
                      .withCustomTheme(
                          new ThemeConfiguration()
                              .withPrimaryColor("")
                              .withSuccessColor("")
                              .withErrorColor("")
                              .withWarningColor("")
                              .withInfoColor("")));
      Entity.getSystemRepository().createNewSetting(setting);
    }

    // Initialise Login Configuration
    // Initialise Logo Setting
    Settings storedLoginConf =
        Entity.getSystemRepository().getConfigWithKey(LOGIN_CONFIGURATION.toString());
    if (storedLoginConf == null) {
      // Only in case a config doesn't exist in DB we insert it
      Settings setting =
          new Settings()
              .withConfigType(LOGIN_CONFIGURATION)
              .withConfigValue(
                  new LoginConfiguration()
                      .withMaxLoginFailAttempts(3)
                      .withAccessBlockTime(30)
                      .withJwtTokenExpiryTime(3600));
      Entity.getSystemRepository().createNewSetting(setting);
    }

    // Initialise Search Settings
    Settings storedSearchSettings =
        Entity.getSystemRepository().getConfigWithKey(SEARCH_SETTINGS.toString());
    if (storedSearchSettings == null) {
      try {
        List<String> jsonDataFiles =
            EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
        if (!jsonDataFiles.isEmpty()) {
          String json =
              CommonUtil.getResourceAsStream(
                  EntityRepository.class.getClassLoader(), jsonDataFiles.get(0));
          Settings setting =
              new Settings()
                  .withConfigType(SEARCH_SETTINGS)
                  .withConfigValue(JsonUtils.readValue(json, SearchSettings.class));
          Entity.getSystemRepository().createNewSetting(setting);
        }
      } catch (IOException e) {
        LOG.error("Failed to read default search settings. Message: {}", e.getMessage(), e);
      }
    }

    // Initialise Certification Settings
    Settings certificationSettings =
        Entity.getSystemRepository().getConfigWithKey(ASSET_CERTIFICATION_SETTINGS.toString());
    if (certificationSettings == null) {
      Settings setting =
          new Settings()
              .withConfigType(ASSET_CERTIFICATION_SETTINGS)
              .withConfigValue(
                  new AssetCertificationSettings()
                      .withAllowedClassification("Certification")
                      .withValidityPeriod("P30D"));
      Entity.getSystemRepository().createNewSetting(setting);
    }

    // Initialise Workflow Settings
    Settings workflowSettings =
        Entity.getSystemRepository().getConfigWithKey(WORKFLOW_SETTINGS.toString());
    if (workflowSettings == null) {
      Settings setting =
          new Settings()
              .withConfigType(WORKFLOW_SETTINGS)
              .withConfigValue(
                  new WorkflowSettings()
                      .withExecutorConfiguration(new ExecutorConfiguration())
                      .withHistoryCleanUpConfiguration(new HistoryCleanUpConfiguration()));
      Entity.getSystemRepository().createNewSetting(setting);
    }

    Settings lineageSettings =
        Entity.getSystemRepository().getConfigWithKey(LINEAGE_SETTINGS.toString());
    if (lineageSettings == null) {
      // Only in case a config doesn't exist in DB we insert it
      Settings setting =
          new Settings()
              .withConfigType(LINEAGE_SETTINGS)
              .withConfigValue(
                  new LineageSettings()
                      .withDownstreamDepth(2)
                      .withUpstreamDepth(2)
                      .withLineageLayer(LineageLayer.ENTITY_LINEAGE));
      Entity.getSystemRepository().createNewSetting(setting);
    }

    // Initialize Authentication Configuration
    Settings storedAuthConfig =
        Entity.getSystemRepository().getConfigWithKey(AUTHENTICATION_CONFIGURATION.toString());
    if (storedAuthConfig == null) {
      AuthenticationConfiguration authConfig = applicationConfig.getAuthenticationConfiguration();
      Settings setting =
          new Settings().withConfigType(AUTHENTICATION_CONFIGURATION).withConfigValue(authConfig);

      Entity.getSystemRepository().createNewSetting(setting);
    }

    // Initialize Authorizer Configuration
    Settings storedAuthzConfig =
        Entity.getSystemRepository().getConfigWithKey(AUTHORIZER_CONFIGURATION.toString());
    if (storedAuthzConfig == null) {
      AuthorizerConfiguration authzConfig = applicationConfig.getAuthorizerConfiguration();
      Settings setting =
          new Settings().withConfigType(AUTHORIZER_CONFIGURATION).withConfigValue(authzConfig);

      Entity.getSystemRepository().createNewSetting(setting);
    }

    Settings storedScimConfig =
        Entity.getSystemRepository().getConfigWithKey(SCIM_CONFIGURATION.toString());
    if (storedScimConfig == null) {
      ScimConfiguration scimConfiguration = applicationConfig.getScimConfiguration();
      Settings setting =
          new Settings()
              .withConfigType(AUTHENTICATION_CONFIGURATION)
              .withConfigValue(scimConfiguration);
      Entity.getSystemRepository().createNewSetting(setting);
    }

    Settings entityRulesSettings =
        Entity.getSystemRepository()
            .getConfigWithKey(SettingsType.ENTITY_RULES_SETTINGS.toString());
    if (entityRulesSettings == null) {
      try {
        List<String> jsonDataFiles =
            EntityUtil.getJsonDataResources(".*json/data/settings/entityRulesSettings.json$");
        if (!jsonDataFiles.isEmpty()) {
          String json =
              CommonUtil.getResourceAsStream(
                  EntityRepository.class.getClassLoader(), jsonDataFiles.get(0));
          Settings setting =
              new Settings()
                  .withConfigType(ENTITY_RULES_SETTINGS)
                  .withConfigValue(JsonUtils.readValue(json, EntityRulesSettings.class));
          Entity.getSystemRepository().createNewSetting(setting);
        }
      } catch (IOException e) {
        LOG.error("Failed to read default Enitty Rules settings. Message: {}", e.getMessage(), e);
      }
    }
  }

  public static <T> T getSetting(SettingsType settingName, Class<T> clazz) {
    try {
      String json = JsonUtils.pojoToJson(CACHE.get(settingName.toString()).getConfigValue());
      return JsonUtils.readValue(json, clazz);
    } catch (Exception ex) {
      LOG.error("Failed to fetch Settings . Setting {}", settingName, ex);
      throw new EntityNotFoundException("Setting not found");
    }
  }

  public static <T> T getSettingOrDefault(
      SettingsType settingName, T defaultValue, Class<T> clazz) {
    try {
      String json = JsonUtils.pojoToJson(CACHE.get(settingName.toString()).getConfigValue());
      return JsonUtils.readValue(json, clazz);
    } catch (Exception ex) {
      LOG.error("Failed to fetch Settings . Setting {}", settingName, ex);
      return defaultValue;
    }
  }

  public static void cleanUp() {
    CACHE.invalidateAll();
    initialized = false;
  }

  public static void invalidateSettings(String settingsName) {
    try {
      CACHE.invalidate(settingsName);
      // If search settings are being invalidated, also invalidate aggregated fields
      if (SEARCH_SETTINGS.toString().equals(settingsName)) {
        CACHE.invalidate(SEARCH_SETTINGS_AGGREGATED_FIELDS);
      }
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for settings {}", settingsName, ex);
    }
  }

  private static SmtpSettings getDefaultSmtpSettings() {
    return new SmtpSettings()
        .withPassword(StringUtils.EMPTY)
        .withEmailingEntity("OpenMetadata")
        .withSupportUrl("https://slack.open-metadata.org")
        .withEnableSmtpServer(Boolean.FALSE)
        .withTransportationStrategy(SmtpSettings.TransportationStrategy.SMTP_TLS)
        .withTemplates(SmtpSettings.Templates.OPENMETADATA);
  }

  @SuppressWarnings("unchecked")
  public static Map<String, Float> getAggregatedSearchFields() {
    try {
      Settings aggregatedFields = CACHE.get(SEARCH_SETTINGS_AGGREGATED_FIELDS);
      Map<String, Float> fields = (Map<String, Float>) aggregatedFields.getConfigValue();
      return fields;
    } catch (Exception ex) {
      LOG.error("Failed to fetch aggregated search fields", ex);
      // Return default fields as fallback
      return SearchIndex.getDefaultFields();
    }
  }

  private static Settings computeAggregatedSearchFields() {
    Map<String, Float> fields = new HashMap<>(SearchIndex.getDefaultFields());

    try {
      SearchSettings searchSettings = getSetting(SEARCH_SETTINGS, SearchSettings.class);
      if (searchSettings != null && searchSettings.getAssetTypeConfigurations() != null) {
        SearchRepository searchRepository = Entity.getSearchRepository();

        for (AssetTypeConfiguration assetConfig : searchSettings.getAssetTypeConfigurations()) {
          String entityType = assetConfig.getAssetType();

          // Check if this entity type's index has dataAsset as a parent alias
          IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
          if (indexMapping != null
              && indexMapping.getParentAliases() != null
              && indexMapping.getParentAliases().contains("dataAsset")) {
            // Add fields from this asset type
            if (assetConfig.getSearchFields() != null) {
              for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
                fields.put(fieldBoost.getField(), fieldBoost.getBoost().floatValue());
              }
            }
          }
        }
      }
    } catch (Exception ex) {
      LOG.error("Error computing aggregated search fields", ex);
    }

    // Create a dummy Settings object to store in cache
    return new Settings()
        .withConfigType(SettingsType.SEARCH_SETTINGS)
        .withConfigValue(Collections.unmodifiableMap(fields));
  }

  // Special key for caching aggregated search fields
  public static final String SEARCH_SETTINGS_AGGREGATED_FIELDS =
      "SEARCH_SETTINGS_AGGREGATED_FIELDS";

  static class SettingsLoader extends CacheLoader<String, Settings> {
    @Override
    public @NonNull Settings load(@CheckForNull String settingsName) {
      Settings fetchedSettings;

      // Handle special case for aggregated fields
      if (SEARCH_SETTINGS_AGGREGATED_FIELDS.equals(settingsName)) {
        return computeAggregatedSearchFields();
      }

      switch (SettingsType.fromValue(settingsName)) {
        case EMAIL_CONFIGURATION -> {
          fetchedSettings = Entity.getSystemRepository().getEmailConfigInternal();
          if (fetchedSettings == null) {
            return new Settings()
                .withConfigType(EMAIL_CONFIGURATION)
                .withConfigValue(getDefaultSmtpSettings());
          }
          LOG.info("Loaded Email Setting");
        }
        case OPEN_METADATA_BASE_URL_CONFIGURATION -> {
          fetchedSettings = Entity.getSystemRepository().getOMBaseUrlConfigInternal();
        }
        case SLACK_APP_CONFIGURATION -> {
          // Only if available
          fetchedSettings = Entity.getSystemRepository().getSlackApplicationConfigInternal();
          LOG.info("Loaded Slack Application Configuration");
        }
        case SLACK_BOT -> {
          // Only if available
          fetchedSettings = Entity.getSystemRepository().getSlackbotConfigInternal();
          LOG.info("Loaded Slack Bot Configuration");
        }
        case SLACK_INSTALLER -> {
          // Only if available
          fetchedSettings = Entity.getSystemRepository().getSlackInstallerConfigInternal();
          LOG.info("Loaded Slack Installer Configuration");
        }
        case SLACK_STATE -> {
          // Only if available
          fetchedSettings = Entity.getSystemRepository().getSlackStateConfigInternal();
          LOG.info("Loaded Slack state Configuration");
        }
        case SEARCH_SETTINGS -> {
          fetchedSettings = Entity.getSystemRepository().getConfigWithKey(settingsName);
          LOG.info("Loaded Setting {}", fetchedSettings.getConfigType());
          // When SEARCH_SETTINGS are loaded, invalidate aggregated fields cache
          CACHE.invalidate(SEARCH_SETTINGS_AGGREGATED_FIELDS);
        }
        default -> {
          fetchedSettings = Entity.getSystemRepository().getConfigWithKey(settingsName);
          LOG.info("Loaded Setting {}", fetchedSettings.getConfigType());
        }
      }
      return fetchedSettings;
    }
  }
}
