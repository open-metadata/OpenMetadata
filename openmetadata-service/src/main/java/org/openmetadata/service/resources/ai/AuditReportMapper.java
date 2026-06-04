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

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.ai.CreateAuditReport;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportFormat;
import org.openmetadata.schema.entity.ai.AuditReportScope;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class AuditReportMapper implements EntityMapper<AuditReport, CreateAuditReport> {
  @Override
  public AuditReport createToEntity(CreateAuditReport create, String user) {
    AuditReportScope scope =
        create.getScope() == null ? AuditReportScope.Estate : create.getScope();
    AuditReportFormat format =
        create.getFormat() == null ? AuditReportFormat.Json : create.getFormat();
    return copy(new AuditReport(), create, user)
        .withFramework(
            create.getFramework() != null
                ? getEntityReference(Entity.AI_GOVERNANCE_FRAMEWORK, create.getFramework())
                : null)
        .withScope(scope)
        .withScopeTarget(
            create.getScopeTarget() != null && scope != AuditReportScope.Estate
                ? resolveScopeTarget(scope, create.getScopeTarget())
                : null)
        .withFormat(format)
        .withStatus(AuditReportStatus.Queued)
        .withAsOfDate(create.getAsOfDate())
        .withIncludeRedacted(create.getIncludeRedacted())
        .withRequestedAt(System.currentTimeMillis());
  }

  private static org.openmetadata.schema.type.EntityReference resolveScopeTarget(
      AuditReportScope scope, String fqn) {
    String entityType = scope == AuditReportScope.Asset ? Entity.AI_APPLICATION : Entity.DOMAIN;
    return getEntityReference(entityType, fqn);
  }
}
