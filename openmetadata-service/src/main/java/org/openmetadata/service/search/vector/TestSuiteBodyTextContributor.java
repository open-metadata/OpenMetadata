/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.search.vector;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.VectorDocBuilder.BodyTextExtractor;

/**
 * Body text contributor for {@link TestSuite}. A suite's semantic payload is its name/description
 * plus the data asset it groups tests for (its basic entity reference) — so a query like "test
 * suites for customer" can match on the linked table name even when the suite description is empty.
 * Reads only fields already populated on the entity (no extra lookups) to stay on the create/update
 * hot path.
 */
public final class TestSuiteBodyTextContributor implements VectorBodyTextContributor {

  public static final TestSuiteBodyTextContributor INSTANCE = new TestSuiteBodyTextContributor();

  private TestSuiteBodyTextContributor() {}

  @Override
  public String entityType() {
    return Entity.TEST_SUITE;
  }

  @Override
  public BodyTextExtractor extractor() {
    return TestSuiteBodyTextContributor::extractBodyText;
  }

  static String extractBodyText(EntityInterface entity) {
    if (!(entity instanceof TestSuite testSuite)) {
      return null;
    }
    List<String> parts = new ArrayList<>();
    appendIfPresent(parts, "description", testSuite.getDescription());
    appendRef(parts, "testedAsset", testSuite.getBasicEntityReference());
    return parts.isEmpty() ? "" : String.join("; ", parts);
  }

  private static void appendRef(List<String> parts, String label, EntityReference ref) {
    if (ref == null) {
      return;
    }
    String value =
        ref.getFullyQualifiedName() != null ? ref.getFullyQualifiedName() : ref.getName();
    appendIfPresent(parts, label, value);
  }

  private static void appendIfPresent(List<String> parts, String label, String value) {
    if (value == null || value.isBlank()) {
      return;
    }
    parts.add(label + ": " + value.strip());
  }
}
