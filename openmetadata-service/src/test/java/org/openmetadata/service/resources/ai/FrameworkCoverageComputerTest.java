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

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.FrameworkControlCoverage;
import org.openmetadata.schema.api.ai.FrameworkCoverageResponse;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.type.AICompliance;
import org.openmetadata.schema.type.AIComplianceRecord;
import org.openmetadata.schema.type.ComplianceFramework;
import org.openmetadata.schema.type.RemediationAction;
import org.openmetadata.schema.type.RemediationStatus;
import org.openmetadata.schema.type.Verification;

class FrameworkCoverageComputerTest {

  @Test
  void computeReportsPerControlStatusFromMatchingRemediationActions() {
    AIGovernanceFramework framework = new AIGovernanceFramework().withName("EU_AI_Act");
    List<AIFrameworkControl> controls = List.of(control("art-10"), control("art-14"));
    List<EntityInterface> assets =
        List.of(
            compliantApplication("claimsCopilot", remediation("art-10", RemediationStatus.Open)),
            compliantApplication("financeCopilot"));

    FrameworkCoverageResponse coverage =
        FrameworkCoverageComputer.compute(framework, controls, assets);
    List<FrameworkControlCoverage> controlRows = coverage.getControls();

    FrameworkControlCoverage dataGovernanceControl = controlRow(controlRows, "art-10");
    assertEquals(FrameworkControlCoverage.Status.PARTIAL, dataGovernanceControl.getStatus());
    assertEquals(1, dataGovernanceControl.getAffectedAssetCount());
    assertEquals(2, dataGovernanceControl.getEvidenceCount());

    FrameworkControlCoverage oversightControl = controlRow(controlRows, "art-14");
    assertEquals(FrameworkControlCoverage.Status.MET, oversightControl.getStatus());
    assertEquals(0, oversightControl.getAffectedAssetCount());
    assertEquals(2, oversightControl.getEvidenceCount());
  }

  private AIFrameworkControl control(String code) {
    return new AIFrameworkControl()
        .withName(code)
        .withCode(code)
        .withDisplayName("Control " + code);
  }

  private AIApplication compliantApplication(String name, RemediationAction... remediationActions) {
    return new AIApplication()
        .withName(name)
        .withGovernanceMetadata(
            new GovernanceMetadata()
                .withAiCompliance(
                    new AICompliance()
                        .withComplianceRecords(
                            List.of(
                                new AIComplianceRecord()
                                    .withFramework(ComplianceFramework.EU_AI_Act)
                                    .withStatus(AIComplianceRecord.Status.COMPLIANT)
                                    .withVerification(
                                        new Verification()
                                            .withCertificateUrl(
                                                "https://example.com/evidence/" + name)))))
                .withRemediationActions(List.of(remediationActions)));
  }

  private RemediationAction remediation(String controlCode, RemediationStatus status) {
    return new RemediationAction()
        .withId(UUID.randomUUID())
        .withLabel("Fix " + controlCode)
        .withFrameworkRef(ComplianceFramework.EU_AI_Act)
        .withControlCode(controlCode)
        .withStatus(status);
  }

  private FrameworkControlCoverage controlRow(
      List<FrameworkControlCoverage> controls, String code) {
    return controls.stream()
        .filter(control -> code.equals(control.getCode()))
        .findFirst()
        .orElseThrow();
  }
}
