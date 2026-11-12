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

package org.openmetadata.service.resources.context;

import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Who may start or retry a file's or an article's memory extraction: its owners, the members of an
 * owning team included, and admins. No policy grants it, since each run can cost a model call.
 */
public final class MemoryExtractionAccess {
  static final String OWNERS_OR_ADMINS =
      "Only the document's owners or an admin can extract its memories.";

  private MemoryExtractionAccess() {}

  /** {@code document} must carry its owners: one loaded without them is refused to non-admins. */
  public static void requireOwnerOrAdmin(
      EntityInterface<?> document, SecurityContext securityContext) {
    SubjectContext caller = DefaultAuthorizer.getSubjectContext(securityContext);
    if (!caller.isAdmin() && !caller.isOwner(document.getOwners())) {
      throw new ForbiddenException(OWNERS_OR_ADMINS);
    }
  }
}
