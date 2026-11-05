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

import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheInvalidationPubSub;

/**
 * Tells the other servers a setting was written, when Redis is configured, so they pick it up
 * without waiting for their next poll of the database.
 */
public final class SettingsChangeAnnouncer {
  private static final String CHANGED = "changed";

  private SettingsChangeAnnouncer() {}

  public static void announce(SettingsType settingsType) {
    CacheInvalidationPubSub pubSub = CacheBundle.getCacheInvalidationPubSub();
    if (pubSub != null) {
      pubSub.publish(CacheInvalidationPubSub.TYPE_SETTINGS, null, settingsType.value(), CHANGED);
    }
  }
}
