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

package org.openmetadata.catalog.security;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.notAdmin;
import static org.openmetadata.catalog.security.SecurityUtil.DEFAULT_PRINCIPAL_DOMAIN;

import at.favre.lib.crypto.bcrypt.BCrypt;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.ws.rs.core.SecurityContext;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.AuthenticationMechanism;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.security.policyevaluator.OperationContext;
import org.openmetadata.catalog.security.policyevaluator.PolicyCache;
import org.openmetadata.catalog.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.catalog.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.catalog.security.policyevaluator.RoleCache;
import org.openmetadata.catalog.security.policyevaluator.SubjectCache;
import org.openmetadata.catalog.security.policyevaluator.SubjectContext;
import org.openmetadata.catalog.teams.authn.BasicAuthMechanism;
import org.openmetadata.catalog.teams.authn.SSOAuthMechanism;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Permission.Access;
import org.openmetadata.catalog.type.ResourcePermission;
import org.openmetadata.catalog.util.ConfigurationHolder;
import org.openmetadata.catalog.util.RestUtil;

@Slf4j
public class DefaultAuthorizer implements Authorizer {
  private Set<String> adminUsers;
  private Set<String> botUsers;
  private Set<String> testUsers;
  private String principalDomain;

  @Override
  public void init(AuthorizerConfiguration config, Jdbi dbi) {
    LOG.info("Initializing DefaultAuthorizer with config {}", config);
    this.adminUsers = new HashSet<>(config.getAdminPrincipals());
    this.botUsers = new HashSet<>(config.getBotPrincipals());
    this.testUsers = new HashSet<>(config.getTestPrincipals());
    this.principalDomain = config.getPrincipalDomain();

    SubjectCache.initialize();
    PolicyCache.initialize();
    RoleCache.initialize();
    LOG.debug("Admin users: {}", adminUsers);
    initializeUsers();
  }

  private void initializeUsers() {
    LOG.debug("Checking user entries for admin users");
    // For a Basic Auth , an admin can during server startup decide who all can be admin by adding admin principal
    // when a registration is done through registration api, then we add the user as admin or normal user
    // checking whether that username was bootstrapped into server during startup as admin
    String domain = principalDomain.isEmpty() ? DEFAULT_PRINCIPAL_DOMAIN : principalDomain;
    if (!ConfigurationHolder.getInstance()
        .getConfig(ConfigurationHolder.ConfigurationType.AUTHENTICATIONCONFIG, AuthenticationConfiguration.class)
        .getProvider()
        .equals(SSOAuthMechanism.SsoServiceType.basic.toString())) {
      for (String adminUser : adminUsers) {
        User user = user(adminUser, domain, adminUser).withIsAdmin(true);
        addOrUpdateUser(user);
      }
    }

    LOG.debug("Checking user entries for bot users");
    for (String botUser : botUsers) {
      User user = user(botUser, domain, botUser).withIsBot(true);
      addOrUpdateUser(user);
    }

    LOG.debug("Checking user entries for test users");
    for (String testUser : testUsers) {
      User user = user(testUser, domain, testUser);
      addOrUpdateUser(user);
    }
  }

  private User user(String name, String domain, String updatedBy) {
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withEmail(name + "@" + domain)
            .withUpdatedBy(updatedBy)
            .withUpdatedAt(System.currentTimeMillis());
    BasicAuthMechanism basicAuthMechanism = new BasicAuthMechanism();
    basicAuthMechanism.setPassword(BCrypt.withDefaults().hashToString(12, "Mohit234".toCharArray()));
    AuthenticationMechanism mechanism = new AuthenticationMechanism();
    mechanism.setAuthType(AuthenticationMechanism.AuthType.BASIC);
    mechanism.setConfig(basicAuthMechanism);
    user.setAuthenticationMechanism(mechanism);
    return user;
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

  private void addOrUpdateUser(User user) {
    EntityRepository<User> userRepository = Entity.getEntityRepository(Entity.USER);
    try {
      RestUtil.PutResponse<User> addedUser = userRepository.createOrUpdate(null, user);
      LOG.debug("Added user entry: {}", addedUser);
    } catch (Exception exception) {
      // In HA set up the other server may have already added the user.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      LOG.debug("User entry: {} already exists.", user);
    }
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
