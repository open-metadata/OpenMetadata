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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.ai.CreateAuditReport;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportFormat;
import org.openmetadata.schema.entity.ai.AuditReportScope;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rules.RuleEngine;

class AuditReportMapperTest {

  @Test
  void createToEntityRecordsTheAuthenticatedUserAsRequester() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleMock = mockStatic(RuleEngine.class)) {
      EntityReference mallory = new EntityReference().withType("user").withName("mallory");
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "mallory", Include.NON_DELETED))
          .thenReturn(mallory);
      ruleMock.when(RuleEngine::getInstance).thenReturn(mock(RuleEngine.class));

      CreateAuditReport create =
          new CreateAuditReport()
              .withName("mallorys_pack")
              .withScope(AuditReportScope.Estate)
              .withFormat(AuditReportFormat.Json);

      AuditReport report = new AuditReportMapper().createToEntity(create, "mallory");

      // Ownership of the pack comes from the authenticated principal, never the request body.
      assertSame(mallory, report.getRequestedBy());
      assertEquals("mallory", report.getUpdatedBy());
      assertEquals(AuditReportScope.Estate, report.getScope());
      assertEquals(AuditReportFormat.Json, report.getFormat());
      assertEquals(AuditReportStatus.Queued, report.getStatus());
    }
  }
}
