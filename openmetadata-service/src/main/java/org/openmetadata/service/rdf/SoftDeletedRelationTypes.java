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

package org.openmetadata.service.rdf;

import java.net.URI;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.data.RelationshipType;

/**
 * The soft-deleted relationship types an RDF import names, which it brings back instead of
 * registering a new type beside them
 * (ADR:2026-11-18-rdf-import-registers-governed-inverse-components).
 */
final class SoftDeletedRelationTypes {
  private SoftDeletedRelationTypes() {}

  /**
   * For each predicate the import names: the soft-deleted type holding the predicate, the most
   * recently changed one if several do; otherwise the soft-deleted type holding the name the import
   * would register, which a new type could not take. Nothing is chosen while a live type holds the
   * named predicate or the chosen type's own one, so a restore cannot put two live types on one
   * predicate. Liveness is looked up only for a predicate a soft-deleted type was found for.
   */
  static List<RelationshipType> namedBy(
      final Map<String, String> namesByPredicate,
      final List<RelationshipType> softDeleted,
      final Predicate<URI> isLivePredicate) {
    final Map<UUID, RelationshipType> named = new LinkedHashMap<>();
    namesByPredicate.forEach(
        (predicate, name) -> {
          final URI iri = URI.create(predicate);
          holder(iri, name, softDeleted)
              .filter(type -> !isLivePredicate.test(iri))
              .filter(type -> !isLivePredicate.test(type.getRdfPredicate()))
              .ifPresent(type -> named.putIfAbsent(type.getId(), type));
        });
    return List.copyOf(named.values());
  }

  private static Optional<RelationshipType> holder(
      final URI predicate, final String name, final List<RelationshipType> softDeleted) {
    return softDeleted.stream()
        .filter(type -> predicate.equals(type.getRdfPredicate()))
        .max(Comparator.comparing(type -> Objects.requireNonNullElse(type.getUpdatedAt(), 0L)))
        .or(() -> softDeleted.stream().filter(type -> name.equals(type.getName())).findFirst());
  }
}
