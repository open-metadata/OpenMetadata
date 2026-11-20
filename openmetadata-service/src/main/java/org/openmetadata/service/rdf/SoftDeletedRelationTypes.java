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
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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
   * For each predicate the import names that no live type holds, the soft-deleted type holding it,
   * the most recently changed one if several do; one type per predicate, so a restore cannot put
   * two live types on one predicate. A type matching only by name is never restored: its
   * predicate differs from the authored one, and restoring it would move the authored edges onto
   * it. Liveness is looked up only for a predicate a soft-deleted type was found for.
   */
  static List<RelationshipType> namedBy(
      final Collection<String> predicates,
      final List<RelationshipType> softDeleted,
      final Predicate<URI> isLivePredicate) {
    final Map<URI, RelationshipType> named = new LinkedHashMap<>();
    predicates.stream()
        .map(URI::create)
        .distinct()
        .forEach(
            predicate ->
                holder(predicate, softDeleted)
                    .filter(type -> !isLivePredicate.test(predicate))
                    .ifPresent(type -> named.put(predicate, type)));
    return List.copyOf(named.values());
  }

  /**
   * The soft-deleted type holding {@code name} on a predicate other than {@code predicate}: a new
   * type registered under that name would overwrite it, and restoring it would remap the authored
   * predicate, so the import skips the name instead.
   */
  static Optional<RelationshipType> holdingNameElsewhere(
      final String name, final URI predicate, final List<RelationshipType> softDeleted) {
    return softDeleted.stream()
        .filter(type -> name.equals(type.getName()))
        .filter(type -> !predicate.equals(type.getRdfPredicate()))
        .findFirst();
  }

  private static Optional<RelationshipType> holder(
      final URI predicate, final List<RelationshipType> softDeleted) {
    return softDeleted.stream()
        .filter(type -> predicate.equals(type.getRdfPredicate()))
        .max(Comparator.comparing(type -> Objects.requireNonNullElse(type.getUpdatedAt(), 0L)));
  }
}
