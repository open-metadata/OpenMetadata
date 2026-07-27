/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.rdf;

import java.util.Set;

/**
 * Entity types that are never represented in the RDF knowledge graph — neither as nodes nor as the
 * endpoint of any relationship edge. The same policy gates both the bulk reindex ({@code
 * RdfIndexApp} / {@code RdfBatchProcessor}) and the live per-write sync ({@link RdfUpdater}), so an
 * excluded type stays out of RDF "at all" rather than reappearing between weekly rebuilds.
 *
 * <p>{@code aiChart} is a Collate AI-generated chart entity that is not part of the metadata
 * knowledge graph; its rows additionally fail to deserialize during the RDF read pass, so each one
 * was dropped from the graph with an error on every reindex. Excluding it up front keeps the graph
 * free of dangling references and stops the reindex from logging a failure for every aiChart row.
 */
public final class RdfExcludedEntities {
  private static final String AI_CHART = "aiChart";

  public static final Set<String> EXCLUDED_ENTITY_TYPES = Set.of(AI_CHART);

  private RdfExcludedEntities() {}

  public static boolean isExcluded(String entityType) {
    return entityType != null && EXCLUDED_ENTITY_TYPES.contains(entityType);
  }
}
