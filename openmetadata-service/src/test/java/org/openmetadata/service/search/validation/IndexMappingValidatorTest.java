/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.validation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.capability.EntityIndexCapability;
import org.openmetadata.service.search.capability.EntityIndexCapabilityRegistry;

class IndexMappingValidatorTest {

  @BeforeEach
  @AfterEach
  void resetRegistry() {
    EntityIndexCapabilityRegistry.clear();
  }

  @Test
  void flagsParentTargetingTimeSeriesChild() {
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forEntity("testCase"));
    EntityIndexCapabilityRegistry.register(
        EntityIndexCapability.forTimeSeries("testCaseResolutionStatus"));

    IndexMapping testCaseMapping =
        IndexMapping.builder()
            .indexName("test_case_search_index")
            .alias("testCase")
            .childAliases(List.of("testCaseResolutionStatus"))
            .indexMappingFile("/elasticsearch/%s/test_case_index_mapping.json")
            .build();

    List<String> warnings = IndexMappingValidator.validate(Map.of("testCase", testCaseMapping));

    assertEquals(1, warnings.size());
    assertTrue(
        warnings.get(0).contains("testCase"),
        () -> "warning should name the parent; got: " + warnings.get(0));
    assertTrue(
        warnings.get(0).contains("testCaseResolutionStatus"),
        () -> "warning should name the child; got: " + warnings.get(0));
  }

  @Test
  void silentWhenAllChildrenAreCompatible() {
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forEntity("table"));
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forEntity("tableColumn"));

    IndexMapping tableMapping =
        IndexMapping.builder()
            .indexName("table_search_index")
            .alias("table")
            .childAliases(List.of("tableColumn"))
            .indexMappingFile("/elasticsearch/%s/table_index_mapping.json")
            .build();

    assertEquals(0, IndexMappingValidator.validate(Map.of("table", tableMapping)).size());
  }

  @Test
  void flagsUnregisteredChildAlias() {
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forEntity("table"));

    IndexMapping tableMapping =
        IndexMapping.builder()
            .indexName("table_search_index")
            .alias("table")
            .childAliases(List.of("ghost"))
            .indexMappingFile("/elasticsearch/%s/table_index_mapping.json")
            .build();

    List<String> warnings = IndexMappingValidator.validate(Map.of("table", tableMapping));

    assertEquals(1, warnings.size());
    assertTrue(
        warnings.get(0).contains("no registered capability"),
        () -> "warning should mention missing capability; got: " + warnings.get(0));
  }

  @Test
  void emptyInputProducesNoWarnings() {
    assertEquals(0, IndexMappingValidator.validate(Map.of()).size());
    assertEquals(0, IndexMappingValidator.validate(null).size());
  }
}
