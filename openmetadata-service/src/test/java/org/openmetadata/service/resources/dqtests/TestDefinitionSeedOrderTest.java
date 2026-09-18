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

package org.openmetadata.service.resources.dqtests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.DataQualityDimensionRepository;
import org.openmetadata.service.resources.Collection;

/**
 * The shipped test definitions reference their data quality dimension by name and
 * {@code TestDefinitionRepository.validateDataQualityDimension} rejects a name that resolves to no
 * dimension entity. Seeding them before the dimensions exist therefore leaves the test definition
 * table empty — and because {@code initSeedDataFromResources} catches per entity and continues, the
 * only symptom is a WARN line and a Data Quality feature that cannot create a single test case.
 * These two checks guard both halves of that contract without needing a running stack.
 */
class TestDefinitionSeedOrderTest {
  private static final Path SEED_ROOT = seedRoot();

  /** Resolved by walking up, so the test does not depend on the surefire working directory. */
  private static Path seedRoot() {
    Path current = Path.of("").toAbsolutePath();
    Path suffix = Path.of("openmetadata-service/src/main/resources/json/data");
    while (current != null && !Files.isDirectory(current.resolve(suffix))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the seed data directory");
    }
    return current.resolve(suffix);
  }

  @Test
  void dimensionsAreSeededBeforeTheTestDefinitionsThatReferenceThem() {
    int dimensionOrder = collectionOrder(DataQualityDimensionResource.class);
    int testDefinitionOrder = collectionOrder(TestDefinitionResource.class);

    assertTrue(
        dimensionOrder < testDefinitionOrder,
        () ->
            "DataQualityDimensions must initialize before TestDefinitions, but the orders are "
                + dimensionOrder
                + " and "
                + testDefinitionOrder
                + ". Note that @Collection.order() defaults to 9, so leaving it off puts the "
                + "dimensions last and every shipped test definition fails to seed.");
  }

  @Test
  void everyShippedTestDefinitionReferencesAShippedDimension() throws IOException {
    Set<String> seededDimensions = seedNames(SEED_ROOT.resolve("dataQualityDimension"));
    assertFalse(seededDimensions.isEmpty(), "No data quality dimension seed files were found");

    Set<String> unknown = new TreeSet<>();
    try (Stream<Path> files = Files.list(SEED_ROOT.resolve("tests"))) {
      for (Path file : files.filter(f -> f.toString().endsWith(".json")).toList()) {
        JsonNode node = JsonUtils.readTree(Files.readString(file));
        JsonNode dimension = node.get("dataQualityDimension");
        if (dimension == null || dimension.isNull()) {
          continue;
        }
        String name = dimension.asText();
        if (!DataQualityDimensionRepository.NO_DIMENSION.equals(name)
            && !seededDimensions.contains(name)) {
          unknown.add(file.getFileName() + " -> " + name);
        }
      }
    }

    assertTrue(
        unknown.isEmpty(),
        () ->
            "These shipped test definitions classify themselves under a dimension that is not "
                + "seeded, so they are rejected on startup: "
                + unknown);
  }

  private static Set<String> seedNames(Path directory) throws IOException {
    Set<String> names = new TreeSet<>();
    try (Stream<Path> files = Files.list(directory)) {
      for (Path file : files.filter(f -> f.toString().endsWith(".json")).toList()) {
        names.add(JsonUtils.readTree(Files.readString(file)).get("name").asText());
      }
    }
    return names;
  }

  private static int collectionOrder(Class<?> resource) {
    Collection collection = resource.getAnnotation(Collection.class);
    assertTrue(collection != null, resource.getSimpleName() + " is not annotated with @Collection");

    return collection.order();
  }
}
