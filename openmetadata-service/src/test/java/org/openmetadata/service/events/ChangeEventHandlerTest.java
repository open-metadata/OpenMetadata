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

package org.openmetadata.service.events;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.configuration.NotificationSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Change events for Query entities are opt-in through the notificationSettings setting, since
 * queries are usually ingested in large bulk batches.
 */
class ChangeEventHandlerTest {
  private static final String NOTIFICATION_SETTINGS_KEY =
      SettingsType.NOTIFICATION_SETTINGS.value();

  @AfterEach
  void cleanup() {
    SettingsCache.invalidateSettings(NOTIFICATION_SETTINGS_KEY);
  }

  @Test
  void testQueryChangeEventsAreSuppressedByDefault() {
    withNotificationSettings(
        new NotificationSettings(),
        () -> assertTrue(ChangeEventHandler.isChangeEventSuppressed(Entity.QUERY)));
  }

  @Test
  void testQueryChangeEventsAreSuppressedWhenDisabled() {
    withNotificationSettings(
        new NotificationSettings().withEnableQueryChangeEvents(false),
        () -> assertTrue(ChangeEventHandler.isChangeEventSuppressed(Entity.QUERY)));
  }

  @Test
  void testQueryChangeEventsAreRecordedWhenEnabled() {
    withNotificationSettings(
        new NotificationSettings().withEnableQueryChangeEvents(true),
        () -> assertFalse(ChangeEventHandler.isChangeEventSuppressed(Entity.QUERY)));
  }

  @Test
  void testQueryChangeEventsAreSuppressedWhenTheSettingIsNotConfigured() {
    withNotificationSettings(
        null, () -> assertTrue(ChangeEventHandler.isChangeEventSuppressed(Entity.QUERY)));
  }

  @Test
  void testWorkflowChangeEventsAreAlwaysSuppressed() {
    withNotificationSettings(
        new NotificationSettings().withEnableQueryChangeEvents(true),
        () -> assertTrue(ChangeEventHandler.isChangeEventSuppressed(Entity.WORKFLOW)));
  }

  @Test
  void testOtherEntitiesAreNotAffectedBySettings() {
    withNotificationSettings(
        new NotificationSettings().withEnableQueryChangeEvents(false),
        () -> assertFalse(ChangeEventHandler.isChangeEventSuppressed(Entity.TABLE)));
  }

  private void withNotificationSettings(NotificationSettings settings, Runnable assertions) {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SystemRepository systemRepository = mock(SystemRepository.class);
      Settings storedSettings =
          settings == null
              ? null
              : new Settings()
                  .withConfigType(SettingsType.NOTIFICATION_SETTINGS)
                  .withConfigValue(settings);
      when(systemRepository.getConfigWithKey(NOTIFICATION_SETTINGS_KEY)).thenReturn(storedSettings);
      entityMock.when(Entity::getSystemRepository).thenReturn(systemRepository);

      SettingsCache.invalidateSettings(NOTIFICATION_SETTINGS_KEY);

      assertions.run();
    }
  }
}
