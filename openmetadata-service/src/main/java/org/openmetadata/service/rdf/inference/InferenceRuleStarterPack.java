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

package org.openmetadata.service.rdf.inference;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.utils.JsonUtils;

/** Loads the required, versioned inference-rule starter pack from the classpath. */
final class InferenceRuleStarterPack {
  private static final List<String> RESOURCES =
      List.of(
          "/rdf/inference-rules/transitive-lineage-closure.json",
          "/rdf/inference-rules/pii-propagation-via-lineage.json",
          "/rdf/inference-rules/schema-tag-inheritance.json",
          "/rdf/inference-rules/domain-membership-inheritance.json");

  private InferenceRuleStarterPack() {}

  static List<InferenceRule> load() {
    return RESOURCES.stream().map(InferenceRuleStarterPack::read).toList();
  }

  private static InferenceRule read(final String resourcePath) {
    final URL resource = requireResource(resourcePath);
    final InferenceRule rule;
    try (InputStream input = resource.openStream()) {
      rule = JsonUtils.getObjectMapper().readValue(input, InferenceRule.class);
    } catch (IOException exception) {
      throw new IllegalStateException(
          "Unable to read inference rule resource: " + resourcePath, exception);
    }
    InferenceRuleValidator.requireValid(rule, resourcePath);
    return rule;
  }

  private static URL requireResource(final String resourcePath) {
    return Optional.ofNullable(InferenceRuleStarterPack.class.getResource(resourcePath))
        .orElseThrow(
            () ->
                new IllegalStateException(
                    "Required inference rule resource is missing: " + resourcePath));
  }
}
