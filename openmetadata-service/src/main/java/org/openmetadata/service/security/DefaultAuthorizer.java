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
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Permission.Access.ALLOW;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notAdmin;

import io.micrometer.core.instrument.Timer;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
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

      if (subjectContext.impersonatedBy() != null) {
        checkImpersonationAuthorization(subjectContext);
      }

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
    SubjectContext subjectContext = SubjectContext.getSubjectContext(adminName);
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

  public void authorizeImpersonation(SecurityContext securityContext, String targetUser) {
    String botName = SecurityUtil.getUserName(securityContext);
    SubjectContext botContext = SubjectContext.getSubjectContext(botName);

    if (!botContext.isBot()) {
      throw new AuthorizationException("Only bot users can impersonate");
    }
    if (!Boolean.TRUE.equals(botContext.user().getAllowImpersonation())) {
      throw new AuthorizationException(
          "Bot " + botName + " does not have impersonation enabled");
    }

    OperationContext operationContext =
        new OperationContext(Entity.USER, MetadataOperation.IMPERSONATE);
    ResourceContextInterface resourceContext = new ResourceContext<>(Entity.USER, null, targetUser);

    PolicyEvaluator.hasPermission(botContext, resourceContext, operationContext);
  }

  /** In 1.2, evaluate policies here instead of just checking the subject */
  @Override
  public boolean authorizePII(SecurityContext securityContext, List<EntityReference> owners) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    return subjectContext.isAdmin() || subjectContext.isBot() || subjectContext.isOwner(owners);
  }

  public static SubjectContext getSubjectContext(SecurityContext securityContext) {
    if (securityContext == null || securityContext.getUserPrincipal() == null) {
      throw new AuthenticationException("No principal in security context");
    }

    if (securityContext instanceof CatalogSecurityContext catalogSecurityContext) {
      String userName = SecurityUtil.getUserName(securityContext);
      String impersonatedBy = catalogSecurityContext.impersonatedUser();
      if (impersonatedBy != null) {
        return SubjectContext.getSubjectContext(userName, impersonatedBy);
      }
    } else {
      // Jersey may have wrapped the SecurityContext, try ThreadLocal fallback
      String impersonatedBy = ImpersonationContext.getImpersonatedBy();
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
    if (resourceContext.getEntity() == null) {
      return false;
    }
    String updatedBy = subjectContext.user().getName();
    List<EntityReference> reviewers = resourceContext.getEntity().getReviewers();
    return !nullOrEmpty(reviewers)
        && reviewers.stream()
            .anyMatch(
                e -> updatedBy.equals(e.getName()) || updatedBy.equals(e.getFullyQualifiedName()));
  }

  private void checkImpersonationAuthorization(SubjectContext subjectContext) {
    User bot = getImpersonatingBot(subjectContext.impersonatedBy());

    if (!Boolean.TRUE.equals(bot.getIsBot()) || !Boolean.TRUE.equals(bot.getAllowImpersonation())) {
      LOG.warn(
          "Impersonation denied: bot={} does not have allowImpersonation enabled", bot.getName());
      throw new AuthorizationException(
          "Bot " + bot.getName() + " does not have impersonation enabled");
    }

    authorizeImpersonationTarget(bot.getName(), subjectContext.user());
  }

  private User getImpersonatingBot(String botName) {
    User bot;
    try {
      bot = Entity.getEntityByName(Entity.USER, botName, "id,name,isBot,allowImpersonation", ALL);
    } catch (Exception e) {
      LOG.error("Failed to get bot user: {}", botName, e);
      throw new AuthorizationException("Bot user not found: " + botName);
    }
    if (bot == null) {
      LOG.warn("Impersonation denied: bot user {} was not found", botName);
      throw new AuthorizationException("Bot user not found: " + botName);
    }
    return bot;
  }

  /**
   * Evaluates the bot's policies for the {@code Impersonate} operation with the target user as the
   * resource. Policies scope who can be impersonated - for example, a deny rule with the {@code
   * isAdminUser()} condition blocks impersonating admins.
   */
  private void authorizeImpersonationTarget(String botName, User targetUser) {
    SubjectContext botSubjectContext = SubjectContext.getSubjectContext(botName);
    OperationContext operationContext =
        new OperationContext(Entity.USER, MetadataOperation.IMPERSONATE);
    ResourceContextInterface targetResourceContext = targetUserResourceContext(targetUser);
    try {
      PolicyEvaluator.hasPermission(botSubjectContext, targetResourceContext, operationContext);
    } catch (AuthorizationException e) {
      LOG.warn(
          "Impersonation denied: bot={} is not authorized to impersonate user={}",
          botName,
          targetUser.getName());
      throw new AuthorizationException(
          "Bot " + botName + " is not authorized to impersonate user " + targetUser.getName());
    }
  }

  @SuppressWarnings("unchecked")
  private static ResourceContextInterface targetUserResourceContext(User targetUser) {
    EntityRepository<User> userRepository =
        (EntityRepository<User>) Entity.getEntityRepository(Entity.USER);
    return new ResourceContext<>(Entity.USER, targetUser, userRepository);
  }
}
