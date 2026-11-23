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

import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.FullyQualifiedName;

/** Attaches the table identity used to derive coverage from captured test definitions. */
public final class TestCaseParentStep implements EnrichmentStep {
  public static final String NAME = "testCaseParent";

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public boolean required() {
    // Publishing an unlinked definition would let a successful capture certify false zero coverage.
    return true;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    if (target.entity() instanceof TestCase testCase) {
      final String tableFqn = EntityLink.parse(testCase.getEntityLink()).getEntityFQN();
      final UUID tableId =
          Objects.requireNonNull(
              target.context().parentTableIds().get(tableFqn),
              "Snapshot parent table no longer exists");
      final String serviceFqn = FullyQualifiedName.getRoot(tableFqn);
      target.entityMap().put("originEntityFQN", tableFqn);
      target.entityMap().put("originEntityId", tableId.toString());
      target
          .entityMap()
          .put(
              "service",
              Map.of(
                  "name",
                  FullyQualifiedName.unquoteName(serviceFqn),
                  "fullyQualifiedName",
                  serviceFqn));
    }
  }
}
