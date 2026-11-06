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
package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.service.Entity;

public class AuditReportIndex implements TaggableIndex {
  final AuditReport report;

  public AuditReportIndex(AuditReport report) {
    this.report = report;
  }

  @Override
  public Object getEntity() {
    return report;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.AUDIT_REPORT;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (report == null) {
      return doc;
    }
    if (report.getStatus() != null) {
      doc.put("status", report.getStatus().value());
    }
    if (report.getScope() != null) {
      doc.put("scope", report.getScope().value());
    }
    if (report.getFormat() != null) {
      doc.put("format", report.getFormat().value());
    }
    if (report.getRequestedAt() != null) {
      doc.put("requestedAt", report.getRequestedAt());
    }
    if (report.getCompletedAt() != null) {
      doc.put("completedAt", report.getCompletedAt());
    }

    return doc;
  }
}
