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
import java.text.ParseException;
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
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.resources.teams.UserResource;
import org.openmetadata.catalog.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.RestUtil;

@Slf4j
public class DefaultAuthorizer implements Authorizer {

  private Set<String> adminUsers;
  private Set<String> botUsers;

  private String principalDomain;
  private UserRepository userRepository;

  private PolicyEvaluator policyEvaluator;
  private static final String FIELDS_PARAM = "roles,teams";

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
    mayBeAddAdminUsers();
    mayBeAddBotUsers();
    this.policyEvaluator = PolicyEvaluator.getInstance();
  }

  private void mayBeAddAdminUsers() {
    LOG.debug("Checking user entries for admin users");
    EntityUtil.Fields fields = new EntityUtil.Fields(UserResource.ALLOWED_FIELDS, FIELDS_PARAM);
    for (String adminUser : adminUsers) {
      try {
        User user = userRepository.getByName(null, adminUser, fields);
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
      } catch (IOException | ParseException e) {
        LOG.error("Failed to create admin user {}", adminUser, e);
      }
    }
  }

  private void mayBeAddBotUsers() {
    LOG.debug("Checking user entries for bot users");
    EntityUtil.Fields fields = new EntityUtil.Fields(UserResource.ALLOWED_FIELDS, FIELDS_PARAM);
    for (String botUser : botUsers) {
      try {
        User user = userRepository.getByName(null, botUser, fields);
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
      } catch (IOException | ParseException e) {
        LOG.error("Failed to create admin user {}", botUser, e);
      }
    }
  }

  @Override
  public boolean hasPermissions(AuthenticationContext ctx, EntityReference owner) {
    validateAuthenticationContext(ctx);
    // To encourage users to claim or update changes to tables when a non-owner or un-claimed datasets.
    if (owner == null) {
      return true;
    }
    try {
      User user = getUserFromAuthenticationContext(ctx);
      return isOwnedByUser(user, owner);
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
    }
  }

  @Override
  public boolean hasPermissions(
      AuthenticationContext ctx, EntityReference entityReference, MetadataOperation operation) {
    validateAuthenticationContext(ctx);
    try {
      User user = getUserFromAuthenticationContext(ctx);
      if (entityReference == null) {
        // In some cases there is no specific entity being acted upon. Eg: Lineage.
        return policyEvaluator.hasPermission(user, null, operation);
      }

      Object entity = Entity.getEntity(entityReference, new EntityUtil.Fields(List.of("tags", FIELD_OWNER)));
      EntityReference owner = Entity.getEntityInterface(entity).getOwner();
      if (Entity.shouldHaveOwner(entityReference.getType()) && owner == null) {
        // Entity does not have an owner.
        return true;
      }
      if (Entity.shouldHaveOwner(entityReference.getType()) && isOwnedByUser(user, owner)) {
        // Entity is owned by the user.
        return true;
      }
      return policyEvaluator.hasPermission(user, entity, operation);
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
    }
  }

  @Override
  public List<MetadataOperation> listPermissions(AuthenticationContext ctx, EntityReference entityReference) {
    validateAuthenticationContext(ctx);

    if (isAdmin(ctx) || isBot(ctx)) {
      // Admins and bots have permissions to do all operations.
      return Stream.of(MetadataOperation.values()).collect(Collectors.toList());
    }

    try {
      User user = getUserFromAuthenticationContext(ctx);
      if (entityReference == null) {
        return policyEvaluator.getAllowedOperations(user, null);
      }
      Object entity = Entity.getEntity(entityReference, new EntityUtil.Fields(List.of("tags", FIELD_OWNER)));
      EntityReference owner = Entity.getEntityInterface(entity).getOwner();
      if (owner == null || isOwnedByUser(user, owner)) {
        // Entity does not have an owner or is owned by the user - allow all operations.
        return Stream.of(MetadataOperation.values()).collect(Collectors.toList());
      }
      return policyEvaluator.getAllowedOperations(user, entity);
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return Collections.emptyList();
    }
  }

  /** Checks if the user is same as owner or part of the team that is the owner. */
  private boolean isOwnedByUser(User user, EntityReference owner) {
    if (owner.getType().equals(Entity.USER) && owner.getName().equals(user.getName())) {
      // Owner is same as user.
      return true;
    }
    if (owner.getType().equals(Entity.TEAM)) {
      for (EntityReference userTeam : user.getTeams()) {
        if (userTeam.getName().equals(owner.getName())) {
          // Owner is a team, and the user is part of this team.
          return true;
        }
      }
    }
    return false;
  }

  @Override
  public boolean isAdmin(AuthenticationContext ctx) {
    validateAuthenticationContext(ctx);
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(UserResource.ALLOWED_FIELDS, FIELDS_PARAM);
    try {
      User user = userRepository.getByName(null, userName, fields);
      if (user.getIsAdmin() == null) {
        return false;
      }
      return user.getIsAdmin();
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
    }
  }

  @Override
  public boolean isBot(AuthenticationContext ctx) {
    validateAuthenticationContext(ctx);
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(UserResource.ALLOWED_FIELDS, FIELDS_PARAM);
    try {
      User user = userRepository.getByName(null, userName, fields);
      if (user.getIsBot() == null) {
        return false;
      }
      return user.getIsBot();
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
    }
  }

  @Override
  public boolean isOwner(AuthenticationContext ctx, EntityReference owner) {
    validateAuthenticationContext(ctx);
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(UserResource.ALLOWED_FIELDS, FIELDS_PARAM);
    try {
      User user = userRepository.getByName(null, userName, fields);
      if (owner == null) {
        return false;
      }
      return isOwnedByUser(user, owner);
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
    }
  }

  private void validateAuthenticationContext(AuthenticationContext ctx) {
    if (ctx == null || ctx.getPrincipal() == null) {
      throw new AuthenticationException("No principal in AuthenticationContext");
    }
  }

  private User getUserFromAuthenticationContext(AuthenticationContext ctx) throws IOException, ParseException {
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(UserResource.ALLOWED_FIELDS, FIELDS_PARAM);
    return userRepository.getByName(null, userName, fields);
  }

  private void addOrUpdateUser(User user) {
    try {
      RestUtil.PutResponse<User> addedUser = userRepository.createOrUpdate(null, user);
      LOG.debug("Added user entry: {}", addedUser);
    } catch (IOException | ParseException exception) {
      // In HA set up the other server may have already added the user.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      LOG.debug("User entry: {} already exists.", user);
    }
  }
}
