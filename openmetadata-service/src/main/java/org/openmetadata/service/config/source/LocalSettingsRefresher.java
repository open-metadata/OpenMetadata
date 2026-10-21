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

import java.util.Set;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * Refreshes what this server derives from a setting: its cached value, and for the security
 * settings the authentication system. Work that changes shared state, such as rebuilding search
 * indexes, belongs to the server that made the change and is never repeated here.
 */
public final class LocalSettingsRefresher implements SettingsRefresher {
  private static final Set<SettingsType> SECURITY_SETTINGS =
      Set.of(
          SettingsType.AUTHENTICATION_CONFIGURATION,
          SettingsType.AUTHORIZER_CONFIGURATION,
          SettingsType.MCP_CONFIGURATION);

  @Override
  public void refresh(SettingsType settingsType) {
    SettingsCache.invalidateSettings(settingsType.value());
    if (SECURITY_SETTINGS.contains(settingsType)) {
      SecurityConfigurationManager.getInstance().reloadIfStoredChanged();
    } else {
      Entity.getSystemRepository().refreshLocalState(settingsType);
    }
  }
}
