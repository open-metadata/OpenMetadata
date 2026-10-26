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

package org.openmetadata.service.migration.utils.v207;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

/**
 * Names the alerts an app install created, before the 2.0.7 post-data SQL disables them and unties
 * them from their app. No shipped app creates alerts, so an admin should review each one before
 * enabling it again. A SQL script cannot log, so this read is the only part of the cleanup in Java;
 * it is plain SQL with fixed names, so later code cannot change what it reads.
 */
@Slf4j
public final class AppCreatedAlerts {

  private static final String APP_CREATED_ALERTS =
      "SELECT e.name FROM event_subscription_entity e JOIN entity_relationship r ON r.toId = e.id"
          + " WHERE r.fromEntity = 'app' AND r.toEntity = 'eventsubscription' AND r.relation = 0";

  private AppCreatedAlerts() {}

  public static void logForReview(Handle handle) {
    handle
        .createQuery(APP_CREATED_ALERTS)
        .mapTo(String.class)
        .list()
        .forEach(
            name ->
                LOG.warn(
                    "Alert {} was created by an app install; the upgrade disables it. Review it"
                        + " before enabling it again.",
                    name));
  }
}
