/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionShape;

/**
 * Projection contract for {@link CustomPropertiesStep}: an entity carrying {@code extension} must
 * leave the snapshot with both DI-queryable shapes — the per-entity-type twin (Group By) and the
 * {@code customPropertiesTyped} nested structure (advanced-search filters) — and an entity with no
 * {@code extension} must gain neither.
 */
class CustomPropertiesStepTest {

  private final CustomPropertiesStep step = new CustomPropertiesStep();

  @Test
  void projectsTwinAndTypedNestedWhenExtensionPresent() {
    Map<String, Object> extension = new HashMap<>();
    extension.put("datapolicy", "purpose");
    EnrichmentTarget target = targetWith("table", extension);

    step.apply(target);

    assertSame(
        extension,
        target.entityMap().get("tableCustomProperty"),
        "the twin keeps the raw extension so Group By's dynamic mapping can term-query each sub-field");

    Object typed = target.entityMap().get("customPropertiesTyped");
    assertInstanceOf(List.class, typed, "customPropertiesTyped must be the nested entry list");
    List<?> entries = (List<?>) typed;
    assertEquals(1, entries.size());
    Map<?, ?> entry = (Map<?, ?>) entries.get(0);
    assertEquals("datapolicy", entry.get("name"), "the property name is the nested term key");
    assertEquals(
        "purpose", entry.get("stringValue"), "the value is carried as a keyword stringValue");
  }

  @Test
  void leavesSnapshotUntouchedWhenExtensionAbsent() {
    EnrichmentTarget target = targetWith("table", null);

    step.apply(target);

    assertFalse(target.entityMap().containsKey("tableCustomProperty"), "no twin without extension");
    assertFalse(
        target.entityMap().containsKey("customPropertiesTyped"),
        "no typed nested structure without extension");
  }

  private static EnrichmentTarget targetWith(String entityType, Map<String, Object> extension) {
    Map<String, Object> entityMap = new HashMap<>();
    if (extension != null) {
      entityMap.put("extension", extension);
    }
    return new EnrichmentTarget(
        null,
        entityMap,
        Map.of(),
        0L,
        0L,
        new EnrichmentContext(entityType, List.of(), 0L, 0L),
        VersionShape.LATEST_HYDRATED);
  }
}
