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

import static org.openmetadata.schema.settings.SettingsType.CUSTOM_LOGO_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.EMAIL_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.LOGIN_CONFIGURATION;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.api.configuration.LogoConfiguration;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
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
      SmtpSettings emailConfig = applicationConfig.getSmtpSettings();
      Settings setting =
          new Settings().withConfigType(EMAIL_CONFIGURATION).withConfigValue(emailConfig);
      systemRepository.createNewSetting(setting);
    }

    // Initialise Logo Setting
    Settings storedCustomLogoConf =
        systemRepository.getConfigWithKey(CUSTOM_LOGO_CONFIGURATION.toString());
    if (storedCustomLogoConf == null) {
      // Only in case a config doesn't exist in DB we insert it
      Settings setting =
          new Settings()
              .withConfigType(CUSTOM_LOGO_CONFIGURATION)
              .withConfigValue(
                  new LogoConfiguration()
                      .withCustomLogoUrlPath("")
                      .withCustomMonogramUrlPath("")
                      .withCustomFaviconUrlPath(""));
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
                      .withAccessBlockTime(600)
                      .withJwtTokenExpiryTime(3600));
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
    public Settings load(@CheckForNull String settingsName) {
      Settings fetchedSettings;
      switch (SettingsType.fromValue(settingsName)) {
        case EMAIL_CONFIGURATION:
          fetchedSettings = systemRepository.getEmailConfigInternal();
          LOG.info("Loaded Email Setting");
          break;
        case SLACK_APP_CONFIGURATION:
          // Only if available
          fetchedSettings = systemRepository.getSlackApplicationConfigInternal();
          LOG.info("Loaded Slack Application Configuration");
          break;
        default:
          fetchedSettings = systemRepository.getConfigWithKey(settingsName);
          LOG.info("Loaded Setting {}", fetchedSettings.getConfigType());
      }
      return fetchedSettings;
    }
  }
}
