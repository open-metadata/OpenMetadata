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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.type.AICompliance;
import org.openmetadata.schema.type.AIComplianceRecord;
import org.openmetadata.schema.type.ComplianceFramework;

class AuditPackAssetTest {

  @Test
  void complianceRecords_isEmptyWhenTheAssetCarriesNoGovernanceMetadata() {
    assertTrue(asset(null).complianceRecords().isEmpty());
  }

  @Test
  void complianceRecords_isEmptyForGovernanceMetadataWithoutCompliance() {
    assertTrue(asset(new GovernanceMetadata()).complianceRecords().isEmpty());
  }

  @Test
  void complianceRecords_readsAiApplicationAndMcpServerGovernanceShapes() {
    AICompliance compliance = new AICompliance().withComplianceRecords(List.of(record()));

    assertEquals(
        1, asset(new GovernanceMetadata().withAiCompliance(compliance)).complianceRecords().size());
    assertEquals(
        1,
        asset(new McpGovernanceMetadata().withAiCompliance(compliance)).complianceRecords().size());
  }

  /** The pack is a point-in-time snapshot handed to external renderers. */
  @Test
  void complianceRecords_cannotBeMutatedByTheCaller() {
    AuditPackAsset asset =
        asset(
            new GovernanceMetadata()
                .withAiCompliance(new AICompliance().withComplianceRecords(List.of(record()))));

    List<AIComplianceRecord> records = asset.complianceRecords();

    assertThrows(UnsupportedOperationException.class, () -> records.add(record()));
  }

  @Test
  void complianceRecords_isNotAffectedByLaterMutationOfTheGovernanceObject() {
    List<AIComplianceRecord> live = new ArrayList<>(List.of(record()));
    AuditPackAsset asset =
        asset(
            new GovernanceMetadata()
                .withAiCompliance(new AICompliance().withComplianceRecords(live)));

    List<AIComplianceRecord> snapshot = asset.complianceRecords();
    live.add(record());

    assertEquals(1, snapshot.size());
  }

  /** Deserialised entities can carry a null element; the snapshot must not throw on one. */
  @Test
  void complianceRecords_toleratesANullRecord() {
    List<AIComplianceRecord> withNull = Collections.singletonList(null);

    AuditPackAsset asset =
        asset(
            new GovernanceMetadata()
                .withAiCompliance(new AICompliance().withComplianceRecords(withNull)));

    assertEquals(1, asset.complianceRecords().size());
  }

  private static AuditPackAsset asset(Object governanceMetadata) {
    return new AuditPackAsset(
        "aiApplication", "id", "name", null, "svc.name", governanceMetadata, 1L);
  }

  private static AIComplianceRecord record() {
    return new AIComplianceRecord().withFramework(ComplianceFramework.EU_AI_Act);
  }
}
