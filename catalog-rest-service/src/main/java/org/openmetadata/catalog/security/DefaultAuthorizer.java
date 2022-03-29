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

import java.io.IOException;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.RoleRepository;
import org.openmetadata.catalog.jdbi3.TeamRepository;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;

@Slf4j
public class DefaultAuthorizer implements Authorizer {

  private Set<String> adminUsers;
  private Set<String> botUsers;

  private String principalDomain;
  private UserRepository userRepository;

  private PolicyEvaluator policyEvaluator;
  private Fields fieldsTeams;
  private Fields fieldsRolesAndTeams;

  @Override
  public void init(AuthorizerConfiguration config, Jdbi dbi) throws IOException {
    LOG.debug("Initializing DefaultAuthorizer with config {}", config);
    this.adminUsers = new HashSet<>(config.getAdminPrincipals());
    this.botUsers = new HashSet<>(config.getBotPrincipals());
    this.principalDomain = config.getPrincipalDomain();
    LOG.debug("Admin users: {}", adminUsers);
    CollectionDAO collectionDAO = dbi.onDemand(CollectionDAO.class);
    this.userRepository = new UserRepository(collectionDAO);
    // RoleRepository and TeamRepository needs to be instantiated for Entity.DAO_MAP to populated.
    // As we create default admin/bots we need to have RoleRepository and TeamRepository available in DAO_MAP.
    // This needs to be handled better in future releases.
    RoleRepository roleRepository = new RoleRepository(collectionDAO);
    TeamRepository teamRepository = new TeamRepository(collectionDAO);
    mayBeAddAdminUsers();
    mayBeAddBotUsers();
    this.policyEvaluator = PolicyEvaluator.getInstance();
    this.fieldsTeams = userRepository.getFields("teams");
    this.fieldsRolesAndTeams = userRepository.getFields("roles,teams");
  }

  private void mayBeAddAdminUsers() {
    LOG.debug("Checking user entries for admin users");
    for (String adminUser : adminUsers) {
      try {
        User user = userRepository.getByName(null, adminUser, Fields.EMPTY_FIELDS);
        if (user != null && (user.getIsAdmin() == null || !user.getIsAdmin())) {
          user.setIsAdmin(true);
        }
        addOrUpdateUser(user);
      } catch (EntityNotFoundException ex) {
        User user =
            new User()
                .withId(UUID.randomUUID())
                .withName(adminUser)
                .withEmail(adminUser + "@" + principalDomain)
                .withIsAdmin(true)
                .withUpdatedBy(adminUser)
                .withUpdatedAt(System.currentTimeMillis());
        addOrUpdateUser(user);
      } catch (IOException e) {
        LOG.error("Failed to create admin user {}", adminUser, e);
      }
    }
  }

  private void mayBeAddBotUsers() {
    LOG.debug("Checking user entries for bot users");
    for (String botUser : botUsers) {
      try {
        User user = userRepository.getByName(null, botUser, Fields.EMPTY_FIELDS);
        if (user != null && (user.getIsBot() == null || !user.getIsBot())) {
          user.setIsBot(true);
        }
        addOrUpdateUser(user);
      } catch (EntityNotFoundException ex) {
        User user =
            new User()
                .withId(UUID.randomUUID())
                .withName(botUser)
                .withEmail(botUser + "@" + principalDomain)
                .withIsBot(true)
                .withUpdatedBy(botUser)
                .withUpdatedAt(System.currentTimeMillis());
        addOrUpdateUser(user);
      } catch (IOException e) {
        LOG.error("Failed to create admin user {}", botUser, e);
      }
    }
  }

  @Override
  public boolean hasPermissions(AuthenticationContext ctx, EntityReference owner) {
    // Since we have roles and operations. An Admin could enable updateDescription, tags, ownership permissions to
    // a role and assign that to the users who can update the entities. With this we can look at the owner as a strict
    // requirement to manage entities. So if owner is null we will not allow users to update entities. They can get a
    // role that allows them to update the entity.
    return isOwner(ctx, owner);
  }

