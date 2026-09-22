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
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.VectorDocBuilder.BodyTextExtractor;

/**
 * Body text contributor for {@link TestCase}. A test case's semantic payload is spread across its
 * test definition, the data asset it validates ({@code entityFQN}), its parameter values, and its
 * latest result — not {@code description}, which is usually empty or formulaic. The default
 * description-only extractor would feed near-empty text to the embedding model, so this contributor
 * concatenates the populated fields into a labelled body so the vector represents what the test
 * actually checks and on which asset. Reads only fields already populated on the entity (no extra
 * lookups) to stay on the create/update hot path.
 */
public final class TestCaseBodyTextContributor implements VectorBodyTextContributor {

  public static final TestCaseBodyTextContributor INSTANCE = new TestCaseBodyTextContributor();

  private TestCaseBodyTextContributor() {}

  @Override
  public String entityType() {
    return Entity.TEST_CASE;
  }

  @Override
  public BodyTextExtractor extractor() {
    return TestCaseBodyTextContributor::extractBodyText;
  }

  static String extractBodyText(EntityInterface entity) {
    if (!(entity instanceof TestCase testCase)) {
      return null;
    }
    List<String> parts = new ArrayList<>();
    appendIfPresent(parts, "description", testCase.getDescription());
    appendRef(parts, "testDefinition", testCase.getTestDefinition());
    appendIfPresent(parts, "testedAsset", testCase.getEntityFQN());
    appendParameters(parts, testCase.getParameterValues());
    appendResult(parts, testCase.getTestCaseResult());
    return parts.isEmpty() ? "" : String.join("; ", parts);
  }

  private static void appendRef(List<String> parts, String label, EntityReference ref) {
    if (ref == null) {
      return;
    }
    String value = ref.getName() != null ? ref.getName() : ref.getFullyQualifiedName();
    appendIfPresent(parts, label, value);
  }

  private static void appendParameters(List<String> parts, List<TestCaseParameterValue> values) {
    if (values == null || values.isEmpty()) {
      return;
    }
    List<String> rendered = new ArrayList<>();
    for (TestCaseParameterValue value : values) {
      if (value.getName() != null) {
        rendered.add(value.getName() + "=" + (value.getValue() == null ? "" : value.getValue()));
      }
    }
    if (!rendered.isEmpty()) {
      parts.add("parameters: " + String.join(", ", rendered));
    }
  }

  private static void appendResult(List<String> parts, TestCaseResult result) {
    if (result == null || result.getTestCaseStatus() == null) {
      return;
    }
    parts.add("status: " + result.getTestCaseStatus().value());
  }

  private static void appendIfPresent(List<String> parts, String label, String value) {
    if (value == null || value.isBlank()) {
      return;
    }
    parts.add(label + ": " + value.strip());
  }
}
