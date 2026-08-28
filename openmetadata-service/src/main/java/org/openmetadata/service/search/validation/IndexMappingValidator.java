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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.capability.EntityIndexCapability;
import org.openmetadata.service.search.capability.EntityIndexCapabilityRegistry;
import org.openmetadata.service.search.scripts.SoftDeleteScript;

/**
 * Boot-time sanity check over the loaded {@code indexMapping.json}. For every parent → child
 * pairing this validator asks the registered scripts whether they can safely target the child;
 * any incompatibility is logged at WARN. The original incident — soft-delete propagation onto
 * {@code testCaseResolutionStatus} / {@code testCaseResult} — would have surfaced here at app
 * startup instead of producing a Jackson exception in the Incident Manager UI.
 *
 * <p>WARN-level (rather than fail-boot) for now: existing deployments may have mappings the
 * platform team has not yet audited against the capability model. Flip to fail-fast once the
 * production mappings have been cleaned up.
 */
@Slf4j
public final class IndexMappingValidator {

  private IndexMappingValidator() {}

  public static List<String> validate(Map<String, IndexMapping> indexMappings) {
    List<String> warnings = new ArrayList<>();
    if (indexMappings == null || indexMappings.isEmpty()) {
      return warnings;
    }
    SoftDeleteScript softDelete = new SoftDeleteScript(true);
    for (Map.Entry<String, IndexMapping> entry : indexMappings.entrySet()) {
      String parentType = entry.getKey();
      IndexMapping mapping = entry.getValue();
      List<String> children = mapping.getChildAliases();
      if (children == null || children.isEmpty()) {
        continue;
      }
      for (String childAlias : children) {
        EntityIndexCapability childCapability = EntityIndexCapabilityRegistry.get(childAlias);
        if (childCapability == null) {
          warnings.add(
              "Parent '%s' declares child alias '%s' with no registered capability; soft-delete"
                  + " propagation will skip it".formatted(parentType, childAlias));
          continue;
        }
        if (!softDelete.compatibleWith(childCapability)) {
          warnings.add(
              "Parent '%s' declares child alias '%s' which does not support SoftDelete (isTimeSeries=%s)"
                  .formatted(parentType, childAlias, childCapability.isTimeSeries()));
        }
      }
    }
    warnings.forEach(LOG::warn);
    return warnings;
  }
}
