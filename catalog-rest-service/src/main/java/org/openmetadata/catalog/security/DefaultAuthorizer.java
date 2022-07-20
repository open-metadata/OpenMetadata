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

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.noPermission;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.notAdmin;
import static org.openmetadata.catalog.security.SecurityUtil.DEFAULT_PRINCIPAL_DOMAIN;

import java.io.IOException;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.ws.rs.core.SecurityContext;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.security.policyevaluator.OperationContext;
import org.openmetadata.catalog.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.catalog.security.policyevaluator.RoleEvaluator;
import org.openmetadata.catalog.security.policyevaluator.SubjectContext;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;

@Slf4j
public class DefaultAuthorizer implements Authorizer {
  private Set<String> adminUsers;
  private Set<String> botUsers;
  private Set<String> testUsers;
  private String principalDomain;

  @Override
  public void init(AuthorizerConfiguration config, Jdbi dbi) {
    LOG.debug("Initializing DefaultAuthorizer with config {}", config);
    this.adminUsers = new HashSet<>(config.getAdminPrincipals());
    this.botUsers = new HashSet<>(config.getBotPrincipals());
    this.testUsers = new HashSet<>(config.getTestPrincipals());
    this.principalDomain = config.getPrincipalDomain();
    LOG.debug("Admin users: {}", adminUsers);
    initializeUsers();
  }

  private void initializeUsers() {
    LOG.debug("Checking user entries for admin users");
    String domain = principalDomain.isEmpty() ? DEFAULT_PRINCIPAL_DOMAIN : principalDomain;
    for (String adminUser : adminUsers) {
      User user = user(adminUser, domain, adminUser).withIsAdmin(true);
      addOrUpdateUser(user);
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
    return new User()
        .withId(UUID.randomUUID())
        .withName(name)
        .withEmail(name + "@" + domain)
        .withUpdatedBy(updatedBy)
        .withUpdatedAt(System.currentTimeMillis());
  }

  @Override
  public boolean hasPermissions(SecurityContext ctx, EntityReference owner) {
    // Since we have roles and operations. An Admin could enable updateDescription, tags, ownership permissions to
    // a role and assign that to the users who can update the entities. With this we can look at the owner as a strict
    // requirement to manage entities. So if owner is null we will not allow users to update entities. They can get a
    // role that allows them to update the entity.
    return isOwner(ctx, owner);
  }

  @Override
  public boolean hasPermissions(
      SecurityContext securityContext, EntityReference entityReference, MetadataOperation operation) {
    try {
      SubjectContext subjectContext = getSubjectContext(securityContext);
      List<EntityReference> allRoles = subjectContext.getAllRoles();
      if (entityReference == null) {
        // In some cases there is no specific entity being acted upon. Eg: Lineage.
        return RoleEvaluator.getInstance().hasPermissions(allRoles, null, operation);
      }

      EntityInterface entity =
          Entity.getEntity(entityReference, new Fields(List.of("tags", FIELD_OWNER)), Include.NON_DELETED);
      EntityReference owner = entity.getOwner();

      if (Entity.shouldHaveOwner(entityReference.getType()) && owner != null && subjectContext.isOwner(owner)) {
        return true; // Entity is owned by the user.
      }
      return RoleEvaluator.getInstance().hasPermissions(allRoles, entity, operation);
    } catch (IOException | EntityNotFoundException ex) {
      return false;
    }
  }

  @Override
  public List<MetadataOperation> listPermissions(SecurityContext securityContext, EntityReference entityReference) {
    SubjectContext subjectContext = getSubjectContext(securityContext);

    if (subjectContext.isAdmin() || subjectContext.isBot()) {
      // Admins and bots have permissions to do all operations.
      return Stream.of(MetadataOperation.values()).collect(Collectors.toList());
    }

    try {
      List<EntityReference> allRoles = subjectContext.getAllRoles();
      if (entityReference == null) {
        return RoleEvaluator.getInstance().getAllowedOperations(allRoles, null);
      }
      EntityInterface entity =
          Entity.getEntity(entityReference, new Fields(List.of("tags", FIELD_OWNER)), Include.NON_DELETED);
      EntityReference owner = entity.getOwner();
      if (owner == null || subjectContext.isOwner(owner)) {
        // Entity does not have an owner or is owned by the user - allow all operations.
        return Stream.of(MetadataOperation.values()).collect(Collectors.toList());
      }
      return RoleEvaluator.getInstance().getAllowedOperations(allRoles, entity);
    } catch (IOException | EntityNotFoundException ex) {
      return Collections.emptyList();
    }
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
      SecurityContext securityContext, OperationContext operationContext, ResourceContextInterface resourceContext)
      throws IOException {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (subjectContext.isAdmin() || subjectContext.isBot()) {
      return;
    }

    if (subjectContext.isOwner(resourceContext.getOwner())) {
      return;
    }

    // TODO view is currently allowed for everyone
    if (operationContext.getOperations().size() == 1
        && operationContext.getOperations().get(0) == MetadataOperation.VIEW_ALL) {
      return;
    }
    List<MetadataOperation> metadataOperations = operationContext.getOperations();

    // If there are no specific metadata operations that can be determined from the JSON Patch, deny the changes.
    if (metadataOperations.isEmpty()) {
      throw new AuthorizationException(noPermission(securityContext.getUserPrincipal()));
    }
    for (MetadataOperation operation : metadataOperations) {
      if (!RoleEvaluator.getInstance()
          .hasPermissions(subjectContext.getAllRoles(), resourceContext.getEntity(), operation)) {
        throw new AuthorizationException(noPermission(securityContext.getUserPrincipal(), operation.value()));
      }
    }
    return;
  }

  @Override
  public void authorizeAdmin(SecurityContext securityContext, boolean allowBots) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (subjectContext.isAdmin() || (allowBots && subjectContext.isBot())) {
      return;
    }
    throw new AuthorizationException(notAdmin(securityContext.getUserPrincipal()));
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
    return SubjectContext.getSubjectContext(SecurityUtil.getUserName(securityContext.getUserPrincipal()));
  }
}
