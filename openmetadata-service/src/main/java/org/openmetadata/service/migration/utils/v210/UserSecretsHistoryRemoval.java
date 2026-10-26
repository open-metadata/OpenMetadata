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

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.service.jdbi3.UserRepository.AUTH_MECHANISM_FIELD;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * A user's authentication mechanism, a password hash or a bot token, was stored in every change
 * event and every version of the user, which alerts, the event log and anyone who may view the user
 * could read. New events and versions no longer carry it; this removes it from the ones stored.
 */
@Slf4j
public final class UserSecretsHistoryRemoval {

  /** Run once per version through {@code DataMigrationStep}. */
  public static final String STEP_NAME = "user-secrets-history-removal";

  private UserSecretsHistoryRemoval() {}

  public static void removeUserSecretsFromHistory(Handle handle, ConnectionType connectionType) {
    StoredChangeEventCleanup.removeEntityFields(
        handle, connectionType, Set.of(Entity.USER), Set.of(AUTH_MECHANISM_FIELD));
    int versions = handle.createUpdate(removeFromVersionsSql(connectionType)).execute();
    LOG.info("Removed {} from {} user versions", AUTH_MECHANISM_FIELD, versions);
  }

  private static String removeFromVersionsSql(ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> "UPDATE entity_extension"
          + " SET json = JSON_REMOVE(json, '$.authenticationMechanism')"
          + " WHERE extension LIKE 'user.version.%'"
          + " AND JSON_CONTAINS_PATH(json, 'one', '$.authenticationMechanism')";
      case POSTGRES -> "UPDATE entity_extension SET json = json - 'authenticationMechanism'"
          + " WHERE extension LIKE 'user.version.%'"
          + " AND json -> 'authenticationMechanism' IS NOT NULL";
    };
  }
}
