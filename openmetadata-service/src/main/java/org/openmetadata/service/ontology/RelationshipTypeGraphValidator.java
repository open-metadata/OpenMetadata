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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.RelationshipCharacteristic;

public final class RelationshipTypeGraphValidator {
  private final Function<UUID, RelationshipType> typeLookup;

  public RelationshipTypeGraphValidator(final Function<UUID, RelationshipType> typeLookup) {
    this.typeLookup = typeLookup;
  }

  public void validate(final RelationshipType relationshipType) {
    validateDisjointReferences(relationshipType);
    validatePropertyChain(relationshipType);
    rejectDependencyCycle(relationshipType);
  }

  private static void validateDisjointReferences(final RelationshipType relationshipType) {
    for (final EntityReference reference : setOrEmpty(relationshipType.getDisjointWith())) {
      requireReference(reference, "disjointWith");
      if (relationshipType.getId().equals(reference.getId())) {
        throw new BadRequestException("A relationship type cannot be disjoint with itself");
      }
    }
  }

  private static void validatePropertyChain(final RelationshipType relationshipType) {
    final List<EntityReference> chain = listOrEmpty(relationshipType.getPropertyChain());
    if (!chain.isEmpty() && chain.size() < 2) {
      throw new BadRequestException("A relationship property chain requires at least two members");
    }
    chain.forEach(reference -> requireReference(reference, "propertyChain"));
    validateDirectSelfReference(relationshipType, chain);
  }

  private static void validateDirectSelfReference(
      final RelationshipType relationshipType, final List<EntityReference> chain) {
    final long selfReferences =
        chain.stream()
            .filter(reference -> relationshipType.getId().equals(reference.getId()))
            .count();
    final boolean isTransitiveChain =
        selfReferences == 2
            && chain.size() == 2
            && relationshipType
                .getCharacteristics()
                .contains(RelationshipCharacteristic.TRANSITIVE);
    if (selfReferences > 0 && !isTransitiveChain) {
      throw new BadRequestException(
          "A property chain can reference itself only as a two-member transitive chain");
    }
  }

  private void rejectDependencyCycle(final RelationshipType candidate) {
    final Set<UUID> visiting = new HashSet<>();
    final Set<UUID> visited = new HashSet<>();
    if (hasCycle(candidate, candidate, visiting, visited)) {
      throw new BadRequestException(
          "Property chain for relationship type '" + candidate.getName() + "' is not regular");
    }
  }

  private boolean hasCycle(
      final RelationshipType current,
      final RelationshipType candidate,
      final Set<UUID> visiting,
      final Set<UUID> visited) {
    final UUID currentId = current.getId();
    final boolean hasCycle;
    if (visited.contains(currentId)) {
      hasCycle = false;
    } else if (!visiting.add(currentId)) {
      hasCycle = true;
    } else {
      hasCycle = hasCyclicMember(current, candidate, visiting, visited);
      visiting.remove(currentId);
      visited.add(currentId);
    }
    return hasCycle;
  }

  private boolean hasCyclicMember(
      final RelationshipType current,
      final RelationshipType candidate,
      final Set<UUID> visiting,
      final Set<UUID> visited) {
    boolean hasCycle = false;
    for (final EntityReference member : listOrEmpty(current.getPropertyChain())) {
      if (!isAllowedTransitiveSelfChain(current, member)) {
        final RelationshipType dependency = resolve(member.getId(), candidate);
        hasCycle = hasCycle(dependency, candidate, visiting, visited);
      }
      if (hasCycle) {
        break;
      }
    }
    return hasCycle;
  }

  private RelationshipType resolve(final UUID id, final RelationshipType candidate) {
    final RelationshipType relationshipType =
        candidate.getId().equals(id) ? candidate : typeLookup.apply(id);
    if (relationshipType == null) {
      throw new BadRequestException(
          "Property chain references unknown relationship type '" + id + "'");
    }
    return relationshipType;
  }

  private static boolean isAllowedTransitiveSelfChain(
      final RelationshipType relationshipType, final EntityReference member) {
    final List<EntityReference> chain = listOrEmpty(relationshipType.getPropertyChain());
    return relationshipType.getId().equals(member.getId())
        && chain.size() == 2
        && relationshipType.getCharacteristics().contains(RelationshipCharacteristic.TRANSITIVE);
  }

  private static void requireReference(final EntityReference reference, final String field) {
    if (reference == null || reference.getId() == null) {
      throw new BadRequestException(
          "Every " + field + " entry must resolve to a relationship type");
    }
  }

  private static Set<EntityReference> setOrEmpty(final Set<EntityReference> references) {
    final Set<EntityReference> safeReferences = references == null ? Set.of() : references;
    return safeReferences;
  }
}
