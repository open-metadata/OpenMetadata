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

import static org.openmetadata.catalog.resources.teams.UserResource.FIELD_LIST;

import java.io.IOException;
import java.text.ParseException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.PolicyRepository;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.RestUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DefaultAuthorizer implements Authorizer {
  private static final Logger LOG = LoggerFactory.getLogger(DefaultAuthorizer.class);

  private Set<String> adminUsers;
  private Set<String> botUsers;

  private String principalDomain;
  private UserRepository userRepository;

  private PolicyEvaluator policyEvaluator;
  private static final String fieldsParam = "roles,teams";

  @Override
  public void init(AuthorizerConfiguration config, Jdbi dbi) throws IOException {
    LOG.debug("Initializing DefaultAuthorizer with config {}", config);
    this.adminUsers = new HashSet<>(config.getAdminPrincipals());
    this.botUsers = new HashSet<>(config.getBotPrincipals());
    this.principalDomain = config.getPrincipalDomain();
    LOG.debug("Admin users: {}", adminUsers);
    CollectionDAO collectionDAO = dbi.onDemand(CollectionDAO.class);
    this.userRepository = new UserRepository(collectionDAO);
    mayBeAddAdminUsers();
    mayBeAddBotUsers();
    policyEvaluator = PolicyEvaluator.getInstance();
    policyEvaluator.setPolicyRepository(new PolicyRepository(collectionDAO));
  }

  private void mayBeAddAdminUsers() {
    LOG.debug("Checking user entries for admin users");
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    for (String adminUser : adminUsers) {
      try {
        User user = userRepository.getByName(null, adminUser, fields);
        if (user != null && (user.getIsAdmin() == null || !user.getIsAdmin())) {
          user.setIsAdmin(true);
        }
        addOrUpdateAdmin(user);
      } catch (EntityNotFoundException ex) {
        User user =
            new User()
                .withId(UUID.randomUUID())
                .withName(adminUser)
                .withEmail(adminUser + "@" + principalDomain)
                .withIsAdmin(true)
                .withUpdatedBy(adminUser)
                .withUpdatedAt(System.currentTimeMillis());
        addOrUpdateAdmin(user);
      } catch (IOException | ParseException e) {
        LOG.error("Failed to create admin user {}", adminUser, e);
      }
    }
  }

  private void mayBeAddBotUsers() {
    LOG.debug("Checking user entries for bot users");
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    for (String botUser : botUsers) {
      try {
        User user = userRepository.getByName(null, botUser, fields);
        if (user != null && (user.getIsBot() == null || !user.getIsBot())) {
          user.setIsBot(true);
        }
        addOrUpdateAdmin(user);
      } catch (EntityNotFoundException ex) {
        User user =
            new User()
                .withId(UUID.randomUUID())
                .withName(botUser)
                .withEmail(botUser + "@" + principalDomain)
                .withIsBot(true)
                .withUpdatedBy(botUser)
                .withUpdatedAt(System.currentTimeMillis());
        addOrUpdateAdmin(user);
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
      Object entity = Entity.getEntity(entityReference, new EntityUtil.Fields(List.of("tags", "owner")));
      EntityReference owner = Entity.getEntityInterface(entity).getOwner();
      if (owner == null) {
        // Entity does not have an owner.
        return true;
      }
      User user = getUserFromAuthenticationContext(ctx);
      if (isOwnedByUser(user, owner)) {
        // Entity is owned by the user.
        return true;
      }
      return policyEvaluator.hasPermission(user, entity, operation);
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
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
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
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
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
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

  private void validateAuthenticationContext(AuthenticationContext ctx) {
    if (ctx == null || ctx.getPrincipal() == null) {
      throw new AuthenticationException("No principal in AuthenticationContext");
    }
  }

  private User getUserFromAuthenticationContext(AuthenticationContext ctx) throws IOException, ParseException {
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    return userRepository.getByName(null, userName, fields);
  }

  private void addOrUpdateAdmin(User user) {
    try {
      RestUtil.PutResponse<User> addedUser = userRepository.createOrUpdate(null, user);
      LOG.debug("Added admin user entry: {}", addedUser);
    } catch (IOException | ParseException exception) {
      // In HA set up the other server may have already added the user.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      LOG.debug("Admin user entry: {} already exists.", user);
    }
  }

  private void addOrUpdateBot(User user) {
    try {
      RestUtil.PutResponse<User> addedUser = userRepository.createOrUpdate(null, user);
      LOG.debug("Added bot user entry: {}", addedUser);
    } catch (IOException | ParseException exception) {
      // In HA se tup the other server may have already added the user.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      LOG.debug("Bot user entry: {} already exists.", user);
    }
  }
}
