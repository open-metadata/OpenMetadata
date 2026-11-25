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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

@DisplayName("RdfExcludedEntities policy")
class RdfExcludedEntitiesTest {

  @Test
  void nativeWorkingDefinitionsNeverEnterGenericProjection() {
    List.of(
            Entity.ONTOLOGY,
            Entity.ONTOLOGY_CONCEPT,
            Entity.ONTOLOGY_PROPERTY,
            Entity.ONTOLOGY_AXIOM,
            Entity.ONTOLOGY_RELEASE)
        .forEach(type -> assertTrue(RdfExcludedEntities.isExcluded(type)));
  }

  @Test
  @DisplayName("aiChart is excluded from RDF")
  void aiChartIsExcluded() {
    assertTrue(RdfExcludedEntities.isExcluded("aiChart"));
    assertTrue(RdfExcludedEntities.EXCLUDED_ENTITY_TYPES.contains("aiChart"));
  }

  @Test
  @DisplayName("a business process and its step links stay out of the graph")
  void businessProcessLinksAreNotProjected() {
    assertTrue(RdfExcludedEntities.isExcluded("businessProcess"));
    assertFalse(RdfRelationshipScope.isProjectedEdge(usesEdge("businessProcess", Entity.TABLE)));
    assertTrue(RdfRelationshipScope.isProjectedEdge(usesEdge(Entity.PIPELINE, Entity.TABLE)));
  }

  private static EntityRelationshipObject usesEdge(String fromEntity, String toEntity) {
    return EntityRelationshipObject.builder()
        .fromId(UUID.randomUUID().toString())
        .toId(UUID.randomUUID().toString())
        .fromEntity(fromEntity)
        .toEntity(toEntity)
        .relation(Relationship.USES.ordinal())
        .build();
  }

  @Test
  @DisplayName("core entity types are not excluded")
  void coreEntityTypesAreNotExcluded() {
    assertFalse(RdfExcludedEntities.isExcluded(Entity.TABLE));
    assertFalse(RdfExcludedEntities.isExcluded(Entity.GLOSSARY_TERM));
    assertFalse(RdfExcludedEntities.isExcluded(Entity.DASHBOARD));
  }

  @Test
  @DisplayName("null and unknown entity types are not excluded")
  void nullAndUnknownAreNotExcluded() {
    assertFalse(RdfExcludedEntities.isExcluded(null));
    assertFalse(RdfExcludedEntities.isExcluded("notARealEntityType"));
  }
}
