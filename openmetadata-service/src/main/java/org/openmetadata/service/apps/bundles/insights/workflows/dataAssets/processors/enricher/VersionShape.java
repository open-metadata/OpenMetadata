/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher;

/**
 * Hydration shape of the entity inside a {@link VersionedWindow}. Steps that resolve external
 * references (notably {@code OwnerTeamStep} via {@code OwnerResolver}) may use this to choose
 * between using the ref's name directly (when populated) or doing a by-id lookup.
 *
 * <p>{@link #LATEST_HYDRATED}: the entity came from {@code setFieldsInBulk} /
 * {@code setFieldsInternal}; references carry FQN, name, displayName, etc.
 *
 * <p>{@link #HISTORICAL_RAW}: the entity was deserialized from a raw {@code entity_extension} JSON
 * row; references are bare {@code {id, type}} with no FQN. Steps that dereference such refs by FQN
 * will NPE — they must resolve by id.
 */
public enum VersionShape {
  LATEST_HYDRATED,
  HISTORICAL_RAW
}
