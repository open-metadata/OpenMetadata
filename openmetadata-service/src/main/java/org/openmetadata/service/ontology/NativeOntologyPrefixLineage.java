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

package org.openmetadata.service.ontology;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyDAO.PrefixFilter;
import org.openmetadata.service.jdbi3.OntologyDAO.PrefixLineageQuery;
import org.openmetadata.service.jdbi3.OntologyDAO.PrefixLineageRow;
import org.openmetadata.service.ontology.OntologyConceptBindingService.Access;

/**
 * The topology's lineage stream: one bounded batch of relationships whose endpoints both lie inside
 * the loaded prefixes, keeping the edges whose endpoints the reader may view.
 */
final class NativeOntologyPrefixLineage {
  private final CollectionDAO dao;
  private final NativeOntologyDataGraphService graph;
  private final int candidateLimit;

  NativeOntologyPrefixLineage(
      final CollectionDAO dao,
      final NativeOntologyDataGraphService graph,
      final int candidateLimit) {
    this.dao = dao;
    this.graph = graph;
    this.candidateLimit = candidateLimit;
  }

  LineagePage read(
      final Access access,
      final UUID ontologyId,
      final List<NativeOntologyLoadedPrefix> loaded,
      final LineagePosition after) {
    final var filter = PrefixFilter.of(loaded);
    if (filter.bindings().isEmpty()) {
      return LineagePage.done(after);
    }
    final var candidates =
        dao.ontologyDAO()
            .listLineageForPrefixes(
                filter.predicate("source"),
                filter.predicate("target"),
                filter.bindings(),
                new PrefixLineageQuery(ontologyId.toString(), after, candidateLimit));
    final var visible = graph.visibleAssets(access, endpoints(candidates)).keySet();
    return page(candidates, visible, after);
  }

  private LineagePage page(
      final List<PrefixLineageRow> candidates,
      final Set<UUID> visible,
      final LineagePosition after) {
    final var edges =
        candidates.stream()
            .map(NativeOntologyPrefixLineage::edge)
            .filter(
                edge ->
                    visible.contains(edge.getFromEntity()) && visible.contains(edge.getToEntity()))
            .distinct()
            .toList();
    return new LineagePage(
        edges,
        candidates.isEmpty() ? after : candidates.getLast().position(),
        candidates.size() < candidateLimit);
  }

  private static Edge edge(final PrefixLineageRow row) {
    return new Edge()
        .withFromEntity(UUID.fromString(row.fromId()))
        .withToEntity(UUID.fromString(row.toId()));
  }

  private static List<BindingRow> endpoints(final List<PrefixLineageRow> candidates) {
    return candidates.stream()
        .flatMap(
            row ->
                Stream.of(
                    endpoint(row.fromId(), row.fromEntity()), endpoint(row.toId(), row.toEntity())))
        .toList();
  }

  private static BindingRow endpoint(final String id, final String type) {
    return new BindingRow(
        null, UUID.fromString(id), OntologyBindingAssetType.fromValue(type), null, List.of());
  }

  record LineagePage(List<Edge> edges, LineagePosition after, boolean done) {
    static LineagePage done(final LineagePosition after) {
      return new LineagePage(List.of(), after, true);
    }
  }
}
