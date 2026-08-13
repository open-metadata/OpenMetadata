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
package org.openmetadata.service.resources.ai;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.type.AICompliance;
import org.openmetadata.schema.type.AIComplianceRecord;

/**
 * One AI asset as captured in an audit pack snapshot. {@code governanceMetadata} is loosely typed
 * because the governance block differs per entity type ({@link GovernanceMetadata} for AI
 * applications, {@link McpGovernanceMetadata} for MCP servers, absent for LLM models) — use
 * {@link #complianceRecords()} rather than casting at the call site.
 *
 * <p>Public because {@link AuditPackPdfRenderer} implementations live outside this package.
 */
public record AuditPackAsset(
    String entityType,
    String id,
    String name,
    String displayName,
    String fullyQualifiedName,
    Object governanceMetadata,
    Long updatedAt) {

  /**
   * Compliance assessments recorded against this asset. Never null; empty when none apply.
   *
   * <p>Returns an unmodifiable defensive copy rather than the live list off the governance object:
   * renderers are external code, and a pack is a point-in-time snapshot, so neither the caller nor
   * a later mutation of the entity should be able to change what this reports. Copied through
   * {@link ArrayList} rather than {@link List#copyOf} so a null element — possible in a
   * deserialised entity — degrades to the renderer rather than throwing here.
   */
  public List<AIComplianceRecord> complianceRecords() {
    AICompliance compliance = aiCompliance();
    List<AIComplianceRecord> records =
        compliance == null ? null : compliance.getComplianceRecords();
    return records == null ? List.of() : Collections.unmodifiableList(new ArrayList<>(records));
  }

  private AICompliance aiCompliance() {
    AICompliance result = null;
    if (governanceMetadata instanceof GovernanceMetadata governance) {
      result = governance.getAiCompliance();
    } else if (governanceMetadata instanceof McpGovernanceMetadata governance) {
      result = governance.getAiCompliance();
    }
    return result;
  }
}
