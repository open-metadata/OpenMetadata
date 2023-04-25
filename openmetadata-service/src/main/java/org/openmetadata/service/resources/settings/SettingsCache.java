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

import static org.openmetadata.schema.settings.SettingsType.EMAIL_CONFIGURATION;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class SettingsCache {
  private static final SettingsCache INSTANCE = new SettingsCache();
  private static volatile boolean INITIALIZED = false;
  protected static LoadingCache<String, Settings> SETTINGS_CACHE;
  protected static SystemRepository systemRepository;

  // Expected to be called only once from the DefaultAuthorizer
  public static void initialize(CollectionDAO dao, OpenMetadataApplicationConfig config) {
    if (!INITIALIZED) {
      SETTINGS_CACHE =
          CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(3, TimeUnit.MINUTES).build(new SettingsLoader());
      systemRepository = new SystemRepository(dao.systemDAO());
      INITIALIZED = true;
      createEmailConfiguration(config);
    }
  }

  private static void createEmailConfiguration(OpenMetadataApplicationConfig applicationConfig) {
    Settings storedSettings = systemRepository.getConfigWithKey(EMAIL_CONFIGURATION.toString());
    if (storedSettings == null) {
      // Only in case a config doesn't exist in DB we insert it
      SmtpSettings emailConfig = applicationConfig.getSmtpSettings();
      Settings setting = new Settings().withConfigType(EMAIL_CONFIGURATION).withConfigValue(emailConfig);
      systemRepository.createNewSetting(setting);
    }
  }

  public static SettingsCache getInstance() {
    return INSTANCE;
  }

  public <T> T getSetting(SettingsType settingName, Class<T> clazz) throws RuntimeException {
    try {
      String json = JsonUtils.pojoToJson(SETTINGS_CACHE.get(settingName.toString()).getConfigValue());
      return JsonUtils.readValue(json, clazz);
    } catch (Exception ex) {
      throw new RuntimeException(ex);
    }
  }

  public static void cleanUp() {
    SETTINGS_CACHE.invalidateAll();
    INITIALIZED = false;
  }

  public void invalidateSettings(String settingsName) {
    try {
      SETTINGS_CACHE.invalidate(settingsName);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for settings {}", settingsName, ex);
    }
  }

  static class SettingsLoader extends CacheLoader<String, Settings> {
    @Override
    public Settings load(@CheckForNull String settingsName) {
      Settings fetchedSettings;
      if (SettingsType.EMAIL_CONFIGURATION.value().equals(settingsName)) {
        fetchedSettings = systemRepository.getEmailConfigInternal();
        LOG.info("Loaded Email Setting");
      } else {
        fetchedSettings = systemRepository.getConfigWithKey(settingsName);
        LOG.info("Loaded Setting {}", fetchedSettings.getConfigType());
      }
      return fetchedSettings;
    }
  }
}
