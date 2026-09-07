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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Permission.Access.ALLOW;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notAdmin;

import io.micrometer.core.instrument.Timer;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class DefaultAuthorizer implements Authorizer {

  @Override
  public void init(OpenMetadataApplicationConfig config) {
    LOG.info("Initializing DefaultAuthorizer with config {}", config.getAuthorizerConfiguration());
  }

  @Override
  public List<ResourcePermission> listPermissions(SecurityContext securityContext, String user) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    subjectContext = changeSubjectContext(user, subjectContext);
    return subjectContext.isAdmin()
        ? PolicyEvaluator.getResourcePermissions(
            ALLOW) // Admin has permissions to do all operations.
        : PolicyEvaluator.listPermission(subjectContext);
  }

  @Override
  public ResourcePermission getPermission(
      SecurityContext securityContext, String user, String resourceType) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    subjectContext = changeSubjectContext(user, subjectContext);
    return subjectContext.isAdmin()
        ? PolicyEvaluator.getResourcePermission(
            resourceType, ALLOW) // Admin has permissions to do all operations.
        : PolicyEvaluator.getPermission(subjectContext, resourceType);
  }

  @Override
  public ResourcePermission getPermission(
      SecurityContext securityContext, String user, ResourceContextInterface resourceContext) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    subjectContext = changeSubjectContext(user, subjectContext);
    return subjectContext.isAdmin()
        ? PolicyEvaluator.getResourcePermission(
            resourceContext.getResource(), ALLOW) // Admin all permissions
        : PolicyEvaluator.getPermission(subjectContext, resourceContext);
  }

  @Override
  public void authorize(
      SecurityContext securityContext,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    Timer.Sample authSample = RequestLatencyContext.startAuthOperation();
    try {
      SubjectContext subjectContext = getSubjectContext(securityContext);
      if (subjectContext.isAdmin()) {
        return;
      }
      if (isReviewer(resourceContext, subjectContext)) {
        return;
      }

      PolicyEvaluator.hasPermission(subjectContext, resourceContext, operationContext);
    } finally {
      RequestLatencyContext.endAuthOperation(authSample);
    }
  }

  public void authorizeRequests(
      SecurityContext securityContext, List<AuthRequest> requests, AuthorizationLogic logic) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (subjectContext.isAdmin()) {
      return;
    }

    if (logic == AuthorizationLogic.ANY) {
      boolean anySuccess = false;
      for (AuthRequest req : requests) {
        try {
          PolicyEvaluator.hasPermission(
              subjectContext, req.resourceContext(), req.operationContext());
          anySuccess = true;
          break;
        } catch (AuthorizationException ignored) {
        }
      }
      if (!anySuccess) {
        throw new AuthorizationException("User does not have ANY of the required permissions.");
      }
    } else { // ALL
      for (AuthRequest req : requests) {
        PolicyEvaluator.hasPermission(
            subjectContext, req.resourceContext(), req.operationContext());
      }
    }
  }

  @Override
  public void authorizeAdmin(SecurityContext securityContext) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (subjectContext.isAdmin()) {
      return;
    }
    throw new AuthorizationException(notAdmin(securityContext.getUserPrincipal().getName()));
  }

  @Override
  public void authorizeAdmin(String adminName) {
    SubjectContext subjectContext = subjectContextForUserName(adminName);
    if (subjectContext.isAdmin()) {
      return;
    }
    throw new AuthorizationException(notAdmin(adminName));
  }

  @Override
  public void authorizeAdminOrBot(SecurityContext securityContext) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (subjectContext.isAdmin() || subjectContext.isBot()) {
      return;
    }
    throw new AuthorizationException(notAdmin(securityContext.getUserPrincipal().getName()));
  }

  @Override
  public boolean shouldMaskPasswords(SecurityContext securityContext) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    return !subjectContext.isBot();
  }

  /** In 1.2, evaluate policies here instead of just checking the subject */
  @Override
  public boolean authorizePII(SecurityContext securityContext, List<EntityReference> owners) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    return subjectContext.isAdmin() || subjectContext.isBot() || subjectContext.isOwner(owners);
  }

  /**
   * Resolves the effective subject for the request and, when the caller is a bot acting through
   * impersonation, checks that impersonation before the subject is handed out.
   *
   * <p>The check lives here rather than in the individual guards because every authorization entry
   * point and every resource that filters on the effective subject funnels through this method.
   */
  public static SubjectContext getSubjectContext(SecurityContext securityContext) {
    return validateImpersonation(resolveSubjectContext(securityContext));
  }

  /**
   * Resolves the effective subject from a username, for the call sites that only have the effective
   * user name rather than the {@link SecurityContext}. The impersonating bot is not carried by the
   * name, so it is read from the request's {@link ImpersonationContext}.
   *
   * <p>Deliberately not an overload of {@code getSubjectContext}: that name is statically imported
   * and stubbed with untyped {@code any()} matchers across the codebase, where a second overload
   * makes the call ambiguous.
   */
  private static SubjectContext subjectContextForUserName(String userName) {
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    if (impersonatedBy == null) {
      return SubjectContext.getSubjectContext(userName);
    }
    return validateImpersonation(SubjectContext.getSubjectContext(userName, impersonatedBy));
  }

  private static SubjectContext validateImpersonation(SubjectContext subjectContext) {
    if (subjectContext.impersonatedBy() != null) {
      checkImpersonationAuthorization(subjectContext);
    }
    return subjectContext;
  }

  private static SubjectContext resolveSubjectContext(SecurityContext securityContext) {
    if (securityContext == null || securityContext.getUserPrincipal() == null) {
      throw new AuthenticationException("No principal in security context");
    }

    if (securityContext instanceof CatalogSecurityContext catalogSecurityContext) {
      String userName = SecurityUtil.getUserName(securityContext);
      String impersonatedBy = catalogSecurityContext.impersonatedUser();
      String activePersona = catalogSecurityContext.activePersona();
      if (activePersona != null) {
        return SubjectContext.getSubjectContext(userName, impersonatedBy, activePersona);
      }
      if (impersonatedBy != null) {
        return SubjectContext.getSubjectContext(userName, impersonatedBy);
      }
    } else {
      // Jersey may have wrapped the SecurityContext, try ThreadLocal fallback
      String impersonatedBy = ImpersonationContext.getImpersonatedBy();
      String activePersona = ActivePersonaContext.getActivePersona();
      if (activePersona != null) {
        String userName = SecurityUtil.getUserName(securityContext);
        return SubjectContext.getSubjectContext(userName, impersonatedBy, activePersona);
      }
      if (impersonatedBy != null) {
        String userName = SecurityUtil.getUserName(securityContext);
        return SubjectContext.getSubjectContext(userName, impersonatedBy);
      }
    }

    return SubjectContext.getSubjectContext(SecurityUtil.getUserName(securityContext));
  }

  private SubjectContext changeSubjectContext(String user, SubjectContext loggedInUser) {
    // Asking for some other user's permissions is admin only operation
    if (user != null && !loggedInUser.user().getName().equals(user)) {
      if (!loggedInUser.isAdmin()) {
        throw new AuthorizationException(notAdmin(loggedInUser.user().getName()));
      }
      LOG.debug("Changing subject context from logged-in user to {}", user);
      return SubjectContext.getSubjectContext(user);
    }
    return loggedInUser;
  }

  private boolean isReviewer(
      ResourceContextInterface resourceContext, SubjectContext subjectContext) {
    // On CREATE the entity is caller-supplied and not yet persisted, so its fields (e.g. reviewers)
    // cannot be trusted to grant authorization. Only evaluate against already persisted entities.
    if (resourceContext instanceof CreateResourceContext || resourceContext.getEntity() == null) {
      return false;
    }
    String updatedBy = subjectContext.user().getName();
    List<EntityReference> reviewers = resourceContext.getEntity().getReviewers();
    return !nullOrEmpty(reviewers)
        && reviewers.stream()
            .anyMatch(
                e -> updatedBy.equals(e.getName()) || updatedBy.equals(e.getFullyQualifiedName()));
  }

  private static void checkImpersonationAuthorization(SubjectContext subjectContext) {
    ImpersonationAuthorizer.authorize(subjectContext.impersonatedBy(), subjectContext.user());
  }
}