  @Override
  public boolean hasPermissions(
      AuthenticationContext ctx, EntityReference entityReference, MetadataOperation operation) {
    validate(ctx);
    try {
      User user = getUserFromAuthenticationContext(ctx, fieldsRolesAndTeams);
      if (entityReference == null) {
        // In some cases there is no specific entity being acted upon. Eg: Lineage.
        return policyEvaluator.hasPermission(user, null, operation);
      }

      Object entity = Entity.getEntity(entityReference, new Fields(List.of("tags", FIELD_OWNER)), Include.NON_DELETED);
      EntityReference owner = Entity.getEntityInterface(entity).getOwner();

      if (Entity.shouldHaveOwner(entityReference.getType()) && owner != null && isOwnedByUser(user, owner)) {
        return true; // Entity is owned by the user.
      }
      return policyEvaluator.hasPermission(user, entity, operation);
    } catch (IOException | EntityNotFoundException ex) {
      return false;
    }
  }

  @Override
  public List<MetadataOperation> listPermissions(AuthenticationContext ctx, EntityReference entityReference) {
    validate(ctx);

    if (isAdmin(ctx) || isBot(ctx)) {
      // Admins and bots have permissions to do all operations.
      return Stream.of(MetadataOperation.values()).collect(Collectors.toList());
    }

    try {
      User user = getUserFromAuthenticationContext(ctx, fieldsRolesAndTeams);
      if (entityReference == null) {
        return policyEvaluator.getAllowedOperations(user, null);
      }
      Object entity = Entity.getEntity(entityReference, new Fields(List.of("tags", FIELD_OWNER)), Include.NON_DELETED);
      EntityReference owner = Entity.getEntityInterface(entity).getOwner();
      if (owner == null || isOwnedByUser(user, owner)) {
        // Entity does not have an owner or is owned by the user - allow all operations.
        return Stream.of(MetadataOperation.values()).collect(Collectors.toList());
      }
      return policyEvaluator.getAllowedOperations(user, entity);
    } catch (IOException | EntityNotFoundException ex) {
      return Collections.emptyList();
    }
  }

  /** Checks if the user is same as owner or part of the team that is the owner. */
  private boolean isOwnedByUser(User user, EntityReference owner) {
    if (owner.getType().equals(Entity.USER) && owner.getName().equals(user.getName())) {
      return true; // Owner is same as user.
    }
    if (owner.getType().equals(Entity.TEAM)) {
      for (EntityReference userTeam : user.getTeams()) {
        if (userTeam.getName().equals(owner.getName())) {
          return true; // Owner is a team, and the user is part of this team.
        }
      }
    }
    return false;
  }

  @Override
  public boolean isAdmin(AuthenticationContext ctx) {
    validate(ctx);
    try {
      User user = getUserFromAuthenticationContext(ctx, Fields.EMPTY_FIELDS);
      return Boolean.TRUE.equals(user.getIsAdmin());
    } catch (IOException | EntityNotFoundException ex) {
      return false;
    }
  }

  @Override
  public boolean isBot(AuthenticationContext ctx) {
    validate(ctx);
    try {
      User user = getUserFromAuthenticationContext(ctx, Fields.EMPTY_FIELDS);
      return Boolean.TRUE.equals(user.getIsBot());
    } catch (IOException | EntityNotFoundException ex) {
      return false;
    }
  }

  @Override
  public boolean isOwner(AuthenticationContext ctx, EntityReference owner) {
    if (owner == null) {
      return false;
    }
    validate(ctx);
    try {
      User user = getUserFromAuthenticationContext(ctx, fieldsTeams);
      return isOwnedByUser(user, owner);
    } catch (IOException | EntityNotFoundException ex) {
      return false;
    }
  }

  private void validate(AuthenticationContext ctx) {
    if (ctx == null || ctx.getPrincipal() == null) {
      throw new AuthenticationException("No principal in AuthenticationContext");
    }
  }

  private User getUserFromAuthenticationContext(AuthenticationContext ctx, Fields fields) throws IOException {
    if (ctx.getUser() != null) {
      // If a requested field is not present in the user, then add it
      for (String field : fields.getList()) {
        if (!ctx.getUserFields().contains(field)) {
          userRepository.setFields(ctx.getUser(), userRepository.getFields(field));
          ctx.getUserFields().add(fields);
        }
      }
      return ctx.getUser();
    }
    String userName = SecurityUtil.getUserName(ctx);
    User user = userRepository.getByName(null, userName, fields);
    ctx.setUser(user);
    ctx.setUserFields(fields);
    return user;
  }

  private void addOrUpdateUser(User user) {
    try {
      RestUtil.PutResponse<User> addedUser = userRepository.createOrUpdate(null, user);
      LOG.debug("Added user entry: {}", addedUser);
    } catch (IOException exception) {
      // In HA set up the other server may have already added the user.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      LOG.debug("User entry: {} already exists.", user);
    }
  }
}
