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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
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
    SubjectContext botContext =
        SubjectContext.getSubjectContext(SecurityUtil.getUserName(securityContext));

    if (!botContext.isBot()) {
      throw new AuthorizationException("Only bot users can impersonate");
    }

    OperationContext operationContext = new OperationContext("user", MetadataOperation.IMPERSONATE);
    ResourceContextInterface resourceContext = new ResourceContext("user");

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
    // Get the bot user who is trying to impersonate
    User bot;
    try {
      bot =
          Entity.getEntityByName(
              Entity.USER,
              subjectContext.impersonatedBy(),
              "id,name,isBot,allowImpersonation,roles",
              ALL);
    } catch (Exception e) {
      LOG.error("Failed to get bot user: {}", subjectContext.impersonatedBy(), e);
      throw new AuthorizationException("Bot user not found: " + subjectContext.impersonatedBy());
    }

    // Verify bot has allowImpersonation flag enabled
    if (Boolean.FALSE.equals(bot.getIsBot()) || Boolean.FALSE.equals(bot.getAllowImpersonation())) {
      LOG.warn(
          "Impersonation denied: bot={} does not have allowImpersonation enabled", bot.getName());
      throw new AuthorizationException(
          "Bot " + bot.getName() + " does not have impersonation enabled");
    }

    if (!hasImpersonatePermission(bot)) {
      LOG.warn("Impersonation denied: bot={} does not have Impersonate permission", bot.getName());
      throw new AuthorizationException(
          "Bot " + bot.getName() + " does not have Impersonate permission");
    }
  }

  private boolean hasImpersonatePermission(User bot) {
    List<EntityReference> roleRefs = bot.getRoles();
    if (nullOrEmpty(roleRefs)) {
      return false;
    }

    List<Role> roles;
    try {
      roles =
          Entity.getEntities(roleRefs, "policies", ALL).stream()
              .filter(Role.class::isInstance)
              .map(Role.class::cast)
              .toList();
    } catch (Exception e) {
      LOG.warn(
          "Failed to load roles for bot {} while checking impersonation permission",
          bot.getName(),
          e);
      return false;
    }
    if (roles.isEmpty()) {
      return false;
    }

    Set<EntityReference> policyRefs = new LinkedHashSet<>();
    for (Role role : roles) {
      if (role != null && role.getPolicies() != null) {
        policyRefs.addAll(role.getPolicies());
      }
    }
    if (policyRefs.isEmpty()) {
      return false;
    }

    List<Policy> policies;
    try {
      policies =
          Entity.getEntities(List.copyOf(policyRefs), "rules", ALL).stream()
              .filter(Policy.class::isInstance)
              .map(Policy.class::cast)
              .toList();
    } catch (Exception e) {
      LOG.warn(
          "Failed to load policies for bot {} while checking impersonation permission",
          bot.getName(),
          e);
      return false;
    }

    for (Policy policy : policies) {
      if (policy == null || policy.getRules() == null) {
        continue;
      }
      for (org.openmetadata.schema.entity.policies.accessControl.Rule rule : policy.getRules()) {
        List<MetadataOperation> operations = rule.getOperations();
        if (operations != null && operations.contains(MetadataOperation.IMPERSONATE)) {
          return true;
        }
      }
    }
    return false;
  }
}
