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
   * The real shape of the gap in {@code indexMapping.json}: {@code directory} lists {@code
   * spreadsheet} but not {@code worksheet}, so hard-deleting a directory leaves the worksheets under
   * its spreadsheets orphaned in search.
   */
  @Test
  void flagsChildAliasesThatAreNotTransitivelyClosed() {
    registerEntities("directory", "spreadsheet", "worksheet");

    Map<String, IndexMapping> mappings =
        Map.of(
            "directory", mappingWithChildren("directory", List.of("spreadsheet")),
            "spreadsheet", mappingWithChildren("spreadsheet", List.of("worksheet")),
            "worksheet", mappingWithChildren("worksheet", List.of()));

    List<String> warnings = IndexMappingValidator.validate(mappings);

    assertEquals(1, warnings.size());
    assertTrue(
        warnings.get(0).contains("directory") && warnings.get(0).contains("worksheet"),
        () -> "warning should name the parent and the unreachable descendant; got: " + warnings);
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
