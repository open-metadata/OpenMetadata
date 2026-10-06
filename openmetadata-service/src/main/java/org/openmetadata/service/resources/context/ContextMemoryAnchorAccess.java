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
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Whether a caller may ViewBasic the asset an Entity memory is anchored to. Admins pass the memory
 * visibility check before reaching this guard.
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
      ResourceContext<EntityInterface> resource =
          new ResourceContext<>(anchor.getType(), anchor.getId(), anchor.getFullyQualifiedName());
      DefaultAuthorizer.authorizeUser(
          userName,
          new OperationContext(resource.getResource(), MetadataOperation.VIEW_BASIC),
          resource);
      allowed = isSourceVisible(userName, resource);
    } catch (AuthorizationException | EntityNotFoundException e) {
      LOG.debug("Hiding memory: user {} cannot read anchor {}", userName, anchor.getId(), e);
      allowed = false;
    } catch (RuntimeException e) {
      LOG.warn(
          "Hiding memory: cannot authorize user {} for anchor {}", userName, anchor.getId(), e);
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
}
