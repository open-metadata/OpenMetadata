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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
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
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class FrameworkCoverageComputerTest {

  static {
    // Entity.registerEntity populates this at server startup; unit tests have no registry.
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("aiapplication", Entity.AI_APPLICATION);
  }

  @Test
  void computeReportsPerControlStatusFromMatchingRemediationActions() {
    AIGovernanceFramework framework = new AIGovernanceFramework().withName("EU_AI_Act");
    List<AIFrameworkControl> controls = List.of(control("art-10"), control("art-14"));
    List<EntityInterface<?>> assets =
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

  @Test
  @SuppressWarnings("unchecked")
  void computeNarrowsCountsToViewableAssets() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      UUID visibleId = UUID.randomUUID();
      UUID hiddenId = UUID.randomUUID();
      EntityRepository<AIApplication> repository = mock(EntityRepository.class);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      when(repository.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      // ResourceContext#getEntity() resolves the entity through this get; hand back an asset
      // carrying the requested id so the authorize answer below can tell the two apart.
      when(repository.get(any(), any(), any(), any(RelationIncludes.class), anyBoolean()))
          .thenAnswer(invocation -> application(invocation.getArgument(1, UUID.class)));
      authMock
          .when(() -> DefaultAuthorizer.authorizeUser(eq("mallory"), any(), any()))
          .thenAnswer(
              invocation -> {
                ResourceContextInterface context = invocation.getArgument(2);
                EntityInterface<?> entity = context.getEntity();
                if (entity != null && hiddenId.equals(entity.getId())) {
                  throw new AuthorizationException("operation ViewBasic denied");
                }
                return null;
              });

      AIGovernanceFramework framework = new AIGovernanceFramework().withName("EU_AI_Act");
      List<AIFrameworkControl> controls = List.of(control("art-10"));
      AIApplication visible = compliantApplication("claimsCopilot");
      visible.setId(visibleId);
      AIApplication hidden = compliantApplication("financeCopilot");
      hidden.setId(hiddenId);

      FrameworkCoverageResponse coverage =
          FrameworkCoverageComputer.compute(
              framework, controls, List.of(visible, hidden), AIAssetVisibility.forUser("mallory"));

      assertEquals(1, coverage.getAssetsInScope());
      assertEquals(1, coverage.getSummary().getCompliant());
    }
  }

  private AIApplication application(UUID id) {
    return new AIApplication().withId(id).withName("app_" + id).withFullyQualifiedName("app_" + id);
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
