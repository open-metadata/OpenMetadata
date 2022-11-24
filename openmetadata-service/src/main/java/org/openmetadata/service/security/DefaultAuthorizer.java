/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.security;

import static org.openmetadata.service.exception.CatalogExceptionMessage.notAdmin;

import java.io.IOException;
import java.util.List;
import javax.ws.rs.core.SecurityContext;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class DefaultAuthorizer implements Authorizer {
  @Override
  public void init(OpenMetadataApplicationConfig openMetadataApplicationConfig, Jdbi dbi) {
    LOG.info(
        "Initializing DefaultAuthorizer with config {}", openMetadataApplicationConfig.getAuthorizerConfiguration());
  }

  @Override
  public List<ResourcePermission> listPermissions(SecurityContext securityContext, String user) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    subjectContext = changeSubjectContext(user, subjectContext);

    if (subjectContext.isAdmin() || subjectContext.isBot()) {
      // Admins and bots have permissions to do all operations.
      return PolicyEvaluator.getResourcePermissions(Access.ALLOW);
    }
    return PolicyEvaluator.listPermission(subjectContext);
  }

  @Override
  public ResourcePermission getPermission(SecurityContext securityContext, String user, String resourceType) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    subjectContext = changeSubjectContext(user, subjectContext);

    if (subjectContext.isAdmin() || subjectContext.isBot()) {
      // Admins and bots have permissions to do all operations.
      return PolicyEvaluator.getResourcePermission(resourceType, Access.ALLOW);
    }
    return PolicyEvaluator.getPermission(subjectContext, resourceType);
  }

  @Override
  public ResourcePermission getPermission(
      SecurityContext securityContext, String user, ResourceContextInterface resourceContext) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    subjectContext = changeSubjectContext(user, subjectContext);

    if (subjectContext.isAdmin() || subjectContext.isBot()) {
      // Admins and bots have permissions to do all operations.
      return PolicyEvaluator.getResourcePermission(resourceContext.getResource(), Access.ALLOW);
    }
    return PolicyEvaluator.getPermission(subjectContext, resourceContext);
  }

  @Override
  public boolean isOwner(SecurityContext securityContext, EntityReference owner) {
    if (owner == null) {
      return false;
    }
    try {
      SubjectContext subjectContext = getSubjectContext(securityContext);
      return subjectContext.isOwner(owner);
    } catch (EntityNotFoundException ex) {
      return false;
    }
  }

  @Override
  public void authorize(
      SecurityContext securityContext,
      OperationContext operationContext,
      ResourceContextInterface resourceContext,
      boolean allowBots)
      throws IOException {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (subjectContext.isAdmin() || (allowBots && subjectContext.isBot())) {
      return;
    }
    PolicyEvaluator.hasPermission(subjectContext, resourceContext, operationContext);
  }

  @Override
  public void authorizeAdmin(SecurityContext securityContext, boolean allowBots) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (subjectContext.isAdmin() || (allowBots && subjectContext.isBot())) {
      return;
    }
    throw new AuthorizationException(notAdmin(securityContext.getUserPrincipal().getName()));
  }

  private SubjectContext getSubjectContext(SecurityContext securityContext) {
    if (securityContext == null || securityContext.getUserPrincipal() == null) {
      throw new AuthenticationException("No principal in security context");
    }
    return getSubjectContext(SecurityUtil.getUserName(securityContext.getUserPrincipal()));
  }

  private SubjectContext getSubjectContext(String userName) {
    return SubjectCache.getInstance().getSubjectContext(userName);
  }

  private SubjectContext changeSubjectContext(String user, SubjectContext loggedInUser) {
    // Asking for some other user's permissions is admin only operation
    if (user != null && !loggedInUser.getUser().getName().equals(user)) {
      if (!loggedInUser.isAdmin()) {
        throw new AuthorizationException(notAdmin(loggedInUser.getUser().getName()));
      }
      LOG.debug("Changing subject context from logged-in user to {}", user);
      return getSubjectContext(user);
    }
    return loggedInUser;
  }
}
