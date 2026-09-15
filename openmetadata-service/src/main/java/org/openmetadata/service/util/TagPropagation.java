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

package org.openmetadata.service.util;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.TagPropagationSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Whether tags flow from a parent (service, database, schema) down to the assets beneath it.
 *
 * <p>Off by default, and deliberately so: turning it on changes which tags every affected asset
 * reports, which in turn changes what existing {@code matchAnyTag} policies match. That is a
 * decision for an operator to make knowingly rather than something an upgrade should do to them.
 */
@Slf4j
public final class TagPropagation {

  private TagPropagation() {}

  /**
   * Reads the setting through {@link SettingsCache}, so the answer follows an admin toggling it
   * without a restart. Any failure reads as "off": this is consulted on every entity read, and
   * defaulting to on would silently alter tag-based authorization if the setting were unreadable.
   */
  public static boolean isEnabled() {
    try {
      TagPropagationSettings settings =
          SettingsCache.getSetting(
              SettingsType.TAG_PROPAGATION_SETTINGS, TagPropagationSettings.class);
      return settings != null && Boolean.TRUE.equals(settings.getEnabled());
    } catch (Exception e) {
      LOG.debug("Tag propagation setting unavailable; treating it as disabled", e);
      return false;
    }
  }
}
