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

import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Gives every reference one relationship type holds to another ({@code inverse}, {@code
 * replacedBy}, {@code propertyChain}, {@code disjointWith}) its {@code name}. A relationship type's
 * fully qualified name is its name, so a reference stored with only its FQN is completed without a
 * lookup (ADR:2026-11-19-relationship-type-references-carry-their-name).
 */
public final class RelationshipTypeReferenceNames {
  private RelationshipTypeReferenceNames() {}

  public static RelationshipType withNamedReferences(final RelationshipType type) {
    type.setInverse(named(type.getInverse()));
    type.setReplacedBy(named(type.getReplacedBy()));
    if (type.getPropertyChain() != null) {
      type.setPropertyChain(
          type.getPropertyChain().stream().map(RelationshipTypeReferenceNames::named).toList());
    }
    if (type.getDisjointWith() != null) {
      type.setDisjointWith(
          type.getDisjointWith().stream()
              .map(RelationshipTypeReferenceNames::named)
              .collect(Collectors.toUnmodifiableSet()));
    }
    return type;
  }

  /** A copy carrying the name, so a reference held in a set is never changed in place. */
  public static EntityReference named(final EntityReference reference) {
    final boolean isNameless =
        reference != null
            && reference.getName() == null
            && reference.getFullyQualifiedName() != null;
    return isNameless
        ? JsonUtils.deepCopy(reference, EntityReference.class)
            .withName(reference.getFullyQualifiedName())
        : reference;
  }
}
