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

import static org.openmetadata.schema.settings.SettingsType.ACTIVITY_FEED_FILTER_SETTING;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SettingsRepository;

@Slf4j
public class SettingsCache {
  private static final SettingsCache INSTANCE = new SettingsCache();
  private static volatile boolean INITIALIZED = false;
  protected static LoadingCache<String, Settings> SETTINGS_CACHE;
  protected static SettingsRepository SETTINGS_REPOSITORY;

  // Expected to be called only once from the DefaultAuthorizer
  public static void initialize(CollectionDAO dao) {
    if (!INITIALIZED) {
      SETTINGS_CACHE =
          CacheBuilder.newBuilder()
              .maximumSize(1000)
              .expireAfterAccess(1, TimeUnit.MINUTES)
              .build(new SettingsLoader());
      SETTINGS_REPOSITORY = new SettingsRepository(dao);
      INITIALIZED = true;
    }
  }

  public static SettingsCache getInstance() {
    return INSTANCE;
  }

  public Settings getEventFilters() throws EntityNotFoundException {
    try {
      return SETTINGS_CACHE.get(ACTIVITY_FEED_FILTER_SETTING.toString());
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public void putSettings(Settings setting) throws RuntimeException {
    SETTINGS_CACHE.put(setting.getConfigType().toString(), setting);
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
    public Settings load(@CheckForNull String settingsName) throws IOException {
      Settings setting = SETTINGS_REPOSITORY.getConfigWithKey(settingsName);
      LOG.info("Loaded Setting {}", setting.getConfigType());
      return setting;
    }
  }
}
