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

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * What the {@code deployment_snapshot} column of a setting holds: the deployment value applied by
 * the last reconciliation (secrets encrypted) and facts about that reconciliation.
 *
 * @param values the deployment value applied last time
 * @param meta facts about the reconciliation that applied it
 */
@Slf4j
public record DeploymentSnapshot(JsonNode values, Meta meta) {

  /**
   * @param mode the source mode the setting was reconciled in; the write guard of processes that do
   *     not reconcile, such as the CLI, reads it from here
   * @param appVersion the server version that reconciled; an older server never writes over it
   * @param appliedJsonHash the database's hash of the stored value the reconciliation wrote, so
   *     other servers can tell that write from a change made through the API
   * @param warned warnings already logged, so a start does not repeat them
   * @param previousStored the stored value before the setting switched to ENV mode
   */
  public record Meta(
      ConfigSourceMode mode,
      String appVersion,
      String appliedJsonHash,
      List<String> warned,
      JsonNode previousStored) {
    public Meta {
      warned = warned == null ? List.of() : List.copyOf(warned);
    }
  }

  /**
   * An unreadable snapshot counts as none, so the setting is reconciled as on first sight instead
   * of stopping the server or the settings watcher.
   */
  public static Optional<DeploymentSnapshot> parse(String json) {
    Optional<DeploymentSnapshot> snapshot = Optional.empty();
    if (json != null && !json.isBlank()) {
      try {
        snapshot = Optional.ofNullable(JsonUtils.readValueLenient(json, DeploymentSnapshot.class));
      } catch (JsonParsingException unreadable) {
        LOG.warn("Ignoring an unreadable deployment snapshot: {}", unreadable.getMessage());
      }
    }
    return snapshot;
  }

  public String toJson() {
    return JsonUtils.pojoToJson(this);
  }
}
