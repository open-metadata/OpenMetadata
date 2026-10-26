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

package org.openmetadata.service.migration.utils.v208;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

/**
 * Names the alerts an app install created from its marketplace definition, before the 2.0.8
 * post-data SQL disables them and unties them from their app. An alert an app's own code
 * created runs that app's consumer and is left alone; one named in the definition, or one that
 * uses the default alert consumer, came from the definition, so an admin should review it before
 * enabling it again. A SQL script cannot log, so this read is the only part of the cleanup in
 * Java; it is plain SQL with fixed names, so later code cannot change what it reads.
 */
@Slf4j
public final class AppCreatedAlerts {

  private static final String LINKED_TO_AN_APP =
      "SELECT DISTINCT e.name FROM event_subscription_entity e"
          + " JOIN entity_relationship r ON r.toId = e.id"
          + " AND r.fromEntity = 'app' AND r.toEntity = 'eventsubscription' AND r.relation = 0"
          + " LEFT JOIN installed_apps a ON a.id = r.fromId"
          + " LEFT JOIN apps_marketplace m ON m.name = a.name";

  private static final String MYSQL =
      LINKED_TO_AN_APP
          + " WHERE JSON_EXTRACT(e.json, '$.className') IS NULL"
          + " OR JSON_UNQUOTE(JSON_EXTRACT(e.json, '$.className')) = 'alert'"
          + " OR JSON_UNQUOTE(JSON_EXTRACT(e.json, '$.className')) LIKE '%.AlertPublisher'"
          + " OR JSON_CONTAINS(COALESCE(JSON_EXTRACT(m.json, '$.eventSubscriptions[*].name'),"
          + " JSON_ARRAY()), JSON_QUOTE(e.name))";

  private static final String POSTGRES =
      LINKED_TO_AN_APP
          + " WHERE e.json ->> 'className' IS NULL"
          + " OR e.json ->> 'className' = 'alert'"
          + " OR e.json ->> 'className' LIKE '%.AlertPublisher'"
          + " OR EXISTS (SELECT 1 FROM jsonb_array_elements("
          + " CASE WHEN jsonb_typeof(m.json -> 'eventSubscriptions') = 'array'"
          + " THEN m.json -> 'eventSubscriptions' ELSE '[]'::jsonb END) s"
          + " WHERE s ->> 'name' = e.name)";

  private AppCreatedAlerts() {}

  public static void logForReviewOnMySql(Handle handle) {
    logForReview(handle, MYSQL);
  }

  public static void logForReviewOnPostgres(Handle handle) {
    logForReview(handle, POSTGRES);
  }

  private static void logForReview(Handle handle, String query) {
    handle
        .createQuery(query)
        .mapTo(String.class)
        .list()
        .forEach(
            name ->
                LOG.warn(
                    "Alert {} was created by an app install from its marketplace definition; the"
                        + " upgrade disables it. Review it before enabling it again.",
                    name));
  }
}
