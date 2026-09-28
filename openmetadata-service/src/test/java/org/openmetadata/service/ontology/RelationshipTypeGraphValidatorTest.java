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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.RelationshipCharacteristic;

class RelationshipTypeGraphValidatorTest {
  @Test
  void acceptsTwoMemberTransitiveSelfChain() {
    final RelationshipType transitive = relationshipType("ancestorOf");
    final EntityReference self = reference(transitive);
    transitive
        .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE))
        .withPropertyChain(List.of(self, self));

    assertDoesNotThrow(() -> validator(Map.of()).validate(transitive));
  }

  @Test
  void rejectsSingleMemberAndNonTransitiveSelfChains() {
    final RelationshipType candidate = relationshipType("contains");
    final EntityReference self = reference(candidate);

    candidate.setPropertyChain(List.of(self));
    assertThrows(BadRequestException.class, () -> validator(Map.of()).validate(candidate));

    candidate.setPropertyChain(List.of(self, self));
    assertThrows(BadRequestException.class, () -> validator(Map.of()).validate(candidate));
  }

  @Test
  void rejectsIndirectDependencyCycle() {
    final RelationshipType first = relationshipType("first");
    final RelationshipType second = relationshipType("second");
    first.setPropertyChain(List.of(reference(second), reference(second)));
    second.setPropertyChain(List.of(reference(first), reference(first)));
    final Map<UUID, RelationshipType> types = new HashMap<>();
    types.put(first.getId(), first);
    types.put(second.getId(), second);

    assertThrows(BadRequestException.class, () -> validator(types).validate(first));
  }

  @Test
  void rejectsUnknownAndSelfDisjointReferences() {
    final RelationshipType candidate = relationshipType("related");
    candidate.setPropertyChain(
        List.of(
            new EntityReference().withId(UUID.randomUUID()),
            new EntityReference().withId(UUID.randomUUID())));
    assertThrows(BadRequestException.class, () -> validator(Map.of()).validate(candidate));

    candidate.setPropertyChain(List.of());
    candidate.setDisjointWith(Set.of(reference(candidate)));
    assertThrows(BadRequestException.class, () -> validator(Map.of()).validate(candidate));
  }

  private static RelationshipTypeGraphValidator validator(final Map<UUID, RelationshipType> types) {
    return new RelationshipTypeGraphValidator(types::get);
  }

  private static RelationshipType relationshipType(final String name) {
    return new RelationshipType()
        .withId(UUID.randomUUID())
        .withName(name)
        .withCharacteristics(Set.of())
        .withPropertyChain(List.of())
        .withDisjointWith(Set.of());
  }

  private static EntityReference reference(final RelationshipType type) {
    return new EntityReference().withId(type.getId()).withName(type.getName());
  }
}
