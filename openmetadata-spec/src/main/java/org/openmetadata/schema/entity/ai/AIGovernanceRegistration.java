/*
 *  Copyright 2026 Collate
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

package org.openmetadata.schema.entity.ai;

/**
 * Common registration/approval milestones shared by {@code GovernanceMetadata} (AI Application) and
 * {@code McpGovernanceMetadata} (MCP Server), which are otherwise distinct generated types with no
 * shared supertype. Applied via {@code javaInterfaces} in the schema so the intake/approval logic
 * can stamp these fields once instead of duplicating it per governance-metadata type. The
 * {@code registrationStatus} enum is intentionally excluded — each type generates its own nested
 * enum with identical values.
 */
public interface AIGovernanceRegistration {
  String getRegisteredBy();

  void setRegisteredBy(String registeredBy);

  Long getRegisteredAt();

  void setRegisteredAt(Long registeredAt);

  String getApprovedBy();

  void setApprovedBy(String approvedBy);

  Long getApprovedAt();

  void setApprovedAt(Long approvedAt);

  String getApprovalComments();

  void setApprovalComments(String approvalComments);
}
