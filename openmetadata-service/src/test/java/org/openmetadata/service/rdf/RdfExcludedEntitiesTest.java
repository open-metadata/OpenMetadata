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

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

@DisplayName("RdfExcludedEntities policy")
class RdfExcludedEntitiesTest {

  @Test
  @DisplayName("aiChart is excluded from RDF")
  void aiChartIsExcluded() {
    assertTrue(RdfExcludedEntities.isExcluded("aiChart"));
    assertTrue(RdfExcludedEntities.EXCLUDED_ENTITY_TYPES.contains("aiChart"));
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
