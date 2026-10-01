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

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.drive.ContextFileVisibility;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Whether a caller may ViewBasic the asset an Entity memory is anchored to, decided like
 * DefaultAuthorizer#authorize (reviewer shortcut, then policies) but as a boolean, so the static
 * read guards need no Authorizer. Admins never get here: the visibility check passes them first.
 */
final class ContextMemoryAnchorAccess {

  private static final Logger LOG = LoggerFactory.getLogger(ContextMemoryAnchorAccess.class);

  private ContextMemoryAnchorAccess() {}

  static boolean canView(String userName, EntityReference anchor) {
    boolean resolvable =
        userName != null
            && anchor.getType() != null
            && Entity.hasEntityRepository(anchor.getType());
    return resolvable && isAllowed(userName, anchor);
  }

  private static boolean isAllowed(String userName, EntityReference anchor) {
    boolean allowed;
    try {
      SubjectContext subject = SubjectContext.getSubjectContext(userName);
      ResourceContext<EntityInterface> resource =
          new ResourceContext<>(anchor.getType(), anchor.getId(), anchor.getFullyQualifiedName());
      allowed =
          (isReviewer(subject, resource) || hasViewBasic(subject, resource))
              && isSourceVisible(userName, resource);
    } catch (EntityNotFoundException e) {
      LOG.debug("Hiding memory: user {} or anchor {} not found", userName, anchor.getId(), e);
      allowed = false;
    }
    return allowed;
  }

  private static boolean isSourceVisible(
      String userName, ResourceContext<EntityInterface> resource) {
    EntityInterface entity = resource.getEntity();
    return entity != null
        && (!(entity instanceof ContextFile file)
            || ContextFileVisibility.isVisibleToUser(file, userName, false));
  }

  private static boolean isReviewer(
      SubjectContext subject, ResourceContext<EntityInterface> resource) {
    EntityInterface entity = resource.getEntity();
    return entity != null && subject.isReviewer(entity.getReviewers());
  }

  private static boolean hasViewBasic(
      SubjectContext subject, ResourceContext<EntityInterface> resource) {
    boolean allowed = true;
    try {
      PolicyEvaluator.hasPermission(
          subject,
          resource,
          new OperationContext(resource.getResource(), MetadataOperation.VIEW_BASIC));
    } catch (AuthorizationException denied) {
      allowed = false;
    }
    return allowed;
  }
}
