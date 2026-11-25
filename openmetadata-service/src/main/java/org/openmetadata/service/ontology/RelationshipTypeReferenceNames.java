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

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Gives every reference one relationship type holds to another ({@code inverse}, {@code
 * replacedBy}, {@code propertyChain}, {@code disjointWith}) both its {@code name} and its {@code
 * fullyQualifiedName}. A relationship type's FQN is its quoted name, so a reference stored with only
 * one of them is completed without a lookup
 * (ADR:2026-11-19-relationship-type-references-carry-their-name).
 */
public final class RelationshipTypeReferenceNames {
  private RelationshipTypeReferenceNames() {}

  public static RelationshipType withNamedReferences(final RelationshipType type) {
    type.setInverse(named(type.getInverse()));
    type.setReplacedBy(named(type.getReplacedBy()));
    if (needsCompleting(type.getPropertyChain())) {
      type.setPropertyChain(
          type.getPropertyChain().stream().map(RelationshipTypeReferenceNames::named).toList());
    }
    if (needsCompleting(type.getDisjointWith())) {
      type.setDisjointWith(
          type.getDisjointWith().stream()
              .map(RelationshipTypeReferenceNames::named)
              .collect(Collectors.toCollection(LinkedHashSet::new)));
    }
    return type;
  }

  private static boolean needsCompleting(final Collection<EntityReference> references) {
    return references != null
        && references.stream().anyMatch(reference -> named(reference) != reference);
  }

  /**
   * The one shape a stored reference to {@code type} takes, whichever writer stores it: identity
   * only, so it never goes stale when the type's display name or description changes.
   */
  public static EntityReference referenceTo(final RelationshipType type) {
    return new EntityReference()
        .withId(type.getId())
        .withType(Entity.RELATIONSHIP_TYPE)
        .withName(type.getName())
        .withFullyQualifiedName(type.getFullyQualifiedName());
  }

  /**
   * A copy carrying both the name and the FQN when the reference holds one of them, so a reference
   * held in a set is never changed in place.
   */
  public static EntityReference named(final EntityReference reference) {
    final boolean isNameless =
        reference != null
            && reference.getName() == null
            && reference.getFullyQualifiedName() != null;
    final boolean isFqnless =
        reference != null
            && reference.getFullyQualifiedName() == null
            && reference.getName() != null;
    final EntityReference completed;
    if (isNameless) {
      completed =
          JsonUtils.deepCopy(reference, EntityReference.class)
              .withName(FullyQualifiedName.unquoteName(reference.getFullyQualifiedName()));
    } else if (isFqnless) {
      completed =
          JsonUtils.deepCopy(reference, EntityReference.class)
              .withFullyQualifiedName(FullyQualifiedName.quoteName(reference.getName()));
    } else {
      completed = reference;
    }
    return completed;
  }
}
