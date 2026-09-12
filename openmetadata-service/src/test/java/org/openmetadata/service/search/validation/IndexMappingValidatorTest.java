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

  /**
   * A grandparent that lists its child but not its grandchild, so a cascade resolved from the
   * grandparent's {@code childAliases} never reaches the grandchild's documents.
   *
   * <p>Deliberately a synthetic hierarchy rather than a real pair from {@code indexMapping.json}:
   * every real gap is a candidate for {@code ACKNOWLEDGED_TRANSITIVE_GAPS}, and a test keyed on one
   * flips from testing the mechanism to testing the allowlist the moment that pair is acknowledged.
   */
  @Test
  void flagsChildAliasesThatAreNotTransitivelyClosed() {
    registerEntities("grandparentType", "childType", "grandchildType");

    Map<String, IndexMapping> mappings =
        Map.of(
            "grandparentType", mappingWithChildren("grandparentType", List.of("childType")),
            "childType", mappingWithChildren("childType", List.of("grandchildType")),
            "grandchildType", mappingWithChildren("grandchildType", List.of()));

    List<String> warnings = IndexMappingValidator.validate(mappings);

    assertEquals(1, warnings.size());
    assertTrue(
        warnings.get(0).contains("grandparentType") && warnings.get(0).contains("grandchildType"),
        () -> "warning should name the parent and the unreachable descendant; got: " + warnings);
  }

  /**
   * {@code directory} → {@code worksheet} is a genuine gap in the generic cascade, but
   * {@code deleteOrUpdateChildren} sweeps the drive subtree by FQN prefix instead, so warning about
   * it is noise. Four of the five gaps in the real mapping are covered this way; suppressing them is
   * what keeps the one actionable warning visible.
   */
  @Test
  void silentWhenTheTransitiveGapIsCoveredByADedicatedCascade() {
    registerEntities("directory", "spreadsheet", "worksheet");

    Map<String, IndexMapping> mappings =
        Map.of(
            "directory", mappingWithChildren("directory", List.of("spreadsheet")),
            "spreadsheet", mappingWithChildren("spreadsheet", List.of("worksheet")),
            "worksheet", mappingWithChildren("worksheet", List.of()));

    assertEquals(
        List.of(),
        IndexMappingValidator.validate(mappings),
        "directory->worksheet is covered by the FQN-prefix drive sweep and must not warn");
  }

  @Test
  void silentWhenChildAliasesAreTransitivelyClosed() {
    registerEntities("directory", "spreadsheet", "worksheet");

    Map<String, IndexMapping> mappings =
        Map.of(
            "directory", mappingWithChildren("directory", List.of("spreadsheet", "worksheet")),
            "spreadsheet", mappingWithChildren("spreadsheet", List.of("worksheet")),
            "worksheet", mappingWithChildren("worksheet", List.of()));

    assertEquals(0, IndexMappingValidator.validate(mappings).size());
  }

  private static void registerEntities(String... entityTypes) {
    for (String entityType : entityTypes) {
      EntityIndexCapabilityRegistry.register(EntityIndexCapability.forEntity(entityType));
    }
  }

  private static IndexMapping mappingWithChildren(String alias, List<String> children) {
    return IndexMapping.builder()
        .indexName(alias + "_search_index")
        .alias(alias)
        .childAliases(children)
        .indexMappingFile("/elasticsearch/%s/" + alias + "_index_mapping.json")
        .build();
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
