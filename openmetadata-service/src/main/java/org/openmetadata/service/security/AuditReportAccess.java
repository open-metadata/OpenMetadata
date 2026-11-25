package org.openmetadata.service.security;

import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** A saved audit artifact carries the requester's scope, which the report's own domains cannot express. */
final class AuditReportAccess {
  private AuditReportAccess() {}

  static void authorize(final SubjectContext subject, final ResourceContextInterface resource) {
    if (!subject.isAdmin()
        && Entity.AUDIT_REPORT.equals(resource.getResource())
        && !resource.isEntityTypeLevel()
        && resource.getEntity() instanceof AuditReport report) {
      final EntityReference requester = report.getRequestedBy();
      if (requester == null
          || requester.getId() == null
          || !requester.getId().equals(subject.user().getId())) {
        throw new AuthorizationException(
            "Only the audit report requester or an administrator may access this report");
      }
    }
  }
}
