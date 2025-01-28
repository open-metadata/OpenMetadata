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
import static org.openmetadata.schema.settings.SettingsType.CUSTOM_UI_THEME_PREFERENCE;
import static org.openmetadata.schema.settings.SettingsType.EMAIL_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.LINEAGE_SETTINGS;
import static org.openmetadata.schema.settings.SettingsType.LOGIN_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.SEARCH_SETTINGS;
import static org.openmetadata.schema.settings.SettingsType.WORKFLOW_SETTINGS;

import com.cronutils.utils.StringUtils;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import okhttp3.HttpUrl;
import org.openmetadata.api.configuration.LogoConfiguration;
import org.openmetadata.api.configuration.ThemeConfiguration;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.lineage.LineageLayer;
import org.openmetadata.schema.api.lineage.LineageSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.configuration.ExecutorConfiguration;
import org.openmetadata.schema.configuration.HistoryCleanUpConfiguration;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class SettingsCache {
  private static volatile boolean initialized = false;
  protected static final LoadingCache<String, Settings> CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(1000)
          .expireAfterWrite(3, TimeUnit.MINUTES)
          .build(new SettingsLoader());
  protected static SystemRepository systemRepository;

  private SettingsCache() {
    // Private constructor for singleton
  }

  // Expected to be called only once from the DefaultAuthorizer
  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!initialized) {
      systemRepository = Entity.getSystemRepository();
      initialized = true;
      createDefaultConfiguration(config);
    }
  }

  private static void createDefaultConfiguration(OpenMetadataApplicationConfig applicationConfig) {
    // Initialise Email Setting
    Settings storedSettings = systemRepository.getConfigWithKey(EMAIL_CONFIGURATION.toString());
    if (storedSettings == null) {
      // Only in case a config doesn't exist in DB we insert it
      SmtpSettings emailConfig =
          new SmtpSettings()
              .withPassword(StringUtils.EMPTY)
              .withEmailingEntity("OpenMetadata")
              .withSupportUrl("https://slack.open-metadata.org")
              .withEnableSmtpServer(Boolean.FALSE)
              .withTransportationStrategy(SmtpSettings.TransportationStrategy.SMTP_TLS)
              .withTemplates(SmtpSettings.Templates.OPENMETADATA);

      Settings setting =
          new Settings().withConfigType(EMAIL_CONFIGURATION).withConfigValue(emailConfig);
      systemRepository.createNewSetting(setting);
    }

    // Initialise OM base url setting
    Settings storedOpenMetadataBaseUrlConfiguration =
        systemRepository.getConfigWithKey(OPEN_METADATA_BASE_URL_CONFIGURATION.toString());
    if (storedOpenMetadataBaseUrlConfiguration == null) {
      String url =
          new HttpUrl.Builder().scheme("http").host("localhost").port(8585).build().toString();
      String baseUrl = url.substring(0, url.length() - 1);

      Settings setting =
          new Settings()
              .withConfigType(OPEN_METADATA_BASE_URL_CONFIGURATION)
              .withConfigValue(new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl(baseUrl));
      systemRepository.createNewSetting(setting);
    }

    // Initialise Theme Setting
    Settings storedCustomUiThemeConf =
        systemRepository.getConfigWithKey(CUSTOM_UI_THEME_PREFERENCE.toString());
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
      systemRepository.createNewSetting(setting);
    }

    // Initialise Login Configuration
    // Initialise Logo Setting
    Settings storedLoginConf = systemRepository.getConfigWithKey(LOGIN_CONFIGURATION.toString());
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
      systemRepository.createNewSetting(setting);
    }

    // Initialise Rbac Settings
    Settings storedRbacSettings = systemRepository.getConfigWithKey(SEARCH_SETTINGS.toString());
    if (storedRbacSettings == null) {
      // Only in case a config doesn't exist in DB we insert it
      Settings setting =
          new Settings()
              .withConfigType(SEARCH_SETTINGS)
              .withConfigValue(new SearchSettings().withEnableAccessControl(false));
      systemRepository.createNewSetting(setting);
    }

    // Initialise Certification Settings
    Settings certificationSettings =
        systemRepository.getConfigWithKey(ASSET_CERTIFICATION_SETTINGS.toString());
    if (certificationSettings == null) {
      Settings setting =
          new Settings()
              .withConfigType(ASSET_CERTIFICATION_SETTINGS)
              .withConfigValue(
                  new AssetCertificationSettings()
                      .withAllowedClassification("Certification")
                      .withValidityPeriod("P30D"));
      systemRepository.createNewSetting(setting);
    }

    // Initialise Workflow Settings
    Settings workflowSettings = systemRepository.getConfigWithKey(WORKFLOW_SETTINGS.toString());
    if (workflowSettings == null) {
      Settings setting =
          new Settings()
              .withConfigType(WORKFLOW_SETTINGS)
              .withConfigValue(
                  new WorkflowSettings()
                      .withExecutorConfiguration(new ExecutorConfiguration())
                      .withHistoryCleanUpConfiguration(new HistoryCleanUpConfiguration()));
      systemRepository.createNewSetting(setting);
    }

    Settings lineageSettings = systemRepository.getConfigWithKey(LINEAGE_SETTINGS.toString());
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
      systemRepository.createNewSetting(setting);
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

  public static void cleanUp() {
    CACHE.invalidateAll();
    initialized = false;
  }

  public static void invalidateSettings(String settingsName) {
    try {
      CACHE.invalidate(settingsName);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for settings {}", settingsName, ex);
    }
  }

  static class SettingsLoader extends CacheLoader<String, Settings> {
    @Override
    public @NonNull Settings load(@CheckForNull String settingsName) {
      Settings fetchedSettings;
      switch (SettingsType.fromValue(settingsName)) {
        case EMAIL_CONFIGURATION -> {
          fetchedSettings = systemRepository.getEmailConfigInternal();
          LOG.info("Loaded Email Setting");
        }
        case OPEN_METADATA_BASE_URL_CONFIGURATION -> {
          fetchedSettings = systemRepository.getOMBaseUrlConfigInternal();
        }
        case SLACK_APP_CONFIGURATION -> {
          // Only if available
          fetchedSettings = systemRepository.getSlackApplicationConfigInternal();
          LOG.info("Loaded Slack Application Configuration");
        }
        case SLACK_BOT -> {
          // Only if available
          fetchedSettings = systemRepository.getSlackbotConfigInternal();
          LOG.info("Loaded Slack Bot Configuration");
        }
        case SLACK_INSTALLER -> {
          // Only if available
          fetchedSettings = systemRepository.getSlackInstallerConfigInternal();
          LOG.info("Loaded Slack Installer Configuration");
        }
        case SLACK_STATE -> {
          // Only if available
          fetchedSettings = systemRepository.getSlackStateConfigInternal();
          LOG.info("Loaded Slack state Configuration");
        }
        default -> {
          fetchedSettings = systemRepository.getConfigWithKey(settingsName);
          LOG.info("Loaded Setting {}", fetchedSettings.getConfigType());
        }
      }
      return fetchedSettings;
    }
  }
}
